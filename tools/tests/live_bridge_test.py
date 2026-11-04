# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
import sys, types, json, time, io, base64
sys.path.insert(0, sys.argv[1])
import numpy as np
from PIL import Image
ok = True
def chk(n, c, extra=""):
    global ok; print(("PASS " if c else "FAIL ") + n + ("" if c or not extra else "  [" + str(extra)[:300] + "]")); ok = ok and c

sent = []
class Srv:
    client_id = "c1"; last_prompt_id = "p1"; last_node_id = "7"
    def send_sync(self, ev, data, cid): sent.append((ev, data, cid))
class Q: currently_running = {}
srv = Srv(); srv.prompt_queue = Q()
server = types.ModuleType("server"); server.PromptServer = types.SimpleNamespace(instance=srv); sys.modules["server"] = server
ce = types.ModuleType("comfy_execution"); cu = types.ModuleType("comfy_execution.utils")
cu.get_executing_context = lambda: types.SimpleNamespace(prompt_id="p1", node_id="7")
sys.modules.update({"comfy_execution": ce, "comfy_execution.utils": cu})
# a small ComfyUI: unpack_latents as in the core, the wrapper keys, a latent_preview with a plain previewer
comfy = types.ModuleType("comfy"); cutils = types.ModuleType("comfy.utils"); cpe = types.ModuleType("comfy.patcher_extension"); cmb = types.ModuleType("comfy.model_base")
def unpack_latents(x, shapes):
    if len(shapes) > 1:
        out = []
        for s in shapes:
            cut = int(np.prod(s[1:])); t = x[:, :, :cut]; x = x[:, :, cut:]; out.append(t.reshape([t.shape[0]] + list(s)[1:]))
        return out
    return [x]
cutils.unpack_latents = unpack_latents
cpe.WrappersMP = types.SimpleNamespace(OUTER_SAMPLE="outer_sample")
cmb.ModelType = types.SimpleNamespace(FLOW_AV="flow_av")
comfy.utils, comfy.patcher_extension, comfy.model_base = cutils, cpe, cmb
sys.modules.update({"comfy": comfy, "comfy.utils": cutils, "comfy.patcher_extension": cpe, "comfy.model_base": cmb})
from ndui_py import live_bridge as L
import ndui_py as pack

# ---- the node
chk("registered", "NDUILiveBridge" in L.NODE_CLASS_MAPPINGS and L.NODE_DISPLAY_NAME_MAPPINGS["NDUILiveBridge"] == "ND UI Live Bridge" and "live_bridge" in pack.MODULES)
spec = L.NDUILiveBridge.INPUT_TYPES()
req, opt = spec["required"], spec.get("optional", {})
chk("the inputs: model, tiny_vae, size, preview, fps, interval, max_frames", list(req) == ["model", "tiny_vae", "size", "preview", "fps", "interval", "max_frames"], str(list(req)))
chk("max_frames goes up to 1024", req["max_frames"][1]["max"] == 1024 and req["max_frames"][1]["min"] == 2, str(req["max_frames"]))
chk("an optional audio VAE", list(opt) == ["audio_vae"] and opt["audio_vae"][0] == "VAE")
chk("tiny_vae keeps the old values (latent2rgb, taesd) and adds auto", all(v in req["tiny_vae"][0] for v in ("auto", "latent2rgb", "taesd")))
chk("first frame is the default preview, 24 fps, 1 s, 48 frames", req["preview"][1]["default"] == "first frame" and req["fps"][1]["default"] == 24 and req["interval"][1]["default"] == 1.0 and req["max_frames"][1]["default"] == 48)
chk("MODEL out and the live pin", L.NDUILiveBridge.RETURN_TYPES == ("MODEL", L.LIVE_TYPE))
class Model:
    def __init__(self): self.wrappers = {}; self.model = types.SimpleNamespace(latent_format=None, model_type="flow")
    def clone(self): m = Model(); return m
    def add_wrapper_with_key(self, k, name, fn): self.wrappers[(k, name)] = fn
    def get_model_object(self, n): return types.SimpleNamespace(audio_scale=2.0)
