// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — decoration: Panel, Heading, Text block, Divider, Image.
import { el, icon } from "./util.js";

const SIZES = [["S", "Small"], ["M", "Medium"], ["L", "Large"], ["XL", "Extra large"]];
const HEAD_PX = { S: 16, M: 22, L: 30, XL: 44 };
const COPY_PX = { S: 12, M: 13, L: 15, XL: 18 };
const ALIGNS = [["left", "Left"], ["center", "Center"], ["right", "Right"]];

export const panel = {
    type: "panel", label: "Panel", icon: "panel", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 520, h: 360, minW: 8, minH: 8 },
    props: [
        { id: "title", kind: "text", label: "Title", hint: "Shown at the top of the panel. Empty: no title bar." },
        { id: "shadow", kind: "bool", label: "Shadow", def: true },
    ],
    mount(ctx) {
        const box = el("div", "ndk-panel-box");
        const title = el("div", "ndk-panel-title");
        box.append(title);
        ctx.body.append(box);
        const show = () => {
            const t = ctx.prop("title");
            title.textContent = t || "";
            title.style.display = t ? "" : "none";
            box.classList.toggle("noshadow", ctx.prop("shadow") === false);
        };
        show();
        return { update: show };
    },
};

const SPOILER_ICONS = [["", "None"], ["sliders", "Sliders"], ["layers", "Layers"], ["cube", "Cube"], ["image", "Image"], ["text", "Text"], ["bolt", "Bolt"], ["gauge", "Gauge"], ["list", "List"], ["grid", "Grid"]];

// a spoiler: a header that opens a small canvas of its own (the widgets with parent = this id; see flow.js)
export const spoiler = {
    type: "spoiler", label: "Spoiler", icon: "spoiler", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 420, h: 44, minW: 120, minH: 30 },
    props: [
        { id: "title", kind: "text", label: "Title", def: "Settings" },
        { id: "icon", kind: "select", label: "Icon", def: "", options: SPOILER_ICONS },
        { id: "open", kind: "bool", label: "Open at the start", def: false },
        { id: "remember", kind: "bool", label: "Remember open / closed", def: true, hint: "In this browser, for whoever uses the panel." },
        { id: "head_h", kind: "int", label: "Header height", def: 0, min: 0, max: 72, hint: "0: by the density of the kit. Otherwise 24 to 72 px. In the editor you can also drag the bottom edge of the spoiler." },
        { id: "pad", kind: "int", label: "Inner padding", def: 12, min: 0, max: 48 },
        { id: "max_h", kind: "int", label: "Maximum height when open", def: 0, min: 0, max: 4000, hint: "0: as tall as the content. Taller content scrolls inside the spoiler." },
        { id: "shadow", kind: "bool", label: "Shadow", def: false },
    ],
    mount(ctx) {
        const box = el("div", "ndk-sp-box");
        const bar = el("div", "ndk-sp-bar"), thumb = el("div", "thumb"); bar.append(thumb); box.append(bar);
        const head = el("button", "ndk-sp-head"); head.type = "button";
        const chev = el("span", "ndk-sp-chev"); chev.append(icon("chevR", 16));
        const ic = el("span", "ndk-sp-ic");
        const title = el("span", "ndk-sp-title");
        const count = el("span", "ndk-sp-count");
        head.append(chev, ic, title, count);
        box.append(head);
        ctx.body.append(box);
        head.addEventListener("click", (e) => { e.stopPropagation(); ctx.toggle(); });
        const show = () => {
            const open = ctx.isOpen();
            head.style.height = `${ctx.headH() / (ctx.ks?.() || 1)}px`;   // the content of the frame is scaled: the header must come out as tall as its frame
            box.classList.toggle("open", open);
            box.classList.toggle("noshadow", ctx.prop("shadow") !== true);
            head.setAttribute("aria-expanded", open ? "true" : "false");
            title.textContent = ctx.prop("title") || "";
            ic.textContent = "";
            const name = ctx.prop("icon");
            if (name) ic.append(icon(name, 16));
            ic.style.display = name ? "" : "none";
            const n = ctx.inside().filter((w) => w.slots && Object.keys(w.slots).length).length;
            // in the editor the closed spoiler says how to get inside
            const edit = ctx.isEditing?.();
            count.textContent = edit ? ctx.tr("{n} inside · double-click to edit", { n: ctx.inside().length }) : (!open && n ? String(n) : "");
            count.style.display = (edit || (!open && n)) ? "" : "none";
            // the scroll bar of an open spoiler that has a maximum height
            const sc = open && !edit ? ctx.scroll() : null;
            bar.style.display = sc ? "" : "none";
            if (sc) {
                const pad = Math.max(0, Number(ctx.prop("pad") ?? 12)), H = ctx.headH();
                const hh = ctx.size().h; bar.style.top = `${((H + pad) / hh) * 100}%`; bar.style.height = `${(sc.view / hh) * 100}%`;
                const th = Math.max(Math.min(0.5, 24 / (sc.view * ctx.unitPx())), sc.view / sc.total);
                thumb.style.height = `${th * 100}%`; thumb.style.top = `${(sc.top / (sc.total - sc.view)) * (1 - th) * 100}%`;
                bar.dataset.k = String((sc.total - sc.view) / (sc.view * (1 - th) || 1));
            }
        };
        let drag = null;
        thumb.addEventListener("pointerdown", (e) => { const sc = ctx.scroll(); if (!sc) return; e.preventDefault(); e.stopPropagation(); thumb.setPointerCapture(e.pointerId); drag = { y: e.clientY, top: sc.top }; });
        thumb.addEventListener("pointermove", (e) => { if (!drag) return; const k = Number(bar.dataset.k) || 1; const sc = ctx.scroll(); const sy = ctx.unitPx(); ctx.scrollTo(drag.top + ((e.clientY - drag.y) / sy) * k); });
        const end = () => { drag = null; };
        thumb.addEventListener("pointerup", end); thumb.addEventListener("pointercancel", end);
        bar.addEventListener("pointerdown", (e) => { if (e.target !== bar) return; const sc = ctx.scroll(); if (!sc) return; const r = bar.getBoundingClientRect(); const f = (e.clientY - r.top) / r.height; ctx.scrollTo(f * (sc.total - sc.view)); });
        show();
        return { update: show, resize: show };
    },
};

