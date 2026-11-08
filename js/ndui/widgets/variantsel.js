// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Variant Preview (id "variantsel"): the view of an ND Variant Preview Selector node of Neural Dreamer Nodes.
// The picture of the chosen variant with the strip of the thumbnails, the Multi-Variant switch (named as in the node), the Upscale button (when the node has it on)
// and the live preview. It talks to the node only through node.ndApi (kind "variant-preview"), so the node and the widget always show the same state;
// the live frames reach the node (from ComfyUI or from an ND Live Preview Bridge) and the widget shows what the node got.
import { el, icon } from "./util.js";
import { openLightbox } from "./media.js";
import { downloadUrl } from "../media/io.js";

export const VARIANT_CLASS = "NDVariantPreviewSelector";
export const isVariantNode = (n) => !!n && (n.comfyClass || n.type) === VARIANT_CLASS;
const apiOf = (n) => (n?.ndApi?.kind === "variant-preview" && n.ndApi.version >= 1 ? n.ndApi : null);
// what makes the widget redraw: the choice, the images and the settings (a live frame itself is drawn from the subscription)
export const variantStamp = (n) => { const a = apiOf(n); if (!a) return "no-api"; const s = a.getState(); return JSON.stringify([s.images.map((i) => i.url), s.sel, s.final?.url, s.viewFinal, s.compare, s.multi, s.label, s.upscaleOn, s.canUpscale, s.busy, s.live.on, s.live.shown, s.live.active]); };

