# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""Real decoding with PyAV on files made by ffmpeg (rotation, variable frame rate, 32 kHz sound, segments).
Skips (exit 0) when PyAV or ffmpeg is missing.  Run:  PYTHONPATH=. python3 tools/tests/media_real_test.py ."""
import os, shutil, subprocess, sys, tempfile
import numpy as np

try:
    import av  # noqa: F401
except Exception:
    print("PyAV is not installed: skipped"); sys.exit(0)
if not shutil.which("ffmpeg"):
    print("ffmpeg is not installed: skipped"); sys.exit(0)

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
from ndui_py import media_load as m

T = tempfile.mkdtemp(prefix="ndmedia_")
fails = 0
def check(name, ok, extra=""):
    global fails
    print(("ok   " if ok else "FAIL ") + name + (f"  {extra}" if extra and not ok else ""))
    fails += 0 if ok else 1
def ff(*a):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True, cwd=T)

# an asymmetric picture: red block top-left, green bottom-right, blue gradient
from PIL import Image
a = np.zeros((90, 160, 3), np.uint8); a[:30, :50] = [255, 0, 0]; a[60:, 110:] = [0, 255, 0]
a[:, :, 2] = np.linspace(0, 255, 160, dtype=np.uint8)[None, :]
Image.fromarray(a).save(os.path.join(T, "frame.png"))
# 1. plain, 25 fps, 2 s, with 32 kHz sound
ff("-loop", "1", "-i", "frame.png", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=32000:duration=2", "-t", "2", "-r", "25",
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "plain.mp4")
# 2. display matrix -90 (phones)
ff("-display_rotation", "-90", "-i", "plain.mp4", "-c", "copy", "rot.mp4")
# 3. old rotate tag
ff("-i", "plain.mp4", "-c", "copy", "-metadata:s:v", "rotate=90", "tag.mp4")
# 4. variable frame rate: frames with pts at irregular times
ff("-framerate", "30", "-loop", "1", "-i", "frame.png", "-t", "3", "-vf", "select='lt(mod(n,3),2)'", "-fps_mode", "vfr", "-c:v", "libx264", "-pix_fmt", "yuv420p", "vfr.mp4")
# 5. sound only
ff("-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000:duration=3", "-ac", "2", "tone.wav")
ff("-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=32000:duration=3", "tone32.flac")

P = lambda n: os.path.join(T, n)
info = m.media_info(P("plain.mp4"), backend=m._backend)
check("probe size/fps", (info["width"], info["height"], round(info["fps"])) == (160, 90, 25), info)
check("probe sound", info["has_audio"] and info["audio_rate"] == 32000, info)
check("probe duration", abs(info["duration"] - 2) < 0.1, info)
ri = m.media_info(P("rot.mp4"), backend=m._backend)
check("probe rotation -90 -> 270, display swapped", ri["rotation"] == 270 and (ri["display_w"], ri["display_h"]) == (90, 160), ri)

# rotation against what ffmpeg itself shows (autorotate)
ff("-i", "rot.mp4", "-frames:v", "1", "ref_rot.png")
ref = np.asarray(Image.open(P("ref_rot.png")).convert("RGB")).astype(int)
r = m.load_video(P("rot.mp4"), m.parse_video_settings("{}"))
got = r["images"][0].astype(int)
check("rotated size", got.shape[:2] == ref.shape[:2] == (160, 90), (got.shape, ref.shape))
check("rotation matches ffmpeg", np.abs(got - ref).mean() < 6, np.abs(got - ref).mean())
check("rotation off keeps the coded picture", m.load_video(P("rot.mp4"), {**m.parse_video_settings("{}"), "rotate_auto": False})["images"].shape[1:3] == (90, 160))
ff("-i", "tag.mp4", "-frames:v", "1", "ref_tag.png")
ref = np.asarray(Image.open(P("ref_tag.png")).convert("RGB")).astype(int)
got = m.load_video(P("tag.mp4"), m.parse_video_settings("{}"))["images"][0].astype(int)
check("old rotate tag matches ffmpeg", got.shape == ref.shape and np.abs(got - ref).mean() < 6, (got.shape, ref.shape))

# plain: frames, fps, audio
r = m.load_video(P("plain.mp4"), m.parse_video_settings("{}"))
check("all frames", r["frame_count"] == 50 and r["fps"] == 25.0, (r["frame_count"], r["fps"]))
check("audio of the whole file", r["audio"][1] == 32000 and abs(r["audio"][0].shape[1] - 64000) < 2200, (r["audio"][1], r["audio"][0].shape))
# segment
r = m.load_video(P("plain.mp4"), m.parse_video_settings('{"start":0.5,"end":1.5}'))
check("segment 0.5-1.5 s = 25 frames", r["frame_count"] == 25, r["frame_count"])
check("segment audio = 1 s", abs(r["audio"][0].shape[1] - 32000) < 1500, r["audio"][0].shape)
# fps by time
r = m.load_video(P("plain.mp4"), m.parse_video_settings('{"fps":10}'))
check("fps 10 over 2 s = 20 frames", r["frame_count"] == 20 and r["fps"] == 10.0, r["frame_count"])
r = m.load_video(P("plain.mp4"), m.parse_video_settings('{"fps":50}'))
check("fps 50 repeats frames: 100", r["frame_count"] == 100, r["frame_count"])
r = m.load_video(P("plain.mp4"), m.parse_video_settings('{"max_frames":7}'))
check("max_frames 7 and audio matches", r["frame_count"] == 7 and abs(r["audio"][0].shape[1] - 7 / 25 * 32000) < 1500, (r["frame_count"], r["audio"][0].shape))
# variable frame rate
vi = m.media_info(P("vfr.mp4"), backend=m._backend)
r = m.load_video(P("vfr.mp4"), m.parse_video_settings('{"fps":10}'))
check("vfr: fps 10 gives a steady 10 fps (about 30 frames over 3 s)", 28 <= r["frame_count"] <= 31, (r["frame_count"], vi))
# crop (after rotation) and fit
r = m.load_video(P("rot.mp4"), m.parse_video_settings('{"crop":[0,0,1,0.5]}'))
check("crop top half after rotation: 90x80", r["images"].shape[1:3] == (80, 90), r["images"].shape)
r = m.load_video(P("plain.mp4"), m.parse_video_settings('{"fit":"crop"}'), width=64, height=64)
check("fit crop to 64x64", r["images"].shape[1:3] == (64, 64) and (r["width"], r["height"]) == (64, 64))
r = m.load_video(P("plain.mp4"), m.parse_video_settings('{"fit":"pad color","pad_color":"#ff0000"}'), width=64, height=64)
check("pad color: red bars on top and bottom", tuple(r["images"][0][0, 0]) == (255, 0, 0) and tuple(r["images"][0][63, 63]) == (255, 0, 0))
r = m.load_video(P("plain.mp4"), m.parse_video_settings("{}"), width=100, height=0, multiple_of=8)
check("width only keeps proportions, multiple of 8", (r["width"], r["height"]) == (104, 56), (r["width"], r["height"]))
# start beyond the file
try:
    m.load_video(P("plain.mp4"), m.parse_video_settings('{"start":9}')); check("start after the end raises", False)
except m.MediaLoadError as e:
    check("start after the end raises", "9" in str(e))
# memory guard
try:
    m.load_video(P("plain.mp4"), m.parse_video_settings('{"fps":240}'), width=16384, height=16384); check("memory guard", False)
except m.MediaLoadError as e:
    check("memory guard", "GB" in str(e))

# sound only
for n, rate in (("tone.wav", 48000), ("tone32.flac", 32000), ("plain.mp4", 32000)):
    r = m.load_audio(P(n), m.parse_audio_settings("{}"))
    check(f"audio {n}: rate {rate}", r["sample_rate"] == rate, r["sample_rate"])
r = m.load_audio(P("tone.wav"), m.parse_audio_settings('{"start":1,"end":2}'))
check("audio segment 1 s", abs(r["audio"][0].shape[1] - 48000) < 600 and r["audio"][0].shape[0] == 2, r["audio"][0].shape)
r = m.load_audio(P("tone.wav"), m.parse_audio_settings('{"mono":true}'))
check("mono", r["audio"][0].shape[0] == 1)
r = m.load_audio(P("tone.wav"), m.parse_audio_settings('{"sample_rate":16000}'))
check("resample to 16000", r["sample_rate"] == 16000 and abs(r["audio"][0].shape[1] - 48000) < 300, r["audio"][0].shape)
p0 = np.abs(m.load_audio(P("tone.wav"), m.parse_audio_settings("{}"))["audio"][0]).max()
p6 = np.abs(m.load_audio(P("tone.wav"), m.parse_audio_settings('{"gain_db":-6}'))["audio"][0]).max()
check("gain -6 dB", abs(p6 / p0 - 0.501) < 0.01, (p0, p6))
shutil.rmtree(T, ignore_errors=True)
print("FAILED" if fails else "all passed", fails)
sys.exit(1 if fails else 0)
