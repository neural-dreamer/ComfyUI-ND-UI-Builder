// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — events: what the graph reports while it runs (results, live frames, progress, the queue), kept for the widgets.
// One bus for the whole page: it listens as soon as the module is loaded, so a panel that is opened later still has the last results.
// A source node is found by its execution id ("12", or "5:12" inside a subgraph); `forNode(node)` hides that detail.

import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";

const HISTORY_MAX = 40;
const state = {
    version: 0,
    results: new Map(),   // exec id -> {images: [ref...], video: [ref...], audio: [ref...], text: string, at}
    history: new Map(),   // exec id -> [[ref...] ...] (newest first), one entry per run
    vhistory: new Map(),  // the same for videos
    ahistory: new Map(),  // and for sounds
    live: new Map(),      // exec id -> {url, at}
    liveAny: null,        // the newest frame of any node: {url, id, at}
    run: { active: false, startedAt: 0, promptId: "", nodes: new Map(), current: "", value: 0, max: 0, total: 0, done: 0, expected: 0, cached: new Set(), fin: new Set(), complete: false },
    queue: { running: 0, pending: 0, remaining: 0 },
    lastError: "",
    exec: "",             // execution id of the node that runs now (for previews that come without a node)
};
const subs = new Set();
const bump = () => { state.version++; for (const f of subs) { try { f(); } catch {} } };
export const events = state;
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

export const debugOn = () => { try { return String(localStorage.getItem("ndui-debug") || "").includes("live"); } catch { return false; } };
export const dbg = (...a) => { if (debugOn()) console.log("[ND UI] live", ...a); };
// "12:5:7" -> ["12:5:7", "12:5", "12"]: the frontend keeps a preview for the node and for every subgraph node around it
export const withAncestors = (id) => { const p = String(id).split(":"), out = []; for (let i = p.length; i > 0; i--) out.push(p.slice(0, i).join(":")); return out; };
const isBlob = (b) => !!b && typeof b === "object" && typeof b.size === "number" && typeof b.type === "string" && typeof b.slice === "function";

function putLive(ids, url, extra = {}) {
    const at = Date.now();
    const seen = new Set();
    for (const id of ids) for (const k of withAncestors(id)) {
        if (!k || seen.has(k)) continue;
        seen.add(k);
        const prev = state.live.get(k)?.url;
        state.live.set(k, { url, at, ...extra });
        if (prev && prev !== url && prev.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(prev), 4000);
    }
    state.liveAny = { url, id: [...ids][0] || "", at };
}

const isRef = (x) => x && typeof x === "object" && typeof x.filename === "string";
const refs = (a) => (Array.isArray(a) ? a.filter(isRef).map((r) => ({ filename: r.filename, subfolder: r.subfolder || "", type: r.type || "output" })) : []);

// the images a node reported: the standard `images`, or ND Variant Preview Selector's own lists
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/i, AUDIO_EXT = /\.(mp3|wav|flac|ogg|opus|m4a|aac|wma)$/i;
export const isVideoName = (n) => VIDEO_EXT.test(String(n || ""));
export const isAudioName = (n) => AUDIO_EXT.test(String(n || ""));
function imagesOf(output) {
    if (!output || typeof output !== "object") return [];
    for (const k of ["images", "nd_final", "nd_batch"]) { const r = refs(output[k]).filter((x) => !isVideoName(x.filename) && !isAudioName(x.filename)); if (r.length) return r; }
    return [];
}
// videos and sounds a node reported: `images` with a video file (SaveVideo), `video` / `videos` / `gifs` (VHS Video Combine), `audio` (SaveAudio, PreviewAudio)
const rawRefs = (a) => (Array.isArray(a) ? a.filter(isRef).map((r) => ({ filename: r.filename, subfolder: r.subfolder || "", type: r.type || "output", ...(r.format ? { format: r.format } : {}), ...(r.frame_rate ? { frame_rate: r.frame_rate } : {}) })) : []);
export function mediaOf(output) {
    const out = { video: [], audio: [] };
    if (!output || typeof output !== "object") return out;
    for (const k of ["video", "videos", "gifs", "images", "nd_final"]) for (const r of rawRefs(output[k])) { if (isVideoName(r.filename)) out.video.push(r); }
    for (const k of ["audio", "audios"]) for (const r of rawRefs(output[k])) { if (!isVideoName(r.filename)) out.audio.push(r); }
    for (const k of ["images", "video", "videos", "gifs"]) for (const r of rawRefs(output[k])) { if (isAudioName(r.filename)) out.audio.push(r); }
    return out;
}
function textOf(output) {
    if (!output) return "";
    for (const k of ["nd_text", "text"]) { const v = output[k]; if (Array.isArray(v) && v.length) return v.map((x) => String(x)).join("\n"); if (typeof v === "string") return v; }
    return "";
}

