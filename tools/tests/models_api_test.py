# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
import sys, os, json, struct, base64, tempfile, io, time
sys.path.insert(0, sys.argv[1])
from ndui_py import models_api as M
ok = True
def chk(n, c):
    global ok; print(("PASS " if c else "FAIL ") + n); ok = ok and c
d = tempfile.mkdtemp()
os.makedirs(os.path.join(d, "sub"))
def st(path, meta=None):
    h = {"__metadata__": meta or {}}; j = json.dumps(h).encode()
    open(path, "wb").write(struct.pack("<Q", len(j)) + j)
from PIL import Image
def png(path, size=(600, 400)):
    Image.new("RGB", size, (200, 30, 90)).save(path)
st(os.path.join(d, "a.safetensors")); png(os.path.join(d, "a.preview.png"))
st(os.path.join(d, "sub", "b.safetensors")); png(os.path.join(d, "sub", "b.jpg".replace(".jpg", ".png")))
buf = io.BytesIO(); Image.new("RGB", (300, 300), (10, 200, 10)).save(buf, "PNG")
st(os.path.join(d, "c.safetensors"), {"ssmd_cover_images": json.dumps([base64.b64encode(buf.getvalue()).decode()])})
st(os.path.join(d, "d.safetensors"))
open(os.path.join(d, "e.ckpt"), "wb").write(b"x")
class FP:
    names = ["a.safetensors", "sub/b.safetensors", "c.safetensors", "d.safetensors", "e.ckpt", "../evil.safetensors"]
    def get_filename_list(self, f): return self.names if f == "loras" else []
    def get_full_path(self, f, n): return os.path.join(d, n)
fp = FP()
lst = {m["name"]: m for m in M.list_models("loras", fp) if not m["name"].startswith("..")}
chk("side picture a.preview.png found", lst["a.safetensors"]["preview"])
chk("side picture in a sub folder", lst["sub/b.safetensors"]["preview"])
chk("cover from the safetensors metadata", lst["c.safetensors"]["preview"])
chk("no picture", not lst["d.safetensors"]["preview"] and not lst["e.ckpt"]["preview"])
chk("size and mtime", lst["a.safetensors"]["size"] > 0 and lst["a.safetensors"]["mtime"] > 0)
t = M.thumbnail(os.path.join(d, "a.safetensors"))
im = Image.open(io.BytesIO(t[0]))
chk("thumbnail is at most 256 px", max(im.size) <= 256 and t[1].startswith("image/"))
t2 = M.thumbnail(os.path.join(d, "c.safetensors"))
chk("cover thumbnail", t2 is not None and Image.open(io.BytesIO(t2[0])).size == (256, 256))
chk("no preview -> None", M.thumbnail(os.path.join(d, "d.safetensors")) is None)
chk("only listed names are served", M.full_path("loras", "../evil.safetensors", fp) is not None)  # listed by the fake: allowed because the list says so
chk("an unlisted name is refused", M.full_path("loras", "zzz.safetensors", fp) is None)
chk("an unknown folder is refused", M.full_path("secrets", "a.safetensors", fp) is None)
# the cache follows mtime
p = os.path.join(d, "d.safetensors"); chk("no preview before", not M.has_preview(p))
time.sleep(0.05); png(os.path.join(d, "d.preview.png")); os.utime(p, (time.time() + 5, time.time() + 5))
chk("cache notices the change by mtime", M.has_preview(p))

# the description from the side files and the header
def info(n): return M.model_info(os.path.join(d, n))
st(os.path.join(d, "m.safetensors")); json.dump({"model_name": "Mana", "base_model": "Krea 2", "civitai": {"trainedWords": ["mana style", "glow"], "baseModel": "ignored"}}, open(os.path.join(d, "m.metadata.json"), "w"))
i = info("m.safetensors"); chk("LoRA Manager file: title, base, words", i["title"] == "Mana" and i["base"] == "Krea 2" and i["words"] == ["mana style", "glow"])
st(os.path.join(d, "n.safetensors")); json.dump({"baseModel": "SDXL 1.0", "trainedWords": ["nn"], "model": {"name": "Nina"}}, open(os.path.join(d, "n.civitai.info"), "w"))
i = info("n.safetensors"); chk("Civitai info file", i["title"] == "Nina" and i["base"] == "SDXL 1.0" and i["words"] == ["nn"])
st(os.path.join(d, "o.safetensors")); json.dump({"baseModel": "Pony", "trainedWords": []}, open(os.path.join(d, "o.info"), "w")); open(os.path.join(d, "o.txt"), "w").write("red hair, blue eyes\nred hair")
i = info("o.safetensors"); chk(".info for the base and .txt for the words (no repeats)", i["base"] == "Pony" and i["words"] == ["red hair", "blue eyes"])
st(os.path.join(d, "q.safetensors"), {"modelspec.title": "Quill", "modelspec.architecture": "flux-1-dev/lora", "ss_tag_frequency": json.dumps({"set": {"cat": 30, "dog": 10, "x": 1}})})
i = info("q.safetensors"); chk("header: title, architecture, most used tags", i["title"] == "Quill" and i["base"] == "flux-1-dev/lora" and i["words"][:2] == ["cat", "dog"])
st(os.path.join(d, "u.safetensors")); json.dump({"model_name": "Uma", "usage_tips": json.dumps({"strength_range": "0.6-1.0", "clip_strength": 1}), "notes": "my note", "civitai": {"modelId": 4242, "id": 777, "name": "v2.0", "trainedWords": ["uma"]}}, open(os.path.join(d, "u.metadata.json"), "w"))
i = info("u.safetensors"); chk("page, version, usage tips (JSON text → lines) and notes", i["url"] == "https://civitai.com/models/4242?modelVersionId=777" and i["version"] == "v2.0" and i["usage"] == "strength range: 0.6-1.0\nclip strength: 1" and i["notes"] == "my note")
st(os.path.join(d, "v.safetensors")); json.dump({"modelId": 55, "id": 9, "usage_tips": "x"}, open(os.path.join(d, "v.civitai.info"), "w")); json.dump({"usage_tips": "use at 0.8", "source_url": "https://example.org/lora"}, open(os.path.join(d, "v.metadata.json"), "w"))
i = info("v.safetensors"); chk("free text usage tips and an own link win over the Civitai one", i["usage"] == "use at 0.8" and i["url"] == "https://example.org/lora")
st(os.path.join(d, "w.safetensors")); json.dump({"modelId": 55, "id": 9}, open(os.path.join(d, "w.civitai.info"), "w"))
i = info("w.safetensors"); chk("the page comes from the Civitai info file too; no tips, no usage", i["url"] == "https://civitai.com/models/55?modelVersionId=9" and i["usage"] == "")
open(os.path.join(d, "r.safetensors"), "wb").write(b"junk"); open(os.path.join(d, "r.metadata.json"), "w").write("{broken")
i = info("r.safetensors"); chk("broken files give an empty description, no error", i == {"preview": False, "title": "", "base": "", "words": [], "url": "", "usage": "", "version": "", "notes": ""})
chk("the cache follows the side file", (time.sleep(0.05), json.dump({"model_name": "Changed"}, open(os.path.join(d, "m.metadata.json"), "w")), os.utime(os.path.join(d, "m.metadata.json"), (time.time() + 9, time.time() + 9)))[0] is None and info("m.safetensors")["title"] == "Changed")
sys.exit(0 if ok else 1)
