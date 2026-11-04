// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the stack of LoRAs (the NDLoraStack node of Neural Dreamer Nodes): reading and writing the list, and the view that edits it (the LoRA widget:
// cards with pictures or video previews, sliders with arrows, trigger words). The node has its own list inside it (Neural Dreamer Nodes).
import { el, icon, popup } from "../widgets/util.js";
import { catalog, isNd, dirName, stemName, stackPresets } from "../models.js";
import { mediaThumb, nsfwButton, shieldButton } from "./media.js";
import { openGallery } from "./gallery.js";
import { infoButtons, fillInfo } from "./info_view.js";
import { touchWorkflow } from "../sources.js";

export const STACK_CLASS = "NDLoraStack";
export const isStackNode = (node) => !!node && (node.comfyClass === STACK_CLASS || node.type === STACK_CLASS);

/* ------------------------------------------------------------------ the list in the hidden widget `stack` */

export const stackWidget = (node) => node?.widgets?.find((w) => w.name === "stack") || null;

export function normalize(raw) {
    let a = [];
    try { a = JSON.parse(raw); } catch {}
    if (!Array.isArray(a)) return [];
    return a.filter((e) => e && typeof e.name === "string" && e.name).map((e) => ({
        name: e.name, on: e.on !== false, sm: Number.isFinite(+e.sm) ? +e.sm : 1,
        sc: Number.isFinite(+e.sc) ? +e.sc : Number.isFinite(+e.sm) ? +e.sm : 1, link: e.link !== false,
        words: Array.isArray(e.words) ? e.words.map(String) : [],
    }));
}
export const readStack = (node) => normalize(stackWidget(node)?.value);
export const stackText = (node) => String(stackWidget(node)?.value ?? "");
export function writeStack(node, list) {
    const w = stackWidget(node);
    if (!w) return false;
    const v = JSON.stringify(list.map((e) => ({ name: e.name, on: e.on, sm: +e.sm.toFixed(3), sc: e.link ? +e.sm.toFixed(3) : +e.sc.toFixed(3), link: e.link, words: e.words })));
    w.value = v;
    try { w.callback?.(v, null, node); } catch {}
    try { node.graph?.setDirtyCanvas?.(true, false); } catch {}
    touchWorkflow();
    return true;
}
// hide the technical widget `stack` from the node and from the parameters of the panel
export function hideStackWidget(node) {
    const w = stackWidget(node);
    if (!w || w.nd_hidden) return;
    w.nd_hidden = true; w.hidden = true; w.computeSize = () => [0, -4];
    if (w.options) w.options.hidden = true;
    for (const k of ["element", "inputEl"]) if (w[k]?.style) w[k].style.display = "none";
}

/* ------------------------------------------------------------------ the view */

const RANGE = [-2, 2];
const STEP = 0.05, STEP_BIG = 0.25;
const fmt = (v) => String(+Number(v).toFixed(2));
// the result of an arrow stays on the grid of 0.05, so repeated steps do not drift (0.8500000001)
const onGrid = (v) => +(Math.round(v / STEP) * STEP).toFixed(3);

// ◀ ▶: one step at once, then (after 400 ms) one every 80 ms while it is held. Shift (held now) makes the step bigger.
function arrowBtn(dir, step, title) {
    const b = el("button", "ndk-lr-arr"); b.type = "button"; b.title = title; b.append(icon(dir < 0 ? "chevL" : "chevR", 12));
    let t1 = null, t2 = null, shift = false;
    const key = (e) => { if (e.key === "Shift") shift = e.type === "keydown"; };
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
    const go = () => step(dir * (shift ? STEP_BIG : STEP));
    b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        shift = e.shiftKey; stop(); go();
        t1 = setTimeout(() => { t2 = setInterval(go, 80); }, 400);
        window.addEventListener("keydown", key, true); window.addEventListener("keyup", key, true);
        try { b.setPointerCapture(e.pointerId); } catch {}
    });
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(t, stop);
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); shift = e.shiftKey; go(); } e.stopPropagation(); });
    return b;
}

