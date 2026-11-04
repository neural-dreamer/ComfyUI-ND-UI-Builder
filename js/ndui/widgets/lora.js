// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — LoRA (the whole stack of an ND LoRA Stack node) and LoRA Picker (one LoRA of a standard Load LoRA node).
import { el, icon } from "./util.js";
import { catalog, dirName, stemName } from "../models.js";
import { openGallery } from "../lora/gallery.js";
import { mediaThumb } from "../lora/media.js";
import { stackView, strengthRow, isStackNode, stackWidget, STACK_CLASS } from "../lora/stack_view.js";

const pctx = (ctx) => ({ tr: ctx.tr, vars: () => ctx.vars(), popupHost: () => ctx.popupHost() });

export const lora = {
    type: "lora", label: "LoRA Stack", icon: "layers", group: "Run", fill: true,
    slots: [{ id: "node", label: "ND LoRA Stack node", data: "lorastack", accepts: [STACK_CLASS], required: true, watch: (node) => String(node.widgets?.find((w) => w.name === "stack")?.value ?? "") }],
    size: { w: 400, h: 300, minW: 260, minH: 120 },
    props: [
        { id: "clip", kind: "bool", label: "Show the CLIP slider", def: false, hint: "Off: the CLIP strength follows the model strength (as long as they are linked)." },
        { id: "rmin", kind: "number", label: "Slider minimum", def: -1.5, min: -1000, max: 1000, hint: "The same for the model and the CLIP strength. A number typed by hand is never limited." },
        { id: "rmax", kind: "number", label: "Slider maximum", def: 1.5, min: -1000, max: 1000, hint: "The same for the model and the CLIP strength. A number typed by hand is never limited." },
        { id: "arrows", kind: "bool", label: "Arrows ◀ ▶ for the strength", def: true, hint: "Step 0.05; hold Shift for a bigger step (0.25). Hold the arrow to repeat." },
        { id: "play", kind: "select", label: "Video previews", def: "hover", options: [["hover", "Play on hover"], ["always", "Always play"]], hint: "For LoRAs whose preview is a video (Neural Dreamer Nodes). Always muted; the first frame stands while it does not play." },
    ],
    mount(ctx) {
        const holder = el("div", "ndk-lora");
        ctx.body.append(holder);
        let cur = null, view = null;
        const note = (text, warn) => { holder.textContent = ""; const n = el("div", `ndk-lr-empty${warn ? " warn" : ""}`); n.append(icon(warn ? "warning" : "layers", 18), el("span", "", text)); holder.append(n); view = null; cur = null; };
        const show = () => {
            holder.classList.toggle("noclip", ctx.prop("clip") !== true);
            const s = ctx.info("node");
            if (!s.bound) return note(ctx.tr("Bind an ND LoRA Stack node"));
            if (s.lost || !s.node) return note(ctx.tr("The node is gone. Bind it again."), true);
            if (!isStackNode(s.node)) return note(ctx.tr("This node is not an ND LoRA Stack"), true);
            if (!stackWidget(s.node)) return note(ctx.tr("The ND LoRA Stack node comes with Neural Dreamer Nodes. Install Neural Dreamer Nodes 1.3.0 or newer."), true);
            if (s.node !== cur) {
                cur = s.node;
                view = stackView({ node: cur, tr: ctx.tr, vars: () => ctx.vars(), popupHost: () => ctx.popupHost(), props: () => ({ play: ctx.prop("play"), rmin: ctx.prop("rmin"), rmax: ctx.prop("rmax"), arrows: ctx.prop("arrows") }) });
                holder.textContent = ""; holder.append(view.el);
            } else view.update();
        };
        show();
        return { update: show };
    },
};

export const lorapicker = {
    type: "lorapicker", label: "LoRA Picker", icon: "cube", group: "Run",
    slots: [
        { id: "lora_name", label: "LoRA", accepts: ["COMBO"], required: true },
        { id: "strength_model", label: "Model strength", accepts: ["FLOAT"], required: true },
        { id: "strength_clip", label: "CLIP strength", accepts: ["FLOAT"], required: false },
    ],
    size: { w: 380, h: 150, minW: 220, minH: 64 },
    props: [],
    mount(ctx) {
        const root = el("div", "ndk-lp");
        const f = el("div", "ndk-field ndk-mp"); f.tabIndex = 0; f.setAttribute("role", "button");
        const thumb = el("div", "ndk-mp-thumb"), name = el("div", "ndk-mp-name");
        f.append(thumb, name, icon("chevD", 16));
        const strengths = el("div", "ndk-lp-str");
        root.append(f, strengths);
        ctx.body.append(root);
        let info = new Map(), seen = "";
        const lim = (id, fall) => { const l = ctx.limits(id); return [Number.isFinite(l.min) ? l.min : fall[0], Number.isFinite(l.max) ? l.max : fall[1]]; };
        const show = () => {
            const v = ctx.get("lora_name"), text = v == null ? "" : String(v);
            const hasClip = ctx.info("strength_clip").bound;
            const sm = Number(ctx.get("strength_model")), sc = Number(ctx.get("strength_clip"));
            const m = info.get(text);
            const k = `${text}|${info.size}|${hasClip}|${sm}|${sc}`;
            if (k === seen) return;
            seen = k;
            name.textContent = "";
            const d = dirName(text); if (d) name.append(el("small", "", d + "/"));
            name.append(document.createTextNode(m?.title || stemName(text) || ctx.tr("Choose…"))); name.title = text;
            thumb.textContent = "";
            thumb.append(mediaThumb(m || {}, "loras", { play: "hover", hover: f }));
            if (document.activeElement && strengths.contains(document.activeElement)) return;
            strengths.textContent = "";
            const mk = (label, id, val) => strengths.append(strengthRow(label, Number.isFinite(val) ? val : 0, (x) => { ctx.set(id, x); seen = ""; }, { range: lim(id, [-2, 2]) }));
            if (ctx.info("strength_model").bound) mk(ctx.tr("Model"), "strength_model", sm);
            if (hasClip) mk(ctx.tr("CLIP"), "strength_clip", sc);
        };
        const open = () => {
            if (ctx.editing && !ctx.info("lora_name").bound) return;
            openGallery(pctx(ctx), f, { folder: "loras", names: ctx.info("lora_name").options || null, current: ctx.get("lora_name"), title: ctx.tr("Choose a LoRA"), onPick: (n) => { ctx.set("lora_name", n); seen = ""; show(); } });
        };
        f.addEventListener("click", open);
        f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); open(); } e.stopPropagation(); });
        catalog("loras").then((m) => { info = m; seen = ""; show(); });
        show();
        return { update: show };
    },
};
