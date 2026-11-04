// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — form controls of the inspector (they take already translated texts).
import { el, icon, popup } from "./widgets/util.js";
import { parseColor, toHex, isLight } from "./kit.js";

export function btn(text, ic, onClick, cls = "", title = "") {
    const b = el("button", `nde-btn ${cls}`);
    b.type = "button";
    if (ic) b.append(icon(ic, 15));
    if (text) b.append(el("span", "", text));
    if (title) b.title = title;
    if (onClick) b.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
    return b;
}
export function iconBtn(ic, title, onClick, cls = "") {
    const b = el("button", `nde-ibtn ${cls}`);
    b.type = "button"; b.title = title; b.setAttribute("aria-label", title);
    b.append(icon(ic, 16));
    if (onClick) b.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
    return b;
}

export function section(title, build, { open = true, key } = {}) {
    const wrap = el("section", "nde-sec");
    const head = el("button", "nde-sec-h"); head.type = "button";
    head.append(el("span", "", title), icon("chevD", 14));
    const body = el("div", "nde-sec-b");
    let opened = open;
    try { if (key) { const v = sessionStorage.getItem(`nde-sec-${key}`); if (v != null) opened = v === "1"; } } catch {}
    const apply = () => { wrap.classList.toggle("closed", !opened); };
    head.addEventListener("click", () => { opened = !opened; apply(); try { if (key) sessionStorage.setItem(`nde-sec-${key}`, opened ? "1" : "0"); } catch {} });
    build(body);
    wrap.append(head, body);
    apply();
    return wrap;
}

export function row(label, control, hint) {
    const r = el("div", `nde-row${control?.classList?.contains("nde-seg") && control.children.length > 2 ? " col" : ""}`);
    const l = el("label", "nde-lab", label);
    if (hint) l.title = hint;
    r.append(l, control);
    if (hint) r.title = hint;
    return r;
}

export function numberInput({ value, min, max, step = 1, placeholder = "", onInput, onChange, int = false, width }) {
    const wrap = el("div", "nde-num");
    const i = el("input", "nde-in"); i.type = "text"; i.inputMode = "decimal"; i.spellcheck = false; i.placeholder = placeholder;
    if (width) wrap.style.width = `${width}px`;
    const show = (v) => { i.value = v == null || v === "" || !Number.isFinite(Number(v)) ? "" : String(+Number(v).toFixed(4)); };
    show(value);
    const parse = () => {
        const t = i.value.trim().replace(",", ".");
        if (t === "") return null;
        let n = Number(t);
        if (!Number.isFinite(n)) return undefined;
        if (int) n = Math.round(n);
        if (Number.isFinite(min)) n = Math.max(min, n);
        if (Number.isFinite(max)) n = Math.min(max, n);
        return n;
    };
    i.addEventListener("input", () => { const n = parse(); if (n !== undefined) onInput?.(n); });
    i.addEventListener("change", () => { const n = parse(); if (n === undefined) { show(value); return; } show(n); onChange?.(n); });
    i.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") i.blur();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const cur = parse() ?? 0;
            let n = cur + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            if (Number.isFinite(min)) n = Math.max(min, n);
            if (Number.isFinite(max)) n = Math.min(max, n);
            n = int ? Math.round(n) : +n.toFixed(6);
            show(n); onInput?.(n); onChange?.(n);
        }
    });
    wrap.append(i);
    wrap.set = show;
    return wrap;
}

export function textInput({ value = "", placeholder = "", onInput, onChange, multiline = false, rows = 3 }) {
    const i = el(multiline ? "textarea" : "input", "nde-in nde-text");
    if (!multiline) i.type = "text"; else i.rows = rows;
    i.spellcheck = false; i.value = value ?? ""; i.placeholder = placeholder;
    i.addEventListener("input", () => onInput?.(i.value));
    i.addEventListener("change", () => onChange?.(i.value));
    i.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !multiline) i.blur(); });
    return i;
}

export function selectInput(options, value, onChange) {
    const s = el("select", "nde-in nde-select");
    for (const [v, label] of options) { const o = el("option", "", label); o.value = String(v); s.append(o); }
    s.value = String(value);
    s.addEventListener("change", () => { const hit = options.find(([v]) => String(v) === s.value); onChange?.(hit ? hit[0] : s.value); });
    s.addEventListener("keydown", (e) => e.stopPropagation());
    return s;
}

export function segInput(options, value, onChange) {
    const g = el("div", "nde-seg");
    for (const [v, label, title] of options) {
        const b = el("button", `${v === value ? "on" : ""}`, label); b.type = "button"; if (title) b.title = title;
        b.addEventListener("click", () => { for (const x of g.children) x.classList.remove("on"); b.classList.add("on"); onChange?.(v); });
        g.append(b);
    }
    return g;
}

export function toggleInput(value, onChange) {
    const t = el("button", `nde-tg${value ? " on" : ""}`); t.type = "button"; t.setAttribute("role", "switch"); t.setAttribute("aria-checked", String(!!value));
    t.append(el("span", "nde-tg-k"));
    t.addEventListener("click", () => { const v = !t.classList.contains("on"); t.classList.toggle("on", v); t.setAttribute("aria-checked", String(v)); onChange?.(v); });
    return t;
}