export const viewUrl = (r) => api.apiURL(`/view?filename=${encodeURIComponent(r.filename)}&type=${encodeURIComponent(r.type || "output")}&subfolder=${encodeURIComponent(r.subfolder || "")}&rand=${r.rand ?? ""}`);

/* ------------------------------------------------------------------ the execution id of a node */

export function execIdOf(node) {
    try {
        const g = node.graph, root = app.rootGraph || app.graph;
        if (!g || g === root) return String(node.id);
        // a node inside a subgraph: the path of the subgraph nodes that hold it
        const path = [String(node.id)];
        let cur = g, guard = 0;
        while (cur && cur !== root && guard++ < 16) {
            const holder = (root.nodes || root._nodes || []).find((n) => n.subgraph === cur) || findHolder(root, cur);
            if (!holder) break;
            path.unshift(String(holder.id));
            cur = holder.graph;
        }
        return path.join(":");
    } catch { return String(node.id); }
}
function findHolder(g, sub, depth = 0) {
    if (depth > 8) return null;
    for (const n of g._nodes || g.nodes || []) {
        if (n.subgraph === sub) return n;
        if (n.subgraph) { const h = findHolder(n.subgraph, sub, depth + 1); if (h) return h; }
    }
    return null;
}
const keysFor = (node) => { const id = execIdOf(node); return [id, String(node.id)]; };
const hit = (map, node) => { for (const k of keysFor(node)) if (map.has(k)) return { key: k, v: map.get(k) }; const tail = `:${node.id}`; for (const [k, v] of map) if (k.endsWith(tail)) return { key: k, v }; return null; };

/* ------------------------------------------------------------------ what the widgets ask */

