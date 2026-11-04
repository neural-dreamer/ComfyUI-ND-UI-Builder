// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Images Input (id "imageinput"): the view of an ND Load Images node (several images, each with its switch, mask, crop and Keep Proportion).
// It talks to the node only through node.ndApi (kind "load-images"), so the node and the widget always show the same state.
import { el, icon } from "./util.js";
import { readDrop, hasDrop } from "../media/io.js";

export const LOAD_IMAGES_CLASS = "NDLoadImages";
export const isLoadImagesNode = (n) => !!n && (n.comfyClass || n.type) === LOAD_IMAGES_CLASS;
const apiOf = (n) => (n?.ndApi?.kind === "load-images" && n.ndApi.version >= 1 ? n.ndApi : null);
// what makes the widget redraw: the state of the node and its UI-only labels
export const imagesStamp = (n) => { const a = apiOf(n); return a ? JSON.stringify([a.getState(), n.properties?.nd_titles, n.properties?.nd_eye]) : "no-api"; };

export const imageinput = {
    type: "imageinput", label: "Images Input", icon: "image", group: "Inputs", fill: true,
    slots: [{ id: "node", label: "ND Load Images node", data: "loadimages", accepts: [LOAD_IMAGES_CLASS], required: true, watch: imagesStamp }],
    size: { w: 520, h: 420, minW: 200, minH: 160 },
    props: [
        { id: "layout", kind: "select", label: "Layout", def: "grid", options: [["grid", "Grid of cards"], ["tabs", "Tabs"]] },
        { id: "tools", kind: "bool", label: "Mask, crop and settings buttons", def: true },
        { id: "add", kind: "bool", label: "Button to add an image", def: true },
        { id: "reset", kind: "bool", label: "Button to reset the image", def: true, hint: "Back to example.png, without mask, rotation and crop." },
        { id: "remove", kind: "bool", label: "Button to remove the image", def: false, hint: "Takes the image slot out of the node." },
    ],
    mount(ctx) {
        const root = el("div", "ndk-ii"); root.tabIndex = 0;
        ctx.body.append(root);
        let node = null, unsub = null, tab = 0, focusId = null, sig = "";
        const ro = new ResizeObserver(() => paintAll());
        ro.observe(root);
        const cards = new Map(); // block id -> {el, canvas, key}

        const note = (text, warn) => {
            unsub?.(); unsub = null; node = null; cards.clear(); root.textContent = ""; root.className = "ndk-ii";
            const n = el("div", `ndk-lr-empty${warn ? " warn" : ""}`); n.append(icon(warn ? "warning" : "image", 18), el("span", "", text)); root.append(n);
        };
        const act = (name, ...a) => Promise.resolve(apiOf(node)?.actions[name]?.(...a)).catch((e) => console.warn("[ND UI] Image Input:", e));
        const sourceOf = (item) => (item.kind === "ref" ? { filename: item.ref.filename, subfolder: item.ref.subfolder, type: item.ref.type } : item.file);
        const give = async (id, items) => { if (items.length && id) await act("setFile", id, sourceOf(items[0])); };

        function paint(id) {
            const c = cards.get(id); if (!c || !node) return;
            const a = apiOf(node); const box = c.view;
            const w = Math.max(8, box.clientWidth - 2), h = Math.max(8, box.clientHeight - 2);
            if (box.clientWidth < 8 || box.clientHeight < 8) return;
            const eye = !!a.meta().eyes[id];
            a.paint(id, c.canvas, w, h, eye).then((ok) => { c.canvas.style.display = ok ? "" : "none"; c.missing.textContent = ""; })
                .catch(() => { c.canvas.style.display = "none"; c.missing.textContent = ctx.tr("File not found"); });
        }
        function paintAll() { for (const id of cards.keys()) paint(id); }

        function card(b, i, meta, st) {
            const a = apiOf(node);
            const e = el("div", "card" + (b.enabled ? "" : " off"));
            e.dataset.id = b.id;
            const head = el("div", "head");
            const dot = el("button", "dot" + (b.enabled ? " on" : "")); dot.type = "button"; dot.title = ctx.tr("Enable / disable this image");
            dot.onclick = () => act("setEnabled", b.id, !b.enabled);
            const title = el("span", "title", meta.titles[b.id] || `Image ${i + 1}`);
            const sp = el("span", "sp");
            head.append(dot, title, sp);
            const btn = (ic, tip, fn, cls = "") => { const x = el("button", `ibtn ${cls}`); x.type = "button"; x.title = ctx.tr(tip); x.append(icon(ic, 14)); x.onclick = (ev) => { ev.stopPropagation(); fn(); }; return x; };
            if (ctx.prop("tools") !== false) {
                if (b.settings.maskButton) head.append(btn("layers", "Mask", () => act("openMask", b.id), b.masked ? "has" : ""));
                head.append(btn("ratio", "Crop, rotate, flip", () => act("openEditor", b.id)), btn("sliders", "Image settings", () => act("openSettings", b.id)));
            }
            if (ctx.prop("reset") !== false) {
                const dirty = b.image !== meta.defaultImage || !!b.masked || JSON.stringify(b.edit) !== JSON.stringify({ rotate: 0, flipH: false, flipV: false, crop: null });
                head.append(btn("undo", "Reset to example.png (removes the mask, rotation, flip and crop)", () => act("reset", b.id), "reset" + (dirty ? " dirty" : "")));
            }
            if (ctx.prop("remove") === true && st.blocks.length > 1) head.append(btn("x", "Remove this image", () => act("removeBlock", b.id)));
            const view = el("div", "view");
            const canvas = el("canvas"); const missing = el("div", "missing");
            const eyeB = btn("eye", "Show the final image (after crop and Keep Proportion)", () => act("setEye", b.id, !meta.eyes[b.id]), "eye" + (meta.eyes[b.id] ? " on" : ""));
            const fname = el("div", "fname", b.image.split("/").pop() + (b.masked ? "  ·  mask" : ""));
            view.append(canvas, missing, eyeB, fname);
            e.append(head, view);
            if (b.settings.keepEnabled && ctx.prop("tools") !== false) {
                const sel = el("select", "keep"); sel.title = "Keep Proportion";
                for (const m of meta.keepModes) { const o = el("option", "", m); o.value = m; sel.append(o); }
                sel.value = b.keep; sel.onchange = () => act("setKeep", b.id, sel.value); e.append(sel);
            }
            const file = el("input"); file.type = "file"; file.accept = "image/*"; file.style.display = "none";
            file.onchange = () => { const f = file.files?.[0]; file.value = ""; if (f) give(b.id, [{ kind: "file", file: f }]); };
            e.append(file);
            view.addEventListener("click", () => { focusId = b.id; file.click(); });
            e.addEventListener("dragover", (ev) => { if (hasDrop(ev.dataTransfer)) { ev.preventDefault(); e.classList.add("drop"); } });
            e.addEventListener("dragleave", (ev) => { if (!e.contains(ev.relatedTarget)) e.classList.remove("drop"); });
            e.addEventListener("drop", (ev) => { e.classList.remove("drop"); const it = readDrop(ev.dataTransfer); if (it.length) { ev.preventDefault(); ev.stopPropagation(); give(b.id, it); } });
            e.addEventListener("pointerdown", () => { focusId = b.id; });
            cards.set(b.id, { el: e, canvas, view, missing });
            return e;
        }

        function build() {
            const a = apiOf(node); const st = a.getState(), meta = a.meta();
            cards.clear(); root.textContent = "";
            const tabsMode = ctx.prop("layout") === "tabs";
            root.className = `ndk-ii ${tabsMode ? "tabs" : "grid"}`;
            if (tab >= st.blocks.length) tab = st.blocks.length - 1;
            const canAdd = ctx.prop("add") !== false && st.blocks.length < meta.maxBlocks;
            const plus = () => { const p = el("button", "plus"); p.type = "button"; p.title = ctx.tr("Add an image"); p.append(icon("plus", 14)); p.onclick = async () => { const id = await act("addBlock"); if (id) { tab = apiOf(node).getState().blocks.findIndex((x) => x.id === id); } }; return p; };
            if (tabsMode) {
                const strip = el("div", "strip");
                st.blocks.forEach((b, i) => { const t = el("button", "tabbtn" + (i === tab ? " act" : "") + (b.enabled ? "" : " off"), String(i + 1)); t.type = "button"; t.title = meta.titles[b.id] || ""; t.onclick = () => { tab = i; build(); }; strip.append(t); });
                if (canAdd) strip.append(plus());
                root.append(strip);
                const b = st.blocks[tab]; root.append(card(b, tab, meta, st));
            } else {
                const g = el("div", "cards");
                st.blocks.forEach((b, i) => g.append(card(b, i, meta, st)));
                if (canAdd) { const add = el("button", "addcard"); add.type = "button"; add.append(icon("plus", 18), el("span", "", ctx.tr("Add an image"))); add.onclick = () => act("addBlock"); g.append(add); }
                const n = st.blocks.length, cols = Math.max(1, Math.min(n + (canAdd ? 1 : 0), Math.round(Math.sqrt((n + 1) * root.clientWidth / Math.max(1, root.clientHeight)))));
                g.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
                root.append(g);
            }
            requestAnimationFrame(paintAll);
        }

        function show() {
            const s = ctx.info("node");
            if (!s.bound) return note(ctx.tr("Bind an ND Load Images node"));
            if (s.lost || !s.node) return note(ctx.tr("The node is gone. Bind it again."), true);
            if (!isLoadImagesNode(s.node)) return note(ctx.tr("This node is not an ND Load Images"), true);
            if (!apiOf(s.node)) return note(ctx.tr("Update Neural Dreamer Nodes: this version has no connection for the Images Input"), true);
            if (s.node !== node) { unsub?.(); node = s.node; sig = ""; unsub = apiOf(node).subscribe(() => show()); }
            const next = imagesStamp(node) + "|" + ctx.prop("layout") + "|" + ctx.prop("tools") + "|" + ctx.prop("add") + "|" + ctx.prop("reset") + "|" + ctx.prop("remove") + "|" + tab;
            if (next !== sig) { sig = next; build(); }
        }
        root.addEventListener("paste", (e) => {
            const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith("image/"));
            if (!f || !node) return;
            e.preventDefault(); e.stopPropagation();
            const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
            const id = ctx.prop("layout") === "tabs" ? apiOf(node)?.getState().blocks[tab]?.id : focusId || apiOf(node)?.getState().blocks[0]?.id;
            give(id, [{ kind: "file", file: new File([f], `pasted_${Date.now()}.${ext}`, { type: f.type }) }]);
        });
        show();
        return { update: show, destroy() { unsub?.(); ro.disconnect(); } };
    },
};