base = Model(); out, _live = L.NDUILiveBridge().run(base, "latent2rgb", 384, "first frame", 24, 1.0, 48, None, "5")
w = out.wrappers.get(("outer_sample", "ndui_live_bridge_5"))
chk("the model comes back as a clone with the sampler wrapper", out is not base and isinstance(w, L.LiveWrapper) and w.bridge_id == "5" and not base.wrappers)
out2, _l2 = L.NDUILiveBridge().run(base, None, 256, "bogus", 10, 0.5, 8, None, "6", method="taesd")
chk("the old `method` value still works and a bad mode becomes first frame", out2.wrappers[("outer_sample", "ndui_live_bridge_6")].cfg["tiny"] == "taesd" and out2.wrappers[("outer_sample", "ndui_live_bridge_6")].cfg["mode"] == "first frame")

# ---- the wrapper around the sampler
class Prev:
    def __init__(self): self.seen = []
    def decode_latent_to_preview(self, x): self.seen.append(tuple(x.shape)); return Image.new("RGB", (800, 600), (200, (len(self.seen) * 37) % 255, 90))
def make(cfg=None, prompt_meta=None, audio_vae=None):
    base = Model(); c = {"tiny": "latent2rgb", "size": 384, "mode": "first frame", "fps": 24, "interval": 1.0, "max_frames": 48}; c.update(cfg or {})
    wr = L.LiveWrapper("5", base, c, audio_vae); pv = Prev(); wr.previewers[id(base.model)] = pv
    Q.currently_running = {"k": (0, "p1", {"5": {"class_type": "NDUILiveBridge", "_meta": prompt_meta if prompt_meta is not None else {"ndui_live": True}}})}
    return wr, pv
class Exec:
    def __init__(self, steps): self.steps = steps; self.got = None; self.orig_calls = []
    def __call__(self, *args, **kwargs):
        self.got = (args, kwargs)
        cb = args[5]
        for s in self.steps: cb(*s)
        return "done"
def x(shape): return np.zeros(shape, dtype=np.float32)
orig_calls = []
orig_cb = lambda *a: orig_calls.append(a[0])
ex = Exec([(0, x((1, 4, 8, 8)), None, 4), (1, x((1, 4, 8, 8)), None, 4), (3, x((1, 4, 8, 8)), None, 4)])
wr, pv = make()
res = wr(ex, "noise", "lat", "sampler", "sigmas", None, orig_cb, False, 1, latent_shapes=None)
chk("the sampling result is passed on and the original callback runs on every step", res == "done" and orig_calls == [0, 1, 3], str(orig_calls))
chk("the first step and the last step send a picture (the other is rate limited)", [m[1]["step"] for m in sent] == [1, 4], str([m[1]["step"] for m in sent]))
m0 = sent[0][1]
chk("a picture event: kind, mime, url, images, step, sampler", m0["kind"] == "image" and m0["mime"] == "image/jpeg" and m0["url"].startswith("data:image/jpeg;base64,") and m0["images"] == [m0["url"]] and m0["steps"] == 4 and m0["sampler"] == "7" and m0["audio"] is False, str(m0)[:200])
chk("the picture is at most `size` px", max(Image.open(io.BytesIO(base64.b64decode(m0["url"].split(",")[1]))).size) <= 384)
# the callback passed as a keyword
sent.clear(); ex2 = Exec([]); 
class Exec2:
    def __call__(self, *a, **k): k["callback"](0, x((1, 4, 8, 8)), None, 1); return "k"