export function forNode(node) {
    if (!node) return { images: [], video: [], audio: [], history: [], vhistory: [], ahistory: [], text: "", live: null, progress: null };
    const r = hit(state.results, node)?.v;
    const h = hit(state.history, node)?.v || [];
    // frames: of a bridge, of a bridge on the model wire of the node (a sampler), the node's own preview of ComfyUI; the newest wins
    const own = isBridgeNode(node);
    const up = own ? null : upstreamBridge(node);
    const cands = [own ? bridgeFrame(node) : null, up ? bridgeFrame(up) : null, own ? null : hit(state.live, node)?.v, storedFrame(node)].filter(Boolean);
    const l = cands.sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
    return { images: r?.images || [], video: r?.video || [], audio: r?.audio || [], history: h, vhistory: hit(state.vhistory, node)?.v || [], ahistory: hit(state.ahistory, node)?.v || [], text: r?.text || "", live: l, progress: progressOf(node) };
}
export const BRIDGE_CLASS = "NDUILiveBridge";
export const isBridgeNode = (node) => !!node && (node.comfyClass === BRIDGE_CLASS || node.type === BRIDGE_CLASS);
// the ND UI Live Bridge on the MODEL wire in front of a node (a sampler): found by walking the wires upstream; null when there is none
export function upstreamBridge(node) {
    try {
        const seen = new Set(), queue = [node];
        for (let guard = 0; queue.length && guard < 300; guard++) {
            const n = queue.shift();
            if (!n || seen.has(n)) continue;
            seen.add(n);
            if (n !== node && isBridgeNode(n)) return n;
            const g = n.graph;
            for (const inp of n.inputs || []) {
                if (!inp || inp.link == null || (inp.type !== "MODEL" && inp.type !== "*")) continue;
                const link = g?.getLink?.(inp.link) ?? g?.links?.get?.(inp.link) ?? g?.links?.[inp.link];
                const o = link && g.getNodeById(link.origin_id);
                if (o) queue.push(o);
            }
        }
    } catch {}
    return null;
}
// the bridge that serves a node bound to a Viewer: the node itself when it is one, or the one in front of it
export const bridgeFor = (node) => (!node ? null : isBridgeNode(node) ? node : upstreamBridge(node));
// does the bridge have an audio VAE wired? Without one it makes no sound, so the widgets show no speaker and no volume
export function bridgeHasAudio(b) {
    try { const i = (b?.inputs || []).find((x) => x?.name === "audio_vae"); return !!i && i.link != null; } catch { return false; }
}
// a widget not bound to a bridge: the sound is possible when any bridge of the graph has the audio VAE
export function anyBridgeAudio() {
    try { return (window.app?.graph?._nodes || []).some((n) => isBridgeNode(n) && bridgeHasAudio(n)); } catch { return false; }
}
// frames of an ND UI Live Bridge are kept under "bridge:<execution id of the bridge>"
function bridgeFrame(node) {
    for (const k of keysFor(node)) { const v = state.live.get("bridge:" + k); if (v) return v; }
    const tail = `:${node.id}`;
    for (const [k, v] of state.live) if (k.startsWith("bridge:") && k.endsWith(tail)) return v;
    return null;
}
// what the canvas itself shows for the node while it runs (the frontend keeps it for the node and the subgraph nodes around it)
function storedFrame(node) {
    if (!state.run.active || isBridgeNode(node)) return null;
    try {
        const map = app.nodePreviewImages;
        if (!map) return null;
        for (const k of keysFor(node)) {
            const v = map[k];
            if (Array.isArray(v) && v.length && typeof v[v.length - 1] === "string") return { url: v[v.length - 1], at: 0, stored: true };
        }
    } catch {}
    return null;
}
export function progressOf(node) {
    const run = state.run;
    if (!node) return { active: run.active, pct: overall(), steps: stepsPct(), value: run.value, max: run.max, name: run.current, done: doneCount(), total: toRunCount() };
    const n = hit(run.nodes, node)?.v;
    if (!n) return { active: false, pct: 0, value: 0, max: 0, name: "", state: "" };
    const pct = n.state === "finished" ? 1 : n.max > 0 ? Math.min(1, n.value / n.max) : 0;
    return { active: n.state === "running", pct, value: n.value, max: n.max, name: "", state: n.state };
}
// How many nodes the run has to execute: the nodes of the prompt that was sent minus the ones ComfyUI took from the cache.
// (The old count came from progress_state, which lists only the nodes seen so far - cached nodes arrive finished - so the bar started at 90%.)
export function toRunCount() {
    const run = state.run;
    const base = run.expected || run.total;
    return Math.max(1, base - (run.expected ? run.cached.size : 0));
}
export const doneCount = () => state.run.fin.size;
export const stepsPct = () => { const run = state.run; return run.active && run.max > 0 ? Math.min(1, run.value / run.max) : 0; };
export function overall() {
    const run = state.run;
    if (run.complete) return 1;
    const part = run.current ? stepsPct() : 0;
    return Math.min(1, (doneCount() + part) / toRunCount());
}
// the newest result of any node (for a widget that is not bound to a node): {images, text, history, id}
export function latestAny(kind) {
    let best = null;
    const has = (r) => (kind === "text" ? r.text : kind === "video" ? r.video?.length : kind === "audio" ? r.audio?.length : r.images.length);
    for (const [id, r] of state.results) { if (has(r) && (!best || r.at > best.r.at)) best = { id, r }; }
    return best
        ? { images: best.r.images, video: best.r.video || [], audio: best.r.audio || [], text: best.r.text, history: state.history.get(best.id) || [], vhistory: state.vhistory.get(best.id) || [], ahistory: state.ahistory.get(best.id) || [], id: best.id }
        : { images: [], video: [], audio: [], text: "", history: [], vhistory: [], ahistory: [], id: "" };
}
export const clearResults = () => { state.results.clear(); state.history.clear(); state.vhistory.clear(); state.ahistory.clear(); state.live.clear(); state.liveAny = null; bump(); };

