// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — files in and out, shared by every widget that shows or takes a picture (a video or a sound later).
//  - a "ref" is {filename, subfolder, type}: a file that lives on the ComfyUI side (input / output / temp);
//  - makeDraggable(): the picture can be pulled out of the page, onto the desktop or onto an image input (same format as ND Variant Selector);
//  - downloadRef(): the "Save" button;
//  - readDrop() / copyToInput(): what an image input needs to take a dropped file, a pulled picture or a pasted one.
import { api } from "../../../../scripts/api.js";

export const ND_IMAGE_MIME = "application/x-nd-image";
const MIMES = { jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", png: "image/png", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", ogg: "audio/ogg", m4a: "audio/mp4" };
const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(String(name || "")) || [])[1]?.toLowerCase() || "";
export const mimeOf = (name, d = "image/png") => MIMES[extOf(name)] || d;

export const cleanRef = (r) => ({ filename: String(r.filename), subfolder: r.subfolder || "", type: r.type || "output" });
// the address of the original file (no preview format, no cache-busting)
export function fileUrl(ref, abs = false) {
    const q = new URLSearchParams({ filename: ref.filename, type: ref.type || "output", subfolder: ref.subfolder || "" });
    const u = api.apiURL(`/view?${q.toString()}`);
    return abs ? new URL(u, window.location.href).href : u;
}

// elm can be pulled out of the page; getRef() says which file it stands for (null = not draggable now)
// opts.nd = false: only the desktop gets the file (a sound or a video is not taken by an image input)
export function makeDraggable(elm, getRef, opts = {}) {
    elm.draggable = true;
    elm.addEventListener("dragstart", (e) => {
        const ref = getRef();
        const dt = e.dataTransfer;
        if (!ref?.filename || !dt) { e.preventDefault(); return; }
        try { dt.clearData(); } catch {}
        const c = cleanRef(ref);
        if (opts.nd !== false) dt.setData(ND_IMAGE_MIME, JSON.stringify(c));
        // outside the browser (desktop, a file manager, another app): Chrome / Edge save the file from this entry
        try { dt.setData("DownloadURL", `${mimeOf(c.filename)}:${c.filename.replace(/[:\\/]/g, "_")}:${fileUrl(c, true)}`); } catch {}
        dt.effectAllowed = "copy";
        const img = elm.tagName === "IMG" ? elm : elm.querySelector?.("img");
        if (img?.naturalWidth) {   // a small picture under the cursor instead of the full one
            const k = Math.min(1, 120 / Math.max(img.naturalWidth, img.naturalHeight));
            const cv = document.createElement("canvas");
            cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
            try {
                cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
                Object.assign(cv.style, { position: "fixed", left: "-1000px", top: "-1000px" });
                document.body.append(cv);
                dt.setDragImage(cv, cv.width / 2, cv.height / 2);
                setTimeout(() => cv.remove(), 0);
            } catch { cv.remove(); }
        }
    });
}

// the "Save" button: the browser downloads the original file
export function downloadRef(ref, name) {
    const a = document.createElement("a");
    a.href = fileUrl(ref);
    a.download = name || ref.filename;
    document.body.append(a); a.click(); a.remove();
}
export function downloadUrl(url, name) {
    const a = document.createElement("a");
    a.href = url; a.download = name || "image.png";
    document.body.append(a); a.click(); a.remove();
}

/* ------------------------------------------------------------------ taking files */

// what was dropped / pasted: [{kind:"ref", ref} | {kind:"file", file}]
export function readDrop(dt) {
    const out = [];
    if (!dt) return out;
    try {
        const raw = dt.getData(ND_IMAGE_MIME);
        if (raw) { const j = JSON.parse(raw); if (j?.filename) out.push({ kind: "ref", ref: cleanRef(j) }); }
    } catch {}
    if (out.length) return out;
    for (const f of Array.from(dt.files || [])) out.push({ kind: "file", file: f });
    return out;
}
export const hasDrop = (dt) => !!dt && (Array.from(dt.types || []).includes(ND_IMAGE_MIME) || Array.from(dt.types || []).includes("Files"));

// a file goes to the input folder; the result is the name a LoadImage-like node takes ("sub/name.png")
export async function uploadFile(file, { type = "input", overwrite = true } = {}) {
    const fd = new FormData();
    fd.append("image", file, file.name); fd.append("type", type); if (overwrite) fd.append("overwrite", "true");
    const r = await api.fetchApi("/upload/image", { method: "POST", body: fd });
    if (!r.ok) throw new Error(`upload failed (${r.status})`);
    const j = await r.json();
    return { name: j.subfolder ? `${j.subfolder}/${j.name}` : j.name, ref: { filename: j.name, subfolder: j.subfolder || "", type: j.type || type } };
}
// a file of the output / temp folder is copied to the input folder (so a Load Image can see it); input files stay where they are
export async function copyToInput(ref) {
    const c = cleanRef(ref);
    if (c.type === "input") return { name: c.subfolder ? `${c.subfolder}/${c.filename}` : c.filename, ref: c };
    const r = await fetch(fileUrl(c));
    if (!r.ok) throw new Error(`read failed (${r.status})`);
    const blob = await r.blob();
    return uploadFile(new File([blob], c.filename, { type: blob.type || mimeOf(c.filename) }));
}
// everything a drop carries, as names in the input folder
export async function takeDrop(items) {
    const out = [];
    for (const it of items) out.push(it.kind === "ref" ? await copyToInput(it.ref) : await uploadFile(it.file));
    return out;
}
// a file name as ComfyUI writes it in a combo: "sub/name.png" or "name.png [input]"
export function refFromName(v, type = "input") {
    let s = String(v ?? "").trim(), t = type;
    const m = /^(.*)\s\[(input|output|temp)\]$/.exec(s);
    if (m) { s = m[1]; t = m[2]; }
    if (!s) return null;
    const i = s.lastIndexOf("/");
    return { filename: i >= 0 ? s.slice(i + 1) : s, subfolder: i >= 0 ? s.slice(0, i) : "", type: t };
}