wr, pv = make(); wr(Exec2(), "n", "l", "s", "sg", None, callback=None) if False else None
# no mark -> nothing, unknown prompt -> pictures
sent.clear(); wr, pv = make(prompt_meta={}); wr(Exec([(0, x((1, 4, 8, 8)), None, 1)]), "n", "l", "s", "sg", None, None, False, 1)
chk("no mark in the prompt: nothing is made", sent == [])
Q.currently_running = {}; wr, pv = make(); Q.currently_running = {}
wr(Exec([(0, x((1, 4, 8, 8)), None, 1)]), "n", "l", "s", "sg", None, None, False, 1)
chk("a prompt that cannot be read: a picture is sent", len(sent) == 1)
# a failing previewer never breaks the sampling and the original callback still runs
sent.clear(); wr, pv = make(); 
class Bad:
    def decode_latent_to_preview(self, x): raise RuntimeError("boom")
wr.previewers[id(wr.patcher.model)] = Bad(); calls = []
r = wr(Exec([(0, x((1, 4, 8, 8)), None, 2), (1, x((1, 4, 8, 8)), None, 2)]), "n", "l", "s", "sg", None, lambda *a: calls.append(a[0]), False, 1)
chk("an error in the preview never breaks the sampling", r == "done" and calls == [0, 1])
chk("the next frames come from the rough preview", isinstance(wr.previewers[id(wr.patcher.model)], L.GroupPreviewer))

# ---- a packed latent with sound (MiniMax H3 AV style): [B, 1, N] and the shapes of the streams
V = (1, 24, 5, 6, 8); A = (1, 32, 3, 4)
n = int(np.prod(V[1:])) + int(np.prod(A[1:]))
packed = np.arange(n, dtype=np.float32).reshape(1, 1, n)
vv, aa = L.split_streams(packed, [V, A])
chk("the packed latent is split into the video and the sound", tuple(vv.shape) == V and tuple(aa.shape) == A)
vv, aa = L.split_streams(x(V), None)
chk("a plain latent has no sound", tuple(vv.shape) == V and aa is None)
class Nested:
    is_nested = True
    tensors = [x(V), x(A)]
vv, aa = L.split_streams(Nested(), None)
chk("an old nested latent is split too", tuple(vv.shape) == V and tuple(aa.shape) == A)

def wait_sent(k, t=20):
    end = time.time() + t
    while time.time() < end and len(sent) < k: time.sleep(0.05)
