# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — the NDLoadVideo and NDLoadAudio nodes

Load a video (or only the sound) from the ComfyUI input folder, cut a segment, pick the frame rate, crop, fit to a size.
Everything the user sets lives in the hidden text widget `settings` (JSON), which the node's own view and the ND UI widgets edit:

    video:  {"start": 0.0, "end": 0.0, "fps": 0, "max_frames": 0, "crop": null, "fit": "crop", "pad_color": "#000000",
             "scale": "lanczos", "audio": true, "rotate_auto": true}
    audio:  {"start": 0.0, "end": 0.0, "sample_rate": 0, "mono": false, "gain_db": 0}

    start / end   the segment in seconds (end 0 = to the end of the file)
    fps           0: all frames as they are; a number: the frames are taken by time (the nearest frame to each start + k / fps), no
                  blending, so it works for variable frame rate files too
    max_frames    0: no limit
    crop          null or [x, y, w, h] in 0..1, in the coordinates of the picture AFTER the rotation from the metadata
    memory_gb     limit of the RAM for the decoded frames: 0 = automatic (70 % of the free RAM), a number = that many GB, -1 = no limit
    fit           crop | pad color | pad edge | pad edge color | stretch | original (the width/height inputs; 0 = as the source)
    rotate_auto   turn the picture by the rotation stored in the file (phones), as the players do

