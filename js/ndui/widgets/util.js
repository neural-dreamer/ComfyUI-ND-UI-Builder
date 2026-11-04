// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — small helpers shared by the widgets.
import { icon, applyVars } from "../kit.js";

export const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
};
export { icon };

export const clampN = (v, lo, hi) => {
    if (Number.isFinite(lo) && v < lo) v = lo;
    if (Number.isFinite(hi) && v > hi) v = hi;
    return v;
};
// a value rounded to the step (counted from min)
export function snap(v, step, min) {
    if (!(step > 0)) return v;
    const base = Number.isFinite(min) ? min : 0;
    const n = Math.round((v - base) / step);
    return base + n * step;
}
export const decimalsOf = (step) => {
    if (!(step > 0) || step >= 1) return 0;
    return Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
};
export function fmt(v, precision) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return precision > 0 ? n.toFixed(precision) : String(Math.round(n));
}
export function parseNumber(text) {
    const t = String(text).trim().replace(",", ".");
    if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
}

// how many screen pixels one pixel of this element takes (the page is scaled, and so is the ComfyUI canvas)
export function screenScale(node) {
    const r = node.getBoundingClientRect();
    return node.offsetWidth ? r.width / node.offsetWidth || 1 : 1;
}

// pointer dragging with capture: start(e) may return false to refuse, returns a state passed to move and end
export function dragger(target, { start, move, end, button = 0 }) {
    target.addEventListener("pointerdown", (e) => {
        if (e.button !== button) return;
        const st = start ? start(e) : {};
        if (st === false) return;
        try { target.setPointerCapture(e.pointerId); } catch {}
        const id = e.pointerId;
        const mv = (ev) => { if (ev.pointerId === id) move?.(ev, st); };
        const up = (ev) => {
            if (ev.pointerId !== id) return;
            target.removeEventListener("pointermove", mv);
            target.removeEventListener("pointerup", up);
            target.removeEventListener("pointercancel", up);
            try { target.releasePointerCapture(id); } catch {}
            end?.(ev, st);
        };
        target.addEventListener("pointermove", mv);
        target.addEventListener("pointerup", up);
        target.addEventListener("pointercancel", up);
    });
}

// A popup near an element, in the layer of the panel (so it works in the node, in the editor and on the full screen).
// build(box, close) fills it. Closes on an outside click, Esc, scroll of the page and when the window loses focus.
let openPopup = null;
export function popup(ctx, anchor, { width, build, maxH = 340, center = null }) {
    openPopup?.close();
    const host = ctx.popupHost?.() || document.body;
    const box = el("div", "ndk ndk-pop");
    applyVars(box, ctx.vars());
    box.style.visibility = "hidden";
    host.appendChild(box);
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener("pointerdown", outside, true);
        window.removeEventListener("keydown", key, true);
        window.removeEventListener("blur", close);
        window.removeEventListener("resize", close);
        box.remove();
        if (openPopup && openPopup.box === box) openPopup = null;
        ctx.onPopupClose?.();
    };
    const outside = (e) => { if (!box.contains(e.target)) close(); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    build(box, close);
    if (center) {
        // a big window in the middle of the screen (the gallery): w x h at most, 96% x 94% of the screen
        const cw = Math.min(center.w, Math.floor(window.innerWidth * 0.96)), ch = Math.min(center.h, Math.floor(window.innerHeight * 0.94));
        box.style.width = `${cw}px`; box.style.height = `${ch}px`; box.style.maxHeight = `${ch}px`;
        box.style.left = `${Math.max(0, Math.round((window.innerWidth - cw) / 2))}px`; box.style.top = `${Math.max(0, Math.round((window.innerHeight - ch) / 2))}px`;
        box.style.visibility = "";
        openPopup = { close, box };
        return { box, close };
    }
    const a = anchor.getBoundingClientRect();
    const w = Math.max(width || 0, a.width, 200);
    box.style.width = `${w}px`;
    box.style.maxHeight = `${maxH}px`;
    const vw = window.innerWidth;
    const left = Math.max(8, Math.min(a.left, vw - w - 8));
    box.style.left = `${left}px`;
    // below the anchor when a comfortable list fits there, else on the side with more room; the box is shortened to that room and grows away
    // from the anchor, so content that arrives later (a gallery filling up) never pushes it out of the window
    const vh = window.innerHeight, below = vh - a.bottom - 14, above = a.top - 14;
    const up = below < Math.min(maxH, 340) && above > below;
    box.style.maxHeight = `${Math.min(maxH, Math.max(140, up ? above : below))}px`;
    if (up) { box.style.top = "auto"; box.style.bottom = `${vh - a.top + 6}px`; }
    else box.style.top = `${Math.max(8, a.bottom + 6)}px`;
    box.style.visibility = "";
    openPopup = { close, box };
    return { box, close };
}
export const closePopup = () => openPopup?.close();
