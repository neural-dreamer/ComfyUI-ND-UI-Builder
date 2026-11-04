// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the toolbar of the top panel: the tiles of the library, picking a button on the top bar of ComfyUI, the interactive ghost
// (drag to reorder, drag out to remove), the settings of an item and of the whole toolbar.
import { el } from "./core/dom.js";
import { icon } from "./kit.js";
import { section, row, numberInput, textInput, selectInput, segInput, toggleInput, rangeInput, colorInput, btn } from "./controls.js";
import { uid, TB_SCALE, SEP_W } from "./model.js";
import * as comfybar from "./comfybar.js";

const CORNERS = (tr) => [["tl", tr("Top left")], ["tr", tr("Top right")], ["bl", tr("Bottom left")], ["br", tr("Bottom right")]];
const itemOf = (ui, id) => ui.view.toolbar.items.find((i) => i.id === id);

/** defines E.tb* — what the editor does with the toolbar */
export function installToolbar(E) {
    E.tbSel = null; E.tbDrag = false;
    const sel0 = E.select;
    E.select = (ids, add) => { if (ids?.length) E.tbSel = null; return sel0(ids, add); };
    const fresh = (kind, extra = {}) => ({ id: uid("t"), kind, scale: 100, style: kind === "comfy" ? "native" : kind === "sep" ? "flat" : "pill", bg: "", fg: "", border: "", ...(kind === "sep" ? { w: 14, line: true, variant: "line", thick: 1 } : {}), ...extra });
    const show = () => { E.renderOverlay(); E.renderInspector(); };
    /** adds an item at `index` (the end by default); a ComfyUI one asks for the button first */
    E.tbAdd = (kind, index) => {
        if (kind === "comfy") { E.tbPick(null, index); return; }
        const it = fresh(kind);
        E.change(null, (u) => { const l = u.view.toolbar.items; l.splice(index ?? l.length, 0, it); }, { inspector: false });
        E.tbSel = it.id; E.sel.clear(); show();
    };
    /** picks a button on the top bar of ComfyUI; replaceId: pick again for an item that exists */
    E.tbPick = (replaceId, index) => {
        startTbPick(E, { replaceId, onPick: (fe) => {
            const base = { name: comfybar.nameOf(fe), fp: comfybar.fingerprintOf(fe), how: comfybar.howFor(fe) };
            if (replaceId) E.change(null, (u) => Object.assign(itemOf(u, replaceId) || {}, base), { inspector: false });
            else { const it = fresh("comfy", base); E.change(null, (u) => { const l = u.view.toolbar.items; l.splice(index ?? l.length, 0, it); }, { inspector: false }); E.tbSel = it.id; E.sel.clear(); }
            show();
        } });
    };
    E.tbRemove = (id) => { E.change(null, (u) => { u.view.toolbar.items = u.view.toolbar.items.filter((i) => i.id !== id); }, { inspector: false }); if (E.tbSel === id) E.tbSel = null; show(); };
    E.tbMove = (id, to) => {
        E.change(null, (u) => { const l = u.view.toolbar.items, i = l.findIndex((x) => x.id === id); if (i < 0) return; const [it] = l.splice(i, 1); l.splice(Math.max(0, Math.min(l.length, to)), 0, it); }, { inspector: false });
        show();
    };
    E.tbSelect = (id) => { E.tbSel = id; E.sel.clear(); E.renderInspector(); E.root.querySelectorAll(".ndk-tb-item").forEach((n) => n.classList.toggle("sel", n.dataset.id === id)); };
}

