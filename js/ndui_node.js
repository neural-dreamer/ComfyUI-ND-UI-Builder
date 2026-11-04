// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — the NDUI node: a window to the panel of the workflow on the canvas.
// The node has no pins and is never executed (it is a virtual node: it stays out of the prompt).
// The panel itself lives in the workflow (graph.extra.nd_ui) and works without this node (see ndui.js).
// A node that keeps its own panel (properties.nd_ui, the older way) is still an "own panel"; the strip can make it the workflow's panel.
import { app } from "../../scripts/app.js";
import { el, chain, bindCanvasNavigation } from "./ndui/core/dom.js";
import { injectKit, applyVars, varsFor, tokensOf, icon } from "./ndui/kit.js";
import { PageView } from "./ndui/render.js";
import { drawTabs } from "./ndui/tabs.js";
import { workflowHost, nodeHost } from "./ndui/host.js";
import { workflowStore, nodeStore } from "./ndui/store.js";
import { enterUiMode } from "./ndui/uimode.js";
import { LOGO_URI } from "./ndui/logo.js";
import { touchWorkflow } from "./ndui/sources.js";

const NODE = "NDUI";
const STRIP_H = 34;
const START_W = 760;

function setupNode(node) {
    injectKit();
    node.isVirtualNode = true; // it never goes into the prompt
    node.properties = node.properties || {};

    const S = { host: null, own: false, unsub: null, view: null };
    const root = el("div", "ndk ndk-nodeview");
    root.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;border-radius:10px;position:relative";
    const strip = el("div", "ndk-strip");
    const stage = el("div");
    stage.style.cssText = "flex:1 1 auto;min-height:0;position:relative;overflow:hidden";
    root.append(strip, stage);
    bindCanvasNavigation(root, node);
    const dom = node.addDOMWidget("nd_ui", "ND_UI", root, { serialize: false, hideOnZoom: false, getMinHeight: () => 200 });

    const ui = () => S.host.ui;
    const tr = (s, v) => S.host.tr(s, v);

    function renderStrip() {
        strip.textContent = "";
        const u = ui();
        const bottom = u.view.tabs.pos === "bottom";
        strip.style.order = bottom ? "2" : "0";
        strip.style.borderBottom = bottom ? "0" : "";
        strip.style.borderTop = bottom ? "1px solid var(--ndk-border)" : "";
        const tabs = el("div", "tabs");
        drawTabs(tabs, u, S.view?.page, tr, (id) => S.view?.setPage(id));
        const mk = (cls, title, fn, ...kids) => { const b = el("button", cls); b.type = "button"; b.title = title; b.append(...kids); b.addEventListener("click", fn); return b; };
        const logo = el("span", "ndk-logo-mini"); logo.style.cssText = `display:inline-block;width:18px;height:18px;background:url("${LOGO_URI}") center/contain no-repeat`;
        const mode = mk("act", tr("Open the panel in the ND UI mode"), openMode, logo, el("span", "", "UI"));
        const fit = mk("act icon", tr("Fit the node to the proportions of the page"), fitNode, icon("fit", 15));
        const edit = mk("act", tr("Open the editor of the panel"), openEdit, icon("pencil", 14), el("span", "", tr("Edit")));
        strip.append(tabs, mode, fit, edit);
        if (S.own) strip.insertBefore(mk("act", tr("Make this the panel of the whole workflow"), makeWorkflowPanel, icon("expand", 14), el("span", "", tr("To workflow"))), fit);
    }

    function applyTheme() {
        const u = ui(), tokens = tokensOf(u);
        applyVars(root, varsFor(tokens, u.kit, {}));
        root.style.setProperty("--ndk-stage-bg", u.view.nodeBg || tokens.bg);
        root.style.background = u.view.nodeBg || tokens.bg;
    }

    function rebuild() {
        S.view?.destroy();
        S.view = null;
        applyTheme();
        S.view = new PageView(stage, {
            ui: ui(), mode: "run", kind: "node", fit: ui().view.fit === "adaptive" ? "adaptive" : "proportions", tr, open: S.host.open,
            onPage: (id) => { S.host.pageChanged(id, S); renderStrip(); },
            onChange: () => {},
        });
        renderStrip();
        emptyHint();
    }

    function emptyHint() {
        stage.querySelector(".ndk-empty")?.remove();
        if (S.host.has && ui().widgets.length) return;
        const e = el("div", "ndk-empty");
        e.style.cssText = "position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;color:var(--ndk-muted)";
        const t = el("div", "", tr("An empty panel. Build it in the editor: pick nodes, add widgets, bind them."));
        t.style.cssText = "max-width:380px;line-height:1.5;font-size:13px";
        const b = el("button", "act"); b.type = "button";
        b.style.cssText = "display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 18px;border:0;border-radius:var(--ndk-rm);background:var(--ndk-accent);color:var(--ndk-on-accent);font-weight:600;cursor:pointer;box-shadow:var(--ndk-glow)";
        b.append(icon("pencil", 16), el("span", "", tr("Open the editor")));
        b.addEventListener("click", openEdit);
        e.append(t, b);
        stage.append(e);
    }

    const openEdit = () => S.host.openEditor();
    const openMode = () => enterUiMode(S.host);
    function fitNode() {
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        const want = Math.round((w * ui().page.h) / ui().page.w);
        const d = want - h;
        node.setSize([node.size[0], Math.max(200, node.size[1] + d)]);
        app.graph?.setDirtyCanvas?.(true, true);
    }
    // an own panel becomes the panel of the workflow (the one that is there is replaced)
    function makeWorkflowPanel() {
        if (!S.own) return;
        workflowStore.write(S.host.ui, { touch: false });
        nodeStore(node).clear();
        workflowHost().reload();
        reload();
        touchWorkflow();
    }

    function follow(kind, src) {
        if (src === S) return;
        if (kind === "rebuild") rebuild();
        else if (kind === "page") { if (S.view && S.view.page !== S.host.cur) S.view.setPage(S.host.cur); renderStrip(); }
        else if (kind === "lang") { renderStrip(); S.view?.refresh(); emptyHint(); }
    }

    // picks the host: the node's own panel (older workflows) or the panel of the workflow
    function reload() {
        const own = !!(node.properties && node.properties.nd_ui && typeof node.properties.nd_ui === "object");
        if (!S.host || S.own !== own || own) {
            S.unsub?.();
            if (S.own) S.host?.dispose();
            S.own = own;
            S.host = own ? nodeHost(node) : workflowHost();
            S.unsub = S.host.subscribe(follow);
        }
        rebuild();
    }

    node.ndUiApi = { state: S, reload, rebuild, openEdit, openMode, fitNode, host: () => S.host, root, dom, tr };
    node.__ndUiDispose = () => { S.unsub?.(); if (S.own) S.host?.dispose(); S.view?.destroy(); };

    if (!node.size || node.size[0] < 300) node.setSize([START_W, Math.round(START_W * workflowHost().ui.page.h / workflowHost().ui.page.w) + STRIP_H + 40]);
    reload();
}

app.registerExtension({
    name: "NeuralDreamer.UI.Node",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const proto = nodeType.prototype;
        chain(proto, "onNodeCreated", function () { setupNode(this); });
        chain(proto, "onConfigure", function () { setTimeout(() => this.ndUiApi?.reload?.(), 0); });
        chain(proto, "onRemoved", function () { this.__ndUiDispose?.(); });
    },
});
