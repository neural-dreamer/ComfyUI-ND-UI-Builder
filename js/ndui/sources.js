// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — sources: the nodes of the graph whose parameters the panel controls.
// A node becomes a source by a tag in its title ("Empty Latent [resolution]") or by a click on the canvas.
// The link is kept in node.properties.nd_ui_src = {uid, tag}: the uid survives renaming and moving, the tag finds the node again
// when the uid is gone (a pasted workflow, a loaded preset). Nodes inside subgraphs are found too.

import { app } from "../../../scripts/app.js";
import { uid } from "./model.js";
import { virtualParams } from "./virtual.js";

export const TAG_RE = /\[([^\[\]]{1,40})\]/;
export const tagOf = (title) => { const m = TAG_RE.exec(String(title ?? "")); return m ? m[1].trim().toLowerCase() : ""; };
const LG = () => globalThis.LiteGraph;

/* ------------------------------------------------------------------ graphs and nodes */

export function allGraphs() {
    const root = app.rootGraph ?? app.graph;
    if (!root) return [];
    const out = [root];
    try { for (const g of root.subgraphs?.values?.() ?? []) out.push(g); } catch {}
    return out;
}
export function allNodes() {
    const out = [];
    for (const g of allGraphs()) for (const n of g.nodes ?? g._nodes ?? []) out.push(n);
    return out;
}
const srcOf = (n) => (n?.properties?.nd_ui_src && typeof n.properties.nd_ui_src === "object" ? n.properties.nd_ui_src : null);
export const isUiNode = (n) => (n?.comfyClass || n?.type) === "NDUI";
const isUsable = (n) => n && !isUiNode(n) && n.graph;

// The index is rebuilt when the graph changes or a lookup fails (at most every 400 ms).
let index = { at: 0, ver: -1, byUid: new Map(), byTag: new Map() };
function graphVersion() { return (app.rootGraph ?? app.graph)?._version ?? 0; }
function rebuild() {
    const byUid = new Map(), byTag = new Map();
    for (const n of allNodes()) {
        if (!isUsable(n)) continue;
        const s = srcOf(n);
        if (s?.uid && !byUid.has(s.uid)) byUid.set(s.uid, n);
        const t = tagOf(n.title);
        if (t && !byTag.has(t)) byTag.set(t, n);
    }
    index = { at: performance.now(), ver: graphVersion(), byUid, byTag };
}
// the node that has this [tag] in its title (null if none); the link of the node is left alone
export function nodeByTag(tag) {
    invalidateSources(); rebuild();
    const n = index.byTag.get(String(tag || "").toLowerCase());
    return isUsable(n) ? n : null;
}
export const srcUidOf = (n) => srcOf(n)?.uid || "";
export function invalidateSources() { index.at = 0; index.ver = -1; }

// The node of a source ({uid, tag}); null when it is gone.
export function findSource(src) {
    if (!src) return null;
    const hit = index.byUid.get(src.uid);
    if (isUsable(hit) && (srcOf(hit)?.uid === src.uid)) return hit;
    const now = performance.now();
    if (index.ver !== graphVersion() || now - index.at > 400) rebuild();
    let n = index.byUid.get(src.uid);
    if (isUsable(n)) return n;
    n = src.tag ? index.byTag.get(String(src.tag).toLowerCase()) : null;
    if (isUsable(n)) {
        // found by the tag: the node takes the uid of the source from now on
        try { n.properties = n.properties || {}; n.properties.nd_ui_src = { uid: src.uid, tag: src.tag }; index.byUid.set(src.uid, n); } catch {}
        return n;
    }
    return null;
}

// Two nodes with one uid (a pasted copy) would both claim the source: the younger one gets a new uid.
export function dedupeUids() {
    const seen = new Set();
    const nodes = allNodes().filter(isUsable).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    for (const n of nodes) {
        const s = srcOf(n);
        if (!s?.uid) continue;
        if (seen.has(s.uid)) n.properties.nd_ui_src = { uid: uid("s_"), tag: s.tag || "" };
        else seen.add(s.uid);
    }
    invalidateSources();
}

// Makes the node a source of the panel (adds it to ui.sources, writes the link into the node). Returns the entry.
export function addSource(ui, node) {
    let s = srcOf(node);
    let entry = s?.uid ? ui.sources.find((e) => e.uid === s.uid) : null;
    if (!entry) {
        const tag = tagOf(node.title);
        entry = { uid: s?.uid || uid("s_"), tag: tag || s?.tag || "", class: node.comfyClass || node.type || "", title: node.title || "" };
        ui.sources.push(entry);
    }
    node.properties = node.properties || {};
    node.properties.nd_ui_src = { uid: entry.uid, tag: entry.tag };
    entry.class = node.comfyClass || node.type || entry.class;
    entry.title = node.title || entry.title;
    invalidateSources();
    return entry;
}