export const variantsel = {
    type: "variantsel", label: "Variant Preview", icon: "gallery", group: "Results", fill: true,
    slots: [{ id: "node", label: "ND Variant Preview Selector node", data: "variantsel", accepts: [VARIANT_CLASS], required: true, watch: variantStamp }],
    size: { w: 460, h: 420, minW: 200, minH: 200 },
    props: [
        { id: "thumbs", kind: "bool", label: "Thumbnails", def: true },
        { id: "toggle", kind: "bool", label: "Multi-Variant switch", def: true, hint: "The name of the switch is the one set in the node." },
        { id: "upscale", kind: "bool", label: "Upscale button", def: true, hint: "Shown only while the Upscale button is on in the node." },
        { id: "live", kind: "bool", label: "Live preview", def: true, hint: "Shows the frames of the sampler (or of an ND Live Preview Bridge) while the variants are made. It turns the Live preview of the node on. The eye on the widget hides them." },
    ],
    mount(ctx) {
        const root = el("div", "ndk-vs"); ctx.body.append(root);
        let node = null, unsub = null, sig = "", autoFor = null;
        const view = {};

        const note = (text, warn) => { unsub?.(); unsub = null; node = null; sig = ""; root.textContent = ""; Object.keys(view).forEach((k) => delete view[k]); const n = el("div", `ndk-lr-empty${warn ? " warn" : ""}`); n.append(icon(warn ? "warning" : "gallery", 18), el("span", "", text)); root.append(n); };
        const act = (name, ...a) => Promise.resolve(apiOf(node)?.actions[name]?.(...a)).catch((e) => console.warn("[ND UI] Variant Preview:", e));

        function build() {
            root.textContent = ""; Object.keys(view).forEach((k) => delete view[k]);
            const stage = el("div", "stage");
            const img = el("img", "main"); img.alt = ""; img.draggable = false;
            const cmpUp = el("img", "cmp-up"), cmpSrc = el("img", "cmp-src"); cmpUp.alt = cmpSrc.alt = ""; cmpUp.draggable = cmpSrc.draggable = false;
            const cmpLine = el("div", "cmp-line"); cmpLine.append(el("span", "knob", "⇄"));
            const cmp = el("div", "cmp"); cmp.append(cmpUp, cmpSrc, cmpLine);
            const live = el("img", "live"); live.alt = ""; live.draggable = false;
            const empty = el("div", "empty"); empty.append(icon("gallery", 28), el("span", "", ctx.tr("Press Run to generate variants")));
            const badge = el("div", "badge");
            const liveBadge = el("div", "ndk-live-badge"); liveBadge.append(el("i"), el("span", "", "LIVE"));
            const tools = el("div", "tools");
            const eye = el("button", "tbtn eye"); eye.type = "button";
            const cmpBtn = el("button", "tbtn cmpb"); cmpBtn.type = "button"; cmpBtn.append(icon("compare", 15)); cmpBtn.title = ctx.tr("Before / after");
            const mkBtn = (cls, ic, title) => { const b = el("button", "tbtn " + cls); b.type = "button"; b.title = ctx.tr(title); b.append(icon(ic, 15)); return b; };
            const saveBtn = mkBtn("save", "download", "Save"), fullBtn = mkBtn("full", "expand", "Full size");
            tools.append(cmpBtn, eye, saveBtn, fullBtn);
            stage.append(img, cmp, live, empty, badge, liveBadge, tools);
            const info = el("div", "info");
            const thumbs = el("div", "thumbs");
            const bar = el("div", "bar");
            const sw = el("label", "sw"); const swIn = el("input"); swIn.type = "checkbox"; const swTrack = el("span", "track"); const swLabel = el("span", "lbl");
            sw.append(swIn, swTrack, swLabel);
            const up = el("button", "up"); up.type = "button"; up.append(icon("upload", 15), el("span", "", ctx.tr("Upscale")));
            bar.append(sw, el("span", "sp"), up);
            root.append(stage, info, thumbs, bar);
            Object.assign(view, { saveBtn, fullBtn, stage, img, cmp, cmpUp, cmpSrc, cmpLine, live, empty, badge, liveBadge, eye, cmpBtn, info, thumbs, bar, sw, swIn, swLabel, up, pos: 50, thumbKey: "" });

            // a click on the picture (or the Full size button) opens it in full size, as in the Viewer widget; Save downloads what is shown
            const shownUrl = () => { const st = apiOf(node)?.getState(); if (!st) return null; if (view.live.style.display !== "none" && view.live.src) return { url: view.live.src, name: "preview.jpg" }; const c = st.viewFinal ? st.final : st.images[st.sel]; return c ? { url: c.url, name: c.filename || (st.viewFinal ? "upscaled.png" : `variant_${st.sel + 1}.png`) } : null; };
            const fullOpen = () => {
                const st = apiOf(node)?.getState(); if (!st) return;
                if (view.live.style.display !== "none" && view.live.src) return openLightbox(ctx, [{ url: view.live.src, name: "preview" }], 0);
                const items = st.images.map((im, i) => ({ url: im.url, name: ctx.tr("Variant") + " " + (i + 1) }));
                if (st.final) items.push({ url: st.final.url, name: ctx.tr("Upscaled") });
                if (!items.length) return;
                openLightbox(ctx, items, st.viewFinal && st.final ? items.length - 1 : Math.max(0, st.sel));
            };
            stage.addEventListener("click", (e) => { if (e.target.closest(".tools") || e.target.closest(".cmp")) return; fullOpen(); });
            saveBtn.addEventListener("click", (e) => { e.stopPropagation(); const it = shownUrl(); if (it) downloadUrl(it.url, it.name); });
            fullBtn.addEventListener("click", (e) => { e.stopPropagation(); fullOpen(); });
            stage.style.cursor = "zoom-in";

            swIn.addEventListener("change", () => act("setMulti", swIn.checked));
            up.addEventListener("click", () => act("upscale"));
            eye.addEventListener("click", () => { const s = apiOf(node).getState(); act("setLiveShown", !s.live.shown); });
            cmpBtn.addEventListener("click", () => act("setCompare", !apiOf(node).getState().compare));
            let drag = false;
            const move = (e) => { const r = cmp.getBoundingClientRect(); if (!r.width) return; view.pos = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); cmpSrc.style.clipPath = `inset(0 ${100 - view.pos}% 0 0)`; cmpLine.style.left = view.pos + "%"; };
            cmp.addEventListener("pointerdown", (e) => { drag = true; try { cmp.setPointerCapture(e.pointerId); } catch {} move(e); e.preventDefault(); });
            cmp.addEventListener("pointermove", (e) => { if (drag) move(e); });
            const end = (e) => { drag = false; try { cmp.releasePointerCapture(e.pointerId); } catch {} };
            cmp.addEventListener("pointerup", end); cmp.addEventListener("pointercancel", end);
            root.tabIndex = 0;
            root.addEventListener("keydown", (e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                const s = apiOf(node).getState(); const n = s.images.length; if (!n) return;
                e.preventDefault(); e.stopPropagation();
                if (s.viewFinal) { act("select", s.sel); return; }
                act("select", (s.sel + (e.key === "ArrowRight" ? 1 : -1) + n) % n);
            });
            paint();
        }

        const setSrc = (i, url) => { if (url) { if (i.dataset.src !== url) { i.src = url; i.dataset.src = url; } } else if (i.dataset.src) { i.removeAttribute("src"); i.dataset.src = ""; } };

        // draws the state of the node: cheap, it also runs for every live frame
        function paint() {
            const a = apiOf(node); if (!a || !view.img) return;
            const s = a.getState();
            const showThumbs = ctx.prop("thumbs") !== false, showSwitch = ctx.prop("toggle") !== false, showUp = ctx.prop("upscale") !== false && s.upscaleOn;
            const cur = s.viewFinal ? s.final : s.images[s.sel];
            const cmpOn = s.viewFinal && !!s.source && s.compare && !!s.final;
            const wantLive = ctx.prop("live") !== false;
            const liveShow = wantLive && s.live.on && s.live.shown && s.live.active && !!s.live.url;

            setSrc(view.img, cur && !cmpOn ? cur.url : "");
            view.img.style.display = cur && !cmpOn ? "" : "none";
            view.cmp.style.display = cmpOn ? "block" : "none";
            if (cmpOn) { setSrc(view.cmpUp, s.final.url); setSrc(view.cmpSrc, s.source.url); view.cmpSrc.style.clipPath = `inset(0 ${100 - view.pos}% 0 0)`; view.cmpLine.style.left = view.pos + "%"; }
            view.cmpBtn.style.display = s.viewFinal && s.source && !liveShow ? "" : "none";
            view.cmpBtn.classList.toggle("on", s.compare);
            { const has = !!cur || liveShow; view.saveBtn.style.display = has ? "" : "none"; view.fullBtn.style.display = has ? "" : "none"; }
            view.empty.style.display = cur || liveShow ? "none" : "";
            setSrc(view.live, liveShow ? s.live.url : "");
            view.live.style.display = liveShow ? "" : "none";
            view.liveBadge.style.display = liveShow ? "" : "none";
            if (liveShow) view.liveBadge.lastChild.textContent = s.live.step ? `LIVE ${s.live.step[0]}/${s.live.step[1]}` : "LIVE";
            view.badge.style.display = cur && !cmpOn && !liveShow ? "" : "none";
            view.badge.textContent = s.viewFinal ? ctx.tr("Upscaled") : `${s.sel + 1}/${s.images.length}`;
            view.eye.style.display = wantLive && s.live.on ? "" : "none";
            view.eye.classList.toggle("off", !s.live.shown);
            view.eye.replaceChildren(icon(s.live.shown ? "eye" : "eyeOff", 15));
            view.eye.title = ctx.tr(s.live.shown ? "Hide the live preview" : "Show the live preview");
            const size = (i) => (i?.width && i?.height ? `${i.width} × ${i.height}` : "");
            const t = cmpOn && size(s.source) && size(s.final) ? `${size(s.source)} → ${size(s.final)}` : size(cur);
            view.info.textContent = t ? `${t} px` : ""; view.info.style.display = cur && t ? "" : "none";

            const key = JSON.stringify([s.images.map((i) => i.url), s.final?.url, showThumbs]);
            if (key !== view.thumbKey) {
                view.thumbKey = key; view.thumbs.textContent = "";
                s.images.forEach((im, i) => { const th = el("div", "th"); const x = el("img"); x.src = im.url; x.draggable = false; th.append(x, el("span", "", String(i + 1))); th.onclick = () => act("select", i); view.thumbs.append(th); });
                if (s.final) { const th = el("div", "th final"); const x = el("img"); x.src = s.final.url; x.draggable = false; th.append(x, el("span", "", "UP")); th.onclick = () => act("selectFinal"); view.thumbs.append(th); }
            }
            const ths = view.thumbs.children;
            for (let k = 0; k < ths.length; k++) { const isFinal = ths[k].classList.contains("final"); ths[k].classList.toggle("sel", s.viewFinal ? isFinal : !isFinal && k === s.sel); }
            view.thumbs.style.display = showThumbs && (s.images.length || s.final) ? "" : "none";

            view.sw.style.display = showSwitch ? "" : "none";
            if (view.swIn.checked !== s.multi) view.swIn.checked = s.multi;
            if (view.swLabel.textContent !== s.label) view.swLabel.textContent = s.label;
            view.up.style.display = showUp ? "" : "none";
            view.up.disabled = !s.canUpscale; view.up.classList.toggle("busy", s.busy);
            view.bar.style.display = showSwitch || showUp ? "" : "none";
        }

        function show() {
            const s = ctx.info("node");
            if (!s.bound) return note(ctx.tr("Bind an ND Variant Preview Selector node"));
            if (s.lost || !s.node) return note(ctx.tr("The node is gone. Bind it again."), true);
            if (!isVariantNode(s.node)) return note(ctx.tr("This node is not an ND Variant Preview Selector"), true);
            if (!apiOf(s.node)) return note(ctx.tr("Update Neural Dreamer Nodes: this version has no connection for the Variant Preview"), true);
            if (s.node !== node) { unsub?.(); node = s.node; sig = ""; autoFor = null; unsub = apiOf(node).subscribe(() => paint()); }
            // the widget shows the live preview, so the node's Live preview is turned on once for this node (the eye hides it; the node's gear turns it off again)
            if (ctx.prop("live") !== false && !ctx.isEditing() && autoFor !== node) { autoFor = node; if (!apiOf(node).getState().live.on) act("setLive", true); }
            const next = ctx.prop("thumbs") + "|" + ctx.prop("toggle") + "|" + ctx.prop("upscale") + "|" + ctx.prop("live");
            if (!view.img || next !== sig) { sig = next; build(); } else paint();
        }
        show();
        return { update: show, destroy() { unsub?.(); } };
    },
};