The order is always: segment -> frame rate -> rotation -> crop -> fit. The sound of NDLoadVideo is the same segment (silence when the
file has no sound). Decoding is done with PyAV (it comes with ComfyUI); the core works on numpy, torch is used only for the outputs.
"""

import hashlib
import json
import logging
import math
import os

CATEGORY = "Neural Dreamer/Loaders"

VIDEO_EXT = (".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".gif", ".mpg", ".mpeg", ".ts", ".wmv", ".flv", ".3gp")
AUDIO_EXT = (".mp3", ".wav", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wma", ".aif", ".aiff")
FIT_MODES = ["crop", "pad color", "pad edge", "pad edge color", "stretch", "original"]
SCALE_METHODS = ["lanczos", "bicubic", "bilinear", "area", "nearest"]
FALLBACK_LIMIT = 6 * 1024 ** 3  # bytes, when the free memory of the computer cannot be read
AUTO_SHARE = 0.7                # automatic limit: this share of the memory that is free now

VIDEO_DEFAULTS = {
    "start": 0.0, "end": 0.0, "fps": 0, "max_frames": 0, "crop": None, "fit": "crop", "pad_color": "#000000",
    "scale": "lanczos", "audio": True, "rotate_auto": True, "memory_gb": 0,
}
AUDIO_DEFAULTS = {"start": 0.0, "end": 0.0, "sample_rate": 0, "mono": False, "gain_db": 0.0}


class MediaLoadError(ValueError):
    pass


# ------------------------------------------------------------------ settings

def _num(v, default, lo=None, hi=None):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return default
    if n != n or abs(n) == float("inf"):
        return default
    if lo is not None:
        n = max(lo, n)
    if hi is not None:
        n = min(hi, n)
    return n


def _color(v, default="#000000"):
    s = str(v or "").strip()
    if len(s) == 4 and s[0] == "#":
        s = "#" + "".join(c * 2 for c in s[1:])
    try:
        if len(s) == 7 and s[0] == "#":
            int(s[1:], 16)
            return s.lower()
    except ValueError:
        pass
    return default


def _load_json(text, who):
    if text is None or not str(text).strip():
        return {}
    try:
        data = json.loads(text)
    except Exception as e:  # noqa: BLE001
        raise MediaLoadError(f"[{who}] the settings are not valid JSON: {e}") from None
    if not isinstance(data, dict):
        raise MediaLoadError(f"[{who}] the settings must be an object")
    return data


def _crop(v):
    if v in (None, "", False):
        return None
    if not isinstance(v, (list, tuple)) or len(v) != 4:
        raise MediaLoadError("[ND Load Video] crop must be [x, y, w, h] in the range 0..1")
    x, y, w, h = (_num(c, None) for c in v)
    if None in (x, y, w, h):
        raise MediaLoadError("[ND Load Video] crop must be four numbers")
    x, y = min(max(x, 0.0), 1.0), min(max(y, 0.0), 1.0)
    w, h = min(max(w, 0.0), 1.0 - x), min(max(h, 0.0), 1.0 - y)
    if w <= 0.0005 or h <= 0.0005:
        raise MediaLoadError("[ND Load Video] the crop is empty")
    if x <= 0.0005 and y <= 0.0005 and w >= 0.999 and h >= 0.999:
        return None  # the whole picture
    return [x, y, w, h]


def parse_video_settings(text):
    d = _load_json(text, "ND Load Video")
    s = dict(VIDEO_DEFAULTS)
    s["start"] = _num(d.get("start"), 0.0, 0.0)
    s["end"] = _num(d.get("end"), 0.0, 0.0)
    if s["end"] and s["end"] <= s["start"]:
        raise MediaLoadError(f"[ND Load Video] the end of the segment ({s['end']:g} s) must be after its start ({s['start']:g} s)")
    s["fps"] = _num(d.get("fps"), 0, 0, 240)
    s["max_frames"] = int(_num(d.get("max_frames"), 0, 0))
    s["crop"] = _crop(d.get("crop"))
    fit = str(d.get("fit") or "crop")
    if fit in ("pad white", "pad black"):  # the names of ND Load Images
        d["pad_color"] = "#ffffff" if fit == "pad white" else "#000000"
        fit = "pad color"
    s["fit"] = fit if fit in FIT_MODES else "crop"
    s["pad_color"] = _color(d.get("pad_color"))
    s["scale"] = d.get("scale") if d.get("scale") in SCALE_METHODS else "lanczos"
    s["audio"] = bool(d.get("audio", True))
    s["rotate_auto"] = bool(d.get("rotate_auto", True))
    s["memory_gb"] = _num(d.get("memory_gb"), 0, -1, 4096)
    return s


def parse_audio_settings(text):
    d = _load_json(text, "ND Load Audio")
    s = dict(AUDIO_DEFAULTS)
    s["start"] = _num(d.get("start"), 0.0, 0.0)
    s["end"] = _num(d.get("end"), 0.0, 0.0)
    if s["end"] and s["end"] <= s["start"]:
        raise MediaLoadError(f"[ND Load Audio] the end of the segment ({s['end']:g} s) must be after its start ({s['start']:g} s)")
    s["sample_rate"] = int(_num(d.get("sample_rate"), 0, 0, 384000))
    s["mono"] = bool(d.get("mono", False))
    s["gain_db"] = _num(d.get("gain_db"), 0.0, -60.0, 60.0)
    return s


# ------------------------------------------------------------------ sizes

def target_size(cw, ch, width, height, multiple_of, fit):
    """The size of the result for a picture cw x ch. width/height 0 = free; `original` keeps the proportions inside the box."""
    width, height, m = int(width or 0), int(height or 0), max(1, int(multiple_of or 1))
    if not width and not height:
        tw, th = cw, ch
    elif not height:
        tw, th = width, round(ch * width / cw)
    elif not width:
        tw, th = round(cw * height / ch), height
    elif fit == "original":
        s = min(width / cw, height / ch)
        tw, th = round(cw * s), round(ch * s)
    else:
        tw, th = width, height
    if m > 1:
        tw, th = max(m, math.floor(tw / m + 0.5) * m), max(m, math.floor(th / m + 0.5) * m)
    return max(1, int(tw)), max(1, int(th))


def crop_rect(w, h, crop):
    """Pixel rectangle (x0, y0, x1, y1) of a normalized crop, at least 1 px."""
    if not crop:
        return 0, 0, w, h
    x0, y0 = min(w - 1, round(crop[0] * w)), min(h - 1, round(crop[1] * h))
    x1, y1 = max(x0 + 1, min(w, round((crop[0] + crop[2]) * w))), max(y0 + 1, min(h, round((crop[1] + crop[3]) * h)))
    return int(x0), int(y0), int(x1), int(y1)


def estimate_bytes(n, w, h):
    return int(n) * int(w) * int(h) * 3 * 4


def ram():
    """(free, total) bytes of the working memory (RAM) of the computer, or (0, 0) when it cannot be read."""
    try:
        import psutil

        v = psutil.virtual_memory()
        return int(v.available), int(v.total)
    except Exception:  # noqa: BLE001
        return 0, 0


def memory_limit(gb=0):
    """Bytes the decoded frames may take in RAM. gb > 0: that many; 0: automatic (70 % of the free RAM, 6 GB when unknown); < 0: no limit."""
    if gb < 0:
        return float("inf")
    if gb > 0:
        return gb * 1024 ** 3
    free, _ = ram()
    return int(free * AUTO_SHARE) if free else FALLBACK_LIMIT


def check_memory(n, w, h, who="ND Load Video", gb=0):
    """The frames come out as float32 [N,H,W,3] in the RAM (not in the video memory): stop early with a clear message instead of freezing the computer."""
    need, limit = estimate_bytes(n, w, h), memory_limit(gb)
    if need > limit:
        free, _ = ram()
        raise MediaLoadError(
            f"[{who}] {n} frames of {w}x{h} would take about {need / 1024 ** 3:.1f} GB of RAM (the limit is {limit / 1024 ** 3:.1f} GB"
            + (f": 70% of the {free / 1024 ** 3:.1f} GB free now" if gb == 0 and free else "")
            + "). Cut a shorter segment, lower the frame rate, set max_frames, choose a smaller size, or raise the limit in the settings (Memory limit, 0 = automatic, -1 = off)."
        )


# ------------------------------------------------------------------ pictures (numpy, uint8 RGB)

def _pil_method(name):
    from PIL import Image

    r = getattr(Image, "Resampling", Image)
    return {"lanczos": r.LANCZOS, "bicubic": r.BICUBIC, "bilinear": r.BILINEAR, "area": r.BOX, "nearest": r.NEAREST}.get(name, r.LANCZOS)


def resize(a, w, h, method="lanczos"):
    if a.shape[1] == w and a.shape[0] == h:
        return a
    import numpy as np
    from PIL import Image

    return np.asarray(Image.fromarray(a).resize((w, h), _pil_method(method)))


def rotate(a, degrees):
    """Turn the picture by the display rotation (degrees counterclockwise, as in the display matrix of the file)."""
    import numpy as np

    k = int(round(degrees / 90.0)) % 4
    return np.ascontiguousarray(np.rot90(a, k)) if k else a


def _edge_color_pad(a, pad):
    import numpy as np

    left, right, top, bottom = pad
    h, w, c = a.shape
    out = np.zeros((h + top + bottom, w + left + right, c), np.uint8)
    if left:
        out[:, :left] = a[:, 0].mean(axis=0).round().astype(np.uint8)
    if right:
        out[:, left + w:] = a[:, -1].mean(axis=0).round().astype(np.uint8)
    if top:
        out[:top] = a[0].mean(axis=0).round().astype(np.uint8)
    if bottom:
        out[top + h:] = a[-1].mean(axis=0).round().astype(np.uint8)
    out[top:top + h, left:left + w] = a
    return out


def fit_picture(a, tw, th, mode, method="lanczos", pad_color="#000000"):
    """Fit one uint8 RGB picture to tw x th. The modes work as in ND Load Images; `original` only scales to the box."""
    import numpy as np

    h, w = a.shape[:2]
    if mode == "original":
        return resize(a, tw, th, method)
    if mode == "stretch":
        return resize(a, tw, th, method)
    if mode == "crop":
        s = max(tw / w, th / h)
        nw, nh = max(tw, round(w * s)), max(th, round(h * s))
        a = resize(a, nw, nh, method)
        x0, y0 = (nw - tw) // 2, (nh - th) // 2
        return np.ascontiguousarray(a[y0:y0 + th, x0:x0 + tw])
    s = min(tw / w, th / h)
    nw, nh = max(1, min(tw, round(w * s))), max(1, min(th, round(h * s)))
    a = resize(a, nw, nh, method)
    left, top = (tw - nw) // 2, (th - nh) // 2
    pad = (left, tw - nw - left, top, th - nh - top)
    if mode == "pad edge color":
        return _edge_color_pad(a, pad)
    if mode == "pad edge":
        return np.pad(a, ((pad[2], pad[3]), (pad[0], pad[1]), (0, 0)), mode="edge")
    col = np.array([int(pad_color[i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
    out = np.empty((th, tw, 3), np.uint8)
    out[:] = col
    out[top:top + nh, left:left + nw] = a
    return out


# ------------------------------------------------------------------ decoding (PyAV)

class PyAVBackend:
    """The only place that talks to PyAV; the tests replace it with a fake one."""

    def _open(self, path):
        import av

        try:
            return av.open(path)
        except Exception as e:  # noqa: BLE001
            raise MediaLoadError(f"[ND Load] cannot open {os.path.basename(path)}: {e}") from None

    @staticmethod
    def _rotation(stream, frame=None):
        """Degrees counterclockwise to apply for display (the display matrix); the old `rotate` tag is clockwise."""
        r = getattr(frame, "rotation", None) if frame is not None else None
        if r:
            return float(r)
        try:
            tag = stream.metadata.get("rotate")
            if tag not in (None, ""):
                return -float(tag)
        except Exception:  # noqa: BLE001
            pass
        return 0.0

    def probe(self, path):
        c = self._open(path)
        try:
            info = {"duration": 0.0, "width": 0, "height": 0, "display_w": 0, "display_h": 0, "rotation": 0, "fps": 0.0,
                    "frames": 0, "has_audio": False, "audio_rate": 0, "audio_channels": 0, "codec": ""}
            if c.duration:
                info["duration"] = c.duration / 1_000_000.0
            v = next(iter(c.streams.video), None)
            if v is not None:
                info["width"], info["height"] = int(v.codec_context.width), int(v.codec_context.height)
                rate = v.average_rate or v.guessed_rate
                info["fps"] = float(rate) if rate else 0.0
                info["codec"] = v.codec_context.name or ""
                if v.frames:
                    info["frames"] = int(v.frames)
                rot = 0.0
                try:
                    for f in c.decode(v):
                        rot = self._rotation(v, f)
                        break
                except Exception:  # noqa: BLE001
                    rot = self._rotation(v)
                info["rotation"] = int(round(rot / 90.0) * 90) % 360 if rot else 0
                if info["rotation"] in (90, 270):
                    info["display_w"], info["display_h"] = info["height"], info["width"]
                else:
                    info["display_w"], info["display_h"] = info["width"], info["height"]
                if v.duration and v.time_base and not info["duration"]:
                    info["duration"] = float(v.duration * v.time_base)
                if not info["frames"] and info["fps"] and info["duration"]:
                    info["frames"] = int(round(info["fps"] * info["duration"]))
            a = next(iter(c.streams.audio), None)
            if a is not None:
                info["has_audio"] = True
                info["audio_rate"] = int(a.codec_context.sample_rate or 0)
                info["audio_channels"] = int(a.codec_context.channels if hasattr(a.codec_context, "channels") else len(a.layout.channels))
                if not v and not info["codec"]:
                    info["codec"] = a.codec_context.name or ""
                if not info["duration"] and a.duration and a.time_base:
                    info["duration"] = float(a.duration * a.time_base)
            return info
        finally:
            c.close()

    def video_frames(self, path, start):
        """Yield (seconds, rgb uint8 [H,W,3], rotation) from the keyframe before `start` on; the caller decides what to keep."""
        c = self._open(path)
        try:
            v = next(iter(c.streams.video), None)
            if v is None:
                raise MediaLoadError(f"[ND Load Video] {os.path.basename(path)} has no video stream")
            v.thread_type = "AUTO"
            if start > 0:
                try:
                    c.seek(int(start / float(v.time_base)), stream=v, backward=True, any_frame=False)
                except Exception:  # noqa: BLE001
                    c.seek(0)
            for f in c.decode(v):
                if f.pts is None:
                    continue
                t = float(f.pts * v.time_base)
                yield t, self._rgb(f), self._rotation(v, f)
        finally:
            c.close()

    @staticmethod
    def _rgb(frame):
        kw = {}
        try:  # HD files are BT.709, swscale assumes BT.601 for untagged ones
            if frame.height >= 720 and not frame.colorspace:
                import av.video.reformatter as r

                kw["src_colorspace"] = r.Colorspace.ITU709
        except Exception:  # noqa: BLE001
            kw = {}
        return frame.to_ndarray(format="rgb24", **kw)

    def audio_samples(self, path, start, end):
        """(float32 [C,S] of the segment start..end seconds (end 0: to the end), sample rate) or (None, 0) without sound."""
        import av
        import numpy as np

        c = self._open(path)
        try:
            a = next(iter(c.streams.audio), None)
            if a is None:
                return None, 0
            rate = int(a.codec_context.sample_rate)
            if start > 0:
                try:
                    c.seek(int(start / float(a.time_base)), stream=a, backward=True)
                except Exception:  # noqa: BLE001
                    c.seek(0)
            res = av.AudioResampler(format="fltp", layout=a.layout.name, rate=rate)
            chunks, first, got = [], None, 0
            stop = int(round(end * rate)) if end else None
            for f in c.decode(a):
                if first is None:
                    t0 = float(f.pts * a.time_base) if f.pts is not None else 0.0
                    first = int(round(t0 * rate))
                for r in res.resample(f):
                    arr = r.to_ndarray()
                    chunks.append(arr)
                    got += arr.shape[1]
                if stop is not None and first + got >= stop:
                    break
            if first is None:
                return np.zeros((1, 0), np.float32), rate
            data = np.concatenate(chunks, axis=1) if chunks else np.zeros((1, 0), np.float32)
            lo = max(0, int(round(start * rate)) - first)
            hi = data.shape[1] if stop is None else max(lo, min(data.shape[1], stop - first))
            return np.ascontiguousarray(data[:, lo:hi].astype(np.float32)), rate
        finally:
            c.close()


_backend = PyAVBackend()


def set_backend(b):
    """For the tests."""
    global _backend
    old, _backend = _backend, b
    return old


# ------------------------------------------------------------------ loading

def pick_frames(frames, start, end, fps, max_frames, src_fps):
    """
    Choose the frames of the segment. `frames` yields (seconds, picture, rotation) in order of time.
    fps 0: every frame with start <= t < end;  fps > 0: for each start + k / fps the nearest frame (no blending).
    Returns ([(picture, rotation)], the frame rate of the result).
    """
    out, step = [], None
    eps = 1e-6
    if not fps:
        out_fps = src_fps or 0.0
        for t, pic, rot in frames:
            if t < start - eps:
                continue
            if end and t >= end - eps:
                break
            out.append((pic, rot))
            if max_frames and len(out) >= max_frames:
                break
        return out, out_fps
    step = 1.0 / fps
    k, prev, last_t = 0, None, None
    gap = 1.0 / src_fps if src_fps else step
    for t, pic, rot in frames:
        last_t = t
        while True:
            if max_frames and len(out) >= max_frames:
                return out, fps
            target = start + k * step
            if end and target >= end - eps:
                return out, fps
            if target > t + eps:
                break  # this frame is before the target: wait for the next one
            if prev is None or (target - prev[0]) > (t - target):
                out.append((pic, rot))
            else:
                out.append((prev[1], prev[2]))
            k += 1
        prev = (t, pic, rot)
    # after the last frame: the targets inside its duration still take it
    while prev is not None:
        target = start + k * step
        if (max_frames and len(out) >= max_frames) or (end and target >= end - eps) or target > last_t + gap - eps:
            break
        out.append((prev[1], prev[2]))
        k += 1
    return out, fps


def process_picture(pic, rot, st, cw_ch, tw_th):
    """rotation -> crop -> fit for one picture (cw_ch: size after rotation and crop, tw_th: final size)."""
    if st["rotate_auto"] and rot:
        pic = rotate(pic, rot)
    x0, y0, x1, y1 = crop_rect(pic.shape[1], pic.shape[0], st["crop"])
    if (x0, y0, x1, y1) != (0, 0, pic.shape[1], pic.shape[0]):
        pic = pic[y0:y1, x0:x1]
    return fit_picture(pic, tw_th[0], tw_th[1], st["fit"], st["scale"], st["pad_color"])


def load_video(path, settings, width=0, height=0, multiple_of=1, backend=None):
    """-> dict(images uint8 [N,H,W,3], audio (float32 [C,S], rate) | None, fps, frame_count, width, height)"""
    import numpy as np

    be = backend or _backend
    st = settings if isinstance(settings, dict) else parse_video_settings(settings)
    info = be.probe(path)
    dur = info["duration"]
    start = st["start"]
    if dur and start >= dur:
        raise MediaLoadError(f"[ND Load Video] the segment starts at {start:g} s but the file is only {dur:.2f} s long")
    end = min(st["end"], dur) if (st["end"] and dur) else st["end"]
    src_fps = info["fps"] or 0.0
    rot_deg = info["rotation"] if st["rotate_auto"] else 0
    dw, dh = (info["height"], info["width"]) if rot_deg in (90, 270) else (info["width"], info["height"])
    x0, y0, x1, y1 = crop_rect(dw, dh, st["crop"])
    tw, th = target_size(x1 - x0, y1 - y0, width, height, multiple_of, st["fit"])
    # a guess of the number of frames before the heavy work
    seg = (end or dur or 0) - start
    out_rate = st["fps"] or src_fps
    guess = int(math.ceil(seg * out_rate)) if seg > 0 and out_rate else (info["frames"] or 1)
    if st["max_frames"]:
        guess = min(guess, st["max_frames"])
    check_memory(max(guess, 1), tw, th, gb=st['memory_gb'])

    picked, fps = pick_frames(be.video_frames(path, start), start, end, st["fps"], st["max_frames"], src_fps)
    if not picked:
        raise MediaLoadError("[ND Load Video] no frames in the chosen segment")
    out = np.empty((len(picked), th, tw, 3), np.uint8)
    for i, (pic, rot) in enumerate(picked):
        out[i] = process_picture(pic, rot, st, (x1 - x0, y1 - y0), (tw, th))
    picked = None

    audio = None
    if st["audio"]:
        a_end = start + len(out) / fps if fps else end
        if end and a_end:
            a_end = min(a_end, end)
        try:
            wave, rate = be.audio_samples(path, start, a_end or 0)
        except MediaLoadError:
            raise
        except Exception as e:  # noqa: BLE001
            logging.warning("[ComfyUI ND UI Builder] audio of %s could not be read: %s", os.path.basename(path), e)
            wave, rate = None, 0
        if wave is None:  # no sound track: silence of the same length
            rate = 44100
            wave = np.zeros((1, int(round(len(out) / fps * rate)) if fps else 0), np.float32)
        audio = (wave, rate)
    return {"images": out, "audio": audio, "fps": float(fps), "frame_count": int(len(out)), "width": int(tw), "height": int(th)}


def resample_audio(wave, rate, new_rate):
    """Linear-phase resampling by PyAV when it is there (float32 [C,S] -> [C,S'])."""
    import numpy as np

    if not new_rate or new_rate == rate or wave.shape[1] == 0:
        return wave, rate
    import av

    layout = "mono" if wave.shape[0] == 1 else "stereo" if wave.shape[0] == 2 else None
    if layout is None:
        raise MediaLoadError(f"[ND Load Audio] cannot change the sample rate of {wave.shape[0]} channels")
    res = av.AudioResampler(format="fltp", layout=layout, rate=new_rate)
    frame = av.AudioFrame.from_ndarray(np.ascontiguousarray(wave), format="fltp", layout=layout)
    frame.sample_rate = rate
    parts = [f.to_ndarray() for f in res.resample(frame)] + [f.to_ndarray() for f in (res.resample(None) or [])]
    return np.ascontiguousarray(np.concatenate(parts, axis=1).astype(np.float32)), new_rate


def load_audio(path, settings, backend=None):
    """-> dict(audio (float32 [C,S], rate), duration seconds, sample_rate)"""
    import numpy as np

    be = backend or _backend
    st = settings if isinstance(settings, dict) else parse_audio_settings(settings)
    wave, rate = be.audio_samples(path, st["start"], st["end"])
    if wave is None:
        raise MediaLoadError(f"[ND Load Audio] {os.path.basename(path)} has no sound")
    if wave.shape[1] == 0:
        raise MediaLoadError("[ND Load Audio] no sound in the chosen segment")
    if st["mono"] and wave.shape[0] > 1:
        wave = wave.mean(axis=0, keepdims=True)
    wave, rate = resample_audio(wave, rate, st["sample_rate"])
    if st["gain_db"]:
        wave = wave * np.float32(10 ** (st["gain_db"] / 20.0))
    return {"audio": (np.ascontiguousarray(wave, dtype=np.float32), rate), "duration": wave.shape[1] / float(rate), "sample_rate": int(rate)}


# ------------------------------------------------------------------ files of the input folder

def _input_dir():
    import folder_paths

    return folder_paths.get_input_directory()


def input_path(name, exts, kind="media"):
    """The file for a name in the input folder (sub-folders allowed, nothing outside it); None when it is not there."""
    name = str(name or "").strip().replace("\\", "/")
    if not name or name.startswith("/") or ".." in name.split("/"):
        return None
    if not name.lower().endswith(exts):
        return None
    base = os.path.realpath(_input_dir())
    p = os.path.realpath(os.path.join(base, name))
    if not (p == base or p.startswith(base + os.sep)) or not os.path.isfile(p):
        return None
    return p


def list_input(exts, limit=2000):
    base = _input_dir()
    out = []
    for root, dirs, files in os.walk(base):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for f in sorted(files):
            if f.lower().endswith(exts):
                out.append(os.path.relpath(os.path.join(root, f), base).replace(os.sep, "/"))
                if len(out) >= limit:
                    return out
    return out


_info_cache = {}


def media_info(path, backend=None):
    key = (path, os.path.getmtime(path))
    if backend is None and key in _info_cache:
        return _info_cache[key]
    info = (backend or _backend).probe(path)
    if backend is None:
        if len(_info_cache) > 200:
            _info_cache.clear()
        _info_cache[key] = info
    return info


# ------------------------------------------------------------------ nodes

def _to_images(arr):
    import torch

    return torch.from_numpy(arr).to(torch.float32).div_(255.0)


def _to_audio(pair):
    import torch

    wave, rate = pair
    return {"waveform": torch.from_numpy(wave).unsqueeze(0).contiguous(), "sample_rate": int(rate)}


def _file_hash(path, extra):
    h = hashlib.sha1(str(extra).encode("utf-8"))
    try:
        st = os.stat(path)
        h.update(f"{st.st_mtime_ns}:{st.st_size}".encode())
    except OSError:
        h.update(b"missing")
    return h.hexdigest()


class NDLoadVideo:
    DESCRIPTION = (
        "Loads a video from the input folder: cut a segment, set the frame rate, crop, fit to a size. The sound of the same segment "
        "comes out as AUDIO. The settings are edited in the node view or in the ND UI widget."
    )
    CATEGORY = CATEGORY
    FUNCTION = "load"
    RETURN_TYPES = ("IMAGE", "AUDIO", "FLOAT", "INT", "INT", "INT")
    RETURN_NAMES = ("images", "audio", "fps", "frame_count", "width", "height")

    @classmethod
    def INPUT_TYPES(cls):
        try:
            files = list_input(VIDEO_EXT)
        except Exception:  # noqa: BLE001
            files = []
        return {
            "required": {
                "video": (files or [""], {"tooltip": "The video file from the input folder."}),
                "settings": ("STRING", {"default": json.dumps(VIDEO_DEFAULTS), "multiline": True, "tooltip": "Segment, frame rate, crop, fit, memory limit (JSON). Edit it in the node view."}),
                "width": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 1, "tooltip": "Width of the result. 0 = as the source (after the crop)."}),
                "height": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 1, "tooltip": "Height of the result. 0 = as the source (after the crop)."}),
                "multiple_of": ("INT", {"default": 1, "min": 1, "max": 256, "step": 1, "tooltip": "Round the size to a multiple of this number."}),
            }
        }

    @classmethod
    def VALIDATE_INPUTS(cls, video=None, **_kw):
        if not video:
            return "[ND Load Video] choose a video file"
        if not input_path(video, VIDEO_EXT):
            return f"[ND Load Video] video not found in the input folder: {video}"
        return True

    @classmethod
    def IS_CHANGED(cls, video="", settings="{}", width=0, height=0, multiple_of=1, **_kw):
        p = input_path(video, VIDEO_EXT) or str(video)
        return _file_hash(p, f"{settings}|{width}|{height}|{multiple_of}")

    def load(self, video, settings="{}", width=0, height=0, multiple_of=1):
        path = input_path(video, VIDEO_EXT)
        if not path:
            raise FileNotFoundError(f"[ND Load Video] video not found in the input folder: {video}")
        r = load_video(path, settings, width, height, multiple_of)
        return (_to_images(r["images"]), _to_audio(r["audio"] if r["audio"] else _silence(r)), r["fps"], r["frame_count"], r["width"], r["height"])