// Nodes with a [tag] in the title that the panel does not know yet.
export function taggedNodes(ui) {
    const known = new Set(ui.sources.map((s) => s.uid));
    const tags = new Set(ui.sources.map((s) => (s.tag || "").toLowerCase()).filter(Boolean));
    const out = [];
    for (const n of allNodes()) {
        if (!isUsable(n)) continue;
        const t = tagOf(n.title);
        if (!t) continue;
        const s = srcOf(n);
        if (s?.uid && known.has(s.uid)) continue;
        if (tags.has(t) && !s) continue; // found by its tag already
        out.push(n);
    }
    return out;
}

/* ------------------------------------------------------------------ the parameters of a node */

function inputSpec(node, name) {
    const nd = node.constructor?.nodeData ?? LG()?.registered_node_types?.[node.type]?.nodeData;
    const inp = nd?.input;
    return inp?.required?.[name] ?? inp?.optional?.[name] ?? inp?.hidden?.[name] ?? null;
}
export function valuesOf(widget, node) {
    const v = widget?.options?.values;
    try { return typeof v === "function" ? v(widget, node) : Array.isArray(v) ? v : []; } catch { return []; }
}
// ComfyUI hides a widget while a wire drives it (w.hidden): such a parameter is still a parameter of the panel
export function isHiddenWidget(w, node) {
    if (w.options?.hidden || w.nd_hidden || w.type === "hidden") return true;
    if (!w.hidden) return false;
    try {
        const i = (node?.inputs || []).findIndex((inp) => inp.widget?.name === w.name);
        if (i >= 0 && (typeof node.isInputConnected === "function" ? node.isInputConnected(i) : node.inputs[i].link != null)) return false;
    } catch {}
    return true;
}

// {name, label, ptype: INT | FLOAT | STRING | COMBO | BOOLEAN | OTHER, ...} of one widget; null for widgets that cannot be linked.
export function paramInfo(node, widget) {
    if (!widget?.name || isHiddenWidget(widget, node)) return null;
    const spec = inputSpec(node, widget.name);
    const o = spec && typeof spec[1] === "object" && spec[1] ? spec[1] : {};
    const wo = widget.options || {};
    const t = widget.type;
    let ptype = "OTHER", multiline = false;
    if (t === "combo") ptype = "COMBO";
    else if (t === "toggle") ptype = "BOOLEAN";
    else if (t === "number" || t === "slider") {
        if (spec?.[0] === "INT") ptype = "INT";
        else if (spec?.[0] === "FLOAT") ptype = "FLOAT";
        else ptype = wo.precision === 0 || (wo.precision == null && Number.isInteger(widget.value)) ? "INT" : "FLOAT";
    }
    else if (t === "text" || t === "string") ptype = "STRING";
    else if (t === "customtext" || t === "textarea" || widget.element?.tagName === "TEXTAREA" || widget.inputEl?.tagName === "TEXTAREA") { ptype = "STRING"; multiline = true; }
    if (ptype === "STRING" && o.multiline) multiline = true;
    if (ptype === "OTHER") return { name: widget.name, label: widget.label || widget.name, ptype, widget, node };
    const step = Number.isFinite(wo.step2) && wo.step2 > 0 ? wo.step2 : Number.isFinite(o.step) && o.step > 0 ? o.step : Number.isFinite(wo.step) && wo.step > 0 ? wo.step / 10 : ptype === "INT" ? 1 : 0.01;
    const min = Number.isFinite(o.min) ? o.min : Number.isFinite(wo.min) ? wo.min : null;
    const max = Number.isFinite(o.max) ? o.max : Number.isFinite(wo.max) ? wo.max : null;
    const precision = Number.isFinite(wo.precision) ? wo.precision : ptype === "INT" ? 0 : Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
    return {
        name: widget.name, label: widget.label || widget.name, ptype, widget, node, multiline,
        min, max, step, precision,
        def: o.default !== undefined ? o.default : undefined,
        control: widget.name === "control_after_generate",
        seed: ptype === "INT" && /seed/i.test(widget.name),
    };
}

export function listParams(node) {
    const out = [];
    for (const w of node?.widgets || []) {
        const p = paramInfo(node, w);
        if (p) out.push(p);
    }
    out.push(...virtualParams(node));
    return out;
}

// one parameter of a node by its name: a real widget, or a virtual one (ND Slider "value", ND Resolution "width" / "height")
export function paramByName(node, name) {
    const w = node?.widgets?.find((x) => x.name === name);
    const p = w ? paramInfo(node, w) : null;
    return p || virtualParams(node).find((v) => v.name === name) || null;
}

// the widget `control_after_generate` that belongs to a seed-like widget (the one placed right after it)
export function controlOf(node, name) {
    const ws = node?.widgets || [];
    const i = ws.findIndex((w) => w.name === name);
    if (i < 0) return null;
    const next = ws[i + 1];
    return next && next.name === "control_after_generate" ? next : ws.find((w) => w.name === "control_after_generate") || null;
}

// does a parameter of this type fit a slot that accepts these types?
export const fits = (accepts, ptype) => accepts.includes(ptype);

