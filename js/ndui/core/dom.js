// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — small DOM helpers (own copy: the pack works without Neural Dreamer Nodes).
import { app } from "../../../../scripts/app.js";

export const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
};

export const dirty = () => app.graph?.setDirtyCanvas?.(true, true);

export function toast(severity, summary, detail) {
    try {
        if (app.extensionManager?.toast?.add) {
            app.extensionManager.toast.add({ severity, summary, detail, life: 4500 });
            return;
        }
    } catch {}
    if (severity === "error") alert(`${summary}\n${detail || ""}`);
    else console.log(`[ND] ${summary}: ${detail || ""}`);
}

export function isSelected(node) {
    const c = app.canvas;
    if (!c) return false;
    if (c.selectedItems instanceof Set) return c.selectedItems.size === 1 && c.selectedItems.has(node);
    if (c.selected_nodes) {
        const keys = Object.keys(c.selected_nodes);
        return keys.length === 1 && c.selected_nodes[node.id] === node;
    }
    return !!node.selected;
}

export function chain(proto, name, fn) {
    const orig = proto[name];
    proto[name] = function (...args) {
        const r = orig?.apply(this, args);
        fn.apply(this, args);
        return r;
    };
}

// The node UI is an HTML overlay above the ComfyUI canvas, so wheel events over it
// never reach the canvas. Re-dispatch them to the canvas element: zoom keeps working

export function getCanvasEl() {
    return app.canvas?.canvas ?? document.getElementById("graph-canvas") ?? document.querySelector("canvas.graph-canvas-container, canvas#graph-canvas");
}

export function forwardWheelToCanvas(root) {
    root.addEventListener("wheel", (e) => {
        if (e.__ndForwarded) return;
        // elements marked data-nd-scroll keep native scrolling while they overflow
        const sc = e.target?.closest?.("[data-nd-scroll]");
        if (sc && !e.ctrlKey && (sc.scrollHeight > sc.clientHeight + 1 || sc.scrollWidth > sc.clientWidth + 1)) return;
        const target = getCanvasEl();
        if (!target || target.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const copy = new WheelEvent("wheel", {
            bubbles: true, cancelable: true, composed: true, view: window,
            clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
            deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
            ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
            buttons: e.buttons,
        });
        copy.__ndForwarded = true;
        target.dispatchEvent(copy);
    }, { passive: false });
}

export function selectOnPointer(root, node) {
    root.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        try { if (!isSelected(node)) app.canvas?.selectNode?.(node, false); } catch {}
    });
}

// Middle-button drag over the node UI pans the canvas, like over an empty area.
// The canvas offset is moved directly (screen delta / zoom), the same way LiteGraph
// pans, so it does not depend on how a given frontend version handles pointer events.
export function panCanvasWithMiddleButton(root) {
    let pan = null;
    const redraw = () => {
        const c = app.canvas;
        if (c?.setDirty) c.setDirty(true, true);
        else app.graph?.setDirtyCanvas?.(true, true);
    };
    root.addEventListener("pointerdown", (e) => {
        if (e.button !== 1 || !app.canvas?.ds?.offset) return;
        e.preventDefault();
        e.stopPropagation();
        pan = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try { root.setPointerCapture(e.pointerId); } catch {}
        root.classList.add("nd-panning");
    }, true);
    root.addEventListener("pointermove", (e) => {
        if (!pan || e.pointerId !== pan.id) return;
        const ds = app.canvas?.ds;
        if (!ds?.offset) return;
        const scale = ds.scale || 1;
        ds.offset[0] += (e.clientX - pan.x) / scale;
        ds.offset[1] += (e.clientY - pan.y) / scale;
        pan.x = e.clientX;
        pan.y = e.clientY;
        redraw();
        e.preventDefault();
        e.stopPropagation();
    }, true);
    const end = (e) => {
        if (!pan || (e.pointerId != null && e.pointerId !== pan.id)) return;
        pan = null;
        try { root.releasePointerCapture(e.pointerId); } catch {}
        root.classList.remove("nd-panning");
    };
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) root.addEventListener(t, end, true);
    // no browser auto-scroll / middle-click paste over the node
    root.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }, true);
    root.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); }, true);
}

// Canvas navigation over a node UI: wheel zoom, middle-button pan, select on click.
export function bindCanvasNavigation(root, node) {
    injectStyleOnce("nd-common-style", ".nd-panning,.nd-panning *{cursor:grabbing!important}");
    selectOnPointer(root, node);
    forwardWheelToCanvas(root);
    panCanvasWithMiddleButton(root);
}

// Injects a <style> block once.
export function injectStyleOnce(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
}

// ND_PARAMS "plug" pins (the single input / output of a node) carry no visible name.