def _silence(r):
    import numpy as np

    return (np.zeros((1, 0), np.float32), 44100)


class NDLoadAudio:
    DESCRIPTION = (
        "Loads a sound from the input folder (or the sound track of a video): cut a segment, change the sample rate, make it mono, "
        "set the gain. The settings are edited in the node view or in the ND UI widget."
    )
    CATEGORY = CATEGORY
    FUNCTION = "load"
    RETURN_TYPES = ("AUDIO", "FLOAT", "INT")
    RETURN_NAMES = ("audio", "duration", "sample_rate")

    @classmethod
    def INPUT_TYPES(cls):
        try:
            files = list_input(AUDIO_EXT + VIDEO_EXT)
        except Exception:  # noqa: BLE001
            files = []
        return {
            "required": {
                "audio": (files or [""], {"tooltip": "The sound file (or a video: its sound track) from the input folder."}),
                "settings": ("STRING", {"default": json.dumps(AUDIO_DEFAULTS), "multiline": True, "tooltip": "Segment, sample rate, mono, gain (JSON). Edit it in the node view."}),
            }
        }

    @classmethod
    def VALIDATE_INPUTS(cls, audio=None, **_kw):
        if not audio:
            return "[ND Load Audio] choose a sound file"
        if not input_path(audio, AUDIO_EXT + VIDEO_EXT):
            return f"[ND Load Audio] file not found in the input folder: {audio}"
        return True

    @classmethod
    def IS_CHANGED(cls, audio="", settings="{}", **_kw):
        p = input_path(audio, AUDIO_EXT + VIDEO_EXT) or str(audio)
        return _file_hash(p, settings)

    def load(self, audio, settings="{}"):
        path = input_path(audio, AUDIO_EXT + VIDEO_EXT)
        if not path:
            raise FileNotFoundError(f"[ND Load Audio] file not found in the input folder: {audio}")
        r = load_audio(path, settings)
        return (_to_audio(r["audio"]), float(r["duration"]), r["sample_rate"])


