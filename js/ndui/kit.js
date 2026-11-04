// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI Kit — the design system of ND UI: tokens, themes, styles, shapes, icons and the stylesheet of the widgets.
// A panel looks finished with no work from the person: every widget takes its colours, radius, depth and type from the tokens.
// Cascade: theme -> kit of the page (style, shape, density, font) -> panel it lies in -> look of the widget.

import { clamp } from "./model.js";
import { EXTRA_CSS } from "./widgets/css2.js";
import { LORA_CSS } from "./widgets/lora_css.js";
import { VIEWER_CSS } from "./widgets/viewer_css.js";
import { PLAYER_CSS } from "./widgets/players_css.js";
import { TRIM_CSS } from "./widgets/trim_css.js";
import { TABS_CSS, SHOWANY_CSS } from "./widgets/tabs_css.js";
import { IMGIN_CSS } from "./widgets/imgin_css.js";
import { VARIANTSEL_CSS } from "./widgets/variantsel_css.js";
import { ACTIVITY_CSS } from "./widgets/activity.js";
import { EMBED_CSS } from "./embed/embed_css.js";

/* ------------------------------------------------------------------ colour helpers */

export function parseColor(c) {
    if (typeof c !== "string") return [0, 0, 0, 1];
    c = c.trim();
    let m = /^#([0-9a-f]{3,8})$/i.exec(c);
    if (m) {
        let h = m[1];
        if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
    return [0, 0, 0, c === "transparent" ? 0 : 1];
}
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
export const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export const rgba = (c, a) => { const [r, g, b, a0] = parseColor(c); return `rgba(${r},${g},${b},${+(a * a0).toFixed(3)})`; };
export function mix(a, b, t) {
    const x = parseColor(a), y = parseColor(b);
    return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t));
}
// composite c (maybe translucent) over a solid background
export function over(c, bg) {
    const x = parseColor(c), y = parseColor(bg);
    return [0, 1, 2].map((i) => x[i] * x[3] + y[i] * (1 - x[3]));
}
export function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
    }
    return [h * 360, s, l];
}
export function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
export function shift(c, dl, ds = 0) {
    const [h, s, l] = rgbToHsl(parseColor(c));
    return toHex(hslToRgb(h, clamp(s + ds, 0, 1), clamp(l + dl, 0, 1)));
}
export function luminance(rgb) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
export const isLight = (c) => luminance(parseColor(c)) > 0.4;
// WCAG contrast of a text colour over a surface colour (both may be translucent over `base`)
export function contrast(fg, bg, base = "#000000") {
    const b = over(bg, base);
    const f = over(fg, toHex(b));
    const [l1, l2] = [luminance(f), luminance(b)].sort((p, q) => q - p);
    return (l1 + 0.05) / (l2 + 0.05);
}

/* ------------------------------------------------------------------ themes */

const SEMANTIC = { success: "#34d399", warning: "#fbbf24", danger: "#f87171" };

