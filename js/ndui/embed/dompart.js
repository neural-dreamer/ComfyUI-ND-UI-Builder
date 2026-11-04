// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — carries the DOM panel of a node (widget.element) into a box of ND UI and brings it back.
// ComfyUI keeps the element inside its own wrapper (.dom-widget) and moves only the wrapper; a panel that sits in our box is left alone,
// except that the frontend takes it back on some events (a node collapsed and expanded, a workflow loaded). The guard here takes it again.

const elIds = new WeakMap();
let elSeq = 0;
export const elementId = (el) => { if (!el) return 0; let i = elIds.get(el); if (!i) { i = ++elSeq; elIds.set(el, i); } return i; };

// the DOM widgets of a node: {name, widget, element}
export function domWidgets(node) {
    const out = [];
    for (const w of node?.widgets || []) {
        const el = w?.element;
        if (el instanceof HTMLElement) out.push({ name: w.name, widget: w, element: el });
    }
    return out;
}
export const findDom = (node, name) => domWidgets(node).find((d) => d.name === name) || null;

// a panel worth showing: not a plain text box (the multiline text of ComfyUI has our Text widget) and it has something inside
export function isPanel(d) {
    const el = d.element;
    if (/^(TEXTAREA|INPUT|SELECT)$/.test(el.tagName)) return false;
    if (d.widget.type === "customtext") return false;
    return el.childElementCount > 0 || el.textContent.trim().length > 0;
}
export const autoPart = (node) => domWidgets(node).find(isPanel)?.name || "";

// a fingerprint for the slot: changes when the panel was rebuilt (a new element) or the node got other widgets
export function stampOf(node) {
    if (!node) return "";
    return `${node.id}|${(node.widgets || []).map((w) => `${w.name}:${elementId(w.element)}`).join(",")}|${node.mode ?? 0}`;
}

export class DomPart {
    constructor(box) {
        this.box = box;
        this.node = null; this.name = ""; this.el = null; this.home = null;
        this.holder = null;                  // the small note left in the wrapper
        this.fights = 0; this.lastFight = 0; this.gaveUp = false;
        this.onChange = null;
        this.onRestore = null;               // called with the element just before it goes back (fit gives its style back)
        this.placeholder = true;
    }
    get attached() { return !!this.el; }

    // takes the panel of (node, name); returns false when the node has no such panel
    attach(node, name, { placeholder = true } = {}) {
        const d = findDom(node, name);
        if (!d) return false;
        if (this.el === d.element && this.node === node && this.name === name) { this.adopt(); return true; }
        this.detach(true);
        this.node = node; this.name = name; this.el = d.element; this.placeholder = placeholder;
        const par = this.el.parentElement;
        this.home = par && par !== this.box ? par : null;
                this.fights = 0; this.gaveUp = false;
        this.box.append(this.el);
        this.note();
        return true;
    }

    // a small plate in the place the panel left, so the graph does not show an empty node body
    note() {
        this.dropNote();
        if (!this.placeholder || !this.home?.isConnected) return;
        const h = document.createElement("div");
        h.className = "ndk-emb-away";
        h.textContent = "ND UI";
        h.title = "This panel is shown in ND UI";
        this.home.append(h);
        this.holder = h;
    }
    dropNote() { this.holder?.remove(); this.holder = null; }

    // the frontend took the element back (or it lies elsewhere): take it again, not too often
    adopt() {
        const el = this.el;
        if (!el || el.parentElement === this.box || this.gaveUp) return false;
        const now = performance.now();
        if (now - this.lastFight > 4000) this.fights = 0;
        this.lastFight = now;
        if (++this.fights > 20) { this.gaveUp = true; this.onChange?.("gaveup"); return false; }
        const par = el.parentElement;
        if (par && par.isConnected) this.home = par;
        this.box.append(el);
        this.note();
        return true;
    }

    // the node got a new element (the panel was rebuilt): drop the old one, take the new one. Returns "same" | "swapped" | "gone"
    check() {
        if (!this.el) return "gone";
        const d = this.node?.graph ? findDom(this.node, this.name) : null;
        if (!d) { this.detach(false); return "gone"; }
        if (d.element !== this.el) {
            const old = this.el;
            if (old.parentElement === this.box) old.remove();
            this.el = null; this.dropNote();
            const node = this.node, name = this.name, ph = this.placeholder;
            this.node = null;
            this.attach(node, name, { placeholder: ph });
            return "swapped";
        }
        if (this.el.parentElement !== this.box) this.adopt();
        if (this.el.hidden) this.el.hidden = false;
        return "same";
    }

    // gives the panel back to the graph. keep = false when the node is gone (nothing to return to)
    detach(returnIt = true) {
        const el = this.el;
        this.dropNote();
        if (el) {
            const inBox = el.parentElement === this.box;
            if (inBox) {
                this.onRestore?.(el);
                if (returnIt && this.home?.isConnected) this.home.append(el);
                else el.remove();
            }
        }
        this.el = null; this.node = null; this.name = ""; this.home = null; this.gaveUp = false;
        if (returnIt) { try { globalThis.app?.canvas?.setDirty?.(true, true); } catch {} }
    }
}