/* ------------------------------------------------------------------ listeners */

let started = false;
const nameOf = (id) => { try { const n = app.graph?.getNodeById?.(id) ?? null; return n ? (n.title || n.type) : ""; } catch { return ""; } };

export function startEvents() {
    if (started) return;
    started = true;
    patchQueueApi();
    api.addEventListener("executed", (e) => {
        const d = e.detail || {};
        const id = String(d.display_node || d.node || "");
        if (!id) return;
        if (debugOn() && d.output && (d.output.audio || d.output.gifs || d.output.video || d.output.videos || d.output.animated)) dbg("executed with media", id, JSON.stringify(d.output).slice(0, 600));
        const images = imagesOf(d.output), text = textOf(d.output), media = mediaOf(d.output);
        if (!images.length && !text && !media.video.length && !media.audio.length) return;
        const at = Date.now();
        if (images.length) images.forEach((r, i) => { r.rand = `${at}${i}`; });
        for (const k of ["video", "audio"]) media[k].forEach((r, i) => { r.rand = `${at}${k[0]}${i}`; });
        const prevR = state.results.get(id);
        // a node that reports only some kinds keeps the others of its last result
        state.results.set(id, { images: images.length ? images : prevR?.images || [], video: media.video.length ? media.video : prevR?.video || [], audio: media.audio.length ? media.audio : prevR?.audio || [], text: text || prevR?.text || "", at });
        for (const [k, map] of [["video", state.vhistory], ["audio", state.ahistory]]) if (media[k].length) {
            const h = map.get(id) || [];
            h.unshift(media[k]); h.length = Math.min(h.length, HISTORY_MAX);
            map.set(id, h);
        }
        if (images.length) {
            const h = state.history.get(id) || [];
            h.unshift(images); h.length = Math.min(h.length, HISTORY_MAX);
            state.history.set(id, h);
            if (state.live.has(id)) state.live.delete(id); // the finished picture replaces the frames
        }
        bump();
    });
    // a frame comes twice: with the node it belongs to (b_preview_with_metadata) and then as a plain b_preview
    let skipLegacy = false;
    api.addEventListener("b_preview_with_metadata", (e) => {
        const d = e.detail || {};
        if (!isBlob(d.blob)) return;
        skipLegacy = true;
        const ids = [d.displayNodeId, d.nodeId, d.realNodeId, d.parentNodeId].filter((x) => x != null && x !== "").map(String);
        dbg("frame with metadata", ids);
        if (!ids.length) { skipLegacy = false; return; }
        putLive(ids, URL.createObjectURL(d.blob));
        bump();
    });
    api.addEventListener("b_preview", (e) => {
        if (skipLegacy) { skipLegacy = false; return; }
        const blob = e.detail;
        if (!isBlob(blob)) return;
        const id = state.exec;
        dbg("frame without metadata, node", id || "(unknown)");
        putLive(id ? [id] : [], URL.createObjectURL(blob));
        bump();
    });
    api.addEventListener("executing", (e) => {
        const d = e.detail;
        const id = d && typeof d === "object" ? d.display_node ?? d.node : d;
        state.exec = id == null ? "" : String(id);
    });
    // frames that ND Live Preview Bridge (Nodes) sends: a data address per image of the batch
    api.addEventListener("nd_live_frame", (e) => {
        const d = e.detail || {};
        const u = Array.isArray(d.images) ? d.images[0] : null;
        const url = typeof u === "string" ? u : u?.url || u?.src || "";
        if (!url) return;
        putLive([String(d.sampler ?? d.bridge ?? "")], url, { step: d.step || 0, steps: d.steps || 0 });
        bump();
    });
    // frames of ND UI Live Bridge (this pack)
    api.addEventListener("ndui_live_frame", (e) => {
        const d = e.detail || {};
        const u = Array.isArray(d.images) ? d.images[0] : null;
        const url = d.url || (typeof u === "string" ? u : u?.url || u?.src || "");
        if (!url || d.bridge == null) return;
        dbg("bridge frame", d.bridge, d.sampler, `${d.step}/${d.steps}`, d.kind || "image");
        const at = Date.now();
        // kind "video": a short clip (MP4, or an animated WebP) with the frames made so far; `audio` says the MP4 carries the sound
        const frame = { url, at, step: d.step || 0, steps: d.steps || 0, sampler: d.sampler, kind: d.kind === "video" ? "video" : "image", mime: d.mime || "", fps: Number(d.fps) || 0, audio: d.audio === true };
        state.live.set("bridge:" + d.bridge, frame);
        state.liveAny = { ...frame, id: String(d.bridge) };
        bump();
    });
    api.addEventListener("execution_start", (e) => {
        const run = state.run;
        run.active = true; run.promptId = e.detail?.prompt_id || ""; run.nodes = new Map(); run.current = ""; run.value = 0; run.max = 0; run.total = 0; run.done = 0; run.startedAt = Date.now();
        run.cached = new Set(); run.fin = new Set(); run.complete = false;
        run.expected = takeExpected(run.promptId);
        state.lastError = "";
        state.live.clear(); state.liveAny = null; state.exec = "";
        if (state.queue.remaining < 1) state.queue.remaining = 1;
        syncQueue(); bump();
    });
    // queue_remaining counts the running job and the waiting ones, and its message comes BEFORE execution_start: so the raw number is kept
    // and the split into running / waiting is recomputed on every event that changes whether a job is running
    const syncQueue = () => {
        const q = state.queue, running = state.run.active && q.remaining > 0 ? 1 : 0;
        q.running = running;
        q.pending = Math.max(0, q.remaining - running);
    };
    const finish = () => {
        state.exec = ""; const run = state.run; run.active = false; run.current = ""; run.value = run.max = 0; if (run.total) run.done = run.total;
        state.queue.remaining = Math.max(0, state.queue.remaining - 1); // the finished job leaves the queue; the next status message confirms it
        syncQueue(); bump();
    };
    api.addEventListener("execution_success", () => { state.run.complete = true; finish(); });
    api.addEventListener("execution_interrupted", finish);
    api.addEventListener("execution_error", (e) => { state.lastError = e.detail?.exception_message || "Error"; finish(); });
    api.addEventListener("execution_cached", (e) => {
        const run = state.run;
        for (const k of e.detail?.nodes || []) { const id = String(k); run.cached.add(id); run.fin.delete(id); }
        bump();
    });
    api.addEventListener("progress_state", (e) => {
        const run = state.run, nodes = e.detail?.nodes || {};
        run.active = true;
        run.nodes = new Map();
        let total = 0, done = 0, cur = null;
        for (const [k, n] of Object.entries(nodes)) {
            const id = String(n.display_node_id || n.real_node_id || n.node_id || k);
            const st = { state: n.state, value: Number(n.value) || 0, max: Number(n.max) || 0 };
            const prev = run.nodes.get(id);
            if (!prev || st.state === "running") run.nodes.set(id, st);
            total++; if (n.state === "finished") { done++; if (!run.cached.has(id)) run.fin.add(id); } if (n.state === "running") cur = { id, ...st };
        }
        run.total = total; run.done = done;
        run.current = cur ? (nameOf(cur.id) || `#${cur.id}`) : "";
        run.value = cur?.value || 0; run.max = cur?.max || 0;
        bump();
    });
    api.addEventListener("progress", (e) => {
        const d = e.detail || {};
        const run = state.run;
        if (!run.nodes.size) { run.active = true; run.value = Number(d.value) || 0; run.max = Number(d.max) || 0; run.current = nameOf(d.node) || run.current; bump(); }
    });
    api.addEventListener("status", (e) => {
        const q = e.detail?.exec_info?.queue_remaining;
        if (q != null) {
            state.queue.remaining = Math.max(0, Number(q) || 0);
            if (state.queue.remaining === 0) { state.run.active = false; state.run.current = ""; }
            syncQueue(); bump();
        }
    });
    // a workflow that is loaded or cleared has no results of its own
    api.addEventListener("graphCleared", () => clearResults());
}

