// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI Active node (frontend): its only widget shows whether the ND UI mode is on; the value is written by the browser when a prompt is sent
// (ndui/live_mark.js), so the widget is not for editing.
import { app } from "../../scripts/app.js";

const CLASS = "NDUIActive";
const modeOn = () => !!document.querySelector(".ndk-uimode");

app.registerExtension({
    name: "NeuralDreamer.UI.Active",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData?.name !== CLASS) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = created?.apply(this, arguments);
            const w = this.widgets?.find((x) => x.name === "active");
            if (w) {
                w.disabled = true;
                w.options = { ...(w.options || {}), read_only: true };
                const show = (on) => { w.value = !!on; this.setDirtyCanvas?.(true, true); };
                show(modeOn());
                const fn = (e) => show(e.detail === true);
                window.addEventListener("nd-uimode", fn);
                const removed = this.onRemoved;
                this.onRemoved = function () { window.removeEventListener("nd-uimode", fn); return removed?.apply(this, arguments); };
            }
            return r;
        };
    },
});
