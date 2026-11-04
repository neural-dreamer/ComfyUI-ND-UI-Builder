// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — colours of a shown panel. off: nothing is touched. comfy (default): the CSS variables of ComfyUI are given the colours of the
// ND UI theme, so a panel built on them follows the theme. recolor (experiment): the colours the panel's own style sheets use are mapped onto the
// theme. css: the author's own CSS, valid only inside the frame.
import { profileOf } from "./profiles.js";

let SEQ = 0;
const COMFY = {
    "--comfy-menu-bg": "var(--ndk-s1)", "--comfy-menu-secondary-bg": "var(--ndk-s2)", "--comfy-input-bg": "var(--ndk-field-bg, var(--ndk-s2))",
    "--input-text": "var(--ndk-text)", "--descrip-text": "var(--ndk-muted)", "--drag-text": "var(--ndk-muted)", "--error-text": "var(--ndk-danger)",
    "--border-color": "var(--ndk-border-strong)", "--tr-even-bg-color": "var(--ndk-s1)", "--tr-odd-bg-color": "var(--ndk-s2)",
    "--content-bg": "var(--ndk-s2)", "--content-fg": "var(--ndk-text)", "--content-hover-bg": "var(--ndk-s3)", "--fg-color": "var(--ndk-text)",
    "--bg-color": "var(--ndk-bg)", "--p-primary-color": "var(--ndk-accent)", "--p-primary-contrast-color": "var(--ndk-on-accent)",
    "accent-color": "var(--ndk-accent)",
};
const COLOR_PROPS = ["color", "background-color", "background-image", "background", "border-color", "border-top-color", "border-right-color", "border-bottom-color",
    "border-left-color", "border", "border-top", "border-right", "border-bottom", "border-left", "outline-color", "outline", "box-shadow", "fill", "stroke", "caret-color", "text-shadow"];
const DYN = /::?(hover|active|focus|focus-within|focus-visible|visited|checked|disabled|enabled|placeholder|before|after|selection|-webkit-[\w-]+|-moz-[\w-]+|first-letter|first-line)\b/g;
const TOKEN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black)\b/gi;

// ---------------------------------------------------------------- colour maths
let cx = null;
export function parseColor(s) {
    if (!cx) cx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000"; cx.fillStyle = String(s);
    const t = cx.fillStyle;                       // normalised: #rrggbb or rgba(r, g, b, a)
    let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(t);
    if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), a: 1 };
    m = /^rgba?\(([^)]*)\)$/.exec(t);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] };
}
const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
function hsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return { h, s, l };
}
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const css = (c, a) => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+(a ?? c.a ?? 1).toFixed(3)})`;

// the theme scale and roles, read from the frame
function themeOf(host) {
    const cs = getComputedStyle(host), g = (n, d) => parseColor(cs.getPropertyValue(n).trim() || d) || parseColor(d);
    const raw = ["--ndk-bg", "--ndk-s1", "--ndk-s2", "--ndk-s3", "--ndk-border-strong", "--ndk-faint", "--ndk-muted", "--ndk-text"].map((n) => g(n, "#888"));
    // glass themes (Frost, Glass) give see-through surfaces: they are laid over the background first, otherwise the mix of their bare rgb is white / grey
    const base = { ...raw[0], a: 1 };
    const scale = raw.map((c) => (c.a >= 0.999 ? c : { ...mix(base, c, c.a), a: 1 }));
    // the order of the roles (background … text) is kept: in a light theme the darkest colour of the panel becomes the light background
    return { scale, accent: g("--ndk-accent", "#7757fa"), danger: g("--ndk-danger", "#f87171"), success: g("--ndk-success", "#34d399"), warning: g("--ndk-warning", "#fbbf24") };
}
// the colour a value of the panel becomes; ranks = sorted lightness values of the neutral colours the panel uses
function mapper(theme, ranks, roles) {
    const sc = theme.scale, n = sc.length;
    const cache = new Map();
    return (tok) => {
        if (cache.has(tok)) return cache.get(tok);
        const c = parseColor(tok);
        let out = tok;
        if (c && c.a > 0) {
            const key = `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
            const role = roles?.[key], h = hsl(c);
            // a colour is "coloured" when it has real chroma; the dark blue-greys of a dark panel are neutral, however saturated HSL calls them
            const chroma = (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255;
            const base = role ? theme[role] : chroma >= 0.2 && h.l > 0.08 && h.l < 0.96
                ? (h.h < 20 || h.h >= 340 ? theme.danger : h.h < 70 ? theme.warning : h.h < 170 ? theme.success : theme.accent) : null;
            if (base) {
                // the relative lightness is kept: a dark tint of the hue becomes a dark tint of the role
                const L = lum(c), Lb = Math.max(0.05, lum(base));
                out = css(L < Lb ? mix(theme.scale[0], base, Math.max(0.15, L / Lb)) : base, c.a);
            }
            else {
                // neutral: by the rank of its lightness among the neutral colours of the panel, on the scale of the theme
                const L = lum(c);
                const hi = ranks.length - 1;
                // between two known lightness values it lies between their places: a colour that appears later (inline) is not thrown to an end
                let t = 0.5;
                if (ranks.length > 1) {
                    const first = ranks.findIndex((x) => x >= L - 1e-6);
                    if (first < 0) t = 1;
                    else if (first === 0 || ranks[first] - L < 1e-6) t = first / hi;
                    else t = (first - 1 + (L - ranks[first - 1]) / (ranks[first] - ranks[first - 1])) / hi;
                }
                const f = t * (n - 1), i = Math.min(n - 2, Math.floor(f));
                out = css(mix(sc[i], sc[i + 1], f - i), c.a);
            }
        }
        cache.set(tok, out);
        return out;
    };
}
const mapValue = (v, map) => v.replace(TOKEN, (t) => map(t));