// a row "label  ——o——  ◀ 0.80 ▶": a slider and a number; onInput is called while it moves, onSettle after a typed number.
// free: a number typed by hand is never limited (otherwise it is held to ±10); fixed: the slider keeps `range` and stops at its end when the value lies outside
// (the number still shows the real value); arrows: the buttons ◀ ▶ (step 0.05, Shift 0.25, hold to repeat); tr: the translator for their tooltips.
export function strengthRow(label, value, onInput, { off = false, onSettle, range = RANGE, free = false, fixed = false, arrows = false, tr = (s) => s } = {}) {
    const r = el("div", `ndk-lr-str${off ? " off" : ""}`);
    const lo = fixed ? range[0] : Math.min(range[0], value), hi = fixed ? range[1] : Math.max(range[1], value);
    const clampR = (v) => (fixed ? Math.max(lo, Math.min(hi, v)) : v);
    const rg = el("input"); rg.type = "range"; rg.min = lo; rg.max = hi; rg.step = 0.05; rg.value = clampR(value); rg.disabled = !!off;
    const paint = () => rg.style.setProperty("--p", `${hi > lo ? ((rg.value - lo) / (hi - lo)) * 100 : 0}%`);
    const num = el("input", "ndk-lr-num"); num.type = "text"; num.inputMode = "decimal"; num.spellcheck = false; num.value = fmt(value); num.disabled = !!off;
    let cur = value;
    paint();
    const put = (v) => { cur = v; rg.value = clampR(v); paint(); num.value = fmt(v); };
    rg.addEventListener("input", () => { put(+rg.value); onInput(+rg.value); });
    num.addEventListener("change", () => {
        const n = Number(num.value.replace(",", "."));
        if (!Number.isFinite(n)) { num.value = fmt(cur); return; }
        const c = free ? n : Math.max(-10, Math.min(10, n));
        put(c); onInput(c); onSettle?.();
    });
    num.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") num.blur(); });
    rg.addEventListener("keydown", (e) => e.stopPropagation());
    r.append(el("span", "ndk-lr-lab", label), rg);
    if (arrows) {
        const step = (d) => { const v = onGrid(cur + d); put(v); onInput(v); };
        const less = arrowBtn(-1, step, tr("Weaker (Shift: bigger step)")), more = arrowBtn(1, step, tr("Stronger (Shift: bigger step)"));
        less.disabled = more.disabled = !!off;
        r.append(less, num, more);
    } else r.append(num);
    return r;
}