export const THEMES = [
    {
        id: "midnight", label: "Midnight", tokens: {
            bg: "#0e1014", s1: "#161920", s2: "#1d212a", s3: "#2a3040", border: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.18)",
            text: "#e8eaf0", muted: "#a4adbf", faint: "#69738a", accent: "#7757fa", accent2: "#35d0ba", onAccent: "#ffffff", shadow: "rgba(0,0,0,0.45)", blur: "0px", glow: "0",
            page: "linear-gradient(160deg,#0e1014 0%,#151823 100%)",
        },
    },
    {
        id: "studio", label: "Studio", tokens: {
            bg: "#f1f3f8", s1: "#ffffff", s2: "#eef0f6", s3: "#dde1ec", border: "rgba(15,23,42,0.10)", borderStrong: "rgba(15,23,42,0.24)",
            text: "#151a28", muted: "#4d5870", faint: "#8b94a7", accent: "#2f6bff", accent2: "#0b8f8d", onAccent: "#ffffff", shadow: "rgba(30,41,70,0.16)", blur: "0px", glow: "0",
            page: "linear-gradient(160deg,#f6f7fb 0%,#e9ecf4 100%)",
        },
    },
    {
        id: "neon", label: "Neon", tokens: {
            bg: "#0a0a12", s1: "#11111c", s2: "#191928", s3: "#26263a", border: "rgba(0,229,255,0.14)", borderStrong: "rgba(0,229,255,0.42)",
            text: "#e9e9f4", muted: "#8b8ba6", faint: "#55556f", accent: "#00e5ff", accent2: "#ff2bd6", onAccent: "#07070d", shadow: "rgba(0,229,255,0.16)", blur: "0px", glow: "1", grad: "1",
            page: "radial-gradient(120% 90% at 15% 0%,#14173a 0%,#0a0a12 62%)",
        },
    },
    {
        id: "comfyui", label: "ComfyUI", tokens: {
            bg: "#171718", s1: "#202123", s2: "#2b2c2f", s3: "#3a3b3f", border: "rgba(255,255,255,0.10)", borderStrong: "rgba(255,255,255,0.26)",
            text: "#e2e2e4", muted: "#a3a4aa", faint: "#6f7077", accent: "#1d74dc", accent2: "#1d74dc", onAccent: "#ffffff", shadow: "rgba(0,0,0,0.5)", blur: "0px", glow: "0",
            page: "#171718",
        },
    },
    {
        id: "glass", label: "Glass", tokens: {
            bg: "#10122a", s1: "rgba(255,255,255,0.08)", s2: "rgba(255,255,255,0.09)", s3: "rgba(255,255,255,0.18)", border: "rgba(255,255,255,0.16)", borderStrong: "rgba(255,255,255,0.34)",
            text: "#f4f6ff", muted: "#c3c9e6", faint: "#8890b5", accent: "#8ab4ff", accent2: "#f59ee8", onAccent: "#0a1330", shadow: "rgba(5,8,30,0.5)", blur: "14px", glow: "0",
            page: "radial-gradient(90% 80% at 15% 10%,#3a2a7a 0%,transparent 60%),radial-gradient(80% 80% at 90% 90%,#0f5a73 0%,transparent 60%),#10122a",
        },
    },
    {
        id: "sakura", label: "Sakura", tokens: {
            bg: "#140d12", s1: "#1d1218", s2: "#281a22", s3: "#3a2531", border: "rgba(255,200,225,0.10)", borderStrong: "rgba(255,200,225,0.24)",
            text: "#f7e9f0", muted: "#c9aab9", faint: "#85667a", accent: "#ff6fae", accent2: "#ffb26b", onAccent: "#2a0716", shadow: "rgba(0,0,0,0.5)", blur: "0px", glow: "0",
            page: "linear-gradient(160deg,#140d12 0%,#22121c 100%)",
        },
    },
    {
        id: "limenoir", label: "Lime Noir", tokens: {
            bg: "#0a0a0a", s1: "#121212", s2: "#1a1a1a", s3: "#262626", border: "rgba(255,255,255,0.07)", borderStrong: "rgba(255,255,255,0.18)",
            text: "#f5f5f5", muted: "#a3a3a3", faint: "#6b6b6b", accent: "#d1fe17", accent2: "#ffffff", onAccent: "#0a0a0a", shadow: "rgba(0,0,0,0.6)", blur: "0px", glow: "0",
            page: "linear-gradient(180deg,#0a0a0a 0%,#0f0f0f 100%)",
        },
    },
    {
        id: "mono", label: "Mono", tokens: {
            bg: "#0b0b0c", s1: "#141415", s2: "#1c1c1e", s3: "#2b2b2e", border: "rgba(255,255,255,0.09)", borderStrong: "rgba(255,255,255,0.22)",
            text: "#f0f0f1", muted: "#a7a7ad", faint: "#6d6d74", accent: "#f2f2f2", accent2: "#9a9aa0", onAccent: "#0b0b0c", shadow: "rgba(0,0,0,0.55)", blur: "0px", glow: "0",
            page: "linear-gradient(160deg,#0b0b0c 0%,#141416 100%)",
        },
    },
];
export const THEME_IDS = [...THEMES.map((t) => t.id), "frost", "custom"];

// A theme made of an accent and a background colour: the rest is derived (HSL) so that it stays balanced.
export function customTheme(accent, bg) {
    const light = isLight(bg);
    const d = light ? -1 : 1;
    const text = light ? "#151a28" : "#e8eaf0";
    return {
        bg, s1: shift(bg, 0.04 * d * (light ? -0.5 : 1)), s2: shift(bg, 0.08 * d * (light ? -0.5 : 1)), s3: shift(bg, 0.15 * d * (light ? -0.6 : 1)),
        border: rgba(text, 0.1), borderStrong: rgba(text, 0.24), text, muted: mix(text, bg, 0.3), faint: mix(text, bg, 0.58),
        accent, accent2: shift(accent, 0, 0), onAccent: isLight(accent) ? "#10131c" : "#ffffff",
        shadow: light ? "rgba(30,41,70,0.16)" : "rgba(0,0,0,0.45)", blur: "0px", glow: "0",
        page: `linear-gradient(160deg,${bg} 0%,${shift(bg, light ? -0.04 : 0.035)} 100%)`,
    };
}

// Frost: frosted glass over a gradient. Everything comes from a few settings: the tint of the glass, the accent, up to three colours of the
// gradient with its angle, the blur behind the cards and how opaque they are.
export const FROST_DEFAULT = { tint: "#ffffff", accent: "#8ee3cf", g1: "#12363a", g2: "#080c10", g3: "#171a33", angle: 140, blur: 18, opacity: 0.07 };
export function frostTheme(f) {
    f = { ...FROST_DEFAULT, ...f };
    const dark = !isLight(f.g2), text = dark ? "#eaf4f3" : "#13201f";
    const stops = [f.g1, f.g2, f.g3].filter(Boolean);
    const [h, sat, l] = rgbToHsl(parseColor(f.accent));
    const op = f.opacity;
    return {
        bg: f.g2, s1: rgba(f.tint, op * 0.7), s2: rgba(f.tint, op), s3: rgba(f.tint, Math.min(0.6, op * 2.4)), border: rgba(f.tint, 0.14), borderStrong: rgba(f.tint, 0.3),
        text, muted: mix(text, f.g2, 0.3), faint: mix(text, f.g2, 0.58), accent: f.accent, accent2: toHex(hslToRgb(h + 35, sat, l)),
        onAccent: isLight(f.accent) ? "#0b1514" : "#ffffff", shadow: "rgba(0,0,0,0.45)", blur: `${f.blur}px`, glow: "0",
        page: `radial-gradient(60% 50% at 82% 4%,${rgba(f.accent, 0.11)} 0%,transparent 70%),linear-gradient(${f.angle}deg,${stops.map((c, i) => `${c} ${Math.round((i / Math.max(1, stops.length - 1)) * 100)}%`).join(",")})`,
        sw: [f.g1, f.g2, f.g3 || f.g2, f.accent],
    };
}
// a gradient that fits an accent: dark tones of its hue, one of them turned a little
export function frostFromAccent(accent) {
    const [h, s] = rgbToHsl(parseColor(accent));
    const tone = (hh, ss, ll) => toHex(hslToRgb(hh, Math.min(s, ss), ll));
    return { g1: tone(h, 0.5, 0.17), g2: tone(h, 0.3, 0.06), g3: tone(h + 45, 0.45, 0.16) };
}

