// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — PanelHost: one live panel (the model) over a store, shared by everything that shows it:
// the window in an NDUI node, the ND UI mode, the editor. Consumers subscribe and get told what happened:
//   "rebuild"  the model was replaced (saved in the editor, workflow loaded, undo): make the views again;
//   "page"     another page was opened somewhere (the source is passed, so a consumer can skip its own);
//   "lang"     the language or its dictionary changed.
import { normalizeNdUi, clone } from "./model.js";
import { resolveLang, loadLang, T, LANG_EVENT } from "./core/i18n.js";
import { workflowStore, nodeStore } from "./store.js";
import { openEditor } from "./editor.js";
import { applyModes, releaseModes, writeIndex, wantedByIndex, activeModeId, modePages } from "./modes.js";
import { touchWorkflow } from "./sources.js";
import { OpenState } from "./openstate.js";

export class PanelHost {
    constructor(store) {
        this.store = store;
        this.subs = new Set();
        this.editor = null;
        this.cur = "";
        this.alive = true;
        this.tr = (s, v) => T(this.lang(), s, v);
        this.ui = normalizeNdUi(null);
        this.open = new OpenState(() => this.ui);   // which spoilers are open (the viewer's own state)
        this.has = false;
        this.load(false);
        this.langListener = () => this.afterLang();
        window.addEventListener(LANG_EVENT, this.langListener);
        this.timer = setInterval(() => { try { this.tick(); } catch {} }, 400);
        this.afterLang();
    }

    lang() { return resolveLang(this.ui.view.lang === "auto" ? "auto" : this.ui.view.lang); }
    afterLang() { loadLang(this.lang()).then(() => { if (this.alive) this.emit("lang"); }); }

    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
    emit(kind, source) { for (const f of [...this.subs]) { try { f(kind, source); } catch (e) { console.warn("[ND UI] subscriber failed", e); } } }

    // reads the store; the model object stays the one that is saved (the store keeps a reference to it)
    load(announce = true) {
        const raw = this.store.read();
        this.has = !!raw;
        this.ui = normalizeNdUi(raw);
        if (raw) this.store.write(this.ui, { touch: false });
        this.cur = this.ui.view.page;
        this.open.load();
        this.applyModesNow();
        this.afterLang();
        if (announce) this.emit("rebuild");
    }
    reload() { this.load(true); }

    applyModesNow() {
        if (modePages(this.ui).length) {
            this.ui.view.modePage = activeModeId(this.ui);
            applyModes(this.ui); writeIndex(this.ui);
        } else releaseModes(this.ui);
    }

    // the editor (or a preset import) hands over a new model
    save(next) {
        this.ui = normalizeNdUi(next);
        this.has = true;
        this.store.write(this.ui, { touch: true });
        this.cur = this.ui.view.page;
        this.open.load();
        this.applyModesNow();
        this.afterLang();
        this.emit("rebuild");
    }

    // a page was opened by `source` (a consumer); the other consumers follow
    pageChanged(id, source) {
        if (this.cur === id) return;
        this.cur = id;
        this.ui.view.page = id;
        const p = this.ui.pages.find((x) => x.id === id);
        if (p?.kind === "mode") {
            if (this.ui.view.modePage !== id) { this.ui.view.modePage = id; touchWorkflow(); }
            applyModes(this.ui); writeIndex(this.ui);
        }
        this.emit("page", source);
    }

    // the mode follows the parameter that is bound to it (the person turned it in the node)
    tick() {
        if (!this.alive || !modePages(this.ui).length) return;
        const w = wantedByIndex(this.ui);
        if (w) { this.cur = ""; this.pageChanged(w, null); }
    }

    openEditor() {
        if (this.editor) return;
        this.editor = openEditor({
            node: null, ui: clone(this.ui), tr: this.tr, lang: () => this.lang(),
            onSave: (next) => this.save(next),
            onClose: () => { this.editor = null; this.emit("editor"); },
        });
        this.emit("editor");
    }

    dispose() {
        this.alive = false;
        clearInterval(this.timer);
        window.removeEventListener(LANG_EVENT, this.langListener);
        this.editor?.close?.();
        this.subs.clear();
    }
}

/* ------------------------------------------------------------------ hosts */

let wfHost = null;
// the panel of the workflow (graph.extra.nd_ui); one for the whole page, re-read whenever a workflow is loaded
export function workflowHost() {
    if (!wfHost) wfHost = new PanelHost(workflowStore);
    return wfHost;
}
export const nodeHost = (node) => new PanelHost(nodeStore(node));