/* ------------------------------------------------------------------ actions */

export async function runQueue(batch = 1) {
    try { await app.queuePrompt(0, Math.max(1, Math.round(batch))); } catch (e) { console.warn("[ND UI] queue failed", e); }
}
/* ------------------------------------------------ run up to a node ("Run to node")

   ComfyUI runs "up to" OUTPUT nodes only. For any other node the helper node NDUIRunTarget is added to the prompt of that one run
   (it is wired to the chosen node) and ComfyUI is asked to run only up to the helper. The helper is never in the graph. */

export const RUN_TARGET_CLASS = "NDUIRunTarget";
export const RUN_TARGET_ID = "ndui_run_target";
const targets = []; // one entry for every prompt that api.queuePrompt will send for the current click
let targetTimer = 0;
let apiPatched = false;

// How many nodes each queued prompt has (the progress needs it): by prompt id once the answer is known, otherwise in the order of sending.
const sentQ = [], totals = new Map();
function takeExpected(pid) {
    const rec = sentQ.shift();
    return (pid && totals.get(pid)) || rec?.n || 0;
}

function patchQueueApi() {
    if (apiPatched || typeof api.queuePrompt !== "function") return;
    apiPatched = true;
    const orig = api.queuePrompt.bind(api);
    api.queuePrompt = async function (number, data, options) {
        const t = targets[0];
        if (t && data?.output && data.output[t.id]) {
            targets.shift();
            data = { ...data, output: { ...data.output, [RUN_TARGET_ID]: { class_type: RUN_TARGET_CLASS, inputs: { source: [String(t.id), t.slot] } } } };
            options = { ...(options || {}), partialExecutionTargets: [RUN_TARGET_ID] };
        }
        const rec = { n: data?.output ? Object.keys(data.output).length : 0 };
        sentQ.push(rec);
        try {
            const res = await orig(number, data, options);
            if (res?.prompt_id) { totals.set(res.prompt_id, rec.n); if (totals.size > 30) totals.delete(totals.keys().next().value); }
            else { const i = sentQ.indexOf(rec); if (i >= 0) sentQ.splice(i, 1); }
            return res;
        } catch (err) {
            const i = sentQ.indexOf(rec); if (i >= 0) sentQ.splice(i, 1);
            throw err;
        }
    };
}

