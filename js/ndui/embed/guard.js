// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — keeps a foreign panel from disturbing the page it sits in.
//  1. wheel / middle button: some panels (H3 Timeline) forward them to the ComfyUI canvas to zoom the graph. While the event comes from inside
//     a host, the forwarded copy is swallowed (it is not trusted, the real one is).
//  2. keys: Esc / Delete / Space / Ctrl+Z typed in a panel do not reach ND UI or the editor (bubbling phase only: the panel's own listeners run).
//  2b. text fields of the panel: the browser's spelling check and the weight of a word on Ctrl+Up / Down (ComfyUI listens for that key on `window`,
//     which the key guard keeps from the key) work as in the graph; the host says whether it wants them (opts.spell / opts.weights).
//  3. windows of the panel (modals, menus) go to document.body with a z-index below the editor: while an embed lives in the editor they are lifted.
import { app } from "../../../../scripts/app.js";
import { isWeightKey, isTextField, editWeight } from "../textedit.js";

const hosts = new Set();
const G = { inHost: false, timer: 0, lastAct: 0, lifted: new Map(), mo: null, editorRefs: 0, patched: false };
const SYNTH = new Set(["wheel", "pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "mousemove", "auxclick"]);
const inAnyHost = (t) => { for (const h of hosts) if (h.contains(t)) return true; return false; };

function onCapture(e) {
    if (!e.target || !inAnyHost(e.target)) return;
    G.inHost = true; G.lastAct = performance.now();
    clearTimeout(G.timer); G.timer = setTimeout(() => { G.inHost = false; }, 0);
}
function patch() {
    if (G.patched) return;
    const cv = app?.canvas?.canvas;
    if (!cv) return;
    G.patched = true;
    const orig = cv.dispatchEvent;
    cv.dispatchEvent = function (ev) {
        try {
            if (G.inHost && !ev.isTrusted && SYNTH.has(ev.type) && (ev.type === "wheel" || ev.button === 1)) return true;
        } catch {}
        return orig.call(this, ev);
    };
    for (const t of ["wheel", "pointerdown", "pointermove", "pointerup", "mousedown", "click", "keydown"]) window.addEventListener(t, onCapture, { capture: true, passive: true });
}

const KEYS = ["keydown", "keyup", "keypress"];
const stop = (e) => e.stopPropagation();

// a host is any element that contains foreign panels
export function guardHost(el, { editor = false, spell = () => false, weights = () => false } = {}) {
    patch();
    hosts.add(el);
    const onKey = (e) => {
        if (e.defaultPrevented || !isWeightKey(e) || !weights()) return;
        const t = e.composedPath?.()[0] || e.target;
        if (isTextField(t) && editWeight(t, e.key)) e.preventDefault();
    };
    const onFocus = (e) => { if (spell() && isTextField(e.target) && !e.target.spellcheck) e.target.spellcheck = true; };
    el.addEventListener("keydown", onKey); el.addEventListener("focusin", onFocus);
    for (const k of KEYS) el.addEventListener(k, stop);
    if (editor) liftOn();
    return () => {
        hosts.delete(el);
        el.removeEventListener("keydown", onKey); el.removeEventListener("focusin", onFocus);
        for (const k of KEYS) el.removeEventListener(k, stop);
        if (editor) liftOff();
    };
}

const BASE_Z = 100020;
function liftOn() {
    if (G.editorRefs++) return;
    G.mo = new MutationObserver((list) => {
        if (performance.now() - G.lastAct > 1500) return;
        for (const m of list) for (const n of m.addedNodes) lift(n);
    });
    G.mo.observe(document.body, { childList: true });
}
function lift(n) {
    if (!(n instanceof HTMLElement) || n.closest?.(".nde") || n.classList.contains("nde")) return;
    const cs = getComputedStyle(n);
    if (cs.position !== "fixed" && cs.position !== "absolute") return;
    const z = Number(cs.zIndex);
    if (Number.isFinite(z) && z >= 100000) return;
    G.lifted.set(n, n.style.zIndex);
    n.style.zIndex = String(BASE_Z);
}
function liftOff() {
    if (--G.editorRefs > 0) return;
    G.editorRefs = 0;
    G.mo?.disconnect(); G.mo = null;
    for (const [n, z] of G.lifted) { if (n.isConnected) n.style.zIndex = z; }
    G.lifted.clear();
}
