// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — the interface of the ND Load Video and ND Load Audio nodes: the player with a trim bar inside the node
// (the technical widgets `settings` and the file list are hidden). The same view is the Video Input / Audio Input widget of the ND UI panel.
import { app } from "../../scripts/app.js";
import { chain, bindCanvasNavigation } from "./ndui/core/dom.js";
import { injectKit, applyVars, varsFor, tokensOf } from "./ndui/kit.js";
import { el } from "./ndui/widgets/util.js";
import { workflowHost } from "./ndui/host.js";
import { trimView, hideLoaderWidgets, VIDEO_CLASS, AUDIO_CLASS } from "./ndui/media/trim_view.js";

function setupNode(node, kind) {
    injectKit();
    hideLoaderWidgets(node, kind);
    const root = el("div", `ndk ndk-tv-node`);
    const theme = () => { const u = workflowHost().ui; applyVars(root, varsFor(tokensOf(u), u.kit, {})); root.style.setProperty("--ndk-bg", "transparent"); };
    theme();
    const tr = (s, v) => workflowHost().tr(s, v);
    const view = trimView({ kind, node, tr, vars: () => { const u = workflowHost().ui; return varsFor(tokensOf(u), u.kit, {}); }, popupHost: () => document.body, compact: true });
    root.append(view.el);
    bindCanvasNavigation(root, node);
    const dom = node.addDOMWidget(`nd_${kind}_load`, "ND_MEDIA_LOAD", root, { serialize: false, hideOnZoom: false, getMinHeight: () => (kind === "video" ? 480 : 300) });
    const timer = setInterval(() => { if (!node.graph) return; view.update(); }, 400);
    node.__ndMediaDispose = () => { clearInterval(timer); view.destroy(); };
    node.ndMediaApi = { view, dom, root, theme };
    if (!node.size || node.size[0] < 340) node.setSize([380, kind === "video" ? 700 : 480]);
}

app.registerExtension({
    name: "NeuralDreamer.UI.MediaLoad",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const kind = nodeData.name === VIDEO_CLASS ? "video" : nodeData.name === AUDIO_CLASS ? "audio" : "";
        if (!kind) return;
        const proto = nodeType.prototype;
        chain(proto, "onNodeCreated", function () { setupNode(this, kind); });
        chain(proto, "onConfigure", function () { setTimeout(() => { hideLoaderWidgets(this, kind); this.ndMediaApi?.view.update(); }, 0); });
        chain(proto, "onRemoved", function () { this.__ndMediaDispose?.(); });
    },
});