export function rangeInput({ value, min, max, step = 1, onInput, onChange, fmt = (v) => String(v) }) {
    const w = el("div", "nde-range");
    const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = step; r.value = value;
    const out = el("span", "nde-range-v", fmt(value));
    const paint = () => { r.style.setProperty("--p", `${((r.value - min) / (max - min)) * 100}%`); out.textContent = fmt(Number(r.value)); };
    r.addEventListener("input", () => { paint(); onInput?.(Number(r.value)); });
    r.addEventListener("change", () => onChange?.(Number(r.value)));
    r.addEventListener("keydown", (e) => e.stopPropagation());
    paint();
    w.append(r, out);
    return w;
}

/* ------------------------------------------------------------------ colours */

const hex6 = (c) => { const a = parseColor(c); return toHex(a); };
const alphaOf = (c) => parseColor(c)[3];
const withAlpha = (hex, a) => (a >= 0.995 ? hex : hex + Math.round(a * 255).toString(16).padStart(2, "0"));

// A colour field: a swatch that opens a small picker (the colours of the theme first, then any colour with transparency).
// value: "#rrggbb" / "#rrggbbaa" / null (null = as the theme says, when `nullable`)
export function colorInput({ value, palette = [], onChange, nullable = true, host, tr }) {
    const wrap = el("div", "nde-color");
    const sw = el("button", "nde-sw"); sw.type = "button";
    const txt = el("span", "nde-sw-t");
    const clr = nullable ? iconBtn("x", tr("As the theme"), () => { value = null; paint(); onChange?.(null); }, "nde-sw-x") : null;
    wrap.append(sw, txt);
    if (clr) wrap.append(clr);
    const paint = () => {
        sw.style.setProperty("--c", value || "transparent");
        sw.classList.toggle("none", !value);
        txt.textContent = value ? value.toUpperCase() : tr("Theme");
        if (clr) clr.style.visibility = value ? "" : "hidden";
    };
    sw.addEventListener("click", () => {
        // dragging in the picker only moves the preview; the colour is applied when the drag ends (the picker closes) — live updates made it very slow
        let pending = false;
        const ctx = { vars: () => ({}), popupHost: () => host, onPopupClose: () => { if (pending) { pending = false; onChange?.(value); } } };
        popup(ctx, sw, {
            width: 244, maxH: 420,
            build(box, close) {
                box.classList.add("nde-colorpop");
                const base = hex6(value || palette[0]?.[1] || "#7757fa");
                let cur = { hex: base, a: value ? alphaOf(value) : 1 };
                const preview = el("div", "nde-cp-prev");
                const hexIn = el("input", "nde-in"); hexIn.spellcheck = false;
                const native = el("input"); native.type = "color";
                // live = true: only the preview and the fields show the colour; the colour itself is applied on commit
                const alpha = rangeInput({ value: Math.round(cur.a * 100), min: 0, max: 100, step: 1, fmt: (v) => `${v}%`, onInput: (v) => { cur.a = v / 100; push(false, true); }, onChange: () => push(false) });
                const push = (fromHex, live) => {
                    const out = withAlpha(cur.hex, cur.a);
                    value = out; paint();
                    preview.style.setProperty("--c", out);
                    if (!fromHex) hexIn.value = cur.hex.toUpperCase();
                    native.value = cur.hex;
                    if (live) pending = true;
                    else { pending = false; onChange?.(out); }
                };
                if (palette.length) {
                    const grid = el("div", "nde-cp-grid");
                    for (const [name, c] of palette) {
                        const b = el("button", "nde-cp-c"); b.type = "button"; b.title = name; b.style.setProperty("--c", c);
                        b.addEventListener("click", () => { cur = { hex: hex6(c), a: alphaOf(c) }; alpha.querySelector("input").value = Math.round(cur.a * 100); alpha.querySelector("input").dispatchEvent(new Event("input")); push(false); });
                        grid.append(b);
                    }
                    box.append(el("div", "nde-cp-h", tr("Colours of the theme")), grid);
                }
                box.append(el("div", "nde-cp-h", tr("Any colour")));
                const line = el("div", "nde-cp-line");
                native.value = cur.hex; hexIn.value = cur.hex.toUpperCase(); preview.style.setProperty("--c", value || cur.hex);
                native.addEventListener("input", () => { cur.hex = native.value; push(false, true); });
                native.addEventListener("change", () => { cur.hex = native.value; push(false); });
                hexIn.addEventListener("change", () => { const t = hexIn.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(t)) { cur.hex = ("#" + t.replace("#", "")).toLowerCase(); push(false); } else hexIn.value = cur.hex.toUpperCase(); });
                hexIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") hexIn.blur(); });
                line.append(native, hexIn, preview);
                box.append(line, el("div", "nde-cp-h", tr("Transparency")), alpha);
                if (nullable) box.append(btn(tr("As the theme"), "x", () => { value = null; paint(); onChange?.(null); close(); }, "nde-cp-reset"));
            },
        });
    });
    paint();
    wrap.set = (v) => { value = v; paint(); };
    return wrap;
}

export const readable = (c) => (isLight(c) ? "#10131c" : "#ffffff");