export function tokensOf(ui) {
    const id = ui.theme.id;
    const base = id === "custom" ? customTheme(ui.theme.custom.accent, ui.theme.custom.bg) : id === "frost" ? frostTheme(ui.theme.frost) : (THEMES.find((t) => t.id === id) || THEMES[0]).tokens;
    const t = { ...base, ...SEMANTIC, ...ui.theme.overrides };
    // the shadow of the cards: blur, strength (a share of the alpha of the theme's colour) and an own colour
    const sh = ui.theme.shadow || {};
    const [r, g, b, a] = parseColor(sh.color || t.shadow);
    const strength = Number.isFinite(sh.strength) ? sh.strength : 100;
    t.shadow = rgba(toHex([r, g, b]), clamp((sh.color ? 0.5 : a) * strength / 100, 0, 1));
    t.shadowBlur = Number.isFinite(sh.blur) ? sh.blur : 30;
    t.noBorders = ui.theme.borders === false;
    return t;
}

/* ------------------------------------------------------------------ style, shape, density -> variables */

const CTL = { compact: 30, comfortable: 36, spacious: 44 };
const FS = { compact: 12, comfortable: 13, spacious: 14 };
const RADIUS = { sharp: [3, 4, 6], rounded: [7, 10, 14], pill: [12, 999, 20] }; // small, medium (fields), large (panels)

function fieldVars(style, t) {
    const glass = t.blur !== "0px";
    switch (style) {
        case "outline": return { bg: "transparent", border: t.borderStrong, shadow: "none", blur: "0px" };
        case "soft": return { bg: t.s2, border: t.border, shadow: `inset 0 1px 0 ${rgba(t.text, 0.05)}, 0 1px 2px ${t.shadow}`, blur: glass ? t.blur : "0px" };
        case "glass": return { bg: rgba(t.text, 0.07), border: rgba(t.text, 0.16), shadow: `inset 0 1px 0 ${rgba(t.text, 0.1)}`, blur: "12px" };
        case "minimal": return { bg: "transparent", border: "transparent", shadow: "none", blur: "0px", minimal: true };
        default: return { bg: t.s2, border: "transparent", shadow: "none", blur: glass ? t.blur : "0px" };
    }
}

// All the CSS variables for a widget: tokens, style, shape, density and the overrides of its look (null = as the theme says).
export function varsFor(tokens, kit, look = {}) {
    const t = { ...tokens };
    const acc = look.accent || t.accent;
    const style = look.style || kit.style, shape = look.shape || kit.shape;
    const f = fieldVars(style, t);
    const r = RADIUS[shape] || RADIUS.rounded;
    const rm = look.radius != null ? look.radius : r[1];
    const v = {
        "--ndk-bg": t.bg, "--ndk-s1": t.s1, "--ndk-s2": t.s2, "--ndk-s3": t.s3, "--ndk-border": t.border, "--ndk-border-strong": t.borderStrong,
        "--ndk-text": t.text, "--ndk-muted": t.muted, "--ndk-faint": t.faint,
        "--ndk-accent": acc, "--ndk-accent2": t.accent2, "--ndk-on-accent": look.accent ? (isLight(acc) ? "#10131c" : "#ffffff") : t.onAccent,
        "--ndk-accent-hi": shift(acc, 0.08), "--ndk-accent-ring": rgba(acc, 0.38), "--ndk-accent-soft": rgba(acc, 0.16),
        "--ndk-success": t.success, "--ndk-warning": t.warning, "--ndk-danger": t.danger, "--ndk-shadow": t.shadow,
        "--ndk-grad": t.grad === "1" && !look.accent ? `linear-gradient(135deg,${acc},${t.accent2})` : acc,
        "--ndk-grad-sl": t.grad === "1" && !look.accent ? `linear-gradient(90deg,${acc},${t.accent2})` : `linear-gradient(90deg,${acc},${shift(acc, 0.08)})`,
        "--ndk-grad-btn": t.grad === "1" && !look.accent ? `linear-gradient(135deg,${acc},${t.accent2})` : `linear-gradient(180deg,${shift(acc, 0.08)},${acc})`,
        "--ndk-glow": t.glow === "1" ? `0 0 14px ${rgba(acc, 0.55)}` : "none",
        "--ndk-field-bg": look.field || f.bg, "--ndk-field-border": look.border || (t.noBorders ? "transparent" : f.border), "--ndk-field-shadow": look.shadow === false ? "none" : f.shadow, "--ndk-field-blur": look.blur === false ? "0px" : f.blur,
        "--ndk-blur-on": look.blur === false ? "0" : "1",
        "--ndk-cbd": look.border || (t.noBorders ? "transparent" : t.border), "--ndk-cbds": look.border || (t.noBorders ? "transparent" : t.borderStrong),
        "--ndk-sh-blur": `${t.shadowBlur ?? 30}px`,
        "--ndk-rs": `${Math.min(r[0], rm)}px`, "--ndk-rm": `${rm}px`, "--ndk-rl": `${look.radius != null ? look.radius : r[2]}px`, "--ndk-ra": `${Math.min(rm, 14)}px`,
        "--ndk-ctl": `${CTL[kit.density] || 36}px`, "--ndk-fs": `${FS[kit.density] || 13}px`,
        "--ndk-label": look.labelColor || t.muted, "--ndk-value": look.text || t.text,
        "--ndk-wbg": look.bg || "transparent",
        "--ndk-minimal": f.minimal ? "1" : "0",
        "--ndk-font": kit.font === "system" ? SYSTEM_FONT : `"Inter ND", ${SYSTEM_FONT}`,
    };
    if (look.shadow === true && f.shadow === "none") v["--ndk-field-shadow"] = `0 2px 8px ${t.shadow}`;
    return v;
}
export const SYSTEM_FONT = `Inter, "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif`;

