# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — the list of models with previews, for the Model Picker of ND UI.

  GET /ndui/models/preview?folder=loras&name=sub/style.safetensors   a small picture of the model (256 px; &big=1: up to 1024 px)
  GET /ndui/models/{folder}                                          [{name, folder, size, mtime, preview, title, base, words, url, usage, version, notes}]

The names come from ComfyUI's own lists (folder_paths), so nothing outside the model folders can be asked for.
A picture is the file next to the model (`name.preview.png`, `name.png`, ...) or the cover that is kept in the metadata of a
safetensors file (`ssmd_cover_images`). Results are cached by the modification time of the file.

The title, the base model and the trigger words come from what lies next to the file (the first that has them wins):
`name.metadata.json` (LoRA Manager), `name.civitai.info` / `name.info` (Civitai), `name.txt` (words, one line or comma separated)
and from the header of a safetensors file (`modelspec.*`, `ss_base_model_version`, `ss_tag_frequency`).
"""

import base64
import io
import json
import logging
import os
import struct

ALLOWED = ("loras", "checkpoints", "diffusion_models", "unet", "vae", "text_encoders", "clip", "controlnet", "upscale_models", "embeddings", "vae_approx", "style_models", "clip_vision", "hypernetworks", "gligen", "photomaker")
PREVIEW_EXT = (".png", ".jpg", ".jpeg", ".webp")
THUMB = 256
BIG = 1024   # the picture shown large (the info of a LoRA)

_info_cache = {}   # (full path, mtime) -> {"preview": bool}
_thumb_cache = {}  # (full path, mtime) -> (bytes, content type)
_THUMB_CACHE_MAX = 400


def _folder_paths():
    import folder_paths  # only inside ComfyUI

    return folder_paths


def side_picture(path):
    """The picture lying next to a model file, or None."""
    base = os.path.splitext(path)[0]
    for stem in (base + ".preview", base):
        for ext in PREVIEW_EXT:
            p = stem + ext
            if os.path.isfile(p):
                return p
    return None


def header_meta(path):
    """The `__metadata__` of a safetensors file ({} when there is none or the file is not readable)."""
    if not path.lower().endswith(".safetensors"):
        return {}
    try:
        with open(path, "rb") as f:
            raw = f.read(8)
            if len(raw) < 8:
                return {}
            (n,) = struct.unpack("<Q", raw)
            if n <= 0 or n > 64 * 1024 * 1024:
                return {}
            header = json.loads(f.read(n).decode("utf-8", "replace"))
        meta = header.get("__metadata__")
        return meta if isinstance(meta, dict) else {}
    except Exception:
        return {}


def cover_of(path, meta=None):
    """The first cover picture kept in the metadata of a safetensors file (bytes), or None."""
    try:
        meta = header_meta(path) if meta is None else meta
        covers = meta.get("ssmd_cover_images")
        if not covers:
            return None
        if isinstance(covers, str):
            covers = json.loads(covers)
        if isinstance(covers, list) and covers:
            return base64.b64decode(covers[0])
    except Exception:
        return None
    return None


def _read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _words_of(value):
    """A list of words from a list or from a comma separated string; clean, no repeats, in order."""
    if isinstance(value, str):
        value = [x for line in value.splitlines() for x in line.split(",")]
    out = []
    if isinstance(value, (list, tuple)):
        for w in value:
            w = str(w).strip()
            if w and w not in out:
                out.append(w)
    return out


def _top_tags(meta, limit=8):
    """The most used tags of the training set (`ss_tag_frequency`): {dataset: {tag: count}}."""
    try:
        freq = meta.get("ss_tag_frequency")
        if isinstance(freq, str):
            freq = json.loads(freq)
        total = {}
        for tags in (freq or {}).values():
            for tag, n in (tags or {}).items():
                total[tag] = total.get(tag, 0) + int(n)
        return [t for t, _ in sorted(total.items(), key=lambda kv: -kv[1])[:limit]]
    except Exception:
        return []


def side_files(path):
    """The files next to the model that carry its description (the ones that exist)."""
    base = os.path.splitext(path)[0]
    return [p for p in (base + ".metadata.json", base + ".civitai.info", base + ".info", base + ".txt") if os.path.isfile(p)]


def _usage_text(value):
    """The usage tips as plain text: LoRA Manager keeps them as a JSON string ({"strength_range": ..., ...}) or as free text."""
    if value is None:
        return ""
    if isinstance(value, str):
        v = value.strip()
        if v[:1] in "{[":
            try:
                value = json.loads(v)
            except Exception:
                return v
        else:
            return v
    if isinstance(value, dict):
        lines = []
        for k, x in value.items():
            if x in (None, "", [], {}):
                continue
            lines.append(f"{str(k).replace('_', ' ')}: {x}")
        return "\n".join(lines)
    if isinstance(value, (list, tuple)):
        return "\n".join(str(x) for x in value if x not in (None, ""))
    return str(value)


def _extras(lm, cv, info):
    """(page url, usage tips, version name, notes) — only what the files really say."""
    url = ""
    for d in (lm, info, cv):
        for k in ("source_url", "civitai_url", "url"):
            v = d.get(k)
            if isinstance(v, str) and v.startswith(("http://", "https://")):
                url = url or v
    if not url:
        for d in (cv, info):
            mid = d.get("modelId")
            if mid is None and isinstance(d.get("model"), dict):
                mid = d["model"].get("id")
            if isinstance(mid, (int, str)) and str(mid).strip().isdigit():
                vid = d.get("id")
                url = f"https://civitai.com/models/{int(str(mid))}" + (f"?modelVersionId={int(str(vid))}" if isinstance(vid, (int, str)) and str(vid).strip().isdigit() else "")
                break
    usage = _usage_text(lm.get("usage_tips"))
    version = ""
    for d in (cv, info):
        version = version or str(d.get("name") or "")
    notes = str(lm.get("notes") or "").strip()
    return url, usage, version, notes[:2000]


def describe(path):
    """{title, base, words} from the side files and the header of the model file. Missing things are empty."""
    title, base, words = "", "", []
    meta = header_meta(path)
    side = {os.path.basename(p)[len(os.path.splitext(os.path.basename(path))[0]):]: p for p in side_files(path)}
    lm = _read_json(side[".metadata.json"]) if ".metadata.json" in side else {}
    cv = lm.get("civitai") if isinstance(lm.get("civitai"), dict) else {}
    info = {}
    for k in (".civitai.info", ".info"):
        if k in side:
            info = _read_json(side[k])
            break
    for c in (cv, info):
        words = words or _words_of(c.get("trainedWords"))
        base = base or str(c.get("baseModel") or "")
        m = c.get("model") if isinstance(c.get("model"), dict) else {}
        title = title or str(m.get("name") or "")
    base = str(lm.get("base_model") or "") or base
    title = str(lm.get("model_name") or "") or title
    if not words and ".txt" in side:
        try:
            with open(side[".txt"], "r", encoding="utf-8", errors="replace") as f:
                words = _words_of(f.read(4000))
        except Exception:
            pass
    words = words or _words_of(meta.get("modelspec.trigger_phrase")) or _top_tags(meta)
    base = base or str(meta.get("modelspec.architecture") or meta.get("ss_base_model_version") or "")
    title = title or str(meta.get("modelspec.title") or "")
    url, usage, version, notes = _extras(lm, cv, info)
    return {"title": title, "base": base, "words": words[:24], "url": url, "usage": usage, "version": version, "notes": notes}


def model_info(path):
    """{preview, title, base, words}, cached by the modification times of the file and of the files next to it."""
    try:
        key = (path, os.path.getmtime(path), tuple((p, os.path.getmtime(p)) for p in side_files(path)), side_picture(path))
    except OSError:
        return {"preview": False, "title": "", "base": "", "words": [], "url": "", "usage": "", "version": "", "notes": ""}
    hit = _info_cache.get(key)
    if hit is None:
        meta = header_meta(path)
        hit = {"preview": bool(key[3] or cover_of(path, meta)), **describe(path)}
        if len(_info_cache) > 5000:
            _info_cache.clear()
        _info_cache[key] = hit
    return hit


def has_preview(path):
    return model_info(path)["preview"]


def picture_bytes(path):
    """(bytes, content type) of the picture of a model, or None."""
    p = side_picture(path)
    if p:
        with open(p, "rb") as f:
            data = f.read()
        ext = os.path.splitext(p)[1].lower()
        return data, {".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    data = cover_of(path)
    if data:
        return data, "image/png" if data[:4] == b"\x89PNG" else ("image/webp" if data[8:12] == b"WEBP" else "image/jpeg")
    return None


def thumbnail(path, size=THUMB):
    """A picture of at most `size` px (PIL when there is one), cached by the modification time."""
    try:
        key = (path, os.path.getmtime(path), size)
    except OSError:
        return None
    if key in _thumb_cache:
        return _thumb_cache[key]
    got = picture_bytes(path)
    if got is None:
        return None
    data, ctype = got
    try:
        from PIL import Image

        im = Image.open(io.BytesIO(data))
        im.thumbnail((size, size))
        out = io.BytesIO()
        if im.mode in ("RGBA", "LA", "P"):
            im.convert("RGBA").save(out, "PNG")
            ctype = "image/png"
        else:
            im.convert("RGB").save(out, "JPEG", quality=84)
            ctype = "image/jpeg"
        data = out.getvalue()
    except Exception:
        pass  # without PIL the picture goes as it is
    if len(_thumb_cache) >= _THUMB_CACHE_MAX:
        _thumb_cache.clear()
    _thumb_cache[key] = (data, ctype)
    return _thumb_cache[key]


def list_models(folder, fp=None):
    fp = fp or _folder_paths()
    out = []
    for name in fp.get_filename_list(folder):
        full = fp.get_full_path(folder, name)
        if not full:
            continue
        try:
            st = os.stat(full)
        except OSError:
            continue
        out.append({"name": name, "folder": folder, "size": st.st_size, "mtime": int(st.st_mtime), **model_info(full)})
    return out


def full_path(folder, name, fp=None):
    """The file of a model, only when ComfyUI lists it in that folder."""
    fp = fp or _folder_paths()
    if folder not in ALLOWED or name not in set(fp.get_filename_list(folder)):
        return None
    return fp.get_full_path(folder, name)


def register():
    try:
        from aiohttp import web
        from server import PromptServer

        routes = PromptServer.instance.routes
    except Exception:
        return  # no server (tests, a plain import)

    @routes.get("/ndui/models/preview")
    async def nd_models_preview(request):
        folder, name = request.query.get("folder", ""), request.query.get("name", "")
        path = full_path(folder, name)
        if not path:
            return web.Response(status=404)
        got = thumbnail(path, BIG if request.query.get("big") else THUMB)
        if got is None:
            return web.Response(status=404)
        return web.Response(body=got[0], content_type=got[1], headers={"Cache-Control": "max-age=3600"})

    @routes.get("/ndui/models/{folder}")
    async def nd_models_list(request):
        folder = request.match_info["folder"]
        if folder not in ALLOWED:
            return web.json_response([], status=404)
        try:
            return web.json_response(list_models(folder))
        except Exception as e:  # a broken file must not break the picker
            logging.warning("[ComfyUI ND UI Builder] model list failed: %s", e)
            return web.json_response([])


register()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
