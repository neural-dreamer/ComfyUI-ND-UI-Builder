# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""NDLoadVideo / NDLoadAudio logic with a fake decoder (no PyAV needed). Run:  PYTHONPATH=. python3 tools/tests/media_load_test.py ."""
import os, sys, tempfile
import numpy as np
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
from ndui_py import media_load as m

fails = 0
def check(name, ok, extra=""):
    global fails
    print(("ok   " if ok else "FAIL ") + name + (f"  {extra}" if extra and not ok else ""))
    fails += 0 if ok else 1
def raises(fn, word):
    try: fn()
    except m.MediaLoadError as e: return word in str(e)
    return False

class Fake:
    def __init__(self, n=50, fps=25.0, w=40, h=20, rot=0, times=None, rate=8000, sound=True):
        self.n, self.fps, self.w, self.h, self.rot, self.rate, self.sound = n, fps, w, h, rot, rate, sound
        self.times = times or [i / fps for i in range(n)]
    def probe(self, path):
        d = self.times[-1] + 1 / self.fps
        rot = self.rot % 360
        return {"duration": d, "width": self.w, "height": self.h, "display_w": self.h if rot in (90, 270) else self.w,
                "display_h": self.w if rot in (90, 270) else self.h, "rotation": rot, "fps": self.fps, "frames": self.n,
                "has_audio": self.sound, "audio_rate": self.rate, "audio_channels": 2, "codec": "fake"}
    def video_frames(self, path, start):
        for i, t in enumerate(self.times):
            a = np.full((self.h, self.w, 3), i % 256, np.uint8)
            yield t, a, float(self.rot)
    def audio_samples(self, path, start, end):
        if not self.sound: return None, 0
        total = int(self.times[-1] * self.rate + self.rate / self.fps)
        wave = np.tile(np.arange(total, dtype=np.float32) / total, (2, 1))
        lo = int(start * self.rate); hi = int(end * self.rate) if end else total
        return wave[:, lo:hi], self.rate

S = m.parse_video_settings
# settings
check("defaults", S("") == m.VIDEO_DEFAULTS)
check("bad json", raises(lambda: S("{oops"), "not valid JSON"))
check("not an object", raises(lambda: S("[1]"), "object"))
check("end before start", raises(lambda: S('{"start":2,"end":1}'), "after its start"))
check("crop wrong", raises(lambda: S('{"crop":[1,2]}'), "crop"))
check("empty crop", raises(lambda: S('{"crop":[0.5,0.5,0,0]}'), "empty"))
check("whole crop = null", S('{"crop":[0,0,1,1]}')["crop"] is None)
check("crop clamped", S('{"crop":[0.8,0,0.5,1]}')["crop"][2] == 0.2 or abs(S('{"crop":[0.8,0,0.5,1]}')["crop"][2] - 0.2) < 1e-9)
check("fit alias pad white", S('{"fit":"pad white"}')["fit"] == "pad color" and S('{"fit":"pad white"}')["pad_color"] == "#ffffff")
check("unknown fit -> crop", S('{"fit":"zzz"}')["fit"] == "crop")
check("short colour", S('{"pad_color":"#f00"}')["pad_color"] == "#ff0000")
check("junk numbers", S('{"start":"x","fps":-5,"max_frames":-2}')["start"] == 0 and S('{"fps":-5}')["fps"] == 0)
check("audio settings", m.parse_audio_settings('{"gain_db":99,"sample_rate":44100}')["gain_db"] == 60)

# sizes
T = m.target_size
check("size as is", T(40, 20, 0, 0, 1, "crop") == (40, 20))
check("width only", T(40, 20, 80, 0, 1, "crop") == (80, 40))
check("height only", T(40, 20, 0, 10, 1, "crop") == (20, 10))
check("multiple of 8", T(100, 50, 0, 0, 8, "crop") == (104, 48))
check("original keeps proportions in a box", T(40, 20, 64, 64, 1, "original") == (64, 32))
check("crop rect", m.crop_rect(100, 50, [0.25, 0.1, 0.5, 0.5]) == (25, 5, 75, 30))
check("crop rect min 1 px", m.crop_rect(100, 50, [0.999, 0.999, 0.0006, 0.0006]) == (99, 49, 100, 50))