sent.clear()
wr, pv = make({"mode": "animated", "fps": 12})
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A])
wait_sent(1)
chk("an animated preview sends a clip", len(sent) == 1 and sent[0][1]["kind"] == "video", str(sent[0][1])[:150] if sent else "nothing")
m = sent[0][1]
chk("the clip is an MP4 without sound when there is no audio VAE, fps as set", m["mime"] == "video/mp4" and m["audio"] is False and m["fps"] == 12, str({k: m[k] for k in m if k != "url"}))
chk("a frame for every latent frame of the video stream (5)", len(pv.seen) == 5 and all(s == (1, 24, 1, 6, 8) for s in pv.seen), str(pv.seen))
import av
c = av.open(io.BytesIO(base64.b64decode(m["url"].split(",")[1])))
chk("it opens as a real MP4 with 5 frames and no audio track", len(c.streams.video) == 1 and len(c.streams.audio) == 0 and c.streams.video[0].frames in (5, 0) or c.streams.video[0].frames > 0)
# with the sound: the audio VAE is connected and the Viewer asks for it
sent.clear()
wr, pv = make({"mode": "animated"}, {"ndui_live": True, "ndui_live_audio": True}, audio_vae=object())
rate = 16000; wave = (np.sin(np.linspace(0, 200, rate * 2)) * 0.3).astype(np.float32)[None].repeat(2, 0)   # 2 s of stereo
calls = []
def fake_sound(self, lat): calls.append(tuple(lat.shape)); return wave, rate
L.Run.sound = fake_sound
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A])
wait_sent(1)
m = sent[0][1]
chk("the sound of the audio stream is requested", calls == [A], str(calls))
chk("the clip carries the sound", m["mime"] == "video/mp4" and m["audio"] is True, str({k: m[k] for k in m if k != "url"}))
c = av.open(io.BytesIO(base64.b64decode(m["url"].split(",")[1])))
dur = float(c.duration) / 1e6
chk("an MP4 with a video and an audio track", len(c.streams.video) == 1 and len(c.streams.audio) == 1, str(c.streams))
chk("the clip is as long as the sound (2 s)", abs(dur - 2.0) < 0.4, str(dur))
chk("fps stays the one of the node (24), not fitted to the sound", m["fps"] == 24 and abs(float(c.streams.video[0].average_rate) - 24) < 0.01, str(m["fps"]))
chk("48 frames on the time grid (2 s x 24 fps), the preview pictures held", c.streams.video[0].frames in (48, 0) or abs(c.streams.video[0].frames - 48) <= 1, str(c.streams.video[0].frames))
# the sound does not depend on the mark: the Viewer only mutes the player
sent.clear(); calls.clear()
wr, pv = make({"mode": "animated"}, {"ndui_live": True, "ndui_live_audio": False}, audio_vae=object())
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
chk("no sound mark -> the sound is made anyway", calls == [A] and sent[0][1]["audio"] is True)
# without the sound the duration comes from the latent frames: 5 latent frames, 24 fps -> (5-1)*4+1 = 17 frames at the node fps
sent.clear()
wr, pv = make({"mode": "animated", "fps": 24})
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
c2 = av.open(io.BytesIO(base64.b64decode(sent[0][1]["url"].split(",")[1])))
chk("no sound: the clip has the real length at the node fps", abs(float(c2.streams.video[0].average_rate) - 24) < 0.01 and abs(c2.streams.video[0].frames - 17) <= 1 or abs(c2.streams.video[0].frames - 33) <= 1, str(c2.streams.video[0].frames))
sent.clear(); calls.clear()
wr, pv = make({"mode": "animated"}, {"ndui_live": True, "ndui_live_audio": True}, audio_vae=None)
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
chk("no audio VAE connected -> a clip without sound", calls == [] and sent[0][1]["audio"] is False)
# a video TAE decodes the whole latent at once: every real frame, the node fps, the real duration, no frame held
class TAEHVPreviewerImpl:
    def __init__(self): self.taesd = types.SimpleNamespace(decode=self.dec); self.calls = []
    def dec(self, z):
        self.calls.append(tuple(z.shape)); T = z.shape[2]; P = (T - 1) * 4 + 1
        out = np.zeros((1, P, 16, 16, 3), dtype=np.float32)
        for i in range(P): out[0, i] = i / float(P)   # a different grey for every frame
        return out
    def decode_latent_to_preview(self, x): raise AssertionError("one latent frame at a time must not be used")