export const isOutputNode = (node) => {
    const d = node?.constructor?.nodeData;
    if (d && d.output_node != null) return !!d.output_node;
    return !!(node?.constructor?.output_node || node?.output_node);
};
export const hasOutputs = (node) => Array.isArray(node?.outputs) && node.outputs.length > 0;

/** Can this node be a target? (a node of the main graph, active, with an output or an output node itself) */
export function runTargetState(node) {
    if (!node) return "none";
    if (node.graph && node.graph !== app.graph) return "subgraph";
    if (node.mode === 2 || node.mode === 4) return "off";
    if (isOutputNode(node) || hasOutputs(node)) return "ok";
    return "noout";
}

export async function runToNode(node, batch = 1) {
    const st = runTargetState(node);
    if (st !== "ok") { state.lastError = st === "subgraph" ? "A node inside a subgraph cannot be a target" : st === "off" ? "The target node is muted or bypassed" : st === "noout" ? "The target node has no output" : "Choose a target node"; bump(); return false; }
    const n = Math.max(1, Math.round(batch));
    state.lastError = "";
    try {
        if (isOutputNode(node)) {
            await app.queuePrompt(0, n, { queueNodeIds: [node.id] });
        } else {
            patchQueueApi();
            targets.length = 0;
            for (let i = 0; i < n; i++) targets.push({ id: String(node.id), slot: 0 });
            clearTimeout(targetTimer);
            targetTimer = setTimeout(() => { targets.length = 0; }, 8000);
            await app.queuePrompt(0, n);
        }
        return true;
    } catch (e) { console.warn("[ND UI] run to node failed", e); return false; }
    finally { if (!targets.length) clearTimeout(targetTimer); }
}

export async function stopRun() {
    try { await api.interrupt(state.run.promptId || null); } catch (e) { try { await api.interrupt(); } catch {} }
}
export async function clearQueue() {
    try { await api.clearItems?.("queue"); } catch { try { await api.fetchApi("/queue", { method: "POST", body: JSON.stringify({ clear: true }) }); } catch {} }
}