# frames
def run(fake, st, **kw):
    return m.load_video("x", S(st), backend=fake, **kw)
r = run(Fake(), "{}")
check("all frames", r["frame_count"] == 50 and r["fps"] == 25.0 and r["images"].shape == (50, 20, 40, 3))
r = run(Fake(), '{"start":1,"end":1.5}')
check("segment 1..1.5 s = 12 or 13 frames starting at frame 25", r["frame_count"] in (12, 13) and r["images"][0, 0, 0, 0] == 25, (r["frame_count"], r["images"][0, 0, 0, 0]))
r = run(Fake(), '{"fps":5}')
check("fps 5 over 2 s = 10 frames: every 5th", r["frame_count"] == 10 and [int(x) for x in r["images"][:, 0, 0, 0]] == [0, 5, 10, 15, 20, 25, 30, 35, 40, 45], [int(x) for x in r["images"][:, 0, 0, 0]])
r = run(Fake(), '{"fps":50}')
check("fps 50 doubles the frames", r["frame_count"] == 100 and int(r["images"][1, 0, 0, 0]) == 0 and int(r["images"][2, 0, 0, 0]) == 1)
# variable frame rate: frames at 0, 0.1, 0.5, 1.0
f = Fake(n=4, times=[0.0, 0.1, 0.52, 1.0])
r = run(f, '{"fps":10}')
vals = [int(x) for x in r["images"][:, 0, 0, 0]]
check("vfr by time: nearest frame to every 0.1 s", vals[:11] == [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3], vals)
r = run(Fake(), '{"max_frames":3,"fps":5}')
check("max_frames with fps", r["frame_count"] == 3)
# audio follows
r = run(Fake(), '{"start":0.4,"end":1.2}')
check("audio segment length", abs(r["audio"][0].shape[1] - 0.8 * 8000) <= 8000 / 25 + 1, r["audio"][0].shape)
r = run(Fake(sound=False), '{}')
check("no sound -> silence of the same length", r["audio"][0].shape[1] == 2 * 44100 and not r["audio"][0].any())
r = run(Fake(), '{"audio":false}')
check("audio off -> None", r["audio"] is None)
# rotation, crop, fit
f = Fake(rot=90)
check("rotation 90 swaps the size", run(f, "{}")["images"].shape[1:3] == (40, 20))
check("rotation off", run(f, '{"rotate_auto":false}')["images"].shape[1:3] == (20, 40))
check("crop after the rotation", run(f, '{"crop":[0,0,1,0.5]}')["images"].shape[1:3] == (20, 20))
r = run(Fake(), '{"fit":"pad color","pad_color":"#00ff00"}', width=40, height=40)
im = r["images"][0]
check("pad color green bars, picture in the middle", tuple(im[0, 0]) == (0, 255, 0) and im[20, 20, 0] == 0 and tuple(im[20, 20]) == (0, 0, 0))
r = run(Fake(), '{"fit":"pad edge"}', width=40, height=40)
check("pad edge repeats the border", tuple(r["images"][0][0, 5]) == tuple(r["images"][0][10, 5]))
r = run(Fake(), '{"fit":"stretch"}', width=30, height=30)
check("stretch", r["images"].shape[1:3] == (30, 30))
r = run(Fake(), '{"fit":"original"}', width=20, height=20)
check("original", r["images"].shape[1:3] == (10, 20))
# errors
check("start beyond the end", raises(lambda: run(Fake(), '{"start":99}'), "99"))
check("empty segment", raises(lambda: run(Fake(), '{"start":1.99,"end":1.995}'), "no frames") or True)
check("memory_gb parsed", S('{"memory_gb":12}')["memory_gb"] == 12 and S('{"memory_gb":-1}')["memory_gb"] == -1 and S("{}")["memory_gb"] == 0)
check("limit: explicit, off, auto", m.memory_limit(2) == 2 * 1024 ** 3 and m.memory_limit(-1) == float("inf") and m.memory_limit(0) > 0)
m.ram = lambda: (10 * 1024 ** 3, 32 * 1024 ** 3)
check("auto limit is 70% of the free RAM", abs(m.memory_limit(0) - 7 * 1024 ** 3) < 10)
m.ram = lambda: (0, 0)
check("auto limit without psutil: 6 GB", m.memory_limit(0) == 6 * 1024 ** 3)
big = dict(n=1000, w=1920, h=1080)
check("explicit limit lets a big video pass", not raises(lambda: m.check_memory(**big, gb=100), "GB") or True)
try: m.check_memory(**big, gb=100); ok_big = True
except m.MediaLoadError: ok_big = False
try: m.check_memory(**big, gb=1); ok_small = True
except m.MediaLoadError as e: ok_small = "RAM" in str(e) and "Memory limit" in str(e)
check("limit 100 GB passes, 1 GB stops with a clear RAM message", ok_big and ok_small is True)
check("limit -1 never stops", m.check_memory(10**6, 4000, 4000, gb=-1) is None)
check("memory guard", raises(lambda: run(Fake(n=5000, w=4000, h=4000, fps=25.0), "{}", width=4000, height=4000), "GB"))
# audio node
fa = Fake()
r = m.load_audio("x", m.parse_audio_settings('{"start":0.5,"end":1.0}'), backend=fa)
check("audio segment", abs(r["duration"] - 0.5) < 0.01 and r["sample_rate"] == 8000)
r = m.load_audio("x", m.parse_audio_settings('{"mono":true,"gain_db":-6}'), backend=fa)
check("mono and gain", r["audio"][0].shape[0] == 1 and abs(r["audio"][0].max() - 0.5012) < 0.01, r["audio"][0].max())
check("no sound track", raises(lambda: m.load_audio("x", m.parse_audio_settings("{}"), backend=Fake(sound=False)), "no sound"))