/* ------------------------------------------------------------------ the library: the group "Top bar" */
export function toolbarTiles(E, body) {
    const { tr } = E;
    body.append(el("div", "nde-pgrp", tr("Top bar")));
    const grid = el("div", "nde-lib");
    const tiles = [
        ["comfy", tr("ComfyUI button or block"), "crosshair", tr("Pick a button or a block on the top bar of ComfyUI; it will stand on the top panel of the ND UI mode")],
        ["sep", tr("Separator"), "distH", tr("A gap between the items, with a line if you like. Its width is a setting")],
        ["unload", tr("Unload models"), "unload", tr("A button that unloads the models from the memory (the same as Unload Models in ComfyUI)")],
        ["unloadCache", tr("Unload models and cache"), "unloadCache", tr("A button that unloads the models and clears the execution cache")],
    ];
    for (const [kind, label, ic, hint] of tiles) {
        const i = el("div", "nde-lib-i"); i.draggable = true; i.title = hint;
        i.append(icon(ic, 22), el("span", "", label));
        i.addEventListener("click", () => E.tbAdd(kind));
        i.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("application/x-nd-tbitem", kind); e.dataTransfer.effectAllowed = "copy";
            if (E.ghost === false) E.ghost = true;
            setTimeout(() => { E.tbDrag = true; E.renderOverlay(); }, 0);
        });
        i.addEventListener("dragend", () => { E.tbDrag = false; E.renderOverlay(); });
        grid.append(i);
    }
    body.append(grid, el("div", "nde-note", tr("Drag these onto the top panel (the ghost at the top of the page) to place them.")));
}