sent.clear()
wr, pv = make({"mode": "animated", "fps": 24, "max_frames": 1024})
tv = TAEHVPreviewerImpl(); wr.previewers[id(wr.patcher.model)] = tv
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
m = sent[0][1]; c3 = av.open(io.BytesIO(base64.b64decode(m["url"].split(",")[1])))
chk("video TAE: one decode of the whole latent", len(tv.calls) == 1 and tv.calls[0][2] == 5, str(tv.calls))
chk("video TAE: (5-1)*4+1 = 17 real frames at 24 fps, none held twice", abs(c3.streams.video[0].frames - 17) <= 1 and m["fps"] == 24, str(c3.streams.video[0].frames))
sent.clear()
wr, pv = make({"mode": "animated", "fps": 24, "max_frames": 5})
tv = TAEHVPreviewerImpl(); wr.previewers[id(wr.patcher.model)] = tv
wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
c4 = av.open(io.BytesIO(base64.b64decode(sent[0][1]["url"].split(",")[1])))
chk("video TAE with max_frames 5: the clip still has all 17 frames of time (frames held, duration real)", abs(c4.streams.video[0].frames - 17) <= 1, str(c4.streams.video[0].frames))
# fallbacks
sent.clear(); real = L.encode_mp4
def no_mp4(*a, **k): raise RuntimeError("no encoder")
L.encode_mp4 = no_mp4
wr, pv = make({"mode": "animated"}); wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
m = sent[0][1]
chk("without an MP4 encoder: an animated WebP without sound", m["mime"] == "image/webp" and m["audio"] is False and Image.open(io.BytesIO(base64.b64decode(m["url"].split(",")[1]))).n_frames == 5)
sent.clear(); real_webp = L.encode_webp
def no_webp(*a, **k): raise RuntimeError("no webp")
L.encode_webp = no_webp
wr, pv = make({"mode": "animated"}); wr(Exec([(0, packed, None, 4)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V, A]); wait_sent(1)
chk("without WebP: one JPEG picture", sent[0][1]["kind"] == "image" and sent[0][1]["mime"] == "image/jpeg")
L.encode_mp4, L.encode_webp = real, real_webp
# max_frames spreads the frames evenly
sent.clear(); T = 40; V2 = (1, 24, T, 4, 4); p2 = np.zeros((1, 1, int(np.prod(V2[1:])) + int(np.prod(A[1:]))), dtype=np.float32)
wr, pv = make({"mode": "animated", "max_frames": 8}); wr(Exec([(0, p2, None, 2)]), "n", "l", "s", "sg", None, None, False, 1, latent_shapes=[V2, A]); wait_sent(1)
chk("at most max_frames frames, spread over the video", len(pv.seen) == 8, str(len(pv.seen)))
# a still latent (one frame) in animated mode is just a picture
sent.clear(); wr, pv = make({"mode": "animated"}); wr(Exec([(0, x((1, 4, 8, 8)), None, 1)]), "n", "l", "s", "sg", None, None, False, 1)
chk("an image model in animated mode sends a picture", sent[0][1]["kind"] == "image")
# the encoder keeps only the newest waiting job
e = L.Encoder(); got = []
import threading
gate = threading.Event(); realmc = L.make_clip
def slow(job): gate.wait(5); got.append(job["meta"]["n"])
L.make_clip = slow
for i in range(4): e.submit({"meta": {"n": i}})
time.sleep(0.2); gate.set(); time.sleep(0.5)
chk("a slow encoder drops the stale jobs, the newest one is made", got and got[-1] == 3 and len(got) <= 3, str(got))
L.make_clip = realmc
im = L.to_jpeg(Image.new("RGB", (2000, 1000)), 384)
chk("fit() makes even sides", all(s % 2 == 0 for s in L.fit(Image.new("RGB", (101, 77)), 64).size))
# the previewers
lp = types.ModuleType("latent_preview"); lp.VIDEO_TAES = []; lp.Latent2RGBPreviewer = lambda *a: "rgb"
sys.modules["latent_preview"] = lp
class Fmt: taesd_decoder_name = None; latent_channels = 4; latent_rgb_factors = None
class BM: latent_format = Fmt()
chk("no factors in the model: no previewer (the rough one takes over)", L.make_previewer(BM(), "auto") is None)
Fmt.latent_rgb_factors = [[0, 0, 0]]
chk("with factors: the ComfyUI latent2rgb previewer", L.make_previewer(BM(), "latent2rgb") == "rgb" and L.make_previewer(BM(), "auto") == "rgb")
chk("tiny_choices works without ComfyUI", L.tiny_choices()[:3] == ["auto", "latent2rgb", "taesd"])
# the decode of a whole clip asks for the room of its weights only (the model of the sampler stays in the video memory), and gives the old answer back
class FakeVae:
    def __init__(self): self.memory_used_decode = lambda shape, dt: 10 ** 10
fv = FakeVae(); asked = []
with L._light(fv): asked.append(fv.memory_used_decode((1, 16, 31, 64, 64), None))
chk("light decode: 64 MB asked while it is on", asked == [64 * 1024 * 1024], str(asked))
chk("light decode: the old estimate is back afterwards", fv.memory_used_decode(None, None) == 10 ** 10)
# a frame that took long makes the next one wait: the cost is remembered per sampler
chk("the cost factor is there", L.COST_FACTOR >= 2)
sys.exit(0 if ok else 1)
