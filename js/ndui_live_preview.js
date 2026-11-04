// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — the ND UI Live Preview node (its interface lives in ndui/live_preview_node.js).
import { app } from "../../scripts/app.js";
import { chain } from "./ndui/core/dom.js";
import { setupLivePreview, LIVE_PREVIEW_CLASS } from "./ndui/live_preview_node.js";

app.registerExtension({
    name: "NeuralDreamer.UI.LivePreview",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData?.name !== LIVE_PREVIEW_CLASS) return;
        const proto = nodeType.prototype;
        chain(proto, "onNodeCreated", function () { setupLivePreview(this); });
        chain(proto, "onRemoved", function () { this.__ndLivePreviewDispose?.(); });
    },
});