/* ------------------------------------------------------------------ picking on the top bar of ComfyUI */
export function startTbPick(E, { onPick, replaceId }) {
    const { tr } = E;
    if (E.stopPick) return;
    E.root.style.display = "none";
    const bar = el("div", "nde-hint"); bar.style.top = "auto"; bar.style.bottom = "28px";
    const done = btn(tr("Cancel"), "x", () => finish(), "");
    bar.append(icon("crosshair", 16), el("span", "", tr("Click a button or a block on the top bar of ComfyUI. Wheel or ↑/↓: the button / its whole block. Esc: cancel.")), done);
    document.body.append(bar);
    const hl = el("div", "nde-hl"); hl.style.display = "none"; document.body.append(hl);
    const lab = el("div", "nde-hl-lab"); lab.style.display = "none"; document.body.append(lab);
    const added = new Set();
    for (const it of E.ui.view.toolbar.items) if (it.kind === "comfy" && it.id !== replaceId) { const e = comfybar.find(it.fp, { withMoved: true }); if (e) added.add(e); }
    let chain = [], level = 0, head = null;
    const inBar = (e) => e.target && bar.contains(e.target);
    const paint = () => {
        const e = chain[level];
        if (!e) { hl.style.display = lab.style.display = "none"; return; }
        const r = e.getBoundingClientRect(), dup = added.has(e);
        hl.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;${dup ? "border-color:#f59e0b;background:rgba(245,158,11,.14)" : ""}`;
        lab.textContent = `${comfybar.nameOf(e)} — ${comfybar.howFor(e) === "move" ? tr("moves here") : tr("copy")}${dup ? ` (${tr("already added")})` : ""}${chain.length > 1 ? `  [${level + 1}/${chain.length}]` : ""}`;
        lab.style.cssText = `display:block;left:${Math.max(4, r.left)}px;top:${r.bottom + 6}px`;
    };
    const move = (e) => {
        if (inBar(e)) return;
        const x = e.clientX, y = e.clientY;
        const list = comfybar.candidates().filter((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; })
            .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
        const h = list[0] || null;
        if (h !== head) { head = h; level = 0; }
        chain = list; paint();
    };
    const swallow = (e) => { if (e.button === 1 || inBar(e)) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); };
    const down = (e) => {
        if (inBar(e) || e.button === 1) return;
        swallow(e);
        if (e.button !== 0) return;
        const t = chain[level];
        if (t && !added.has(t)) { finish(true); onPick(t); }
    };
    const wheel = (e) => { if (inBar(e)) return; e.preventDefault(); e.stopPropagation(); if (!chain.length) return; level = Math.max(0, Math.min(chain.length - 1, level + (e.deltaY < 0 ? 1 : -1))); paint(); };
    const key = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); if (chain.length) { level = Math.max(0, Math.min(chain.length - 1, level + (e.key === "ArrowUp" ? 1 : -1))); paint(); } }
    };
    const evs = ["mousedown", "mouseup", "click", "dblclick", "pointerup", "contextmenu"];
    window.addEventListener("pointermove", move, true); window.addEventListener("pointerdown", down, true);
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    for (const t of evs) window.addEventListener(t, swallow, true);
    window.addEventListener("keydown", key, true);
    function finish(picked) {
        if (!E.stopPick) return;
        window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerdown", down, true);
        window.removeEventListener("wheel", wheel, { capture: true });
        for (const t of evs) window.removeEventListener(t, swallow, true);
        window.removeEventListener("keydown", key, true);
        E.stopPick = null;
        // the clicks that follow the pick are swallowed a moment longer, so that the button is not pressed by the pick itself
        bar.remove(); hl.remove(); lab.remove();
        if (picked) setTimeout(() => {}, 0);
        E.root.style.display = "";
        E.renderLeft(); E.root.focus();
    }
    E.stopPick = () => finish();
}

/* ------------------------------------------------------------------ the ghost of the toolbar */
/** makes the plate of the ghost interactive: select, drag to reorder, drag out to remove, drop from the library */
export function wireGhost(plate, E) {
    const { tr } = E;
    plate.classList.add("editable");
    const items = () => [...plate.querySelectorAll(".ndk-tb-item:not(.ph)")];
    const indexAt = (x, skip) => items().filter((n) => n !== skip).filter((n) => { const r = n.getBoundingClientRect(); return (r.left + r.right) / 2 < x; }).length;
    for (const n of items()) {
        n.classList.toggle("sel", n.dataset.id === E.tbSel);
        n.title = n.dataset.kind === "sep" ? tr("Separator") : n.title;
        n.addEventListener("pointerdown", (ev) => {
            if (ev.button !== 0) return;
            ev.preventDefault(); ev.stopPropagation();
            E.tbSelect(n.dataset.id);
            const x0 = ev.clientX, y0 = ev.clientY;
            let flo = null, mark = null, drag = false, out = false;
            const pr = plate.getBoundingClientRect();
            const mv = (e) => {
                if (!drag && Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return;
                if (!drag) {
                    drag = true;
                    const r = n.getBoundingClientRect();
                    flo = n.cloneNode(true); flo.classList.add("ndk-tb-float"); flo.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;margin:0;pointer-events:none;opacity:.85;z-index:2147483300`;
                    mark = el("div", "ndk-tb-ins"); mark.style.cssText = "position:fixed;width:3px;border-radius:2px;background:var(--ndk-accent,#7757fa);z-index:2147483300;pointer-events:none";
                    document.body.append(flo, mark);
                    n.style.opacity = ".3";
                }
                flo.style.transform = `translate(${e.clientX - x0}px,${e.clientY - y0}px)`;
                out = e.clientY < pr.top - 50 || e.clientY > pr.bottom + 50 || e.clientX < pr.left - 80 || e.clientX > pr.right + 80;
                flo.classList.toggle("remove", out);
                const list = items().filter((q) => q !== n), i = indexAt(e.clientX, n);
                const ref = list[i] || list[list.length - 1];
                const rr = ref ? ref.getBoundingClientRect() : pr;
                mark.style.cssText += `;left:${(list[i] ? rr.left - 6 : rr.right + 5)}px;top:${rr.top}px;height:${rr.height}px;display:${out ? "none" : "block"}`;
            };
            const up = (e) => {
                window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
                flo?.remove(); mark?.remove(); n.style.opacity = "";
                if (!drag) return;
                if (out) E.tbRemove(n.dataset.id); else E.tbMove(n.dataset.id, indexAt(e.clientX, n));
            };
            window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
        });
    }
    // drop from the library
    plate.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("application/x-nd-tbitem")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; plate.classList.add("over"); } });
    plate.addEventListener("dragleave", () => plate.classList.remove("over"));
    plate.addEventListener("drop", (e) => {
        const kind = e.dataTransfer?.getData("application/x-nd-tbitem");
        if (!kind) return;
        e.preventDefault(); e.stopPropagation(); plate.classList.remove("over");
        E.tbDrag = false;
        E.tbAdd(kind, indexAt(e.clientX));
    });
}

