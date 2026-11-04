// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — project files: the work of the current workflow in a file of its own type (default .ndui).
// The file is a JSON envelope; the graph inside is packed (gzip + base64), so a project is not a plain workflow for ComfyUI,
// but Builder opens it. Input images and videos are kept as links to the files of the ComfyUI folders, not inside.
import { app } from "../../../scripts/app.js";
import { cleanExt, DEFAULT_EXT } from "./model.js";

export const FORMAT = "nd-ui-project";
export const VERSION = 1;
export const S_OPEN = "NeuralDreamerUI.ProjectOpen";   // "tab" | "replace"

export class ProjectError extends Error {
    constructor(code, extra) { super(code); this.code = code; this.extra = extra || {}; }
}

/* ------------------------------------------------------------------ packing */

async function pipe(bytes, stream) {
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(out);
}
function toB64(u8) {
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
}
function fromB64(b64) {
    const s = atob(b64), u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
}
export async function packGraph(graph) {
    const bytes = new TextEncoder().encode(JSON.stringify(graph));
    return toB64(await pipe(bytes, new CompressionStream("gzip")));
}
export async function unpackGraph(b64) {
    const bytes = await pipe(fromB64(b64), new DecompressionStream("gzip"));
    return JSON.parse(new TextDecoder().decode(bytes));
}

/** the text of a project file */
export async function encodeProject(graph, { ext = DEFAULT_EXT, name = "" } = {}) {
    return JSON.stringify({ format: FORMAT, version: VERSION, ext: cleanExt(ext), name: String(name || ""), saved: new Date().toISOString(), workflow: await packGraph(graph) }, null, 1);
}

/** reads a project file: throws ProjectError("notproject" | "ext" | "version" | "corrupt") */
export async function decodeProject(text, ext) {
    let env;
    try { env = JSON.parse(text); } catch { throw new ProjectError("notproject"); }
    if (!env || typeof env !== "object" || env.format !== FORMAT || typeof env.workflow !== "string") throw new ProjectError("notproject");
    if (Number(env.version) > VERSION) throw new ProjectError("version", { version: env.version });
    if (ext != null && cleanExt(env.ext) !== cleanExt(ext)) throw new ProjectError("ext", { found: cleanExt(env.ext), wanted: cleanExt(ext) });
    let graph;
    try { graph = await unpackGraph(env.workflow); } catch { throw new ProjectError("corrupt"); }
    if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) throw new ProjectError("corrupt");
    return { graph, name: String(env.name || ""), ext: cleanExt(env.ext), saved: env.saved || "" };
}

/* ------------------------------------------------------------------ the browser */

const wf = () => { try { return app.extensionManager?.workflow?.activeWorkflow || null; } catch { return null; } };
const wfKey = () => wf()?.path || "(new)";
export const projectName = () => String(wf()?.filename || "workflow").replace(/\.json$/i, "");
const setting = (id, d) => { try { return app.extensionManager?.setting?.get?.(id) ?? d; } catch { return d; } };
const currentGraph = () => app.graph.serialize();
const handles = new Map();   // workflow -> the file Save writes to again
export const hasHandle = () => handles.has(wfKey());
export const forgetHandle = () => handles.delete(wfKey());

const types = (ext) => [{ description: `ND UI project (.${ext})`, accept: { "application/json": [`.${ext}`] } }];
const canPick = () => typeof window.showSaveFilePicker === "function" && window.isSecureContext;
const aborted = (e) => e && (e.name === "AbortError" || e.code === 20);

function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Save / Save as. Resolves {ok, name, cancelled?}. ext: the type of this workflow (view.save.ext) */
export async function saveProject({ ext, as = false } = {}) {
    ext = cleanExt(ext);
    const name = projectName();
    const text = await encodeProject(currentGraph(), { ext, name });
    const file = `${name}.${ext}`;
    if (canPick()) {
        try {
            let h = !as ? handles.get(wfKey()) : null;
            if (!h) { h = await window.showSaveFilePicker({ suggestedName: file, types: types(ext) }); handles.set(wfKey(), h); }
            const w = await h.createWritable(); await w.write(text); await w.close();
            return { ok: true, name: h.name || file };
        } catch (e) {
            if (aborted(e)) return { ok: false, cancelled: true };
            handles.delete(wfKey());   // the file is gone or locked: fall back to a download
        }
    }
    download(file, text);
    return { ok: true, name: file, downloaded: true };
}

async function pickText(ext) {
    if (typeof window.showOpenFilePicker === "function" && window.isSecureContext) {
        try {
            const [h] = await window.showOpenFilePicker({ types: types(ext), multiple: false });
            const f = await h.getFile();
            return { text: await f.text(), name: f.name, handle: h };
        } catch (e) { if (aborted(e)) return null; }
    }
    return new Promise((resolve) => {
        const inp = document.createElement("input"); inp.type = "file"; inp.accept = `.${ext}`; inp.style.display = "none";
        inp.addEventListener("change", async () => { const f = inp.files?.[0]; inp.remove(); resolve(f ? { text: await f.text(), name: f.name } : null); });
        inp.addEventListener("cancel", () => { inp.remove(); resolve(null); });
        document.body.append(inp); inp.click();
    });
}

/** puts a graph into ComfyUI: a new tab or the current workflow (the ComfyUI setting ComfyUI ND UI Builder > Project files) */
export async function loadGraph(graph, name) {
    if (setting(S_OPEN, "tab") === "replace" && wf()) await app.loadGraphData(graph, true, true, wf());
    else await app.loadGraphData(graph, true, true, name || "project");
}

/** Open: asks for a file of the type `ext`. Resolves {ok, name} or {ok:false, error: ProjectError | null} (null: cancelled) */
export async function openProject({ ext } = {}) {
    ext = cleanExt(ext);
    const picked = await pickText(ext);
    if (!picked) return { ok: false, error: null };
    try {
        const d = await decodeProject(picked.text, ext);
        const base = picked.name.replace(new RegExp(`\\.${ext}$`, "i"), "");
        await loadGraph(d.graph, base);
        if (picked.handle) handles.set(wfKey(), picked.handle);
        return { ok: true, name: picked.name };
    } catch (e) {
        if (e instanceof ProjectError) return { ok: false, error: e };
        throw e;
    }
}

export const toast = (severity, summary, detail) => { try { app.extensionManager?.toast?.add?.({ severity, summary, detail, life: 4500 }); } catch {} };
