// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — the interface of the ND UI Live Preview node: the live preview of the ND UI Live Bridge that is wired to its only input.
// It is the live layer of the Video Player in a node: the frames of the sampler while a run goes, the LIVE badge, the progress, the eye, the speaker and
// the volume. The speaker, the volume and the eye are kept in the properties of the node (they are saved with the workflow).
import { app } from "../../../scripts/app.js";
import { chain, bindCanvasNavigation } from "./core/dom.js";
import { injectKit, applyVars, varsFor, tokensOf } from "./kit.js";
import { el } from "./widgets/util.js";
import { workflowHost } from "./host.js";
import { liveLayer } from "./widgets/livelayer.js";
import { startEvents, isBridgeNode, events } from "./events.js";

export const LIVE_PREVIEW_CLASS = "NDUILivePreview";
const DEFAULTS = { live: true, liveOn: true, sound: false, volume: 70, progress: "line", muteComfy: false, busyOn: false };

export function setupLivePreview(node) {
    injectKit(); startEvents();
    node.properties = node.properties || {};
    const root = el("div", "ndk ndk-lpn");
    const theme = () => { const u = workflowHost().ui; applyVars(root, varsFor(tokensOf(u), u.kit, {})); root.style.setProperty("--ndk-bg", "transparent"); };
    theme();
    const tr = (s, v) => workflowHost().tr(s, v);
    const hint = el("div", "ndk-lpn-hint"); hint.textContent = tr("Connect the live pin of an ND UI Live Bridge");
    root.append(hint);
    // the bridge on the input wire (null: nothing is wired)
    const bridge = () => { try { const n = node.getInputNode?.(0); return n && isBridgeNode(n) ? n : null; } catch { return null; } };
    const ctx = {
        prop: (id) => (id in node.properties ? node.properties[id] : DEFAULTS[id]),
        setProp: (id, v) => { node.properties[id] = v; try { app.graph?.change?.(); } catch {} },
        info: () => { const b = bridge(); return { bound: true, lost: !b, node: b }; },
        tr,
    };
    const L = liveLayer(ctx, root, root, () => false);
    bindCanvasNavigation(root, node);
    const dom = node.addDOMWidget("nd_live_preview", "ND_LIVE_PREVIEW", root, { serialize: false, hideOnZoom: false, getMinHeight: () => 180 });
    let wired = null, last = "";
    // the node is looked at only while it is on the screen, and redrawn only when something changed (events, its settings, the wire)
    const tick = () => {
        if (!node.graph || !root.isConnected || root.offsetParent === null) return;
        const b = bridge();
        const stamp = `${events.version}|${b?.id ?? ""}|${b ? (b.inputs || []).map((i) => i.link ?? "").join(",") : ""}|${JSON.stringify(node.properties)}`;
        if (stamp === last) return;
        last = stamp;
        if (b !== wired) { wired = b; theme(); }
        const covering = L.update();
        hint.style.display = covering ? "none" : "";
        hint.textContent = b ? tr("Waiting for the live preview") : tr("Connect the live pin of an ND UI Live Bridge");
    };
    const timer = setInterval(tick, 200);
    tick();
    node.__ndLivePreviewDispose = () => { clearInterval(timer); L.destroy(); };
    node.ndLivePreview = { root, dom, layer: L, ctx };
    if (!node.size || node.size[0] < 280) node.setSize([360, 290]);
}