/* ------------------------------------------------------------------ the inspector */
const colorRow = (E, label, value, onChange) => row(label, colorInput({ value: value || null, palette: [], onChange: (v) => onChange(v || ""), nullable: true, host: E.root, tr: E.tr }));

/** the settings of the whole toolbar (the page settings) */
export function toolbarSection(E, body) {
    const { tr, ui } = E;
    const tb = ui.view.toolbar;
    const set = (fn) => E.change(null, (u) => fn(u.view.toolbar));
    body.append(section(tr("Top bar"), (b) => {
        b.append(el("div", "nde-note", tr("Buttons and blocks of the top bar of ComfyUI, the memory buttons and separators on the top panel of the ND UI mode. Drag them in the ghost at the top of the page.")));
        b.append(row(tr("Top bar corner"), selectInput(CORNERS(tr), tb.corner, (v) => set((t) => { t.corner = v; }))));
        b.append(row(tr("Top bar scale"), rangeInput({ value: tb.scale, min: TB_SCALE[0], max: TB_SCALE[1], step: 5, onInput: (v) => E.change("tbs", (u) => { u.view.toolbar.scale = v; }, { light: true }), fmt: (v) => `${v}%` })));
        b.append(row(tr("Background plate"), toggleInput(tb.bg === "pill", (v) => set((t) => { t.bg = v ? "pill" : "none"; })), tr("A rounded plate under all the items of the top bar")));
        b.append(row(tr("Dim the top bar"), toggleInput(tb.dim, (v) => set((t) => { t.dim = v; })), tr("The items fade until the mouse comes near")));
        // the look of the whole top panel (logo, project button, tabs, items): as the theme says, or its own
        const bl = ui.view.bar, bset = (k, v, key) => E.change(key || null, (u) => { u.view.bar[k] = v; }, key ? { light: true } : undefined);
        b.append(row(tr("Top panel shape"), selectInput([["", tr("As the kit")], ["sharp", tr("Sharp")], ["rounded", tr("Rounded")], ["pill", tr("Pill")]], bl.shape, (v) => bset("shape", v))));
        b.append(colorRow(E, tr("Top panel background"), bl.bg, (v) => bset("bg", v, "bbg")));
        b.append(row(tr("Top panel opacity"), rangeInput({ value: bl.opacity, min: 0, max: 100, step: 1, onInput: (v) => bset("opacity", v, "bop"), fmt: (v) => `${v}%` }), tr("Of the background that comes from the theme")));
        b.append(colorRow(E, tr("Strip under the top panel"), bl.strip, (v) => bset("strip", v, "bst")));
        b.append(colorRow(E, tr("Top panel text"), bl.fg, (v) => bset("fg", v, "bfg")));
        b.append(colorRow(E, tr("Top panel border"), bl.border, (v) => bset("border", v, "bbd")));
        b.append(row(tr("Top panel blur"), rangeInput({ value: bl.blur, min: 0, max: 40, step: 1, onInput: (v) => bset("blur", v, "bbl"), fmt: (v) => `${v} px` })));
        const bar = el("div", "nde-tools");
        bar.append(btn(tr("Pick from the ComfyUI top bar"), "crosshair", () => E.tbAdd("comfy"), "primary"), btn(tr("Add separator"), "distH", () => E.tbAdd("sep")));
        b.append(bar);
    }, { key: "toolbar" }));
}

