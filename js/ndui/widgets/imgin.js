// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Simple Load Image: the picture of a plain "load one image" node (the standard Load Image and any node of other packs
// that has an `image` list), shown big. Click, drop, paste or pick from the list; the file goes to the input folder and into the node.
import { el, icon } from "./util.js";
import { openList } from "./choice.js";
import { fileUrl, refFromName, readDrop, hasDrop, takeDrop } from "../media/io.js";

const IMG_EXT = /\.(png|jpe?g|webp|bmp|gif|tiff?|avif)$/i;
export const isImageName = (s) => IMG_EXT.test(String(s || "").replace(/\s\[(input|output|temp)\]$/, ""));

// what the widget needs from a combo parameter: the name goes in, the list of files learns the new name
export function putName(ctx, slot, name) {
    const w = ctx.info(slot).p?.widget, vals = w?.options?.values;
    if (Array.isArray(vals) && !vals.includes(name)) vals.push(name);
    ctx.set(slot, name);
}

export const simpleimage = {
    type: "simpleimage", label: "Simple Load Image", icon: "image", group: "Inputs", fill: true,
    slots: [{ id: "image", label: "Image", accepts: ["COMBO"], required: true }],
    size: { w: 320, h: 320, minW: 120, minH: 90 },
    props: [
        { id: "fit", kind: "select", label: "Picture", def: "contain", options: [["contain", "Whole picture"], ["cover", "Fill the frame"]] },
        { id: "name", kind: "bool", label: "File name", def: true },
        { id: "pick", kind: "bool", label: "List of files", def: true },
    ],
    mount(ctx) {
        const root = el("div", "ndk-si"); root.tabIndex = 0;
        const stage = el("div", "stage");
        const img = el("img"); img.alt = ""; img.draggable = false;
        const empty = el("div", "empty");
        const hint = el("span", "", "");
        empty.append(icon("image", 30), hint);
        const busy = el("div", "busy"); busy.style.display = "none";
        stage.append(img, empty, busy);
        const bar = el("div", "bar");
        const nameEl = el("span", "fname");
        const bList = el("button", "btn"); bList.type = "button"; bList.title = ctx.tr("Pick from the files of the input folder"); bList.append(icon("list", 14));
        const bLoad = el("button", "btn"); bLoad.type = "button"; bLoad.title = ctx.tr("Load an image from the computer"); bLoad.append(icon("plus", 14), el("span", "", ctx.tr("Load")));
        bar.append(nameEl, bList, bLoad);
        const fin = el("input"); fin.type = "file"; fin.accept = "image/*"; fin.style.display = "none";
        root.append(stage, bar, fin);
        ctx.body.append(root);
        let shown = "", bust = 0, state = { ok: false };
        const say = (t, warn) => { hint.textContent = t; empty.classList.toggle("warn", !!warn); };
        const take = async (items) => {
            if (!state.ok) return;
            busy.style.display = ""; busy.textContent = ctx.tr("Loading…");
            try {
                const got = await takeDrop(items.slice(0, 1));
                if (got[0]) { bust = Date.now(); shown = ""; putName(ctx, "image", got[0].name); show(); }
            } catch (e) { say(String(e?.message || e), true); empty.style.display = ""; }
            busy.style.display = "none";
        };
        function show() {
            const st = ctx.info("image");
            state = { ok: false };
            root.classList.toggle("off", !st.bound || st.lost || st.linked);
            const noImg = (t, warn) => { img.style.display = "none"; empty.style.display = ""; say(t, warn); nameEl.textContent = ""; shown = ""; };
            bList.style.display = ctx.prop("pick") !== false ? "" : "none";
            if (!st.bound) return noImg(ctx.tr("Bind the image parameter of a Load Image node"));
            if (st.lost) return noImg(ctx.tr("The node is gone. Bind it again."), true);
            if (st.ptype !== "COMBO") return noImg(ctx.tr("This parameter is not a list of files"), true);
            state = { ok: !st.linked, st };
            const v = st.value == null ? "" : String(st.value);
            nameEl.style.display = ctx.prop("name") !== false ? "" : "none";
            nameEl.textContent = v; nameEl.title = v;
            img.style.objectFit = ctx.prop("fit") === "cover" ? "cover" : "contain";
            if (st.linked) return noImg(ctx.tr("This parameter is driven by a wire"));
            if (!v) return noImg(ctx.tr("Drop an image here, paste it or click to choose"));
            const key = `${v}|${bust}`;
            if (key !== shown) {
                shown = key;
                const ref = refFromName(v);
                img.style.display = "none"; empty.style.display = "";
                if (!isImageName(v)) { say(ctx.tr("This file is not a picture: {name}", { name: v }), true); return; }
                say(ctx.tr("Loading…"));
                img.onload = () => { if (shown === key) { img.style.display = ""; empty.style.display = "none"; } };
                img.onerror = () => { if (shown === key) { img.style.display = "none"; empty.style.display = ""; say(ctx.tr("File not found: {name}", { name: v }), true); } };
                img.src = fileUrl(ref) + (bust ? `&r=${bust}` : "");
            }
        }
        stage.addEventListener("click", () => { if (state.ok) fin.click(); });
        bLoad.addEventListener("click", () => { if (state.ok) fin.click(); });
        fin.addEventListener("change", () => { const f = Array.from(fin.files || []).map((file) => ({ kind: "file", file })); fin.value = ""; if (f.length) take(f); });
        bList.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!state.ok) return;
            const options = (state.st.options || []).filter((o) => isImageName(o));
            openList(ctx, bList, { options, current: state.st.value, onPick: (o) => { shown = ""; ctx.set("image", o); show(); } });
        });
        root.addEventListener("dragover", (e) => { if (state.ok && hasDrop(e.dataTransfer)) { e.preventDefault(); root.classList.add("drop"); } });
        root.addEventListener("dragleave", (e) => { if (!root.contains(e.relatedTarget)) root.classList.remove("drop"); });
        root.addEventListener("drop", (e) => { root.classList.remove("drop"); const it = readDrop(e.dataTransfer); if (it.length && state.ok) { e.preventDefault(); e.stopPropagation(); take(it); } });
        root.addEventListener("paste", (e) => {
            if (!state.ok) return;
            const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith("image/"));
            if (!f) return;
            e.preventDefault(); e.stopPropagation();
            const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
            take([{ kind: "file", file: new File([f], `pasted_${Date.now()}.${ext}`, { type: f.type }) }]);
        });
        show();
        return { update: show };
    },
};