// ---------------------------------------------------------------- the style sheets used inside the frame
function* rulesOf(list) {
    for (const r of list) {
        if (r.type === 1) yield r;
        else if (r.cssRules && (r.type === 4 || r.type === 12)) yield* rulesOf(r.cssRules);   // @media, @supports
    }
}
function ownSheets() {
    const out = [];
    for (const s of document.styleSheets) {
        const o = s.ownerNode;
        if (!o || o.tagName !== "STYLE" || /^(nd-|ndk-)/.test(o.id || "") || o.dataset?.ndemb != null) continue;
        out.push(s);
    }
    return out;
}
function paletteOf(area) {
    const hits = [];
    for (const s of ownSheets()) {
        let rules; try { rules = s.cssRules; } catch { continue; }
        for (const r of rulesOf(rules)) {
            const decls = COLOR_PROPS.filter((p) => r.style.getPropertyValue(p));
            if (!decls.length) continue;
            const sels = r.selectorText.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
            for (const sel of sels) {
                if (/^(:root|html|body)\b/.test(sel)) continue;
                const probe = sel.replace(DYN, "").trim() || "*";
                let found = false;
                try { found = !!area.querySelector(probe) || area.matches(probe); } catch { continue; }
                if (found) hits.push({ sel, decls: decls.map((p) => [p, r.style.getPropertyValue(p), r.style.getPropertyPriority(p)]) });
            }
        }
    }
    return hits;
}