# ------------------------------------------------------------------ routes

def register():
    try:
        from aiohttp import web
        from server import PromptServer

        routes = PromptServer.instance.routes
    except Exception:
        return  # no server (tests, a plain import)

    @routes.get("/ndui/media/info")
    async def nd_media_info(request):
        name = request.query.get("name", "")
        path = input_path(name, VIDEO_EXT + AUDIO_EXT)
        if not path:
            return web.json_response({"error": "not found"}, status=404)
        try:
            free, total = ram()
            return web.json_response({**media_info(path), "ram_free": free, "ram_total": total})
        except Exception as e:  # noqa: BLE001
            logging.warning("[ComfyUI ND UI Builder] media info failed for %s: %s", name, e)
            return web.json_response({"error": str(e)}, status=500)

    @routes.get("/ndui/media/list")
    async def nd_media_list(request):
        kind = request.query.get("kind", "video")
        exts = AUDIO_EXT + VIDEO_EXT if kind == "audio" else VIDEO_EXT
        try:
            return web.json_response(list_input(exts))
        except Exception as e:  # noqa: BLE001
            logging.warning("[ComfyUI ND UI Builder] media list failed: %s", e)
            return web.json_response([])


register()

NODE_CLASS_MAPPINGS = {"NDLoadVideo": NDLoadVideo, "NDLoadAudio": NDLoadAudio}
NODE_DISPLAY_NAME_MAPPINGS = {"NDLoadVideo": "ND Load Video", "NDLoadAudio": "ND Load Audio"}
