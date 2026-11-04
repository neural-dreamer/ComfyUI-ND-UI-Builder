// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Audio Player and Video Player: they play what a node made (SaveAudio, PreviewAudio, SaveVideo, VHS Video Combine...),
// with the runs of the session in a list below. Not bound: the newest sound / video of any node.
import { el, icon } from "./util.js";
import { forNode, latestAny } from "../events.js";
import { createPlayer } from "../media/player.js";
import { fileUrl } from "../media/io.js";
import { liveLayer, LIVE_PROPS, LIVE_SLOT } from "./livelayer.js";

function make(kind) {
    const isV = kind === "video";
    const slot = isV ? "video" : "audio";
    return {
        type: isV ? "videoplayer" : "audioplayer", label: isV ? "Video Player" : "Audio Player", icon: isV ? "film" : "music", group: "Results", live: true, fill: true,
        slots: [{ id: slot, label: isV ? "Video of" : "Sound of", data: slot, required: false }, ...(isV ? [LIVE_SLOT] : [])],
        size: isV ? { w: 520, h: 360, minW: 220, minH: 140 } : { w: 520, h: 160, minW: 240, minH: 96 },
        props: [
            { id: "autoplay", kind: "bool", label: "Play when a new one comes", def: false },
            { id: "loop", kind: "bool", label: "Loop", def: isV },
            { id: "muted", kind: "bool", label: "Muted", def: false },
            ...(isV ? [{ id: "fit", kind: "select", label: "Picture", def: "contain", options: [["contain", "Whole picture"], ["cover", "Fill the frame"]] }] : [{ id: "wave", kind: "bool", label: "Wave form", def: true }]),
            { id: "history", kind: "bool", label: isV ? "Runs below" : "List of runs", def: true },
            { id: "save", kind: "bool", label: "Save button", def: true },
            ...(isV ? LIVE_PROPS : []),
        ],
        mount(ctx) {
            const wrap = el("div", "ndk-pw");
            const empty = el("div", "ndk-media-empty"); empty.append(icon(isV ? "film" : "music", 30), el("div", "", ctx.tr(isV ? "No video yet" : "No sound yet")));
            const list = el("div", `ndk-pw-list ${kind}`);
            const P = () => ({ autoplay: ctx.prop("autoplay") === true, loop: ctx.prop("loop") ?? isV, muted: ctx.prop("muted") === true, volume: ctx.prop("volume"), fit: ctx.prop("fit"), wave: ctx.prop("wave") !== false, save: ctx.prop("save") !== false });
            const player = createPlayer(kind, { props: P, setProp: (k, v) => ctx.setProp(k, v), tr: (s) => ctx.tr(s) });
            wrap.append(empty, player.el, list);
            ctx.body.append(wrap);
            let picked = -1, listKey = "", first = true, curRef = null;
            // the live preview (the video player only): the frames of the sampler over the player while a run goes
            const ll = isV ? liveLayer(ctx, player.el, wrap, () => !!curRef) : null;
            const render = () => {
                const st = ctx.info(slot);
                let s;
                if (st.bound && st.node) s = forNode(st.node);
                else if (st.bound) s = null;
                else s = latestAny(kind);
                const cur = s ? (isV ? s.video : s.audio) : [];
                const hist = s ? (isV ? s.vhistory : s.ahistory) : [];
                const runs = hist.length ? hist : cur.length ? [cur] : [];
                if (picked >= runs.length) picked = -1;
                const ref = (picked >= 0 ? runs[picked] : runs[0])?.[0] || null;
                curRef = ref;
                const covered = ll ? ll.update() : false;
                empty.style.display = ref || covered ? "none" : "";
                if (!ref) empty.lastChild.textContent = ctx.tr(st.lost ? "The node is gone. Bind it again." : isV ? "No video yet" : "No sound yet");
                player.el.style.display = ref || covered ? "" : "none";
                // the first one that is already there when the page opens does not start by itself
                const p = P(); if (first) { first = false; if (p.autoplay && ref) { /* autoplay only for what comes later */ } }
                player.setRef(ref);
                const show = ctx.prop("history") !== false && runs.length > 1;
                list.style.display = show ? "" : "none";
                const lk = show ? runs.map((r) => r[0]?.rand ?? r[0]?.filename).join("|") + "|" + picked : "";
                if (lk !== listKey) {
                    listKey = lk; list.textContent = "";
                    if (show) runs.forEach((r, n) => {
                        const b = el("button", n === (picked < 0 ? 0 : picked) ? "on" : ""); b.type = "button"; b.title = r[0]?.filename || "";
                        if (isV) { const v = document.createElement("video"); v.muted = true; v.preload = "metadata"; v.src = fileUrl(r[0]) + "#t=0.1"; v.tabIndex = -1; v.draggable = false; b.append(v); }
                        else b.append(icon("music", 14), el("span", "", `${runs.length - n} · ${r[0]?.filename || ""}`));
                        b.addEventListener("click", () => { picked = n === 0 ? -1 : n; listKey = ""; render(); });
                        list.append(b);
                    });
                }
            };
            render();
            return { update: render, destroy() { ll?.destroy(); player.destroy(); } };
        },
    };
}
export const audioplayer = make("audio");
export const videoplayer = make("video");
