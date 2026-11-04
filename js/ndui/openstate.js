// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — which spoilers are open. It is the state of the viewer, not of the panel: it is not saved in the workflow
// (an opened spoiler must not mark the workflow as changed). A spoiler with "remember" keeps it in the browser (localStorage, per panel id).
import { byId } from "./model.js";

const KEY = (id) => `ndui-open:${id}`;

export class OpenState {
    constructor(getUi = null) {
        this.getUi = getUi;
        this.map = new Map();
        this.subs = new Set();
        this.saved = null;
    }
    // reads what the browser remembers for this panel
    load() {
        this.saved = null;
        const ui = this.getUi?.();
        if (!ui) return;
        try {
            const t = localStorage.getItem(KEY(ui.id));
            this.saved = t ? JSON.parse(t) : null;
        } catch { this.saved = null; }
    }
    isOpen(w) {
        if (!w) return false;
        if (this.map.has(w.id)) return this.map.get(w.id);
        if (w.props?.remember !== false && this.saved && typeof this.saved[w.id] === "boolean") return this.saved[w.id];
        return w.props?.open === true;
    }
    set(w, v) {
        this.map.set(w.id, !!v);
        const ui = this.getUi?.();
        if (ui && w.props?.remember !== false) {
            try {
                const cur = JSON.parse(localStorage.getItem(KEY(ui.id)) || "{}");
                cur[w.id] = !!v;
                // forget the spoilers that are gone
                for (const k of Object.keys(cur)) if (!byId(ui, k)) delete cur[k];
                localStorage.setItem(KEY(ui.id), JSON.stringify(cur));
                this.saved = cur;
            } catch {}
        }
        for (const f of [...this.subs]) { try { f(w.id); } catch {} }
    }
    toggle(w) { this.set(w, !this.isOpen(w)); }
    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
}