// opts: {node, tr, vars(), popupHost(), props()}; props() -> {play: "hover"|"always", rmin, rmax, arrows}, asked again at every update
export function stackView(opts) {
    const { node } = opts;
    const tr = (s, v) => opts.tr(s, v);
    const pctx = { tr, vars: opts.vars || (() => ({})), popupHost: opts.popupHost || (() => document.body) };
    const root = el("div", "ndk-lr");
    const listEl = el("div", "ndk-lr-list");
    listEl.dataset.ndScroll = "1"; listEl.dataset.captureWheel = "true";   // the wheel scrolls the list (not the graph) while it has more to show
    const bar = el("div", "ndk-lr-bar");
    root.append(listEl, bar);
    const P = () => { const p = opts.props?.() || {}; const lo = Number.isFinite(+p.rmin) ? +p.rmin : -1.5, hi = Number.isFinite(+p.rmax) ? +p.rmax : 1.5; return { play: p.play === "always" ? "always" : "hover", rmin: Math.min(lo, hi), rmax: Math.max(lo, hi), arrows: p.arrows !== false }; };
    let info = new Map(), seen = null, list = [], pseen = "";

    const commit = (redraw = true) => { writeStack(node, list); seen = stackText(node); if (redraw) draw(); };
    const move = (from, to) => { if (from === to || from < 0 || to < 0) return; const [x] = list.splice(from, 1); list.splice(to, 0, x); commit(); };
    const wordsOf = (e) => { const known = info.get(e.name)?.words || []; return [...known, ...e.words.filter((w) => !known.includes(w))]; };

    const addButton = () => {
        const b = el("button", "ndk-btn ndk-lr-add"); b.type = "button"; b.append(icon("plus", 15), el("span", "", tr("LoRA")));
        b.addEventListener("click", () => openGallery(pctx, b, {
            folder: "loras", title: tr("Add a LoRA"),
            onPick: (name, m) => { list.push({ name, on: true, sm: 1, sc: 1, link: true, words: [...(m?.words || [])] }); commit(); },
        }));
        return b;
    };
    const presetsButton = () => {
        const b = el("button", "ndk-btn ndk-lr-pre"); b.type = "button"; b.title = tr("Saved stacks"); b.append(icon("save", 15), el("span", "", tr("Stacks")));
        b.addEventListener("click", () => popup(pctx, b, {
            width: 280, maxH: 360,
            build(box, close) {
                const names = () => Object.keys(stackPresets.all()).sort();
                const row = el("div", "ndk-lr-prerow");
                const inp = el("input", "ndk-input"); inp.placeholder = tr("Name of the stack"); inp.spellcheck = false;
                const f = el("div", "ndk-field"); f.append(inp);
                const save = el("button", "ndk-btn"); save.type = "button"; save.textContent = tr("Save"); save.style.padding = "0 12px";
                row.append(f, save);
                const rows = el("div", "ndk-pop-list");
                const draw2 = () => {
                    rows.textContent = "";
                    if (!names().length) rows.append(el("div", "ndk-pop-empty", tr("No saved stacks yet")));
                    for (const n of names()) {
                        const r = el("div", "ndk-pop-row"); r.append(el("span", "", n));
                        const x = el("button", "ndk-iconbtn"); x.type = "button"; x.title = tr("Delete"); x.style.marginLeft = "auto"; x.append(icon("trash", 14));
                        x.addEventListener("click", (e) => { e.stopPropagation(); stackPresets.remove(n); draw2(); });
                        r.append(x);
                        r.addEventListener("click", () => { list = normalize(JSON.stringify(stackPresets.all()[n])); commit(); close(); });
                        rows.append(r);
                    }
                };
                const doSave = () => { const n = inp.value.trim(); if (!n || !list.length) return; stackPresets.save(n, list); inp.value = ""; draw2(); };
                save.addEventListener("click", doSave);
                inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") doSave(); });
                box.append(row, rows); draw2();
            },
        }));
        return b;
    };

    const strength = (label, value, onInput, off) => { const p = P(); return strengthRow(label, value, onInput, { off, onSettle: draw, range: [p.rmin, p.rmax], fixed: true, free: true, arrows: p.arrows, tr }); };

    const row = (e, i) => {
        const m = info.get(e.name);
        const c = el("div", `ndk-lr-card${e.on ? "" : " off"}`); c.dataset.i = String(i);
        const top = el("div", "ndk-lr-top");
        const grip = el("span", "ndk-lr-grip"); grip.title = tr("Drag to change the order"); grip.append(icon("grip", 14));
        const pic = el("div", "ndk-lr-pic");
        const media = mediaThumb(m || {}, "loras", { play: P().play, hover: c }); pic.append(media);
        const nm = el("div", "ndk-lr-name"); nm.title = e.name;
        nm.append(el("b", "", m?.title || stemName(e.name)));
        const sub = el("small", "", [dirName(e.name), m?.base].filter(Boolean).join(" · ")); if (sub.textContent) nm.append(sub);
        if (!info.has(e.name) && info.size) { c.classList.add("miss"); nm.append(el("small", "warn", tr("File not found"))); }
        const sw = el("button", `ndk-lr-sw${e.on ? " on" : ""}`); sw.type = "button"; sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", String(e.on)); sw.title = tr("On / off"); sw.append(el("i"));
        sw.addEventListener("click", () => { e.on = !e.on; commit(); });
        const del = el("button", "ndk-iconbtn ndk-lr-del"); del.type = "button"; del.title = tr("Remove from the stack"); del.append(icon("x", 14));
        del.addEventListener("click", () => { list.splice(i, 1); commit(); });
        {
            const ib = infoButtons(m, tr, (anchor) => popup(pctx, anchor, {
                width: 340, maxH: 420,
                build(pbox) { fillInfo(pbox, { ...m, words: wordsOf(e) }, { tr, title: m?.title || stemName(e.name), chosen: e.words, onChosen: (w) => { e.words = w; commit(false); }, picture: { folder: "loras" } }); },
            }));
            const shield = m && isNd(m) ? shieldButton(pctx, m, "ndk-iconbtn ndk-lr-shield", () => media.setNsfw(m.nsfw)) : null;
            top.append(grip, pic, nm, ib, ...(shield ? [shield] : []), sw, del);
            c.append(top);
            const body = el("div", "ndk-lr-body");
            body.append(strength(tr("Model"), e.sm, (v) => { e.sm = v; if (e.link) e.sc = v; commit(false); }));
            const clipRow = strength(tr("CLIP"), e.link ? e.sm : e.sc, (v) => { e.sc = v; commit(false); }, e.link);
            clipRow.classList.add("ndk-lr-cliprow");
            const lk = el("button", `ndk-iconbtn ndk-lr-link${e.link ? " on" : ""}`); lk.type = "button"; lk.title = tr("The CLIP strength follows the model strength"); lk.append(icon(e.link ? "link" : "unlink", 14));
            lk.addEventListener("click", () => { e.link = !e.link; if (!e.link) e.sc = e.sm; commit(); });
            clipRow.append(lk);
            body.append(clipRow);
            c.append(body);
            // the order: drag by the grip
            grip.draggable = true;
            grip.addEventListener("dragstart", (ev) => { ev.dataTransfer.setData("application/x-nd-lora", String(i)); ev.dataTransfer.effectAllowed = "move"; setTimeout(() => c.classList.add("drag"), 0); });
            grip.addEventListener("dragend", () => { c.classList.remove("drag"); for (const x of listEl.children) x.classList.remove("over-t", "over-b"); });
            c.addEventListener("dragover", (ev) => {
                if (![...ev.dataTransfer.types].includes("application/x-nd-lora")) return;
                ev.preventDefault();
                const r = c.getBoundingClientRect(), top2 = ev.clientY < r.top + r.height / 2;
                c.classList.toggle("over-t", top2); c.classList.toggle("over-b", !top2);
            });
            c.addEventListener("dragleave", () => c.classList.remove("over-t", "over-b"));
            c.addEventListener("drop", (ev) => {
                const from = parseInt(ev.dataTransfer.getData("application/x-nd-lora"), 10);
                if (!Number.isFinite(from)) return;
                ev.preventDefault();
                const r = c.getBoundingClientRect(), after = ev.clientY >= r.top + r.height / 2;
                let to = i + (after ? 1 : 0); if (from < to) to--;
                c.classList.remove("over-t", "over-b");
                move(from, to);
            });
        }
        return c;
    };

    function draw() {
        list = readStack(node); seen = stackText(node); pseen = JSON.stringify(P());
        listEl.textContent = "";
        if (!list.length) listEl.append(el("div", "ndk-lr-empty", tr("No LoRAs yet. Press + LoRA.")));
        list.forEach((e, i) => listEl.append(row(e, i)));
        bar.textContent = "";
        const on = list.filter((e) => e.on).length;
        bar.append(addButton());
        bar.append(presetsButton());
        if ([...info.values()].some(isNd)) bar.append(nsfwButton(tr, "ndk-iconbtn ndk-lr-eye"));
        bar.append(el("span", "ndk-lr-count", list.length ? tr("{on} of {all} on", { on, all: list.length }) : ""));
    }
    catalog("loras").then((m) => { info = m; draw(); });
    draw();
    return {
        el: root,
        // called by the page: the list is redrawn only when somebody else changed it
        update() { if (stackText(node) !== seen || JSON.stringify(P()) !== pseen) draw(); },
        refresh() { catalog("loras", true).then((m) => { info = m; draw(); }); },
    };
}