// the widget a parameter should get by default when the person clicks "+" next to it
export function defaultWidgetFor(p) {
    switch (p.ptype) {
        case "INT": if (p.seed) return "seed"; return p.min != null && p.max != null && p.max - p.min <= 4096 ? "slider" : "number";
        case "FLOAT": return p.min != null && p.max != null ? "slider" : "number";
        case "STRING": return p.multiline ? "prompt" : "text";
        case "COMBO": return (valuesOf(p.widget, p.node).length <= 5 ? "segmented" : "dropdown");
        case "BOOLEAN": return "toggle";
        default: return null;
    }
}

/* ------------------------------------------------------------------ writing and reading the value */

export function readParam(p) {
    try { return p.widget.value; } catch { return undefined; }
}
export function writeParam(p, v) {
    const w = p.widget, node = p.node;
    if (!w) return false;
    try {
        if (typeof w.setValue === "function") w.setValue(v, { e: undefined, node, canvas: app.canvas });
        else { w.value = v; w.callback?.(v, app.canvas, node); }
    } catch (e) {
        try { w.value = v; w.callback?.(v, app.canvas, node); } catch {}
    }
    try { node.graph?.setDirtyCanvas?.(true, false); app.canvas?.setDirty?.(true, false); } catch {}
    return true;
}

// the state of a linked parameter: wired from another node, muted, bypassed
export function paramState(p) {
    const node = p.node;
    let linked = false;
    try {
        const i = (node.inputs || []).findIndex((inp) => inp.widget?.name === p.name);
        if (i >= 0) linked = typeof node.isInputConnected === "function" ? node.isInputConnected(i) : node.inputs[i].link != null;
    } catch {}
    const mode = node.mode ?? 0;
    return { linked, muted: mode === 2, bypassed: mode === 4 };
}

/* ------------------------------------------------------------------ picking on the canvas */

// While it runs, the next click on the graph canvas is taken instead of being passed on.
// onHover(node, widget) and onPick(node, widget) get the node under the pointer and its widget (or null).
export function pickOnCanvas({ onHover, onPick, onCancel, skip }) {
    const canvas = app.canvas;
    const find = (e) => {
        const g = canvas?.graph;
        if (!g || !canvas.convertEventToCanvasOffset) return { node: null, widget: null };
        const [x, y] = canvas.convertEventToCanvasOffset(e);
        const node = g.getNodeOnPos?.(x, y) ?? null;
        if (!node || isUiNode(node)) return { node: null, widget: null };
        let widget = null;
        try { widget = node.getWidgetOnPos?.(x, y, true) ?? null; } catch {}
        return { node, widget };
    };
    const inSkip = (e) => skip && e.target && skip.contains(e.target);
    let last = null;
    const move = (e) => {
        if (inSkip(e)) return;
        const r = find(e);
        if (r.node !== last?.node || r.widget !== last?.widget) { last = r; onHover?.(r.node, r.widget); }
    };
    const swallow = (e) => { if (e.button === 1) return; /* the middle button pans the canvas */ if (!inSkip(e)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); } };
    const down = (e) => {
        if (inSkip(e) || e.button === 1) return;
        swallow(e);
        if (e.button !== 0) return;
        const r = find(e);
        if (r.node) onPick?.(r.node, r.widget);
    };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); onCancel?.(); } };
    const stop = () => {
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerdown", down, true);
        for (const t of ["mousedown", "mouseup", "click", "dblclick", "pointerup", "contextmenu"]) window.removeEventListener(t, swallow, true);
        window.removeEventListener("keydown", key, true);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    for (const t of ["mousedown", "mouseup", "click", "dblclick", "pointerup", "contextmenu"]) window.addEventListener(t, swallow, true);
    window.addEventListener("keydown", key, true);
    return stop;
}

// where a node is on the screen (for the highlight while picking); null when it is not on the canvas
export function nodeScreenRect(node) {
    const c = app.canvas;
    if (!c?.ds || !c.canvas || c.graph !== node.graph) return null;
    const r = c.canvas.getBoundingClientRect();
    const s = c.ds.scale, [ox, oy] = c.ds.offset;
    const titleH = LG()?.NODE_TITLE_HEIGHT ?? 30;
    return { x: r.left + (node.pos[0] + ox) * s, y: r.top + (node.pos[1] - titleH + oy) * s, w: node.size[0] * s, h: (node.size[1] + titleH) * s };
}

export function selectedNodes() {
    const c = app.canvas;
    const out = [];
    if (c?.selectedItems instanceof Set) {
        for (const it of c.selectedItems) if (it && it.widgets !== undefined && it.pos && !isUiNode(it)) out.push(it);
    } else if (c?.selected_nodes) {
        for (const n of Object.values(c.selected_nodes)) if (!isUiNode(n)) out.push(n);
    }
    return out;
}

// tells ComfyUI that the workflow changed (the undo step and the "modified" mark)
export function touchWorkflow() {
    try {
        const tr = app.extensionManager?.workflow?.activeWorkflow?.changeTracker;
        if (tr?.captureCanvasState) tr.captureCanvasState();
        else tr?.checkState?.();
    } catch {}
    try { app.graph?.setDirtyCanvas?.(true, true); } catch {}
}
