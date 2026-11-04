// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — bindings: a slot of a widget <-> a parameter (a widget) of a source node.
// resolveSlot() looks at the live graph every time it is called, so renaming, deleting, muting or wiring a node is noticed at once.

import { findSource, paramByName, valuesOf, readParam, writeParam, paramState } from "./sources.js";
import { sourceOf } from "./model.js";
import { events } from "./events.js";

const DEMO = {
    INT: { value: 30, min: 0, max: 100, step: 1, precision: 0, def: 30 },
    FLOAT: { value: 0.5, min: 0, max: 1, step: 0.01, precision: 2, def: 0.5 },
    STRING: { value: "", def: "" },
    BOOLEAN: { value: false, def: false },
    COMBO: { value: "Option A", options: ["Option A", "Option B", "Option C"], def: "Option A" },
};

// The state of one slot: {bound, lost, ptype, value, options, min, max, step, precision, def, linked, muted, bypassed, p}
// bound = linked to a parameter; lost = the link is there but the node or the parameter is not.
export function resolveSlot(ui, w, slotId, slotDef) {
    if (slotDef?.data) return resolveData(ui, w, slotId, slotDef);
    const b = w.slots?.[slotId];
    if (!b || !b.src) {
        const t = slotDef?.accepts?.[0] || "STRING";
        return { bound: false, lost: false, ptype: t, ...(DEMO[t] || DEMO.STRING), linked: false, muted: false, bypassed: false, p: null };
    }
    const src = sourceOf(ui, b.src);
    const node = src ? findSource(src) : null;
    const p = node ? paramByName(node, b.name) : null;
    if (!node || !p || p.ptype === "OTHER") {
        return { bound: true, lost: true, ptype: slotDef?.accepts?.[0] || "STRING", value: undefined, linked: false, muted: false, bypassed: false, p: null, why: !node ? "node" : "param" };
    }
    const st = paramState(p);
    return {
        bound: true, lost: false, ptype: p.ptype, value: readParam(p), p,
        options: p.ptype === "COMBO" ? valuesOf(p.widget, p.node) : undefined,
        min: p.min, max: p.max, step: p.step, precision: p.precision, def: p.def,
        ...st,
    };
}

// A slot that takes data of a node (its pictures, live frames, progress, text), not one of its parameters.
// `value` is the version of the event bus: it changes whenever something arrives, so the page redraws the widget.
function resolveData(ui, w, slotId, slotDef) {
    const base = { bound: false, lost: false, data: slotDef.data, ptype: "DATA", value: events.version, linked: false, muted: false, bypassed: false, p: null, node: null };
    const b = w.slots?.[slotId];
    if (!b || !b.src) return base;
    const src = sourceOf(ui, b.src);
    const node = src ? findSource(src) : null;
    if (!node) return { ...base, bound: true, lost: true, why: "node" };
    let value = base.value;
    try { if (slotDef.watch) value = slotDef.watch(node); } catch {}
    return { ...base, value, bound: true, node, muted: (node.mode ?? 0) === 2, bypassed: (node.mode ?? 0) === 4 };
}

export function coerce(st, v) {
    switch (st.ptype) {
        case "INT": { let n = Math.round(Number(v)); if (!Number.isFinite(n)) return undefined; if (Number.isFinite(st.min)) n = Math.max(st.min, n); if (Number.isFinite(st.max)) n = Math.min(st.max, n); return n; }
        case "FLOAT": { let n = Number(v); if (!Number.isFinite(n)) return undefined; if (Number.isFinite(st.min)) n = Math.max(st.min, n); if (Number.isFinite(st.max)) n = Math.min(st.max, n); return n; }
        case "BOOLEAN": return !!v;
        case "STRING": return v == null ? "" : String(v);
        case "COMBO": return v;
        default: return v;
    }
}

export function writeSlot(st, v) {
    if (!st.p || st.lost || st.linked) return false;
    const c = coerce(st, v);
    if (c === undefined) return false;
    return writeParam(st.p, c);
}

// the range a widget works in: what the node allows, narrowed by the min / max / step the person set on the widget
export function effectiveLimits(st, props) {
    const num = (x) => (x === "" || x == null ? NaN : Number(x));
    let min = Number.isFinite(st.min) ? st.min : -Infinity, max = Number.isFinite(st.max) ? st.max : Infinity;
    const pmin = num(props.min), pmax = num(props.max), pstep = num(props.step);
    if (Number.isFinite(pmin)) min = Math.max(min, pmin);
    if (Number.isFinite(pmax)) max = Math.min(max, pmax);
    if (max < min) max = min;
    let step = Number.isFinite(pstep) && pstep > 0 ? pstep : st.step > 0 ? st.step : st.ptype === "INT" ? 1 : 0.01;
    if (st.ptype === "INT") step = Math.max(1, Math.round(step));
    return { min: Number.isFinite(min) ? min : NaN, max: Number.isFinite(max) ? max : NaN, step, precision: Number.isFinite(st.precision) ? st.precision : (st.ptype === "INT" ? 0 : 2) };
}

// a short text for the state of a slot (badges and hints)
export function stateLabel(st) {
    if (st.lost) return "lost";
    if (!st.bound) return "unbound";
    if (st.linked) return "wire";
    if (st.bypassed) return "bypassed";
    if (st.muted) return "muted";
    return "";
}
