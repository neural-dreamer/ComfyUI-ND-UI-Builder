// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the list of models with pictures (the server side is ndui_py/models_api.py), and what the person keeps about them:
// favourites, recently used, stacks of LoRAs saved under a name. Kept in the browser (localStorage), best effort.
import { api } from "../../../scripts/api.js";

const catalogs = new Map(); // folder -> Promise<Map name -> info>

// Node definitions were reloaded (the R key of ComfyUI): files may have come or gone, so what was read is forgotten.
// `modelsVersion` goes into the signature of every widget (render.js), so each widget is told once; a widget that keeps a catalog asks again.
export let modelsVersion = 0;
const MODELS_EVENT = "ndui:models-changed";
export function refreshModels() {
    catalogs.clear();
    modelsVersion++;
    try { window.dispatchEvent(new CustomEvent(MODELS_EVENT, { detail: { version: modelsVersion } })); } catch {}
}
// fn() runs after the lists were reset; returns the function that stops listening
export function onModelsChanged(fn) {
    const h = () => fn();
    window.addEventListener(MODELS_EVENT, h);
    return () => window.removeEventListener(MODELS_EVENT, h);
}

// The catalog of a folder of models. LoRAs come from Neural Dreamer Nodes (GET /nd/loras: video previews, the NSFW flag and marks, entry.src = "nd")
// when that pack is installed, and from this pack's own list (GET /ndui/models/loras: pictures only) when it is not.
// A preview is {kind: "image"|"video", v, image}|null in the first, true|false in the second: read it with previewOf().
export function catalog(folder, fresh = false) {
    if (!fresh && catalogs.has(folder)) return catalogs.get(folder);
    const p = (async () => {
        const get = async (url) => { try { const r = await api.fetchApi(url); return r.ok ? await r.json() : null; } catch { return null; } };
        if (folder === "loras") {
            const nd = await get("/nd/loras");
            if (Array.isArray(nd)) return new Map(nd.map((m) => [m.name, Object.assign(m, { src: "nd" })]));
        }
        const list = await get(`/ndui/models/${encodeURIComponent(folder)}`);
        return new Map(Array.isArray(list) ? list.map((m) => [m.name, m]) : []);
    })();
    catalogs.set(folder, p);
    return p;
}
// what the catalog says about the preview of an entry: {kind, v, image} or null
export const previewOf = (m) => (m && m.preview && typeof m.preview === "object" ? m.preview : m && m.preview === true ? { kind: "image", v: 0, image: true } : null);
export const isNd = (m) => !!m && m.src === "nd";
// the addresses of the picture and of the video of an entry
export const previewUrlOf = (m, folder, big = false) => (isNd(m)
    ? api.apiURL(`/nd/loras/preview?name=${encodeURIComponent(m.name)}${big ? "&big=1" : ""}&v=${previewOf(m)?.v || 0}`)
    : previewUrl(folder, m.name, big));
export const videoUrlOf = (m) => api.apiURL(`/nd/loras/video?name=${encodeURIComponent(m.name)}&v=${previewOf(m)?.v || 0}`);
export const previewUrl = (folder, name, big = false) => api.apiURL(`/ndui/models/preview?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}${big ? "&big=1" : ""}`);
export const baseName = (n) => String(n).split(/[\\/]/).pop();
export const dirName = (n) => { const p = String(n).split(/[\\/]/); p.pop(); return p.join("/"); };
export const stemName = (n) => baseName(n).replace(/\.(safetensors|ckpt|pt|pth|bin|gguf)$/i, "");

/* ------------------------------------------------------------------ what the person keeps */

const read = (key, def) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch { return def; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const KEY = { fav: "ndui-fav:", recent: "ndui-recent:", presets: "ndui-lora-presets", gal: "ndui-gallery:" };

export const favorites = {
    all: (folder) => new Set(read(KEY.fav + folder, [])),
    has: (folder, name) => favorites.all(folder).has(name),
    toggle(folder, name) { const s = favorites.all(folder); if (s.has(name)) s.delete(name); else s.add(name); write(KEY.fav + folder, [...s]); return s.has(name); },
};
export const recents = {
    all: (folder) => read(KEY.recent + folder, []),
    add(folder, name) { const l = recents.all(folder).filter((n) => n !== name); l.unshift(name); write(KEY.recent + folder, l.slice(0, 12)); },
};
// what the gallery had narrowed to (folder, base model, favourites only), kept per kind of model so the next opening starts the same
export const galleryFilter = {
    get: (folder) => { const v = read(KEY.gal + folder, {}); return { dir: String(v.dir || ""), base: String(v.base || ""), fav: v.fav === true }; },
    set: (folder, v) => write(KEY.gal + folder, { dir: v.dir || "", base: v.base || "", fav: v.fav === true }),
};
// saved stacks of LoRAs: {name: [entry, ...]}
export const stackPresets = {
    all: () => read(KEY.presets, {}),
    save(name, list) { const a = stackPresets.all(); a[name] = JSON.parse(JSON.stringify(list)); write(KEY.presets, a); },
    remove(name) { const a = stackPresets.all(); delete a[name]; write(KEY.presets, a); },
};
