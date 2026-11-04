// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Video Input and Audio Input: the view of an ND Load Video / ND Load Audio node (choose a file, cut a segment, crop, frame rate).
import { el, icon } from "./util.js";
import { trimView, isLoaderNode, settingsText, VIDEO_CLASS, AUDIO_CLASS } from "../media/trim_view.js";

function make(kind) {
    const isV = kind === "video";
    const cls = isV ? VIDEO_CLASS : AUDIO_CLASS;
    return {
        type: isV ? "videoinput" : "audioinput", label: isV ? "Video Input" : "Audio Input", icon: isV ? "film" : "music", group: "Inputs", fill: true,
        slots: [{ id: "node", label: isV ? "ND Load Video node" : "ND Load Audio node", data: isV ? "videoload" : "audioload", accepts: [cls], required: true, watch: (node) => settingsText(node, kind) }],
        size: isV ? { w: 460, h: 620, minW: 300, minH: 300 } : { w: 460, h: 330, minW: 280, minH: 200 },
        props: [
            { id: "collapse", kind: "bool", label: "Controls under a spoiler", def: true },
            { id: "spoiler_title", kind: "text", label: "Spoiler title", hint: "Empty: Trim, crop and settings." },
        ],
        mount(ctx) {
            const holder = el("div", "ndk-tvw");
            ctx.body.append(holder);
            let cur = null, view = null;
            const note = (text, warn) => { view?.destroy(); view = null; cur = null; holder.textContent = ""; const n = el("div", `ndk-lr-empty${warn ? " warn" : ""}`); n.append(icon(warn ? "warning" : isV ? "film" : "music", 18), el("span", "", text)); holder.append(n); };
            const show = () => {
                const s = ctx.info("node");
                if (!s.bound) return note(ctx.tr(isV ? "Bind an ND Load Video node" : "Bind an ND Load Audio node"));
                if (s.lost || !s.node) return note(ctx.tr("The node is gone. Bind it again."), true);
                if (!isLoaderNode(s.node, kind)) return note(ctx.tr(isV ? "This node is not an ND Load Video" : "This node is not an ND Load Audio"), true);
                if (s.node !== cur) {
                    view?.destroy();
                    cur = s.node;
                    view = trimView({ kind, node: cur, tr: ctx.tr, vars: () => ctx.vars(), popupHost: () => ctx.popupHost(), compact: false, collapsible: ctx.prop("collapse") !== false, title: ctx.prop("spoiler_title"), open: ctx.prop("open") === true, onOpen: (v) => ctx.setProp("open", v) });
                    holder.textContent = ""; holder.append(view.el);
                } else { view.setOptions({ collapsible: ctx.prop("collapse") !== false, title: ctx.prop("spoiler_title") }); view.update(); }
            };
            show();
            return { update: show, destroy() { view?.destroy(); } };
        },
    };
}
export const videoinput = make("video");
export const audioinput = make("audio");
