// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — virtual parameters of Neural Dreamer Nodes.
// ND Slider and ND Resolution keep their numbers in one hidden JSON widget ("state"). To the panel they look like ordinary
// INT / FLOAT parameters: ND Slider -> "value"; ND Resolution -> "width" and "height" (what the node outputs).
// A virtual parameter has a proxy widget with `value` and `setValue`, so readParam / writeParam work on it unchanged.

import { app } from "../../../scripts/app.js";

const classOf = (node) => node?.comfyClass || node?.type || "";
const stateWidget = (node) => node?.widgets?.find((w) => w.name === "state") || null;
const parse = (w) => { try { const s = JSON.parse(w?.value); return s && typeof s === "object" ? s : {}; } catch { return {}; } };
const num = (v, d) => (v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const touch = (node) => { try { app.graph?.change?.(); node.graph?.setDirtyCanvas?.(true, false); app.canvas?.setDirty?.(true, false); } catch {} };

/* ------------------------------------------------------------------ ND Slider */

function sliderLimits(s) {
    const integer = !!s.integer;
    let min = num(s.min, 0), max = num(s.max, 1), step = num(s.step, 0);
    if (max < min) [min, max] = [max, min];
    if (integer) { min = Math.round(min); max = Math.round(max); step = Math.max(1, Math.round(step)); }
    else if (!(step > 0)) step = 0.01;
    return { integer, min, max, step };
}
const decimals = (step) => { const t = String(step); return t.includes("e-") ? Number(t.split("e-")[1]) || 0 : t.includes(".") ? t.split(".")[1].length : 0; };

function sliderParam(node) {
    const sw = stateWidget(node);
    if (!sw) return null;
    const lim = sliderLimits(parse(sw));
    const proxy = {
        name: "value", type: "number", options: {}, node,
        get value() { const s = parse(sw), l = sliderLimits(s); return num(s.value, l.min); },
        setValue(v) {
            const s = parse(sw), l = sliderLimits(s);
            let x = Number(v);
            if (!Number.isFinite(x)) return;
            x = l.min + Math.round((x - l.min) / l.step) * l.step;
            x = Math.min(l.max, Math.max(l.min, x));
            s.value = l.integer ? Math.round(x) : Number(x.toFixed(Math.min(10, Math.max(decimals(l.step), decimals(l.min)) + 2)));
            sw.value = JSON.stringify(s);
            node.ndSlider?.restore?.();
            touch(node);
        },
    };
    return {
        name: "value", label: "Value", ptype: lim.integer ? "INT" : "FLOAT", widget: proxy, node, multiline: false, virtual: true,
        min: lim.min, max: lim.max, step: lim.step, precision: lim.integer ? 0 : decimals(lim.step) || 2, def: undefined, control: false, seed: false,
    };
}

/* ------------------------------------------------------------------ ND Resolution */

const SIDE = [16, 16384];

function resolutionParam(node, which) {
    const sw = stateWidget(node);
    if (!sw) return null;
    const size = () => { try { return node.ndRes?.size?.() || null; } catch { return null; } };
    const mult = () => Math.max(1, num(parse(sw).multiple, 16));
    const idx = which === "width" ? 0 : 1;
    const proxy = {
        name: which, type: "number", options: {}, node,
        get value() { const z = size(); return z ? z[idx] : undefined; },
        setValue(v) {
            let x = Number(v);
            if (!Number.isFinite(x)) return;
            const z = size() || [1024, 1024];
            const t = idx === 0 ? [x, z[1]] : [z[0], x];
            t[0] = Math.min(SIDE[1], Math.max(SIDE[0], Math.round(t[0])));
            t[1] = Math.min(SIDE[1], Math.max(SIDE[0], Math.round(t[1])));
            const s = parse(sw);
            s.ratio = "custom"; s.custom = `${t[0]}:${t[1]}`; s.method = "long side"; s.long = Math.max(t[0], t[1]);
            sw.value = JSON.stringify(s);
            node.ndResApi?.restore?.();
            touch(node);
        },
    };
    return {
        name: which, label: which === "width" ? "Width" : "Height", ptype: "INT", widget: proxy, node, multiline: false, virtual: true,
        min: mult(), max: SIDE[1], step: mult(), precision: 0, def: undefined, control: false, seed: false,
    };
}

/* ------------------------------------------------------------------ public */

export function virtualParams(node) {
    switch (classOf(node)) {
        case "NDValueSlider": { const p = sliderParam(node); return p ? [p] : []; }
        case "NDResolution": return ["width", "height"].map((n) => resolutionParam(node, n)).filter(Boolean);
        default: return [];
    }
}
export const virtualParam = (node, name) => virtualParams(node).find((p) => p.name === name) || null;
