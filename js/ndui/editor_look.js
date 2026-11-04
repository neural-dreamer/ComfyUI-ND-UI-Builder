// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the design of the editor itself (not of the panel that is being made): accent colours, the canvas (a colour or a gradient, dots),
// the side panels and the top bar. It belongs to the user of the browser, not to the workflow: it is kept in localStorage.
import { el } from "./widgets/util.js";
import { section, row, segInput, toggleInput, rangeInput, colorInput, btn } from "./controls.js";

const KEY = "ndui-editor-look";
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const hex = (v) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : "");
export const DEFAULT_LOOK = { accent: "", accent2: "", top: "", side: "", dots: true, canvas: { type: "solid", color: "", a: "", b: "", angle: 135 } };

export function cleanLook(r) {
    const o = r && typeof r === "object" ? r : {}, c = o.canvas && typeof o.canvas === "object" ? o.canvas : {};
    const angle = Math.round(Number(c.angle));
    return { accent: hex(o.accent), accent2: hex(o.accent2), top: hex(o.top), side: hex(o.side), dots: o.dots !== false,
        canvas: { type: c.type === "gradient" ? "gradient" : "solid", color: hex(c.color), a: hex(c.a), b: hex(c.b), angle: Number.isFinite(angle) ? Math.max(0, Math.min(360, angle)) : 135 } };
}
export function loadLook() { try { return cleanLook(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return cleanLook(null); } }
export function saveLook(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} }

const lum = (h) => { const n = parseInt(h.slice(1, 7), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; };

// the variables the editor styles read; an empty value is "as it was" (the property is removed, the default of the style sheet applies)
export function applyLook(root, look) {
    // what the editor theme had put on the root before the look touched it: an empty value goes back to that (and never to "nothing")
    const base = root._ndLookBase || (root._ndLookBase = {});
    const DEF = { "--ndk-accent": "#7757fa", "--ndk-accent-hi": "#8d72fb", "--ndk-accent-soft": "rgba(119,87,250,0.16)", "--ndk-accent-ring": "rgba(119,87,250,0.38)", "--ndk-on-accent": "#ffffff" };
    const set = (k, v) => {
        if (!(k in base)) base[k] = root.style.getPropertyValue(k) || DEF[k] || "";
        if (v) root.style.setProperty(k, v);
        else if (base[k]) root.style.setProperty(k, base[k]);
        else root.style.removeProperty(k);
    };
    const a = look.accent;
    set("--ndk-accent", a);
    set("--ndk-accent-hi", a && `color-mix(in srgb, ${a} 82%, #ffffff)`);
    set("--ndk-accent-soft", a && `color-mix(in srgb, ${a} 16%, transparent)`);
    set("--ndk-accent-ring", a && `color-mix(in srgb, ${a} 34%, transparent)`);
    set("--ndk-on-accent", a && (lum(a.slice(0, 7)) > 0.6 ? "#10131c" : "#ffffff"));
    set("--ndk-accent2", look.accent2);
    set("--nde-top", look.top);
    set("--nde-side", look.side);
    const c = look.canvas;
    set("--nde-canvas-c", c.type === "gradient" ? (c.a || "") : c.color);
    set("--nde-canvas-g", c.type === "gradient" && c.a && c.b ? `linear-gradient(${c.angle}deg, ${c.a}, ${c.b})` : "");
    set("--nde-dots", look.dots ? "" : "none");
}

/** the tab "Editor" of the right panel */
export function editorLookTab(E, body) {
    const { tr } = E;
    const look = E.look;
    const upd = (fn, rebuild) => { fn(look); saveLook(look); applyLook(E.root, look); if (rebuild) E.renderInspector(); };
    const color = (label, key, hint) => row(label, colorInput({ value: look[key] || null, palette: [], nullable: true, host: E.root, tr, onChange: (v) => upd((l) => { l[key] = v || ""; }) }), hint);
    body.append(el("div", "nde-note", tr("The look of the editor itself. It is kept in this browser and does not go into the workflow.")));
    body.append(section(tr("Colours"), (b) => {
        b.append(color(tr("Accent"), "accent", tr("Buttons, selection, sliders")));
        b.append(color(tr("Second accent"), "accent2"));
        b.append(color(tr("Side panels"), "side"));
        b.append(color(tr("Top bar"), "top"));
    }, { key: "elook-colours" }));
    body.append(section(tr("Canvas"), (b) => {
        const c = look.canvas;
        b.append(row(tr("Background"), segInput([["solid", tr("Colour")], ["gradient", tr("Gradient")]], c.type, (v) => upd((l) => { l.canvas.type = v; }, true))));
        if (c.type === "gradient") {
            b.append(row(tr("From"), colorInput({ value: c.a || null, palette: [], nullable: true, host: E.root, tr, onChange: (v) => upd((l) => { l.canvas.a = v || ""; }) })));
            b.append(row(tr("To"), colorInput({ value: c.b || null, palette: [], nullable: true, host: E.root, tr, onChange: (v) => upd((l) => { l.canvas.b = v || ""; }) })));
            b.append(row(tr("Angle"), rangeInput({ value: c.angle, min: 0, max: 360, step: 5, fmt: (v) => `${v}°`, onChange: (v) => upd((l) => { l.canvas.angle = v; }) })));
        } else b.append(row(tr("Colour"), colorInput({ value: c.color || null, palette: [], nullable: true, host: E.root, tr, onChange: (v) => upd((l) => { l.canvas.color = v || ""; }) })));
        b.append(row(tr("Dots of the grid"), toggleInput(look.dots, (v) => upd((l) => { l.dots = v; }))));
    }, { key: "elook-canvas" }));
    body.append(btn(tr("Back to the usual look"), "x", () => { Object.assign(look, cleanLook(null)); saveLook(look); applyLook(E.root, look); E.renderInspector(); }, "nde-cp-reset"));
}
