// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — tells ND UI Live Bridge nodes when somebody looks at them.
// A bridge makes a frame only when the prompt says so (`_meta.ndui_live`): that keeps the sampler fast when no viewer is open.
// The prompt is marked right before it is sent: api.queuePrompt is wrapped (chain-wise, so other extensions keep their wrappers).
//   - a bridge is wanted when a Viewer that shows live frames is on the screen, its eye is open and its "Frames of" slot is bound to that bridge;
//   - when such a Viewer asks for silence, ComfyUI's own preview is switched off for this run (previewMethod "none").
import { api } from "../../../scripts/api.js";
import { BRIDGE_CLASS, execIdOf, isBridgeNode, dbg } from "./events.js";

const viewers = new Set();
// rec: {el, wants(): boolean, bridge(): node|null, mute(): boolean, sound(): boolean (optional: the clip is played with the sound)}
export function registerViewer(rec) { viewers.add(rec); return () => viewers.delete(rec); }

const shown = (rec) => { try { return !!rec.el?.isConnected && rec.el.getClientRects().length > 0; } catch { return false; } };

// -> {bridges: Set<exec id>, audio: Set<exec id> (the ones whose sound is played), mute: boolean}
export function wanted() {
    const bridges = new Set(), audio = new Set();
    let mute = false;
    for (const v of viewers) {
        try {
            if (!shown(v) || !v.wants()) continue;
            const n = v.bridge();
            if (!n || !isBridgeNode(n)) continue;
            bridges.add(execIdOf(n));
            audio.add(execIdOf(n));   // the sound is always made; the speaker button only mutes the <video>
            if (v.mute()) mute = true;
        } catch {}
    }
    return { bridges, audio, mute };
}

// the node ND UI Active: the browser writes into its `active` input whether the ND UI mode is on (the server cannot know it)
export const ACTIVE_CLASS = "NDUIActive";
export const modeIsOn = () => !!document.querySelector(".ndk-uimode");
export function markActive(data) {
    const out = data?.output;
    if (!out || typeof out !== "object") return;
    const on = modeIsOn();
    for (const node of Object.values(out)) {
        if (node?.class_type === ACTIVE_CLASS) node.inputs = { ...(node.inputs || {}), active: on };
    }
}

// marks the bridges of a prompt ({output: {id: node}}); returns what was asked
export function markPrompt(data) {
    const w = wanted();
    const out = data?.output;
    if (out && typeof out === "object") {
        for (const [id, node] of Object.entries(out)) {
            if (node?.class_type !== BRIDGE_CLASS) continue;
            node._meta = { ...(node._meta || {}), ndui_live: w.bridges.has(String(id)), ndui_live_audio: w.audio.has(String(id)) };
        }
    }
    dbg("prompt marked: bridges wanted", [...w.bridges], "viewers", viewers.size, "silence", w.mute);
    return w;
}

let installed = false;
export function installLiveMark() {
    if (installed || typeof api?.queuePrompt !== "function") return;
    installed = true;
    const orig = api.queuePrompt.bind(api);
    api.queuePrompt = function (number, data, options, ...rest) {
        let opts = options;
        try {
            markActive(data);
            const w = markPrompt(data);
            if (w.mute) opts = { ...(options || {}), previewMethod: "none" };
        } catch (e) { console.warn("[ND UI] live mark failed", e); }
        return orig(number, data, opts, ...rest);
    };
}
