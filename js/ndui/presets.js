// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — presets (a panel as a .ndui.json file) and page templates.
// A preset keeps the pages and widgets; its sources are found again in the new workflow by their [tag]. Those that are not found stay "lost"
// and are shown in Link with a button to pick the node on the canvas.
import { normalizeNdUi, uid, clone } from "./model.js";
import { nodeByTag, srcUidOf, invalidateSources } from "./sources.js";

export const FORMAT = "neuraldreamer-ndui";

/* ------------------------------------------------------------------ export / import */

export function exportText(ui) {
    return JSON.stringify({ format: FORMAT, version: 1, ui: clone(ui) }, null, 2);
}
export function download(ui, name = "panel") {
    const blob = new Blob([exportText(ui)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${String(name).replace(/[^\w.-]+/g, "_") || "panel"}.ndui.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function remap(ui, from, to) {
    for (const w of ui.widgets) for (const b of Object.values(w.slots || {})) if (b.src === from) b.src = to;
    for (const p of ui.pages) {
        p.control.nodes = p.control.nodes.map((u) => (u === from ? to : u));
        if (p.control.bindIndex?.src === from) p.control.bindIndex.src = to;
    }
}

// text -> {ui, missing: [source...], linked: n}; throws Error(message) when the file is not a preset
export function parsePreset(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("The file is not valid JSON"); }
    const raw = data?.format === FORMAT ? data.ui : data?.pages && data?.widgets ? data : null;
    if (!raw) throw new Error("This is not an ND UI preset");
    const ui = normalizeNdUi(raw);
    const missing = []; let linked = 0;
    const taken = new Set();
    for (const s of ui.sources) {
        const n = s.tag ? nodeByTag(s.tag) : null;
        if (!n) { missing.push(s); continue; }
        const have = srcUidOf(n);
        if (have && have !== s.uid) { if (!taken.has(have)) { remap(ui, s.uid, have); s.uid = have; } else { missing.push(s); continue; } }
        else { n.properties = n.properties || {}; n.properties.nd_ui_src = { uid: s.uid, tag: s.tag }; }
        taken.add(s.uid); linked++;
        s.class = n.comfyClass || n.type || s.class; s.title = n.title || s.title;
    }
    invalidateSources();
    return { ui, missing, linked };
}

/* ------------------------------------------------------------------ templates */

export const TEMPLATES = [
    { id: "generator", label: "Generator", hint: "Prompts and settings on the left, the result on the right" },
    { id: "columns", label: "Two columns", hint: "Settings in a panel, the result next to it" },
    { id: "prompt-top", label: "Prompt on top", hint: "A wide prompt, the button below, a big result" },
    { id: "mobile", label: "Mobile 9:16", hint: "One column for a phone-like page" },
];
const r8 = (v) => Math.round(v / 8) * 8;

// items: [{t:type, h:px | w:weight, props, slots}] stacked in a column; returns widgets
function column(ui, x, y, w, ch, items, gap = 16) {
    const fixed = items.reduce((a, i) => a + (i.h || 0), 0), weights = items.reduce((a, i) => a + (i.h ? 0 : i.w || 1), 0);
    const free = Math.max(0, ch - fixed - gap * (items.length - 1));
    const out = []; let cy = y;
    for (const i of items) {
        const h = r8(i.h || (free * (i.w || 1)) / weights);
        out.push({ type: i.t, x: r8(x), y: r8(cy), w: r8(w), h: Math.max(32, h), slots: i.slots || {}, props: i.props || {} });
        cy += h + gap;
    }
    return out;
}
const hint = (label) => ({ label });

function build(id, ui) {
    const W = ui.page.w, H = ui.page.h, m = 24, g = 16, cw = W - m * 2, ch = H - m * 2;
    if (id === "generator") {
        const lw = Math.round(cw * 0.42), rx = m + lw + g, rw = cw - lw - g;
        const yg = H - m - 64, yp = yg - g - 48;
        return [
            ...column(ui, m, m, lw, ch, [
                { t: "prompt", w: 3, props: hint("Bind: prompt") }, { t: "prompt", w: 2, props: hint("Bind: negative prompt") },
                { t: "resolution", w: 3 }, { t: "seed", h: 64, props: hint("Bind: seed") },
            ]),
            { type: "viewer", x: r8(rx), y: m, w: r8(rw), h: r8(yp - g - m), slots: {}, props: { progress: "off" } },
            { type: "progress", x: r8(rx), y: r8(yp), w: r8(rw), h: 48, slots: {}, props: {} },
            { type: "generate", x: r8(rx), y: r8(yg), w: r8(rw - 232), h: 64, slots: {}, props: {} },
            { type: "queue", x: r8(rx + rw - 216), y: r8(yg), w: 216, h: 64, slots: {}, props: {} },
        ];
    }
    if (id === "columns") {
        const lw = Math.round(cw * 0.36), rx = m + lw + g, rw = cw - lw - g;
        const panel = { type: "panel", x: m, y: m, w: lw, h: r8(ch), slots: {}, props: { title: "Settings" } };
        const inner = column(ui, m + 16, m + 48, lw - 32, ch - 64, [
            { t: "seed", h: 64, props: hint("Bind: seed") }, { t: "slider", h: 64, props: hint("Bind: steps") }, { t: "slider", h: 64, props: hint("Bind: cfg") },
            { t: "dropdown", h: 64, props: hint("Bind: sampler") }, { t: "dropdown", h: 64, props: hint("Bind: scheduler") },
        ], 12);
        return [panel, ...inner, ...column(ui, rx, m, rw, ch, [{ t: "viewer", w: 1, props: { progress: "off" } }, { t: "progress", h: 48 }, { t: "generate", h: 64 }])];
    }
    if (id === "prompt-top") {
        return column(ui, m, m, cw, ch, [{ t: "prompt", w: 1, props: hint("Bind: prompt") }, { t: "generate", h: 64 }, { t: "viewer", w: 4, props: { progress: "off" } }, { t: "progress", h: 48 }]);
    }
    // mobile: a 9:16 column in the middle of the page
    const colW = Math.min(cw, Math.round((ch * 9) / 16)), x0 = Math.round((W - colW) / 2);
    return column(ui, x0, m, colW, ch, [
        { t: "prompt", w: 2, props: hint("Bind: prompt") }, { t: "generate", h: 64 }, { t: "progress", h: 40 }, { t: "viewer", w: 5, props: { progress: "off" } }, { t: "resolution", w: 2 },
    ]);
}

// adds a page made from a template; returns the id of the new page
export function addTemplatePage(ui, id, name) {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    const pid = uid("p");
    ui.pages.push({ id: pid, name: name || t.label, kind: "page", control: { nodes: [], groups: [], how: "mute", bindIndex: null } });
    let z = 1;
    for (const w of build(t.id, ui)) {
        ui.widgets.push({ id: uid("w"), type: w.type, page: pid, x: w.x, y: w.y, w: w.w, h: w.h, z: z++, hidden: false, locked: false, slots: w.slots || {}, props: w.props || {}, look: {} });
    }
    return pid;
}