export function applyVars(el, vars) {
    for (const [k, val] of Object.entries(vars)) el.style.setProperty(k, val);
    if (vars["--ndk-minimal"] != null) el.dataset.minimal = vars["--ndk-minimal"];
    if (vars["--ndk-blur-on"] != null) el.dataset.blur = vars["--ndk-blur-on"];
}

// background of the page (CSS value) for the page settings
export function pageBackground(ui, tokens) {
    const b = ui.page.bg;
    if (b.type === "solid") return b.color;
    if (b.type === "gradient") return `linear-gradient(${b.angle}deg,${b.a} 0%,${b.b} 100%)`;
    if (b.type === "image" && b.src) return { image: b.src, mode: b.mode, dim: b.dim };
    return tokens.page || tokens.bg;
}

/* ------------------------------------------------------------------ icons (24 px grid, 1.6 line) */

const P = (d) => `<path d="${d}"/>`;
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const R = (x, y, w, h, r = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const ICONS = {
    plug: P("M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4"),
    speaker: P("M4 9v6h4l5 4V5L8 9H4z") + P("M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"), speakerOff: P("M4 9v6h4l5 4V5L8 9H4z") + P("M17 9l5 6M22 9l-5 6"),
    info: C(12, 12, 9) + P("M12 11v5.5M12 7.6v.2"),
    plus: P("M12 5v14M5 12h14"), minus: P("M5 12h14"), x: P("M6 6l12 12M18 6L6 18"), check: P("M5 12.5l4.5 4.5L19 7.5"),
    chevD: P("M6 9l6 6 6-6"), chevU: P("M6 15l6-6 6 6"), chevR: P("M9 6l6 6-6 6"), chevL: P("M15 6l-6 6 6 6"),
    search: C(10.5, 10.5, 6.5) + P("M15.5 15.5L20 20"),
    dice: R(4, 4, 16, 16, 3.5) + `<g fill="currentColor" stroke="none">${[[8.2, 8.2], [15.8, 8.2], [12, 12], [8.2, 15.8], [15.8, 15.8]].map(([x, y]) => C(x, y, 1.15)).join("")}</g>`,
    lock: R(5, 11, 14, 9, 2.5) + P("M8 11V8a4 4 0 0 1 8 0v3"), unlock: R(5, 11, 14, 9, 2.5) + P("M8 11V8a4 4 0 0 1 7.6-1.7"),
    link: P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
    unlink: P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16"),
    trash: P("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"), copy: R(9, 9, 11, 11, 2.5) + P("M5 15V6.5A2.5 2.5 0 0 1 7.5 4H16"),
    undo: P("M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"), redo: P("M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"),
    eye: P("M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z") + C(12, 12, 3), eyeOff: P("M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM4 4l16 16") + C(12, 12, 3),
    layers: P("M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5"),
    group: R(3, 3, 18, 18, 3) + R(7, 7, 4, 4, 1) + R(13, 13, 4, 4, 1), ungroup: R(3, 3, 8, 8, 1.5) + R(13, 13, 8, 8, 1.5) + P("M14 10l4-4M6 18l4-4"),
    sliders: P("M4 7h9M17 7h3M4 17h3M11 17h9") + C(15, 7, 2) + C(9, 17, 2),
    play: P("M7 5l12 7-12 7z"), expand: P("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"),
    grid: P("M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"),
    image: R(3, 4, 18, 16, 2.5) + C(9, 10, 1.6) + P("M3 17l5-5 4 4 3-3 6 6"),
    text: P("M5 6V4h14v2M12 4v16M9 20h6"), toggle: R(2, 7, 20, 10, 5) + C(16, 12, 2.6),
    list: P("M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"), panel: R(3, 4, 18, 16, 2.5) + P("M3 9h18"),
    spoiler: R(3, 4, 18, 16, 2.5) + P("M8 10l4 4 4-4"),
    heading: P("M6 4v16M18 4v16M6 12h12"), divider: P("M4 12h16M8 7h.01M12 7h.01M16 7h.01M8 17h.01M12 17h.01M16 17h.01"),
    knob: C(12, 12, 8) + P("M12 12l4-4"), seed: P("M12 21v-7M12 14c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"),
    textarea: R(3, 4, 18, 16, 2.5) + P("M7 9h10M7 13h10M7 17h5"), segmented: R(2, 7, 20, 10, 3) + P("M9.5 7v10M15.5 7v10"),
    number: R(2, 6, 20, 12, 3) + P("M6 12h3M15 12h3M16.5 10.5v3"),
    save: P("M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"), crosshair: C(12, 12, 7) + P("M12 2v5M12 17v5M2 12h5M17 12h5"),
    warning: P("M12 3l10 18H2L12 3zM12 10v5M12 18h.01"), pencil: P("M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"),
    alignL: P("M4 4v16M8 7h12M8 13h8"), alignCX: P("M12 3v18M6 7h12M8 13h8"), alignR: P("M20 4v16M4 7h12M8 13h8"),
    alignT: P("M4 4h16M7 8v12M13 8v8"), alignCY: P("M3 12h18M7 6v12M13 8v8"), alignB: P("M4 20h16M7 4v12M13 8v8"),
    distH: P("M4 4v16M20 4v16M10 8h4v8h-4z"), distV: P("M4 4h16M4 20h16M8 10v4h8v-4z"),
    front: P("M12 4v10M7 9l5-5 5 5M5 19h14"), back: P("M12 20V10M7 15l5 5 5-5M5 5h14"),
    up: P("M12 19V5M6 11l6-6 6 6"), down: P("M12 5v14M6 13l6 6 6-6"), grip: P("M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"),
    wire: P("M3 12h5M16 12h5") + R(8, 8, 8, 8, 2), page: R(5, 3, 14, 18, 2.5) + P("M9 8h6M9 12h6"),
    zoomIn: C(10.5, 10.5, 6.5) + P("M15.5 15.5L20 20M10.5 8v5M8 10.5h5"), fit: P("M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"),
    download: P("M12 4v11M7 11l5 5 5-5M5 20h14"), upload: P("M12 16V5M7 9l5-5 5 5M5 20h14"), refresh: P("M20 11a8 8 0 1 0-1.8 5.6M20 4v7h-7"),
    stop: R(6, 6, 12, 12, 2.5), bolt: P("M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z"), swap: P("M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"),
    external: P("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"), refresh: P("M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"),
    star: P("M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.6z"),
    shield: P("M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"),
    cube: P("M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9"), compare: R(3, 5, 18, 14, 2.5) + P("M12 5v14M8 10l-2 2 2 2M16 10l2 2-2 2"),
    terminal: R(3, 5, 18, 14, 2.5) + P("M7 10l3 2-3 2M12 15h5"), gauge: P("M4 16a8 8 0 1 1 16 0M12 16l4-5"), queue: P("M4 6h12M4 12h12M4 18h8M19 15v6M16 18h6"),
    live: C(12, 12, 3) + P("M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.7 4.7a10.4 10.4 0 0 0 0 14.6M19.3 4.7a10.4 10.4 0 0 1 0 14.6"),
    ratio: R(3, 7, 18, 10, 2) + P("M7 11v2M17 11v2"), gallery: R(3, 3, 8, 8, 2) + R(13, 3, 8, 8, 2) + R(3, 13, 8, 8, 2) + R(13, 13, 8, 8, 2),
    pause: R(6, 5, 4, 14, 1) + R(14, 5, 4, 14, 1), volume: P("M4 9v6h4l5 4V5L8 9H4z") + P("M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"), volumeOff: P("M4 9v6h4l5 4V5L8 9H4z") + P("M17 9l5 6M22 9l-5 6"),
    repeat: P("M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"), music: P("M9 18V5l12-2v13") + C(6, 18, 3) + C(18, 16, 3), film: R(3, 3, 18, 18, 2) + P("M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"),
    unload: P("M12 4l8 9H4l8-9zM5 18h14"), unloadCache: P("M12 3l7 7H5l7-7zM5 14h14M7 18h10M9 22h6"),
    more: P("M5 12h.01M12 12h.01M19 12h.01"), sun: C(12, 12, 4) + P("M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"),
};
export function icon(name, size = 18) {
    const s = document.createElement("span");
    s.className = "ndk-ic";
    s.style.cssText = `display:inline-flex;width:${size}px;height:${size}px;flex:0 0 auto`;
    s.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
    return s;
}
export const hasIcon = (n) => n in ICONS;
export const ICON_NAMES = Object.keys(ICONS);

/* ------------------------------------------------------------------ stylesheet */

const FONT_URL = new URL("../fonts/Inter-ND.woff", import.meta.url).href;

export const KIT_CSS = `
@font-face{font-family:"Inter ND";src:url("${FONT_URL}") format("woff");font-weight:400 650;font-style:normal;font-display:swap}
.ndk,.ndk *,.ndk *::before,.ndk *::after{box-sizing:border-box}
.ndk{font-family:var(--ndk-font);font-size:var(--ndk-fs,13px);line-height:1.35;color:var(--ndk-text);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.ndk button{font:inherit;color:inherit}
.ndk-ic{pointer-events:none}
/* the page */
.ndk-stage{position:relative;width:100%;height:100%;overflow:hidden;background:var(--ndk-stage-bg,#000)}
.ndk-page{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;background-color:var(--ndk-bg);isolation:isolate}
.ndk-page-bg{position:absolute;inset:0;z-index:-1;border-radius:inherit}
.ndk-fillbg{position:absolute;inset:0;pointer-events:none;overflow:hidden;isolation:isolate}
.ndk-page-dim{position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit}
.ndk-edit .ndk-page{overflow:visible}
.ndk-edit .ndk-w.ndk-outside{opacity:.5;outline:1.5px dashed rgba(255,255,255,.55);outline-offset:2px}
/* a widget: the frame is placed by the layout, the inner box is scaled by the UI scale */
.ndk-w{position:absolute;min-width:0;min-height:0}
.ndk-wi{position:absolute;left:0;top:0;transform-origin:0 0;display:flex;flex-direction:column;justify-content:center;min-width:0;min-height:0}
.ndk-w.has-wbg>.ndk-wi{background:var(--ndk-wbg);border-radius:var(--ndk-rl);padding:10px 12px;box-shadow:inset 0 0 0 1px var(--ndk-cbd,var(--ndk-border))}
.ndk-label{flex:0 0 auto;font-size:12px;font-weight:500;color:var(--ndk-label);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.01em;user-select:none}
.ndk-w.lp-left>.ndk-wi{flex-direction:row;align-items:center;gap:12px}
.ndk-w.lp-left .ndk-label{margin:0;max-width:42%}
.ndk-w.lp-hidden .ndk-label{display:none}
.ndk-body{flex:0 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:center}
.ndk-w.lp-left .ndk-body{flex:1 1 auto}
.ndk-w.fill .ndk-body{flex:1 1 auto}
.ndk-w.lp-inside .ndk-label{display:none}
/* states */
.ndk-w.is-off>.ndk-wi{opacity:.5}
.ndk-w.is-off .ndk-body,.ndk-w.is-off .ndk-body *{pointer-events:none!important}
.ndk-w.is-lost>.ndk-wi{opacity:.6}
.ndk-badge{position:absolute;right:0;top:-2px;z-index:3;display:inline-flex;align-items:center;gap:4px;padding:1px 7px;font-size:10.5px;font-weight:600;border-radius:99px;background:var(--ndk-s3);color:var(--ndk-muted);pointer-events:none;letter-spacing:.02em}
.ndk-badge.lost{background:var(--ndk-danger);color:#1a0505}
.ndk-badge.unbound{background:var(--ndk-accent-soft);color:var(--ndk-accent)}
/* shared field look */
.ndk-field{display:flex;align-items:center;min-width:0;height:var(--ndk-ctl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rm);box-shadow:var(--ndk-field-shadow);-webkit-backdrop-filter:blur(var(--ndk-field-blur));backdrop-filter:blur(var(--ndk-field-blur));transition:border-color .14s ease,box-shadow .14s ease,background-color .14s ease;overflow:hidden}
.ndk-field:hover{border-color:var(--ndk-cbds,var(--ndk-border-strong))}
.ndk-field:focus-within{border-color:var(--ndk-accent);box-shadow:0 0 0 3px var(--ndk-accent-ring)}
.ndk[data-minimal="1"] .ndk-field,.ndk-w[data-minimal="1"] .ndk-field{border-radius:0;border-width:0 0 1px 0;border-bottom-color:var(--ndk-border-strong);box-shadow:none}
.ndk-iconbtn{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:calc(var(--ndk-ctl) - 2px);height:100%;padding:0;border:0;background:transparent;color:var(--ndk-muted);cursor:pointer;transition:color .12s,background-color .12s}
.ndk-iconbtn:hover{color:var(--ndk-text);background:var(--ndk-accent-soft)}
.ndk-iconbtn:active{color:var(--ndk-accent)}
.ndk-input{flex:1 1 auto;min-width:0;height:100%;padding:0 12px;border:0;outline:0;background:transparent;color:var(--ndk-value);font:inherit;font-weight:500}
.ndk-input::placeholder{color:var(--ndk-faint)}
/* number */
.ndk-num .ndk-input{text-align:center;padding:0 4px}
.ndk-unit{flex:0 0 auto;padding-right:10px;color:var(--ndk-faint);font-size:12px}
.ndk-scrub{cursor:ew-resize}
/* slider */
.ndk-sl{display:flex;align-items:center;gap:12px;height:var(--ndk-ctl)}
.ndk-sl-track{position:relative;flex:1 1 auto;height:6px;border-radius:99px;background:var(--ndk-s3);cursor:pointer;touch-action:none}
.ndk-sl-track::before{content:"";position:absolute;inset:-12px 0}
.ndk-sl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:inherit;background:var(--ndk-grad-sl,linear-gradient(90deg,var(--ndk-accent),var(--ndk-accent-hi)));box-shadow:var(--ndk-glow)}
.ndk-sl-thumb{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--ndk-accent-ring),0 2px 6px rgba(0,0,0,.35);transition:box-shadow .12s,transform .12s}
.ndk-sl-track:hover .ndk-sl-thumb{transform:scale(1.12)}
.ndk-sl-track.drag .ndk-sl-thumb{box-shadow:0 0 0 5px var(--ndk-accent-ring),0 2px 8px rgba(0,0,0,.4)}
.ndk-sl .ndk-field{flex:0 0 auto;width:72px;height:calc(var(--ndk-ctl) - 6px)}
.ndk-sl .ndk-input{text-align:center;padding:0 6px}
/* knob */
.ndk-knob{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex:1 1 auto;min-height:0}
.ndk-knob svg{display:block;touch-action:none;cursor:ns-resize;overflow:visible}
.ndk-knob-val{font-weight:600;font-size:14px;color:var(--ndk-value)}
.ndk-knob .trk{stroke:var(--ndk-s3)}.ndk-knob .val{stroke:var(--ndk-accent)}.ndk-knob .dot{fill:#fff}
/* seed */
.ndk-seed .ndk-input{padding:0 4px 0 12px}
.ndk-pill{flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;height:calc(100% - 10px);margin:0 5px 0 0;padding:0 9px;border:0;border-radius:var(--ndk-rs);background:var(--ndk-accent-soft);color:var(--ndk-accent);font-size:11.5px;font-weight:600;cursor:pointer}
.ndk-pill:hover{background:var(--ndk-accent);color:var(--ndk-on-accent)}
/* text and prompt */
.ndk-text .ndk-input{padding:0 12px}
.ndk-area{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;height:auto;border-radius:var(--ndk-ra)}
.ndk-w.fill .ndk-area{flex:1 1 auto}
.ndk-area textarea{flex:1 1 auto;min-height:0;width:100%;resize:none;padding:10px 12px;border:0;outline:0;background:transparent;color:var(--ndk-value);font:inherit;line-height:1.5}
.ndk-area.mono textarea{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:12.5px}
.ndk-area-foot{display:flex;align-items:center;justify-content:space-between;padding:0 6px 4px 12px;color:var(--ndk-faint);font-size:11px;min-height:22px}
.ndk-area-foot button{border:0;background:transparent;color:var(--ndk-muted);cursor:pointer;padding:2px 6px;border-radius:var(--ndk-rs);font-size:11px}
.ndk-area-foot button:hover{color:var(--ndk-text);background:var(--ndk-accent-soft)}
.ndk-area{height:100%}
/* dropdown */
.ndk-dd{cursor:pointer;padding:0 6px 0 12px;gap:6px;user-select:none}
.ndk-dd-val{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--ndk-value)}
.ndk-dd-val i{font-style:normal;color:var(--ndk-faint);font-weight:400}
.ndk-dd .ndk-ic{color:var(--ndk-muted)}
.ndk-pop{position:fixed;z-index:2147483000;display:flex;flex-direction:column;min-width:200px;max-height:340px;background:var(--ndk-s1);background-color:color-mix(in srgb,var(--ndk-s1) 100%,var(--ndk-bg));border:1px solid var(--ndk-cbds,var(--ndk-border-strong));border-radius:var(--ndk-rl);box-shadow:0 18px calc(var(--ndk-sh-blur,30px) * 1.6) var(--ndk-shadow),0 2px 8px var(--ndk-shadow);-webkit-backdrop-filter:blur(var(--ndk-field-blur,0px));backdrop-filter:blur(var(--ndk-field-blur,0px));overflow:hidden;color:var(--ndk-text);animation:ndk-pop .12s ease-out}
.ndk-pop[data-blur="0"]{background:color-mix(in srgb,var(--ndk-bg) 92%,var(--ndk-s1))}
@keyframes ndk-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.ndk-pop-search{display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;border-bottom:1px solid var(--ndk-border);color:var(--ndk-muted)}
.ndk-pop-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ndk-text);font:inherit}
.ndk-pop-list{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:4px;position:relative}
.ndk-pop-row{display:flex;align-items:center;gap:8px;height:32px;padding:0 10px;border-radius:var(--ndk-rs);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-pop-row:hover,.ndk-pop-row.hot{background:var(--ndk-accent-soft)}
.ndk-pop-row.sel{color:var(--ndk-accent);font-weight:600}
.ndk-pop-row i{font-style:normal;color:var(--ndk-faint);font-weight:400}
.ndk-pop-row mark{background:transparent;color:var(--ndk-accent);font-weight:600}
.ndk-pop-empty{padding:18px;text-align:center;color:var(--ndk-faint)}
.ndk-pop-foot{padding:6px 12px;border-top:1px solid var(--ndk-border);color:var(--ndk-faint);font-size:11px}
/* segmented and tabs */
.ndk-seg{display:flex;gap:2px;padding:3px;height:var(--ndk-ctl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rm);box-shadow:var(--ndk-field-shadow);-webkit-backdrop-filter:blur(var(--ndk-field-blur));backdrop-filter:blur(var(--ndk-field-blur))}
.ndk-seg button{flex:1 1 0;min-width:0;padding:0 10px;border:0;border-radius:calc(var(--ndk-rm) - 3px);background:transparent;color:var(--ndk-muted);font-weight:500;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background-color .14s,color .14s,box-shadow .14s}
.ndk-seg button:hover{color:var(--ndk-text)}
.ndk-seg button.on{background:var(--ndk-grad,var(--ndk-accent));color:var(--ndk-on-accent);box-shadow:0 1px 3px var(--ndk-shadow),var(--ndk-glow)}
.ndk[data-minimal="1"] .ndk-seg{border-width:0 0 1px 0;border-radius:0;padding:0;box-shadow:none}
.ndk[data-minimal="1"] .ndk-seg button.on{background:transparent;color:var(--ndk-accent);box-shadow:inset 0 -2px 0 var(--ndk-accent);border-radius:0}
/* toggle */
.ndk-tg{display:flex;align-items:center;gap:12px;min-height:var(--ndk-ctl);cursor:pointer;user-select:none}
.ndk-tg-sw{position:relative;flex:0 0 auto;width:40px;height:22px;border-radius:99px;background:var(--ndk-s3);box-shadow:inset 0 0 0 1px var(--ndk-border);transition:background-color .16s}
.ndk-tg-sw::after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:transform .16s cubic-bezier(.3,.7,.3,1)}
.ndk-tg.on .ndk-tg-sw{background:var(--ndk-grad,var(--ndk-accent));box-shadow:var(--ndk-glow)}
.ndk-tg.on .ndk-tg-sw::after{transform:translateX(18px)}
.ndk-tg:focus-visible .ndk-tg-sw{box-shadow:0 0 0 3px var(--ndk-accent-ring)}
.ndk-tg-txt{display:flex;flex-direction:column;min-width:0}
.ndk-tg-txt b{font-weight:500;color:var(--ndk-value);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-tg-txt small{color:var(--ndk-faint);font-size:11.5px}
/* decor */
.ndk-panel-box{position:absolute;inset:0;background:var(--ndk-pbg,var(--ndk-s1));border:1px solid var(--ndk-cbd,var(--ndk-border));border-radius:var(--ndk-rl);box-shadow:0 calc(var(--ndk-sh-blur,30px) / 3) var(--ndk-sh-blur,30px) var(--ndk-shadow);-webkit-backdrop-filter:blur(var(--ndk-field-blur));backdrop-filter:blur(var(--ndk-field-blur));overflow:hidden}
.ndk-panel-box.noshadow{box-shadow:none}
.ndk-panel-title{display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--ndk-ptitle,var(--ndk-text));border-bottom:1px solid var(--ndk-border);user-select:none}
.ndk-panel-title::before{content:"";width:3px;height:14px;border-radius:2px;background:var(--ndk-grad,var(--ndk-accent));box-shadow:var(--ndk-glow)}
.ndk-heading{margin:0;font-weight:600;color:var(--ndk-value);letter-spacing:-.01em;line-height:1.2}
.ndk-copy{color:var(--ndk-muted);line-height:1.5;white-space:pre-wrap;overflow:hidden}
.ndk-copy b{color:var(--ndk-text);font-weight:600}
.ndk-div{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.ndk-div::before{content:"";background:var(--ndk-border-strong);width:100%;height:var(--ndk-dth,1px);border-radius:2px}
.ndk-div.v::before{width:var(--ndk-dth,1px);height:100%}
.ndk-div.accent::before{background:linear-gradient(90deg,transparent,var(--ndk-accent),transparent)}
.ndk-img{position:absolute;inset:0;border-radius:var(--ndk-rl);overflow:hidden;background:var(--ndk-s2);display:flex;align-items:center;justify-content:center;color:var(--ndk-faint)}
.ndk-img img{width:100%;height:100%;object-fit:var(--ndk-fit,cover);display:block}
/* the strip with the pages above the page in the node */
.ndk-strip{display:flex;align-items:center;gap:6px;height:34px;padding:0 8px;background:var(--ndk-s1);border-bottom:1px solid var(--ndk-border);flex:0 0 auto}
.ndk-strip .tabs{display:flex;gap:2px;flex:1 1 auto;min-width:0;overflow:hidden}
.ndk-strip .tab{border:0;background:transparent;color:var(--ndk-muted);height:26px;padding:0 12px;border-radius:var(--ndk-rs);font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}
.ndk-strip .tab:hover{color:var(--ndk-text);background:var(--ndk-accent-soft)}
.ndk-strip .tab.on{color:var(--ndk-on-accent);background:var(--ndk-accent)}
.ndk-strip .act{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border:0;border-radius:var(--ndk-rs);background:var(--ndk-s2);color:var(--ndk-text);font-size:12px;font-weight:500;cursor:pointer}
.ndk-strip .act:hover{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-strip .act.icon{width:26px;padding:0;justify-content:center}
`;

let injected = false;
export function injectKit() {
    if (injected || document.getElementById("nd-ui-kit")) { injected = true; return; }
    const s = document.createElement("style");
    s.id = "nd-ui-kit";
    s.textContent = KIT_CSS + EXTRA_CSS + LORA_CSS + VIEWER_CSS + PLAYER_CSS + TRIM_CSS + IMGIN_CSS + ACTIVITY_CSS + EMBED_CSS + TABS_CSS + SHOWANY_CSS + VARIANTSEL_CSS;
    document.head.appendChild(s);
    injected = true;
}

/* ------------------------------------------------------------------ the checks the tests make */

// the pairs of colours that carry text in a theme: [name, text, surface]
export function contrastPairs(tokens) {
    return [
        ["text on page", tokens.text, tokens.bg], ["text on surface", tokens.text, tokens.s1], ["text on field", tokens.text, tokens.s2],
        ["muted on page", tokens.muted, tokens.bg], ["muted on surface", tokens.muted, tokens.s1], ["on-accent on accent", tokens.onAccent, tokens.accent],
    ];
}
export function themeContrast(tokens) {
    const base = tokens.bg;
    return contrastPairs(tokens).map(([name, fg, bg]) => ({ name, ratio: contrast(fg, bg, base) }));
}