export const heading = {
    type: "heading", label: "Heading", icon: "heading", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 360, h: 48, minW: 40, minH: 20 },
    props: [
        { id: "text", kind: "text", label: "Text", def: "Heading" },
        { id: "size", kind: "select", label: "Size", def: "M", options: SIZES },
        { id: "align", kind: "select", label: "Align", def: "left", options: ALIGNS },
    ],
    mount(ctx) {
        const h = el("h2", "ndk-heading");
        ctx.body.append(h);
        const show = () => {
            h.textContent = ctx.prop("text") ?? "";
            h.style.fontSize = `${HEAD_PX[ctx.prop("size")] || 22}px`;
            h.style.textAlign = ctx.prop("align") || "left";
        };
        show();
        return { update: show };
    },
};

export const textblock = {
    type: "textblock", label: "Text block", icon: "text", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 360, h: 80, minW: 40, minH: 20 },
    props: [
        { id: "text", kind: "textarea", label: "Text", def: "A few words about this panel.", hint: "Line breaks are kept. **Bold** is supported." },
        { id: "size", kind: "select", label: "Size", def: "M", options: SIZES },
        { id: "align", kind: "select", label: "Align", def: "left", options: ALIGNS },
    ],
    mount(ctx) {
        const p = el("div", "ndk-copy");
        ctx.body.append(p);
        const show = () => {
            p.textContent = "";
            const parts = String(ctx.prop("text") ?? "").split(/(\*\*[^*]+\*\*)/g);
            for (const s of parts) {
                if (/^\*\*[^*]+\*\*$/.test(s)) p.append(el("b", "", s.slice(2, -2)));
                else p.append(s);
            }
            p.style.fontSize = `${COPY_PX[ctx.prop("size")] || 13}px`;
            p.style.textAlign = ctx.prop("align") || "left";
        };
        show();
        return { update: show };
    },
};

export const divider = {
    type: "divider", label: "Divider", icon: "divider", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 360, h: 12, minW: 2, minH: 2 },
    props: [
        { id: "variant", kind: "select", label: "Look", def: "line", options: [["line", "Line"], ["accent", "Accent glow"]] },
        { id: "thickness", kind: "int", label: "Thickness", def: 1, min: 1, max: 8 },
    ],
    mount(ctx) {
        const d = el("div", "ndk-div");
        ctx.body.append(d);
        const show = () => {
            const s = ctx.size();
            d.classList.toggle("v", s.h > s.w);
            d.classList.toggle("accent", ctx.prop("variant") === "accent");
            d.style.setProperty("--ndk-dth", `${Math.max(1, Math.min(8, Number(ctx.prop("thickness")) || 1))}px`);
        };
        show();
        return { update: show, resize: show };
    },
};

export const image = {
    type: "image", label: "Image", icon: "image", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 280, h: 180, minW: 24, minH: 24 },
    props: [
        { id: "src", kind: "image", label: "Image", hint: "Upload a picture (it is stored in the ComfyUI input folder) or paste an address." },
        { id: "fit", kind: "select", label: "Fit", def: "cover", options: [["cover", "Cover"], ["contain", "Contain"]] },
    ],
    mount(ctx) {
        const box = el("div", "ndk-img");
        ctx.body.append(box);
        let shown = null;
        const show = () => {
            const src = ctx.prop("src") || "";
            box.style.setProperty("--ndk-fit", ctx.prop("fit") === "contain" ? "contain" : "cover");
            if (src === shown) return;
            shown = src;
            box.textContent = "";
            if (!src) { box.append(icon("image", 28)); return; }
            const im = el("img"); im.alt = ""; im.draggable = false; im.src = ctx.imageUrl(src);
            im.onerror = () => { box.textContent = ""; box.append(icon("warning", 24)); };
            box.append(im);
        };
        show();
        return { update: show };
    },
};