/** the settings of one item */
export function toolbarItemSettings(E, body, it) {
    const { tr } = E;
    const set = (key, fn, o) => E.change(key ? `tb:${it.id}:${key}` : null, (u) => { const i = itemOf(u, it.id); if (i) fn(i); }, o);
    const titles = { comfy: it.name || tr("ComfyUI button or block"), sep: tr("Separator"), unload: tr("Unload models"), unloadCache: tr("Unload models and cache") };
    body.append(el("div", "nde-note", tr("Top bar item: change it here, drag it in the ghost to move it, drag it out of the panel to remove it.")));
    body.append(section(titles[it.kind], (b) => {
        if (it.kind === "comfy") {
            b.append(row(tr("Name"), textInput({ value: it.name, onChange: (v) => set(null, (i) => { i.name = v.slice(0, 60); }) })));
            b.append(row(tr("Shown as"), el("span", "nde-hint-t", it.how === "mirror" ? tr("A copy (clicks go to the original)") : tr("The button itself, moved here while the mode is on"))));
            const found = comfybar.find(it.fp, { withMoved: true });
            if (!found) b.append(el("div", "nde-note warn", tr("Not found on the top bar of ComfyUI. Its pack may be off or not loaded yet.")));
        }
        if (it.kind === "sep") {
            b.append(row(tr("Width"), numberInput({ value: it.w, min: SEP_W[0], max: SEP_W[1], int: true, onChange: (v) => set(null, (i) => { i.w = Math.max(SEP_W[0], Math.min(SEP_W[1], Math.round(v) || 14)); }) })));
            b.append(row(tr("Line"), toggleInput(it.line !== false, (v) => set(null, (i) => { i.line = v; }))));
            b.append(row(tr("Look"), segInput([["line", tr("Line")], ["accent", tr("Accent glow")]], it.variant === "accent" ? "accent" : "line", (v) => set(null, (i) => { i.variant = v; }))));
            b.append(row(tr("Thickness"), numberInput({ value: it.thick || 1, min: 1, max: 8, int: true, onChange: (v) => set(null, (i) => { i.thick = Math.max(1, Math.min(8, Math.round(v) || 1)); }) })));
            b.append(colorRow(E, tr("Line colour"), it.bg, (v) => set(null, (i) => { i.bg = v; })));
        } else {
            b.append(row(tr("Scale"), rangeInput({ value: it.scale, min: TB_SCALE[0], max: TB_SCALE[1], step: 5, onInput: (v) => set("sc", (i) => { i.scale = v; }, { light: true }), fmt: (v) => `${v}%` })));
            const styles = it.kind === "comfy" ? [["native", tr("As in ComfyUI")], ["pill", tr("Pill")], ["flat", tr("Flat")]] : [["pill", tr("Pill")], ["flat", tr("Flat")]];
            b.append(row(tr("Style"), segInput(styles, it.kind === "comfy" ? it.style : it.style === "flat" ? "flat" : "pill", (v) => set(null, (i) => { i.style = v; }))));
            b.append(colorRow(E, tr("Background"), it.bg, (v) => set(null, (i) => { i.bg = v; })));
            b.append(colorRow(E, tr("Text and icons"), it.fg, (v) => set(null, (i) => { i.fg = v; })));
            b.append(colorRow(E, tr("Border"), it.border, (v) => set(null, (i) => { i.border = v; })));
        }
        const bar = el("div", "nde-tools");
        if (it.kind === "comfy") bar.append(btn(tr("Pick again"), "crosshair", () => E.tbPick(it.id)));
        bar.append(btn(tr("Remove"), "trash", () => E.tbRemove(it.id)), btn(tr("Done"), "check", () => { E.tbSel = null; E.renderOverlay(); E.renderInspector(); }));
        b.append(bar);
    }, { key: "tbitem" }));
}