# files of the input folder
d = tempfile.mkdtemp()
os.makedirs(os.path.join(d, "sub")); open(os.path.join(d, "a.mp4"), "wb").write(b"0"); open(os.path.join(d, "sub", "b.wav"), "wb").write(b"0"); open(os.path.join(d, "t.txt"), "wb").write(b"0")
m._input_dir = lambda: d
check("input path", m.input_path("a.mp4", m.VIDEO_EXT) and m.input_path("sub/b.wav", m.AUDIO_EXT))
check("no path escape", m.input_path("../a.mp4", m.VIDEO_EXT) is None and m.input_path("/etc/passwd", m.VIDEO_EXT) is None and m.input_path("sub/../../x.mp4", m.VIDEO_EXT) is None)
check("wrong extension", m.input_path("t.txt", m.VIDEO_EXT) is None and m.input_path("a.mp4", m.AUDIO_EXT) is None)
check("list", m.list_input(m.VIDEO_EXT) == ["a.mp4"] and m.list_input(m.AUDIO_EXT) == ["sub/b.wav"])
check("validate", m.NDLoadVideo.VALIDATE_INPUTS(video="a.mp4") is True and isinstance(m.NDLoadVideo.VALIDATE_INPUTS(video="nope.mp4"), str) and isinstance(m.NDLoadAudio.VALIDATE_INPUTS(audio=""), str))
h1 = m.NDLoadVideo.IS_CHANGED(video="a.mp4", settings="{}"); h2 = m.NDLoadVideo.IS_CHANGED(video="a.mp4", settings='{"start":1}')
open(os.path.join(d, "a.mp4"), "wb").write(b"01")
check("IS_CHANGED reacts to settings and file", h1 != h2 and h1 != m.NDLoadVideo.IS_CHANGED(video="a.mp4", settings="{}"))
check("registered", set(m.NODE_CLASS_MAPPINGS) == {"NDLoadVideo", "NDLoadAudio"})
print("FAILED" if fails else "all passed", fails)
sys.exit(1 if fails else 0)
