# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — the ND UI Live Bridge node

Put it on the MODEL wire in front of the samplers. It hands the model on unchanged (a clone with a wrapper around the sampling), and
while the sampler works it sends a preview of what is being generated to the browser as an "ndui_live_frame" message. The Viewer widget
of ND UI that is bound to this node shows it. The node has no extra outputs.

  preview "first frame"  one picture of the first frame (a JPEG), every `interval` seconds
  preview "animated"     a short clip of the frames being made (an MP4, with the sound when there is one, else an animated WebP)

Models with sound (MiniMax H3 AV, LTX 2...) pack the picture and the sound into one tensor while they sample; the wrapper splits it
with the shapes ComfyUI hands to the sampler. The sound is decoded by the optional `audio_vae` input and is always in the clip: the Viewer
mutes / unmutes it. The clip has the fps of the node and the real duration of the video; the preview pictures are held on that time grid.

Frames are made only while a Viewer wants them: the browser marks the bridge in the queued prompt (`_meta.ndui_live`, and
`_meta.ndui_live_audio`, kept for old pages), which does not change the cache, so turning the eye or the sound of the Viewer on or off never
re-runs the sampling. Without the mark the wrapper does nothing. A preview never breaks a generation: any failure is one warning in the
log and the next step down (sound -> WebP -> JPEG -> rough colours).
"""

import base64
import io
import logging
import queue
import threading
import time

log = logging.getLogger("NeuralDreamerUI")

EVENT = "ndui_live_frame"
MODE_FIRST = "first frame"
MODE_ANIM = "animated"
MODES = [MODE_FIRST, MODE_ANIM]
TINY_BUILTIN = ["auto", "latent2rgb", "taesd"]   # "taesd" is the old value: the decoder of the model from models/vae_approx
WRAPPER_KEY = "ndui_live_bridge"
LIVE_TYPE = "NDUI_LIVE"   # the type of the `live` pin of the bridge and of the input of the ND UI Live Preview node
MAX_GRID = 1800       # the most frames of one clip on the time grid (held frames cost almost nothing in H.264)
COST_FACTOR = 3.0     # a frame may take at most about a quarter of the time of the sampler
MIN_INTERVAL = 0.12   # seconds: the shortest interval between two frames of one sampler
STEP_ARG = 5          # outer_sample(noise, latent_image, sampler, sigmas, denoise_mask, callback, ...): the place of the callback


def running_prompt(prompt_id):
    """The API prompt being executed (read from the queue), or None."""
    try:
        from server import PromptServer
        running = PromptServer.instance.prompt_queue.currently_running
        for item in list(running.values()):
            if isinstance(item, (list, tuple)) and len(item) > 2 and item[1] == prompt_id and isinstance(item[2], dict):
                return item[2]
    except Exception:  # noqa: BLE001
        pass
    return None


def executing():
    """(prompt_id, node_id) of the node running now, e.g. the sampler."""
    try:
        from comfy_execution.utils import get_executing_context
        ctx = get_executing_context()
        if ctx is not None:
            return str(ctx.prompt_id), str(ctx.node_id)
    except Exception:  # noqa: BLE001
        pass
    try:
        from server import PromptServer
        s = PromptServer.instance
        return str(s.last_prompt_id), str(s.last_node_id)
    except Exception:  # noqa: BLE001
        return None, None


def send(data):
    try:
        from server import PromptServer
        s = PromptServer.instance
        s.send_sync(EVENT, data, s.client_id)
    except Exception as e:  # noqa: BLE001
        log.debug(f"[ND UI Live] send failed: {e}")


def data_url(mime, raw):
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def to_jpeg(img, size):
    img = img.convert("RGB")
    if size and max(img.size) > size:
        img.thumbnail((size, size))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return data_url("image/jpeg", buf.getvalue())


def _pil(x):
    """a PIL image of a frame (H, W, C) in 0..1: a torch tensor or a numpy array"""
    import numpy as np
    from PIL import Image
    if hasattr(x, "detach"):
        a = (x.detach().float().clamp(0, 1) * 255).byte().cpu().numpy()
    else:
        a = (np.clip(np.asarray(x), 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(a[..., :3])


def fit(img, size):
    """a PIL image no bigger than `size`, with even sides (video codecs want that)"""
    img = img.convert("RGB")
    if size and max(img.size) > size:
        img.thumbnail((size, size))
    w, h = img.size
    w, h = max(2, w - w % 2), max(2, h - h % 2)
    return img if (w, h) == img.size else img.resize((w, h))


# ------------------------------------------------------------ the clip: MP4 (+ sound) or animated WebP

def encode_webp(frames, fps):
    buf = io.BytesIO()
    frames[0].save(buf, format="WEBP", save_all=True, append_images=frames[1:], duration=max(20, int(1000 / max(1.0, fps))), loop=0, quality=60)
    return buf.getvalue()


def _codec(av, names):
    for n in names:
        try:
            av.codec.Codec(n, "w")
            return n
        except Exception:  # noqa: BLE001
            continue
    return None


def encode_mp4(frames, fps, wave=None, rate=0):
    """frames: PIL images; wave: float32 numpy [channels, samples] in -1..1 (or None). Returns the bytes of an MP4 (H.264 + AAC)."""
    import av
    import numpy as np
    from fractions import Fraction
    name = _codec(av, ("libx264", "h264_nvenc", "libopenh264", "mpeg4"))
    if name is None:
        raise RuntimeError("no video encoder in this PyAV")
    buf = io.BytesIO()
    out = av.open(buf, mode="w", format="mp4")
    try:
        vs = out.add_stream(name, rate=Fraction(int(round(fps * 1000)), 1000))
        vs.width, vs.height = frames[0].size
        vs.pix_fmt = "yuv420p"
        if name == "libx264":
            vs.options = {"crf": "30", "preset": "ultrafast"}
        astream = None
        if wave is not None and rate > 0:
            astream = out.add_stream("aac", rate=int(rate))
            astream.layout = "mono" if wave.shape[0] == 1 else "stereo"
        for im in frames:
            vf = av.VideoFrame.from_ndarray(np.asarray(im.convert("RGB")), format="rgb24")
            for pkt in vs.encode(vf):
                out.mux(pkt)
        for pkt in vs.encode():
            out.mux(pkt)
        if astream is not None:
            ch = 1 if wave.shape[0] == 1 else 2
            data = np.ascontiguousarray(wave[:ch].astype(np.float32))
            n = data.shape[1]
            step = 1024
            pos = 0
            while pos < n:
                chunk = data[:, pos:pos + step]
                if chunk.shape[1] < step:
                    chunk = np.pad(chunk, ((0, 0), (0, step - chunk.shape[1])))
                af = av.AudioFrame.from_ndarray(np.ascontiguousarray(chunk), format="fltp", layout="mono" if ch == 1 else "stereo")
                af.sample_rate = int(rate)
                af.pts = pos
                for pkt in astream.encode(af):
                    out.mux(pkt)
                pos += step
            for pkt in astream.encode():
                out.mux(pkt)
    finally:
        out.close()
    return buf.getvalue()


class Encoder:
    """Makes the clips off the sampling thread: a queue of one, so a slow encoder drops the old job instead of slowing the sampler."""

    def __init__(self):
        self.q = queue.Queue(maxsize=1)
        self.thread = None
        self.lock = threading.Lock()

    def submit(self, job):
        with self.lock:
            if self.thread is None or not self.thread.is_alive():
                self.thread = threading.Thread(target=self.loop, name="ndui-live-encoder", daemon=True)
                self.thread.start()
        try:
            self.q.get_nowait()   # an older job that did not start yet is stale
        except queue.Empty:
            pass
        try:
            self.q.put_nowait(job)
        except queue.Full:
            pass

    def loop(self):
        while True:
            try:
                job = self.q.get(timeout=20)
            except queue.Empty:
                return   # restarts on the next job
            try:
                make_clip(job)
            except Exception as e:  # noqa: BLE001
                log.warning(f"[ND UI Live] a clip could not be made: {e!r}")


ENCODER = Encoder()


def on_grid(frames, count):
    """The preview frames put on the time grid of the real video: `count` frames, each preview frame is held until the next one.
    The clip keeps the real duration (count / fps) and the fps stays the one of the node."""
    k = len(frames)
    count = int(count)
    if k < 1 or count <= k:
        return list(frames)
    return [frames[min(k - 1, int(round(j * (k - 1) / max(1, count - 1))))] for j in range(count)]


def make_clip(job):
    """job: dict(meta, frames, fps, count, wave, rate, size). Sends the clip: MP4 with sound, else MP4, else WebP, else the first frame as a JPEG.
    The fps is always the one of the node; the duration is the real duration of the video (`count` frames), not the length of the sound."""
    meta, frames, fps, wave, rate = job["meta"], job["frames"], float(job["fps"]), job.get("wave"), job.get("rate", 0)
    fps = min(120.0, max(1.0, fps))
    count = int(job.get("count") or len(frames))
    count = max(len(frames), min(MAX_GRID, count))
    try:
        raw = encode_mp4(on_grid(frames, count), fps, wave, rate)
        send({**meta, "kind": "video", "mime": "video/mp4", "url": data_url("video/mp4", raw), "fps": round(fps, 2), "audio": wave is not None})
        return
    except Exception as e:  # noqa: BLE001
        log.warning(f"[ND UI Live] no MP4 ({e!r}); using an animated WebP without sound")
    try:
        raw = encode_webp(frames, len(frames) / max(0.05, count / fps))   # a frame per preview picture, the same total time
        send({**meta, "kind": "video", "mime": "image/webp", "url": data_url("image/webp", raw), "fps": round(fps, 2), "audio": False})
        return
    except Exception as e:  # noqa: BLE001
        log.warning(f"[ND UI Live] no animated WebP ({e!r}); using one picture")
    url = to_jpeg(frames[0], job.get("size", 384))
    send({**meta, "kind": "image", "mime": "image/jpeg", "url": url, "images": [url], "fps": 0, "audio": False})


# ------------------------------------------------------------ previewers

_LOADED = {}


def tiny_choices():
    """the values of the tiny_vae input: the built-in ones and the decoders in models/vae_approx"""
    out = list(TINY_BUILTIN)
    try:
        import folder_paths
        for f in folder_paths.get_filename_list("vae_approx"):
            if f not in out:
                out.append(f)
    except Exception:  # noqa: BLE001
        pass
    return out


def _load_decoder(file_name, fmt, device):
    """a previewer for a TAE file from models/vae_approx; None (with a warning) when it does not fit the model"""
    import latent_preview
    import folder_paths
    path = folder_paths.get_full_path("vae_approx", file_name)
    if not path:
        log.warning(f"[ND UI Live] {file_name} is not in models/vae_approx")
        return None
    channels = getattr(fmt, "latent_channels", 4)
    key = (path, channels)
    if key in _LOADED:
        return _LOADED[key]
    prev = None
    try:
        stem = file_name.split(".")[0]
        if any(stem.startswith(v) for v in getattr(latent_preview, "VIDEO_TAES", [])):
            import comfy.utils
            from comfy.sd import VAE
            taesd = VAE(comfy.utils.load_torch_file(path))
            taesd.first_stage_model.show_progress_bar = False
            prev = latent_preview.TAEHVPreviewerImpl(taesd, compile_preview=getattr(fmt, "compile_preview", False))
        else:
            import comfy.model_management
            from comfy.taesd.taesd import TAESD
            dev = comfy.model_management.get_torch_device()
            prev = latent_preview.TAESDPreviewerImpl(TAESD(None, path, latent_channels=channels).to(dev))
    except Exception as e:  # noqa: BLE001 - a decoder made for other latents fails here
        log.warning(f"[ND UI Live] {file_name} could not be used for this model ({e}); using latent2rgb")
    _LOADED[key] = prev
    return prev


class _light:
    """while it is on, the VAE asks for 64 MB of room (its weights), not for the whole decode: the model of the sampler stays where it is"""

    def __init__(self, vae):
        self.vae = vae

    def __enter__(self):
        self.old = self.vae.__dict__.get("memory_used_decode")
        if self.old is not None:
            self.vae.memory_used_decode = lambda *a, **k: 64 * 1024 * 1024
        return self

    def __exit__(self, *exc):
        if self.old is not None:
            self.vae.memory_used_decode = self.old
        return False


def make_previewer(base_model, choice):
    """A previewer for this model, independent of the preview setting of ComfyUI. choice: auto | latent2rgb | taesd | a file of models/vae_approx."""
    import latent_preview
    fmt = getattr(base_model, "latent_format", None)
    if fmt is None:
        return None
    if choice not in ("latent2rgb",):
        name = None
        if choice in ("auto", "taesd"):
            want = getattr(fmt, "taesd_decoder_name", None)
            if want:
                try:
                    import folder_paths
                    name = next((f for f in folder_paths.get_filename_list("vae_approx") if f.startswith(want)), None)
                except Exception:  # noqa: BLE001
                    name = None
                if name is None and choice == "taesd":
                    log.warning(f"[ND UI Live] TAESD not found in models/vae_approx/{want}; using latent2rgb")
        else:
            name = choice
        if name:
            prev = _load_decoder(name, fmt, None)
            if prev is not None:
                return prev
    if getattr(fmt, "latent_rgb_factors", None) is not None:
        return latent_preview.Latent2RGBPreviewer(fmt.latent_rgb_factors, getattr(fmt, "latent_rgb_factors_bias", None),
                                                  getattr(fmt, "latent_rgb_factors_reshape", None))
    return None


class GroupPreviewer:
    """For a model whose latents ComfyUI cannot preview: the channels are split into three groups, each group is a colour channel.
    Rough, but the picture takes shape in it, which is all a live preview is for."""

    def decode_latent_to_preview(self, x):
        import torch
        from PIL import Image
        t = x[0].float()
        if t.dim() == 4:  # (C, T, H, W): a video latent, the middle frame
            t = t[:, t.shape[1] // 2]
        c = t.shape[0]
        n = max(1, c // 3)
        chans = [t[i * n:(i + 1) * n].mean(0) for i in range(3)] if c >= 3 else [t.mean(0)] * 3
        img = torch.stack(chans)
        lo, hi = img.amin(dim=(1, 2), keepdim=True), img.amax(dim=(1, 2), keepdim=True)
        img = (img - lo) / (hi - lo).clamp(min=1e-6)
        arr = (img * 255).clamp(0, 255).byte().permute(1, 2, 0).cpu().numpy()
        return Image.fromarray(arr)


# ------------------------------------------------------------------ the wrapper

def split_streams(x0, shapes):
    """(video latent, audio latent or None) of what the sampler hands to the step callback"""
    if getattr(x0, "is_nested", False):
        ts = list(x0.tensors)
        return ts[0], (ts[-1] if len(ts) > 1 else None)
    if shapes and len(shapes) > 1 and getattr(x0, "ndim", 0) == 3:
        import comfy.utils
        parts = comfy.utils.unpack_latents(x0, shapes)
        return parts[0], parts[-1]
    return x0, None


def is_av(model):
    """models with a sound stream (core marks them by the model type)"""
    try:
        import comfy.model_base
        flow_av = getattr(comfy.model_base.ModelType, "FLOW_AV", None)
        return flow_av is not None and getattr(model, "model_type", None) == flow_av
    except Exception:  # noqa: BLE001
        return False


class LiveWrapper:
    """The OUTER_SAMPLE wrapper: puts a callback around the step callback of the sampler. The prediction is not touched."""

    def __init__(self, bridge_id, patcher, cfg, audio_vae=None):
        self.bridge_id = str(bridge_id)
        self.patcher = patcher
        self.cfg = cfg          # dict: tiny, size, mode, fps, interval, max_frames
        self.audio_vae = audio_vae
        self.previewers = {}
        self.wants = {}         # prompt id -> (picture wanted, sound wanted); None: unknown, then pictures are sent
        self.last = {}          # (prompt id, sampler id) -> time of the last frame
        self.cost = {}          # (prompt id, sampler id) -> seconds the last frame took: the next one waits for a few times that, so a preview never slows the sampler much
        self.said = set()

    # ---- what a Viewer wants
    def wanted(self, prompt_id):
        if prompt_id not in self.wants:
            if len(self.wants) > 32:
                self.wants.clear()
            prompt = running_prompt(prompt_id)
            node = prompt.get(self.bridge_id) if isinstance(prompt, dict) else None
            if isinstance(node, dict):
                meta = node.get("_meta") or {}
                self.wants[prompt_id] = (bool(meta.get("ndui_live")), bool(meta.get("ndui_live_audio")))
            else:
                self.wants[prompt_id] = (None, False)
        return self.wants[prompt_id]

    def say(self, key, text):
        """a warning once per kind: a silent preview is hard to diagnose"""
        if key not in self.said:
            self.said.add(key)
            log.warning(text)

    def previewer(self):
        base = getattr(self.patcher, "model", None)
        key = id(base)
        if key not in self.previewers:
            p = None
            try:
                p = make_previewer(base, self.cfg["tiny"])
            except Exception as e:  # noqa: BLE001
                self.say("prev", f"[ND UI Live] no previewer ({e!r}); using the rough preview")
            if p is None:
                self.say("nofactors", "[ND UI Live] ComfyUI has no preview colours for this model: using a rough channel preview instead")
                p = GroupPreviewer()
            self.previewers[key] = p
        return self.previewers[key]

    # ---- the wrapper itself
    def __call__(self, executor, *args, **kwargs):
        args = list(args)
        orig = args[STEP_ARG] if len(args) > STEP_ARG else kwargs.get("callback")
        shapes = kwargs.get("latent_shapes")
        run = Run(self, shapes)

        def callback(step, x0, x, total_steps):
            if orig is not None:
                orig(step, x0, x, total_steps)
            try:
                run.on_step(step, x0, total_steps)
            except Exception as e:  # noqa: BLE001 - a preview must never break the sampling
                self.say("fail", f"[ND UI Live] a frame could not be made: {e!r}")
                run.broken()

        if len(args) > STEP_ARG:
            args[STEP_ARG] = callback
        else:
            kwargs["callback"] = callback
        return executor(*args, **kwargs)


class Run:
    """The state of one sampling: the sampler id, the audio decoder, the last frame."""

    def __init__(self, w, shapes):
        self.w = w
        self.shapes = shapes
        self.sampler = None
        self.audio_ready = None   # None: not tried, False: off, True: ready
        self.audio_scale = 1.0
        self.rate = 0
        self.real = None

    def broken(self):
        # the next frames come from the rough preview
        base = getattr(self.w.patcher, "model", None)
        if not isinstance(self.w.previewers.get(id(base)), GroupPreviewer):
            self.w.previewers[id(base)] = GroupPreviewer()
        self.w.cfg = {**self.w.cfg, "mode": MODE_FIRST}

    def on_step(self, step, x0, total):
        w, cfg = self.w, self.w.cfg
        if x0 is None:
            return
        prompt_id, sampler = executing()
        want, _ = w.wanted(prompt_id)
        if want is False:
            return   # no Viewer wants frames from this bridge
        n = int(step) + 1
        total = int(total) if total else n
        now = time.monotonic()
        key = (prompt_id, sampler)
        last_step = n >= total
        gap = max(MIN_INTERVAL, float(cfg.get("interval", 1.0)), COST_FACTOR * w.cost.get(key, 0.0))
        if not last_step and now - w.last.get(key, 0) < gap:
            return
        w.last[key] = now
        try:
            self.make_frame(x0, total, n, prompt_id, sampler)
        finally:
            w.cost[key] = time.monotonic() - now

    def make_frame(self, x0, total, n, prompt_id, sampler):
        w, cfg = self.w, self.w.cfg
        video, audio = split_streams(x0, self.shapes)
        meta = {"bridge": w.bridge_id, "sampler": sampler, "prompt_id": prompt_id, "step": n, "steps": total}
        prev = w.previewer()
        if cfg.get("mode") == MODE_ANIM and getattr(video, "ndim", 0) == 5 and video.shape[2] > 1:
            frames = self.frames(prev, video, int(cfg.get("max_frames", 48)), int(cfg.get("size", 384)))
            wave, rate = None, 0
            fps = float(cfg.get("fps", 24))
            if w.audio_vae is not None and audio is not None:   # the sound is always made; the Viewer only mutes or unmutes it
                wave, rate = self.sound(audio)
            count = self.real or self.real_frames(int(video.shape[2]), fps, wave, rate)
            if len(frames) > 1:
                ENCODER.submit({"meta": meta, "frames": frames, "fps": fps, "count": count, "wave": wave, "rate": rate, "size": int(cfg.get("size", 384))})
                return
            if frames:
                url = to_jpeg(frames[0], int(cfg.get("size", 384)))
                send({**meta, "kind": "image", "mime": "image/jpeg", "url": url, "images": [url], "fps": 0, "audio": False})
                return
        # one picture: the first frame of the first sample
        img = prev.decode_latent_to_preview(video[0:1])
        url = to_jpeg(img, int(cfg.get("size", 384)))
        send({**meta, "kind": "image", "mime": "image/jpeg", "url": url, "images": [url], "fps": 0, "audio": False})

    def real_frames(self, t, fps, wave, rate):
        """how many frames the finished video has at the node fps: from the sound when there is one, else from the latent frames"""
        if wave is not None and rate > 0:
            return max(1, int(round(wave.shape[1] / float(rate) * fps)))
        scale = 8 if is_av(getattr(self.w.patcher, "model", None)) else 4
        try:
            lf = getattr(getattr(self.w.patcher, "model", None), "latent_format", None)
            scale = int(getattr(lf, "temporal_compression", None) or getattr(lf, "temporal_downscale", None) or scale)
        except Exception:  # noqa: BLE001
            pass
        return max(1, (int(t) - 1) * scale + 1)

    def full_video(self, prev, video, limit, size):
        """(frames, real count) from one decode of the whole latent with a video TAE: every frame of the video, as ComfyUI would decode it.
        None when the previewer is not a video TAE or the decode fails (then the frames come one latent frame at a time)."""
        taesd = getattr(prev, "taesd", None)
        if taesd is None or not type(prev).__name__.startswith("TAEHV") or self.w.cfg.get("full_decode") is False:
            return None
        try:
            # VAE.decode asks ComfyUI for room for the whole decode and pushes the model of the sampler out of the video memory (and brings it back
            # on the next step): a dip in the memory and a slow step. The decoder needs only its own weights loaded; if the activations do not fit,
            # VAE.decode itself falls back to tiles.
            with _light(taesd):
                out = taesd.decode(video[0:1])
            out = out[0]                      # (frames, H, W, C), 0..1
            p = int(out.shape[0])
            if p < 2:
                return None
            count = max(2, min(p, limit))
            idx = sorted({min(p - 1, int(round(i * (p - 1) / (count - 1)))) for i in range(count)})
            return [fit(_pil(out[i]), size) for i in idx], p
        except Exception as e:  # noqa: BLE001
            self.w.say("fulldecode", f"[ND UI Live] the whole video could not be decoded at once ({e!r}); using one latent frame at a time")
            self.w.cfg = {**self.w.cfg, "full_decode": False}
            return None

    def frames(self, prev, video, limit, size):
        """PIL frames: every real frame of the video (a video TAE decodes them all at once), else one for every latent frame
        (evenly spread when there are more than `limit`). self.real: how many frames the video has, when it is known."""
        self.real = None
        got = self.full_video(prev, video, limit, size)
        if got is not None:
            self.real = got[1]
            return got[0]
        t = int(video.shape[2])
        count = max(1, min(t, limit))
        idx = sorted({min(t - 1, round(i * (t - 1) / max(1, count - 1))) for i in range(count)}) if count > 1 else [0]
        out = []
        for i in idx:
            out.append(fit(prev.decode_latent_to_preview(video[0:1, :, i:i + 1]), size))
        return out

    def sound(self, audio_latent):
        """(wave [channels, samples] float32, rate) of the audio latent; (None, 0) when the sound cannot be made"""
        w = self.w
        if self.audio_ready is None:
            self.audio_ready = False
            try:
                import comfy.model_management
                av_vae = w.audio_vae
                scale = getattr(w.patcher.get_model_object("model_sampling"), "audio_scale", None)
                rate = int(getattr(av_vae, "audio_sample_rate_output", None) or getattr(av_vae, "audio_sample_rate", 0) or 0)
                if scale is None or rate <= 0:
                    w.say("noaudio", "[ND UI Live] the model or the audio VAE has no audio scale / sample rate: no sound in the preview")
                else:
                    comfy.model_management.load_models_gpu(
                        [av_vae.patcher], memory_required=64 * 1024 * 1024,   # its weights only: the model of the sampler must not be pushed out
                        force_full_load=getattr(av_vae, "disable_offload", False))
                    self.audio_scale, self.rate, self.audio_ready = float(scale), rate, True
            except Exception as e:  # noqa: BLE001
                w.say("noaudio", f"[ND UI Live] the audio VAE could not be prepared ({e!r}): no sound in the preview")
        if not self.audio_ready:
            return None, 0
        try:
            import torch
            av_vae = w.audio_vae
            z = (audio_latent / self.audio_scale).to(device=av_vae.device, dtype=av_vae.vae_dtype)
            wave = av_vae.process_output(av_vae.first_stage_model.decode(z))
            wave = wave[:1].float().cpu()
            std = torch.std(wave, dim=[1, 2], keepdim=True) * 5.0
            std[std < 1.0] = 1.0
            return (wave / std)[0].clamp_(-1, 1).numpy(), self.rate
        except Exception as e:  # noqa: BLE001
            w.say("audiofail", f"[ND UI Live] the sound of a frame could not be decoded ({e!r}): no sound in the preview")
            self.audio_ready = False
            return None, 0


# ------------------------------------------------------------------ node

class NDUILiveBridge:
    CATEGORY = "Neural Dreamer/UI"
    DESCRIPTION = (
        "Put it on the MODEL wire in front of the samplers. While they run, it sends a live preview (a picture, or a short clip with sound) "
        "to the Viewer widget of ND UI that is bound to this node. The model passes through unchanged."
    )
    RETURN_TYPES = ("MODEL", LIVE_TYPE)
    RETURN_NAMES = ("model", "live")
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "tiny_vae": (tiny_choices(), {"default": "auto", "tooltip": "The small decoder for the preview. auto: the one of the model from models/vae_approx if there is one, else fast rough colours. latent2rgb: fast, rough. taesd: the old name of auto. Or a file of models/vae_approx."}),
                "size": ("INT", {"default": 384, "min": 64, "max": 1024, "step": 32, "tooltip": "Longer side of the preview, in pixels."}),
                "preview": (MODES, {"default": MODE_FIRST, "tooltip": "first frame: one picture. animated: a short clip of the frames being made (with the sound when an audio VAE is connected and a Viewer plays it)."}),
                "fps": ("INT", {"default": 24, "min": 1, "max": 60, "tooltip": "Frames per second of the clip when there is no sound. With sound the clip is as long as the sound."}),
                "interval": ("FLOAT", {"default": 1.0, "min": 0.12, "max": 30.0, "step": 0.1, "tooltip": "Seconds between two previews. The last step is always sent."}),
                "max_frames": ("INT", {"default": 48, "min": 2, "max": 1024, "tooltip": "At most this many frames in a clip (spread evenly)."}),
            },
            "optional": {
                "audio_vae": ("VAE", {"tooltip": "The audio VAE of the model (models with sound). Only then the sound can be heard in the preview."}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    def run(self, model, tiny_vae="auto", size=384, preview=MODE_FIRST, fps=24, interval=1.0, max_frames=48, audio_vae=None, unique_id=None, method=None):
        m = model.clone()
        choice = tiny_vae or method or "auto"
        cfg = {"tiny": choice, "size": int(size), "mode": preview if preview in MODES else MODE_FIRST, "fps": int(fps), "interval": float(interval), "max_frames": int(max_frames)}
        wrapper = LiveWrapper(unique_id, m, cfg, audio_vae)
        import comfy.patcher_extension
        m.add_wrapper_with_key(comfy.patcher_extension.WrappersMP.OUTER_SAMPLE, f"{WRAPPER_KEY}_{unique_id}", wrapper)
        return (m, None)   # `live` carries nothing: it only tells an ND UI Live Preview node which bridge to show


class NDUILivePreview:
    """A node that shows the live preview of an ND UI Live Bridge (a picture or a clip, with the sound and the volume). One input, no parameters:
    everything else is set on the bridge. The picture is drawn by the browser (js/ndui_live_preview.js)."""
    CATEGORY = "Neural Dreamer/UI"
    DESCRIPTION = "Shows the live preview of an ND UI Live Bridge in the node: the frames of the sampler while it works, with the sound and the volume. Connect the `live` pin of the bridge."
    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"live": (LIVE_TYPE, {"tooltip": "The `live` pin of an ND UI Live Bridge."})}}

    def run(self, live=None):
        return ()


NODE_CLASS_MAPPINGS = {"NDUILiveBridge": NDUILiveBridge, "NDUILivePreview": NDUILivePreview}
NODE_DISPLAY_NAME_MAPPINGS = {"NDUILiveBridge": "ND UI Live Bridge", "NDUILivePreview": "ND UI Live Preview"}