// ---------------------------------------------------------------- the controller of one frame
export class EmbedTheme {
    constructor(area) {
        this.area = area; this.id = `e${++SEQ}`; area.dataset.ndemb = this.id;
        this.mode = "off"; this.css = ""; this.vars = false;
        this.styleEl = null; this.cssEl = null; this.mo = null; this.orig = new WeakMap(); this.touched = new Set();
        this.raf = 0; this.map = null; this.sig = "";
    }
    set({ mode, css: c, node }) {
        mode = mode === "off" || mode === "recolor" ? mode : "comfy";
        this.node = node || null;
        if (mode !== this.mode) { this.clearRecolor(); this.mode = mode; this.sig = ""; }
        this.comfy(mode !== "off");
        this.userCss(String(c || ""));
        if (mode === "recolor") this.recolor();
    }
    comfy(on) {
        if (on === this.vars) return;
        this.vars = on;
        for (const [k, v] of Object.entries(COMFY)) on ? this.area.style.setProperty(k, v) : this.area.style.removeProperty(k);
    }
    userCss(text) {
        if (text === (this.cssText || "")) return;
        this.cssText = text;
        if (!text.trim()) { this.cssEl?.remove(); this.cssEl = null; return; }
        if (!this.cssEl) { this.cssEl = document.createElement("style"); this.cssEl.dataset.ndemb = this.id; document.head.append(this.cssEl); }
        const scope = `[data-ndemb="${this.id}"]`;
        let out;
        if (typeof CSSScopeRule !== "undefined") out = `@scope (${scope}) {\n${text}\n}`;
        else out = text.replace(/(^|\})\s*([^{}@]+)\{/g, (m, a, sel) => `${a}\n${sel.split(",").map((s) => `${scope} ${s.trim()}`).join(", ")}{`);
        this.cssEl.textContent = out;
    }
    // ---- recolor: call again whenever the panel inside may have changed (it does nothing when the set of used rules is the same)
    recolor() {
        if (this.mode !== "recolor") return;
        const a = this.area, hits = paletteOf(a);
        const theme = themeOf(a);
        const sig = hits.map((h) => h.sel).join("|") + "|" + theme.scale.map((c) => css(c)).join("");
        if (sig !== this.sig) {
            this.sig = sig;
            const toks = []; for (const h of hits) for (const [, v] of h.decls) for (const t of v.match(TOKEN) || []) toks.push(t);
            const ranks = this.neutralRanks(toks, a);
            const roles = profileOf(this.node)?.roles;
            this.map = mapper(theme, ranks, roles);
            if (!this.styleEl) { this.styleEl = document.createElement("style"); this.styleEl.dataset.ndemb = this.id; document.head.append(this.styleEl); }
            const pre = `[data-ndemb="${this.id}"] `;
            this.styleEl.textContent = hits.map((h) => `${pre}${h.sel}{${h.decls.map(([p, v]) => `${p}:${mapValue(v, this.map)}`).join(";")}}`).join("\n");
        }
        this.inline(a);
        if (!this.mo) {
            this.mo = new MutationObserver((list) => {
                if (this.busy || this.raf) return;
                this.raf = requestAnimationFrame(() => { this.raf = 0; if (this.mode === "recolor") this.inline(this.area); });
            });
            this.mo.observe(a, { subtree: true, attributes: true, attributeFilter: ["style"], childList: true });
        }
    }
    neutralRanks(toks, area) {
        const vals = [];
        const add = (t) => { const c = parseColor(t); if (c && c.a > 0 && hsl(c).s < 0.18) vals.push(lum(c)); };
        toks.forEach(add);
        for (const e of area.querySelectorAll("[style]")) for (const t of e.getAttribute("style").match(TOKEN) || []) add(t);
        return [...new Set(vals.map((v) => +v.toFixed(4)))].sort((x, y) => x - y);
    }
    inline(root) {
        if (!this.map) return;
        this.busy = true;
        try {
            for (const e of root.querySelectorAll("[style]")) {
                if (e.closest("canvas,video,img,svg image")) continue;
                const st = e.style;
                for (const p of COLOR_PROPS) {
                    const v = st.getPropertyValue(p);
                    if (!v) continue;
                    let o = this.orig.get(e); if (!o) this.orig.set(e, o = {});
                    // the value we wrote ourselves is not the original
                    if (o[p] && o[p].mapped === v) continue;
                    const mapped = mapValue(v, this.map);
                    if (mapped === v) continue;
                    o[p] = { orig: v, mapped, prio: st.getPropertyPriority(p) };
                    st.setProperty(p, mapped, o[p].prio);
                    o[p].mapped = st.getPropertyValue(p);      // the browser writes the value its own way; that is what we look for later
                    this.touched.add(e);
                }
            }
        } finally { this.busy = false; }
    }
    clearRecolor() {
        this.mo?.disconnect(); this.mo = null;
        if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0;
        this.styleEl?.remove(); this.styleEl = null;
        this.busy = true;
        for (const e of this.touched) {
            const o = this.orig.get(e); if (!o) continue;
            for (const [p, r] of Object.entries(o)) if (e.style.getPropertyValue(p) === r.mapped) e.style.setProperty(p, r.orig, r.prio);
            this.orig.delete(e);
        }
        this.touched.clear(); this.busy = false; this.map = null; this.sig = "";
    }
    destroy() {
        this.clearRecolor(); this.comfy(false); this.cssEl?.remove(); this.cssEl = null;
        delete this.area.dataset.ndemb;
    }
}
