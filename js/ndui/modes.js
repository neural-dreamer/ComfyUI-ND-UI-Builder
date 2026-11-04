// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — mode tabs. A page of kind "mode" owns nodes (the sources of its widgets, the nodes it lists, the nodes inside the groups it lists).
// While another mode is active, the nodes of the inactive modes are muted or bypassed, so they do not go into the prompt.
// The user's own mute/bypass is kept in node.properties.nd_ui_ctl and put back when the node is enabled again.
import { app } from "../../../scripts/app.js";
import { findSource, paramByName, readParam, writeParam, touchWorkflow, invalidateSources } from "./sources.js";
import { sourceOf } from "./model.js";

const MODE_HOW = { mute: 2, bypass: 4 };
const isMode = (p) => p.kind === "mode";

export const modePages = (ui) => ui.pages.filter(isMode);

function groupNodes(title) {
    const out = [];
    try {
        for (const g of app.graph?._groups || []) {
            if (g.title !== title) continue;
            g.recomputeInsideNodes?.();
            const items = g._children ? [...g._children] : g._nodes || [];
            for (const n of items) if (n && n.type && n.mode !== undefined) out.push(n);
        }
    } catch {}
    return out;
}

// the nodes a mode page owns
export function nodesOf(ui, page) {
    const set = new Set();
    const add = (uidv) => { const s = sourceOf(ui, uidv); const n = s ? findSource(s) : null; if (n) set.add(n); };
    for (const w of ui.widgets) if (w.page === page.id) for (const b of Object.values(w.slots || {})) if (b?.src) add(b.src);
    for (const u of page.control.nodes) add(u);
    for (const t of page.control.groups) for (const n of groupNodes(t)) set.add(n);
    return set;
}

export function activeModeId(ui) {
    const ms = modePages(ui);
    if (!ms.length) return "";
    return ms.some((p) => p.id === ui.view.modePage) ? ui.view.modePage : ms[0].id;
}

function ctlOf(n) { return n.properties?.nd_ui_ctl || null; }
function setCtl(n, v) { n.properties = n.properties || {}; if (v) n.properties.nd_ui_ctl = v; else delete n.properties.nd_ui_ctl; }

// Brings the modes of the nodes in step with the active mode page. Returns true if anything changed.
export function applyModes(ui) {
    invalidateSources();
    const ms = modePages(ui);
    if (!ms.length) return false;
    const active = activeModeId(ui);
    const owned = new Map(); // node -> {on: bool (belongs to the active mode), how}
    for (const p of ms) {
        const how = MODE_HOW[p.control.how] || 2;
        for (const n of nodesOf(ui, p)) {
            const cur = owned.get(n) || { on: false, how };
            if (p.id === active) cur.on = true;
            else if (how === 4) cur.how = 4;
            owned.set(n, cur);
        }
    }
    let changed = false;
    for (const [n, st] of owned) {
        const ctl = ctlOf(n);
        if (!st.on) {
            if (n.mode === st.how && ctl) continue;
            if (!ctl) setCtl(n, { user: n.mode ?? 0 });
            if (n.mode !== st.how) { n.mode = st.how; changed = true; }
        } else if (ctl) {
            // it is enabled again: the user's own state comes back (unless the user changed the node since: then theirs wins)
            const mine = n.mode === 2 || n.mode === 4;
            if (mine && ctl.user !== n.mode) { n.mode = ctl.user ?? 0; changed = true; }
            setCtl(n, null);
        }
    }
    if (changed) { try { app.graph?.setDirtyCanvas?.(true, true); } catch {} touchWorkflow(); }
    return changed;
}

// the nodes that are no longer owned by any mode page get their own state back (a mode page was deleted or emptied)
export function releaseModes(ui) {
    const keep = new Set();
    for (const p of modePages(ui)) for (const n of nodesOf(ui, p)) keep.add(n);
    try {
        for (const n of app.graph?._nodes || []) {
            const ctl = ctlOf(n);
            if (!ctl || keep.has(n)) continue;
            if (n.mode === 2 || n.mode === 4) n.mode = ctl.user ?? 0;
            setCtl(n, null);
        }
    } catch {}
}

/* ------------------------------------------------------------------ the INT parameter that follows the active mode */

function indexParam(ui) {
    for (const p of modePages(ui)) {
        const b = p.control.bindIndex;
        if (!b?.src) continue;
        const s = sourceOf(ui, b.src), n = s ? findSource(s) : null;
        const info = n ? paramByName(n, b.name) : null;
        if (info && (info.ptype === "INT" || info.ptype === "BOOLEAN")) return info;
    }
    return null;
}
// the first mode is the smallest value of the parameter (0 for a 0-based one, 1 for a parameter that cannot go below 1)
const baseOf = (p) => (Number.isFinite(p.min) ? p.min : 0);
export function writeIndex(ui) {
    const p = indexParam(ui); if (!p) return;
    const i = modePages(ui).findIndex((x) => x.id === activeModeId(ui));
    if (i < 0) return;
    // a BOOLEAN (ND Multi Switch "condition"): the first mode is true, the second is false
    const v = p.ptype === "BOOLEAN" ? i === 0 : baseOf(p) + i;
    if (readParam(p) !== v) writeParam(p, v);
}
// the page that the parameter asks for (the user turned the value in the node); "" when it agrees with the active mode
export function wantedByIndex(ui) {
    const p = indexParam(ui); if (!p) return "";
    const ms = modePages(ui);
    const raw = readParam(p);
    const v = p.ptype === "BOOLEAN" ? (raw ? 0 : 1) : Number(raw) - baseOf(p);
    if (!Number.isInteger(v) || v < 0 || v >= ms.length) return "";
    return ms[v].id !== activeModeId(ui) ? ms[v].id : "";
}
