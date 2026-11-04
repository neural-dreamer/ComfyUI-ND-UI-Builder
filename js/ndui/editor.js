// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the editor: a full-window workshop for the page.
// Left: Link (sources and their parameters) / Widgets (the library) / Layout (layers and alignment).
// Centre: the page with the grid, guides, selection and zoom. Right: the inspector of the selected widget (or of the page).
// Everything works on a copy of the panel; Save writes it back to the node, Cancel throws it away.

import { virtualParam } from "./virtual.js";
import { loadLook, applyLook } from "./editor_look.js";
import { el, icon } from "./widgets/util.js";
import { toast } from "./core/dom.js";
import { THEMES, applyVars, varsFor, injectKit } from "./kit.js";
import { EDITOR_CSS } from "./editor_style.js";
import { btn, iconBtn } from "./controls.js";
import { installGroups } from "./editor_groups.js";
import { fixGroups, membersOf, human, History, normalizeNdUi, normalizeLook, byId, widgetsOf, pageOf, uid, freeSpot, topZ, insidePanel, clamp, clone, GRID_STEPS, levelOf, childrenOf, descendantsOf, isSpoiler, innerW, contentBottom, spoilerPad, headHOf, HEAD_MIN, HEAD_MAX, fixParents, fixTabs, isPanelLike, TABS_MAX, fitChildren, syncSpoilerHeights, SPOILER_DEPTH, sourceOf, pageLength, pageBottom, LEN_MAX } from "./model.js";
import { defOf, defaultProps } from "./widgets/index.js";
import { PageView } from "./render.js";
import { addSource, dedupeUids, findSource, listParams, defaultWidgetFor, controlOf, invalidateSources } from "./sources.js";
import { renderLeft } from "./editor_left.js";
import { drawGhost, reserveOf } from "./topghost.js";
import { renderInspector } from "./editor_inspector.js";
import { installToolbar } from "./editor_toolbar.js";

const MIDNIGHT = THEMES[0].tokens;
const SNAP_PX = 7;

let styleDone = false;
function injectEditorStyle() {
    if (styleDone || document.getElementById("nd-ui-editor-style")) { styleDone = true; return; }
    const s = document.createElement("style"); s.id = "nd-ui-editor-style"; s.textContent = EDITOR_CSS; document.head.appendChild(s); styleDone = true;
}

export function openEditor({ node, ui, tr, lang, onSave, onClose }) {
    injectKit();
    injectEditorStyle();
    dedupeUids();

    const E = {
        node, ui: normalizeNdUi(ui), tr, lang, hist: new History(100), sel: new Set(), tab: "link", preview: false,
        openSrc: new Set(), paramQ: "", zoom: 1, ox: 0, oy: 0, fitted: true, dirty: false, lastKey: "", lastAt: 0, clip: null, space: false, closed: false,
    };
    E.page = E.ui.view.page;

    /* ---------------------------------------------------------- skeleton */
    const root = el("div", "ndk nde");
    root.tabIndex = -1;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); // ComfyUI then leaves its own shortcuts (undo, queue...) alone
    applyVars(root, varsFor(MIDNIGHT, { style: "soft", shape: "rounded", density: "comfortable", font: "inter" }, {}));
    E.look = loadLook(); applyLook(root, E.look);
    const top = el("div", "nde-top");
    const left = el("div", "nde-left");
    const center = el("div", "nde-center");
    const right = el("div", "nde-right");
    root.append(top, left, center, right);
    const stageHost = el("div", "nde-stage");
    const viewHost = el("div"); viewHost.style.cssText = "position:absolute;inset:0";
    const ovl = el("div", "nde-ovl");
    stageHost.append(viewHost, ovl);
    center.append(stageHost);
    document.body.append(root);
    // the side panels can be pulled wider (not narrower than they are by default, not wider than a third of the window); the widths are remembered
    const LW = 304, RW = 332, LS = "nde-panel-w";
    let pw = { l: LW, r: RW };
    try { const v = JSON.parse(localStorage.getItem(LS) || "null"); if (v && Number(v.l) && Number(v.r)) pw = { l: Number(v.l), r: Number(v.r) }; } catch {}
    const maxW = () => Math.max(LW, Math.floor(window.innerWidth / 3));
    const applyW = () => {
        pw.l = Math.max(LW, Math.min(maxW(), pw.l)); pw.r = Math.max(RW, Math.min(maxW(), pw.r));
        root.style.setProperty("--nde-lw", `${pw.l}px`); root.style.setProperty("--nde-rw", `${pw.r}px`);
        sl.style.left = `${pw.l}px`; sr.style.right = `${pw.r}px`; sr.style.left = "auto"; sr.style.marginLeft = "0"; sr.style.marginRight = "-4px";
    };
    const mkSplit = (side) => {
        const h = el("div", "nde-split"); h.title = tr("Drag to change the width of the panel. Double-click: the usual width");
        let x0 = 0, w0 = 0;
        h.addEventListener("pointerdown", (e) => { e.preventDefault(); h.setPointerCapture(e.pointerId); h.classList.add("drag"); x0 = e.clientX; w0 = pw[side]; });
        h.addEventListener("pointermove", (e) => { if (!h.classList.contains("drag")) return; pw[side] = w0 + (side === "l" ? e.clientX - x0 : x0 - e.clientX); applyW(); });
        const end = () => { if (!h.classList.contains("drag")) return; h.classList.remove("drag"); try { localStorage.setItem(LS, JSON.stringify(pw)); } catch {} };
        h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
        h.addEventListener("dblclick", () => { pw[side] = side === "l" ? LW : RW; applyW(); try { localStorage.setItem(LS, JSON.stringify(pw)); } catch {} });
        return h;
    };
    const sl = mkSplit("l"), sr = mkSplit("r");
    root.append(sl, sr); applyW();
    window.addEventListener("resize", applyW);
    E.root = root; E.center = center; E.stageHost = stageHost; E.ovl = ovl;
    E.vars = () => ({});
    E.host = () => root;

    E.view = new PageView(viewHost, { ui: E.ui, mode: "edit", kind: "editor", fit: "proportions", tr, popupHost: () => root, page: E.page, onPage: (id) => { E.page = id; E.sel.clear(); E.refreshAll(); }, onTab: (box, id) => E.change(`tab:${box.id}`, () => { box.props.active = id; }), onTabOp: (box, op, a, b) => E.tabOp(box, op, a, b), tabCount: (box, id) => E.tabCount(box, id) });

    /* ---------------------------------------------------------- state helpers */
    E.curPage = () => pageOf(E.ui, E.page);
    E.scope = null;   // the id of the spoiler whose inside is on the stage (null: the page)
    E.grow = 0;       // extra height of the inside of a spoiler while a widget is dragged to its bottom edge
    E.scopeChain = () => { const out = []; let s = E.scope && byId(E.ui, E.scope); while (s) { out.unshift(s); s = s.parent && byId(E.ui, s.parent); } return out; };
    E.viewScope = () => (E.preview ? null : E.scope);
    // the size of what is on the stage: the page, or the inside of a spoiler (its width, and room below the last widget)
    // room kept free for the top panel (page units): new widgets and the snap lines keep clear of it
    E.reserve = () => (E.ghost !== false && !E.viewScope() ? reserveOf(E.ui) : { top: 0, bottom: 0 });
    E.canvas = () => {
        const s = E.viewScope() && byId(E.ui, E.scope);
        // the page is as long as its content (the preview shows the window and scrolls the rest, like the modes)
        if (!s && E.adaptivePreview()) return { w: E.previewSize().w, h: E.previewSize().h };
        if (!s) return { w: E.ui.page.w, h: E.preview ? E.ui.page.h : E.pageLen() };
        return { w: innerW(s), h: Math.max(contentBottom(E.ui, s) + 240, 320, E.grow) };
    };
    E.pageLen = () => pageLength(E.ui, E.page);
    // the preview of a page that adapts to the width shows it in a window of the chosen width (the page itself is shown 1:1 inside it and the whole is zoomed)
    E.pvw = "1";                                   // "1" | "1.25" | "1.5" | "2" | "win"
    E.adaptivePreview = () => E.preview && !E.scope && E.ui.view.fit === "adaptive";
    E.previewSize = () => (E.pvw === "win" ? { w: Math.max(240, window.innerWidth), h: Math.max(240, window.innerHeight) } : { w: Math.round(E.ui.page.w * (Number(E.pvw) || 1)), h: E.ui.page.h });
    // the height that alignment and the lines of the grid are counted from: the window, or the length set for the page
    E.designH = () => Math.max(E.ui.page.h, E.curPage()?.len || 0);
    E.alignBox = () => { const cv = E.canvas(); return E.viewScope() ? cv : { w: cv.w, h: E.designH() }; };
    E.syncScope = () => { E.view.scope = E.viewScope(); E.view.scopeDims = E.view.scope ? E.canvas() : null; };
    E.widgets = () => levelOf(E.ui, E.page, E.viewScope());
    E.selected = () => [...E.sel].map((id) => byId(E.ui, id)).filter(Boolean);
    E.grid = () => E.ui.view.grid;

    // a change of the panel: the snapshot goes to the history first (changes with one key within a second count as one step)
    E.change = (key, fn, opts = {}) => {
        const now = Date.now();
        if (!(key && key === E.lastKey && now - E.lastAt < 900)) E.hist.push(E.ui);
        E.lastKey = key; E.lastAt = now;
        fn(E.ui);
        E.dirty = true;
        E.afterChange(opts);
    };
    E.afterChange = (opts = {}) => {
        E.view.ui = E.ui;
        fixParents(E.ui);
        fixTabs(E.ui);
        fixGroups(E.ui);
        for (const w of E.ui.widgets) if (isSpoiler(w)) fitChildren(E.ui, w);
        syncSpoilerHeights(E.ui);
        if (E.scope) { const s = byId(E.ui, E.scope); if (!s || !isSpoiler(s) || s.page !== E.page) E.scope = null; }
        E.syncScope();
        for (const id of [...E.sel]) if (!byId(E.ui, id)) E.sel.delete(id);
        if (!E.ui.pages.some((p) => p.id === E.page)) E.page = E.ui.pages[0].id;
        E.view.refresh();
        E.layoutStage();
        E.renderOverlay();
        updateTop();
        if (opts.left !== false && opts.light !== true) E.renderLeft();
        if (opts.inspector !== false && opts.light !== true) E.renderInspector();
        else if (opts.light) E.syncPosition?.();
    };
    E.refreshAll = () => { E.syncScope(); E.view.refresh(); E.layoutStage(); E.renderOverlay(); updateTop(); E.renderLeft(); E.renderInspector(); };
    E.select = (ids, add = false) => {
        if (!add) E.sel.clear();
        for (const id of ids) { if (add && E.sel.has(id)) E.sel.delete(id); else E.sel.add(id); }
        E.renderOverlay(); E.renderInspector(); E.renderLeft(); updateTop();
    };
    installToolbar(E);
    installGroups(E);
    { const sel1 = E.select; E.select = (ids, add) => { if (ids?.length && E.rtab === "templates") E.rtab = "settings"; return sel1(ids, add); }; }
    E.setPage = (id) => { if (E.ui.pages.some((p) => p.id === id)) { E.scope = null; E.grow = 0; E.page = id; E.ui.view.page = id; E.view.setPage(id); E.sel.clear(); E.refreshAll(); } };
    E.setTab = (t) => { E.tab = t; E.renderLeft(); };

    E.undo = () => { const p = E.hist.undo(E.ui); if (p) { E.ui = normalizeNdUi(p); E.lastKey = ""; E.afterChange({}); } };
    E.redo = () => { const p = E.hist.redo(E.ui); if (p) { E.ui = normalizeNdUi(p); E.lastKey = ""; E.afterChange({}); } };

    /* ---------------------------------------------------------- widgets: add, bind, remove */
    E.bindingOf = (entry, p) => ({ src: entry.uid, kind: "widget", name: p.name });
    E.addWidget = (type, o = {}) => {
        const def = defOf(type);
        if (!def) return null;
        if (type === "spoiler" && E.scopeChain().length >= SPOILER_DEPTH) { toast("warn", tr_("Spoilers go two levels deep"), tr_("Leave this spoiler to add one next to it.")); return null; }
        let made = null;
        E.change(null, (ui) => {
            const size = def.size;
            const cv = E.canvas();
            const w = E.scope ? Math.max(size.minW || 16, Math.min(size.w, cv.w - 2 * ui.view.grid)) : size.w, h = size.h;
            const at = o.at || freeSpot(ui, E.page, w, h, ui.view.grid, E.scope, { ...cv, h: E.scope ? cv.h : cv.h + 2000, top: E.reserve().top, bottom: E.reserve().bottom });
            made = {
                id: uid("w"), type, page: E.page, parent: E.scope, x: Math.round(at.x), y: Math.round(at.y), w, h, z: topZ(ui, E.page), hidden: false, locked: false,
                slots: o.slots || {}, props: { ...(def.noLabel ? {} : { label: o.label ?? def.label }), ...defaultProps(def), ...(o.props || {}) }, look: normalizeLook({}),
            };
            ui.widgets.push(made);
        }, { inspector: false });
        if (made) { E.sel.clear(); E.sel.add(made.id); E.renderOverlay(); E.renderInspector(); E.renderLeft(); }
        return made;
    };
    E.createFromParam = (entry, p, at) => {
        // ND Resolution: one Resolution widget (width + height), not two number fields
        if (p.virtual && (p.node.comfyClass || p.node.type) === "NDResolution") {
            if (p.name !== "width") return null;
            const h = virtualParam(p.node, "height");
            return E.addWidget("resolution", { label: human("Resolution"), slots: { width: E.bindingOf(entry, p), height: E.bindingOf(entry, h) }, at });
        }
        const type = defaultWidgetFor(p);
        if (!type) return null;
        const slots = { value: E.bindingOf(entry, p) };
        if (type === "seed") { const c = controlOf(p.node, p.name); if (c) slots.control = { src: entry.uid, kind: "widget", name: c.name }; }
        const w = E.addWidget(type, { label: human(p.label), slots, at });
        if (w && type === "toggle") w.props.text = human(p.label);
        return w;
    };
    // Node Embed: ND widgets for every parameter of the embedded node, in a spoiler-free column to the right of the frame
    E.embedParams = (w) => {
        const entry = w.slots?.node ? sourceOf(E.ui, w.slots.node.src) : null;
        const node = entry ? findSource(entry) : null;
        if (!node) return;
        let n = 0;
        for (const p of listParams(node)) { if (n >= 24) break; if (defaultWidgetFor(p) && E.createFromParam(entry, p)) n++; }
        if (!n) toast("warn", tr_("No parameters"), tr_("This node has no parameters that an ND widget can control."));
    };
    E.bindSlot = (w, slotId, entry, p) => {
        E.change(null, () => {
            if (!entry) { delete w.slots[slotId]; return; }
            w.slots[slotId] = E.bindingOf(entry, p);
            if (w.type === "seed" && slotId === "value" && !w.slots.control) { const c = controlOf(p.node, p.name); if (c) w.slots.control = { src: entry.uid, kind: "widget", name: c.name }; }
            if (!w.props.label || w.props.label === defOf(w.type)?.label) w.props.label = human(p.label);
        });
    };
    E.bindData = (w, slotId, entry, kind) => {
        E.change(null, () => { if (!entry) delete w.slots[slotId]; else w.slots[slotId] = { src: entry.uid, kind, name: "" }; });
    };
    // delete; a spoiler with widgets inside asks what to do with them
    // the tabs of a Tab panel: add, rename, move, delete (the widgets of a deleted tab go with it)
    E.tabCount = (box, tabId) => insidePanel(E.ui, box).filter((c) => c.tab === tabId).length;
    E.tabOp = (box, op, a, b) => {
        if (!box || box.type !== "tabbox") return;
        E.change(null, (ui) => {
            const t = box.props.tabs;
            if (op === "add") {
                if (t.length >= TABS_MAX) return;
                let n = t.length + 1; while (t.some((x) => x.name === `Tab ${n}`)) n++;
                const id = uid("t"); t.push({ id, name: `Tab ${n}` }); box.props.active = id;
            } else if (op === "rename") {
                const x = t.find((q) => q.id === a); if (x && String(b).trim()) x.name = String(b).trim().slice(0, 40);
            } else if (op === "move") {
                const i = t.findIndex((q) => q.id === a); if (i < 0) return;
                const [x] = t.splice(i, 1); t.splice(Math.max(0, Math.min(t.length, b)), 0, x);
            } else if (op === "del") {
                if (t.length <= 1) return;
                const i = t.findIndex((q) => q.id === a); if (i < 0) return;
                const gone = new Set();
                for (const c of insidePanel(ui, box)) if (c.tab === a) { gone.add(c.id); if (isSpoiler(c)) descendantsOf(ui, c.id).forEach((d) => gone.add(d.id)); }
                ui.widgets = ui.widgets.filter((w) => !gone.has(w.id));
                t.splice(i, 1);
                if (box.props.active === a) box.props.active = t[Math.min(i, t.length - 1)].id;
            }
        });
    };
    E.remove = (ids, how) => {
        if (!ids.length) return;
        const full = ids.map((id) => byId(E.ui, id)).filter((w) => w && isSpoiler(w) && childrenOf(E.ui, w.id).length);
        if (full.length && !how) return askDelete(ids, full);
        E.change(null, (ui) => {
            const gone = new Set(ids);
            if (how === "out") {
                const depth = (w) => { let n = 0, p = w.parent && byId(ui, w.parent); while (p) { n++; p = p.parent && byId(ui, p.parent); } return n; };
                for (const sp of ids.map((id) => byId(ui, id)).filter((w) => w && isSpoiler(w)).sort((a, b) => depth(a) - depth(b))) {
                    const pad = spoilerPad(sp), hh = headHOf(ui, sp);
                    for (const c of childrenOf(ui, sp.id)) { if (gone.has(c.id)) continue; c.parent = sp.parent || null; c.x += sp.x + pad; c.y += sp.y + hh + pad; }
                }
            } else for (const id of ids) { const w = byId(ui, id); if (w && isSpoiler(w)) descendantsOf(ui, id).forEach((d) => gone.add(d.id)); }
            ui.widgets = ui.widgets.filter((w) => !gone.has(w.id));
        });
    };
    function askDelete(ids, spoilers) {
        const n = spoilers.reduce((a, s) => a + descendantsOf(E.ui, s.id).length, 0);
        const c = el("div", "nde-confirm");
        const box = el("div");
        box.append(el("b", "", tr_("Delete the spoiler?")), el("span", "", tr_("{n} widgets lie inside it.", { n })));
        const acts = el("div", "acts");
        const keep = btn(tr_("Cancel"), null, () => c.remove(), "");
        const all = btn(tr_("Delete the spoiler and its {n} widgets", { n }), "trash", () => { c.remove(); E.remove(ids, "all"); }, "danger");
        const out = btn(tr_("Move the widgets out and delete"), "check", () => { c.remove(); E.remove(ids, "out"); }, "primary");
        out.classList.add("ndx-out"); all.classList.add("ndx-all");
        acts.append(keep, all, out); box.append(acts); c.append(box); root.append(c);
        out.focus?.();
    }
    // copies of the widgets with what lies inside the spoilers among them (new ids, "parent" follows)
    const treeOf = (ws) => { const all = new Map(); for (const w of ws) { all.set(w.id, w); if (isSpoiler(w)) descendantsOf(E.ui, w.id).forEach((d) => all.set(d.id, d)); } return [...all.values()]; };
    const cloneTree = (list, dx, dy, keepParent, groupDefs) => {
        const map = new Map(list.map((w) => [w.id, uid("w")]));
        let z = topZ(E.ui, E.page);
        const out = [], roots = [];
        for (const w of list) {
            const c = clone(w); c.id = map.get(w.id); c.page = E.page;
            if (map.has(w.parent)) c.parent = map.get(w.parent);
            else { c.parent = keepParent ? w.parent || null : E.scope; c.x += dx; c.y += dy; c.z = z++; roots.push(c.id); }
            out.push(c);
        }
        // groups: a copy of a group keeps its members together (a group with one member left is not kept)
        const gdef = new Map((groupDefs || E.ui.groups || []).map((g) => [g.id, g])), cnt = new Map(), gmap = new Map(), groups = [];
        for (const w of list) if (w.group) cnt.set(w.group, (cnt.get(w.group) || 0) + 1);
        for (const c of out) {
            const og = c.group;
            if (!og) continue;
            if (!gdef.has(og) || (cnt.get(og) || 0) < 2) { delete c.group; continue; }
            if (!gmap.has(og)) { const id = uid("g"); gmap.set(og, id); groups.push({ id, page: E.page, parent: c.parent || null, name: gdef.get(og).name }); }
            c.group = gmap.get(og);
        }
        return { list: out, roots, groups };
    };
    E.duplicate = (ids, offset = 16) => {
        const src = ids.map((id) => byId(E.ui, id)).filter(Boolean);
        if (!src.length) return;
        let roots = [];
        E.change(null, (ui) => { const r = cloneTree(treeOf(src), offset, offset, true); roots = r.roots; ui.widgets.push(...r.list); ui.groups.push(...r.groups); }, { inspector: false });
        E.sel.clear(); roots.forEach((id) => E.sel.add(id)); E.renderOverlay(); E.renderInspector(); E.renderLeft();
    };
    E.copy = () => { const s = E.selected(); if (s.length) { E.clip = clone(treeOf(s)); E.clipG = clone(E.ui.groups); } };
    E.paste = () => {
        if (!E.clip?.length) return;
        let roots = [];
        const ids = new Set(E.clip.map((w) => w.id));
        E.change(null, (ui) => {
            // the clipboard is a copy of its own: the widgets whose parent is not in it come into the current level
            const r = cloneTree(E.clip, 20, 20, false, E.clipG); roots = r.roots; ui.widgets.push(...r.list); ui.groups.push(...r.groups);
        }, { inspector: false });
        E.clip = E.clip.map((w) => (ids.has(w.parent) ? w : { ...w, x: w.x + 20, y: w.y + 20 }));
        E.sel.clear(); roots.forEach((id) => E.sel.add(id)); E.renderOverlay(); E.renderInspector(); E.renderLeft();
    };
    // moves widgets into a spoiler (parentId) or out to the page (null); what lies in them goes along
    E.moveTo = (ids, parentId) => {
        const ws = ids.map((id) => byId(E.ui, id)).filter(Boolean);
        if (!ws.length) return;
        const target = parentId && byId(E.ui, parentId);
        if (parentId && (!target || !isSpoiler(target))) return;
        const bad = ws.some((w) => w.id === parentId || (isSpoiler(w) && descendantsOf(E.ui, w.id).some((d) => d.id === parentId)));
        if (bad) return;
        E.change(null, (ui) => {
            for (const w of ws) {
                if ((w.parent || null) === (parentId || null)) continue;
                const from = w.parent && byId(ui, w.parent);
                if (target) {
                    const n = childrenOf(ui, target.id).length;
                    const y = contentBottom(ui, target) + (n ? 8 : 0);   // below what is inside already
                    w.parent = parentId; w.w = Math.min(w.w, innerW(target)); w.x = 0; w.y = y;
                } else {
                    w.parent = null;
                    if (from) { w.x = from.x; w.y = from.y + from.h + 8; }
                }
                w.z = topZ(ui, w.page);
            }
        });
    };
    E.zOrder = (how) => {
        const sel = E.selected();
        if (!sel.length) return;
        E.change(null, (ui) => {
            const all = levelOf(ui, E.page, E.scope).sort((a, b) => a.z - b.z);
            const ids = new Set(sel.map((w) => w.id));
            let order = all.filter((w) => !ids.has(w.id));
            const mine = all.filter((w) => ids.has(w.id));
            if (how === "front") order = [...order, ...mine];
            else if (how === "back") order = [...mine, ...order];
            else {
                order = all.slice();
                const step = how === "up" ? 1 : -1;
                const idx = order.map((w, i) => (ids.has(w.id) ? i : -1)).filter((i) => i >= 0);
                for (const i of step > 0 ? idx.reverse() : idx) { const j = i + step; if (j < 0 || j >= order.length || ids.has(order[j].id)) continue; [order[i], order[j]] = [order[j], order[i]]; }
            }
            order.forEach((w, i) => { w.z = i; });
        });
    };
    // the settings of Align / Spread (the margins and the gaps of the Layout tab) are kept in the browser, so the last values come back next time
    const SPREAD_KEY = "ndui-layout-spread", SPREAD_DEF = { mode: "margins", alignTo: "margins", anchor: "start", gapH: 16, gapV: 16, mL: 16, mT: 16, mR: 16, mB: 16 };
    const spreadLoad = () => {
        const o = { ...SPREAD_DEF };
        try {
            const v = JSON.parse(localStorage.getItem(SPREAD_KEY) || "null");
            if (v && typeof v === "object") {
                for (const k of ["gapH", "gapV", "mL", "mT", "mR", "mB"]) if (Number.isFinite(v[k])) o[k] = Math.max(-500, Math.min(4000, Math.round(v[k])));
                if (["margins", "gap", "even"].includes(v.mode)) o.mode = v.mode;
                if (["margins", "selection"].includes(v.alignTo)) o.alignTo = v.alignTo;
                if (["start", "end"].includes(v.anchor)) o.anchor = v.anchor;
            }
        } catch {}
        return o;
    };
    E.spread = E.spread || new Proxy(spreadLoad(), { set(t, k, v) { t[k] = v; try { localStorage.setItem(SPREAD_KEY, JSON.stringify(t)); } catch {} return true; } });
    E.align = (how) => {
        const sel = E.selected().filter((w) => !w.locked);
        if (!sel.length) return;
        const cv = E.alignBox(), sp = E.spread;
        // the box to align to: the page (or the inside of the spoiler) with the margins taken off, or the selection itself
        const selBox = sel.length > 1 ? bounds(sel) : { x: 0, y: 0, w: cv.w, h: cv.h };
        const box = sp.alignTo === "margins" ? { x: sp.mL, y: sp.mT, w: Math.max(1, cv.w - sp.mL - sp.mR), h: Math.max(1, cv.h - sp.mT - sp.mB) } : selBox;
        E.change(null, () => {
            if (how === "distH" || how === "distV") {
                const h = how === "distH";
                const sp = E.spread;
                const s = sel.slice().sort((a, b) => (h ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x));
                const size = (w) => (h ? w.w : w.h);
                const put = (w, v) => { if (h) w.x = Math.round(v); else w.y = Math.round(v); };
                if (sp.mode === "gap") {
                    if (s.length < 2) { toast("warn", tr_("Select at least two widgets"), ""); return; }
                    const gap = h ? sp.gapH : sp.gapV;
                    if (sp.anchor === "end") {
                        // the last one (right / bottom) stays, the others step back from it with the same gap
                        let edge = (h ? s[s.length - 1].x : s[s.length - 1].y);
                        for (let k = s.length - 2; k >= 0; k--) { edge -= gap + size(s[k]); put(s[k], edge); }
                    } else {
                        // the first one (left / top) stays, the others follow with the same gap
                        let pos = h ? s[0].x : s[0].y;
                        for (const w of s) { put(w, pos); pos += size(w) + gap; }
                    }
                } else if (sp.mode === "margins") {
                    // between the margins of the page (or of the spoiler we are inside)
                    const cv = E.alignBox();
                    const a = h ? sp.mL : sp.mT, b = h ? sp.mR : sp.mB, len = (h ? cv.w : cv.h) - a - b;
                    const stacked = s.some((p, k) => s.some((q, m) => m > k && Math.min(h ? p.x + p.w : p.y + p.h, h ? q.x + q.w : q.y + q.h) - Math.max(h ? p.x : p.y, h ? q.x : q.y) > 1));
                    if (h && (stacked || s.length === 1)) {
                        // a column: every widget is stretched across the whole width between the margins
                        for (const w of s) {
                            const min = defOf(w.type)?.size?.minW || 16;
                            put(w, a);
                            w.w = Math.max(min, Math.round(len));
                        }
                        return;
                    }
                    // the first one at the first margin, the last one at the last margin, the others between them with the same gaps
                    if (s.length === 1) { put(s[0], a); return; }
                    const total = s.reduce((t, w) => t + size(w), 0);
                    const gap = (len - total) / (s.length - 1);
                    let pos = a;
                    for (const w of s) { put(w, pos); pos += size(w) + gap; }
                } else {
                    if (s.length < 3) { toast("warn", tr_("Select at least three widgets"), tr_("Or choose the mode By gap or Within margins.")); return; }
                    const total = s.reduce((t, w) => t + size(w), 0);
                    const gap = ((h ? selBox.w : selBox.h) - total) / (s.length - 1);
                    let pos = h ? selBox.x : selBox.y;
                    for (const w of s) { put(w, pos); pos += size(w) + gap; }
                }
                return;
            }
            for (const w of sel) {
                if (how === "L") w.x = box.x; else if (how === "R") w.x = box.x + box.w - w.w; else if (how === "CX") w.x = Math.round(box.x + (box.w - w.w) / 2);
                else if (how === "T") w.y = box.y; else if (how === "B") w.y = box.y + box.h - w.h; else if (how === "CY") w.y = Math.round(box.y + (box.h - w.h) / 2);
            }
        });
    };
    const bounds = (ws) => { const x0 = Math.min(...ws.map((w) => w.x)), y0 = Math.min(...ws.map((w) => w.y)), x1 = Math.max(...ws.map((w) => w.x + w.w)), y1 = Math.max(...ws.map((w) => w.y + w.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

    /* ---------------------------------------------------------- the viewport */
    E.layoutStage = () => {
        E.syncScope();
        const { w, h } = E.canvas();
        const s = E.stageHost.style;
        s.width = `${w * E.zoom}px`; s.height = `${h * E.zoom}px`; s.left = `${E.ox}px`; s.top = `${E.oy}px`;
        s.setProperty("--page-r", `${(E.viewScope() ? 12 : E.ui.page.radius) * E.zoom}px`);
        if (E.adaptivePreview()) viewHost.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform:scale(${E.zoom});transform-origin:0 0`;
        else viewHost.style.cssText = "position:absolute;inset:0";
        E.view.resize();
    };
    // Ctrl+0 fits the width of the page and the height of the window (the rest lies below and is scrolled to); the button "whole page" fits the whole length
    E.fit = (whole) => {
        if (whole !== undefined) E.fitWhole = !!whole;
        const cw = center.clientWidth, ch = center.clientHeight;
        if (!cw || !ch) return;
        const { w, h } = E.canvas();
        const hf = E.viewScope() || E.fitWhole || E.preview ? h : Math.min(h, E.ui.page.h);
        E.zoom = clamp(Math.min((cw - 96) / w, (ch - 96) / hf), 0.1, 2);
        E.ox = (cw - w * E.zoom) / 2; E.oy = h > hf + 1 ? 48 : (ch - h * E.zoom) / 2;
        E.fitted = true;
        E.layoutStage(); E.renderOverlay(); updateTop();
    };
    E.zoomAt = (factor, cx, cy) => {
        const z = clamp(E.zoom * factor, 0.1, 4);
        const f = z / E.zoom;
        if (cx == null) { cx = center.clientWidth / 2; cy = center.clientHeight / 2; }
        E.ox = cx - (cx - E.ox) * f; E.oy = cy - (cy - E.oy) * f; E.zoom = z; E.fitted = false;
        E.layoutStage(); E.renderOverlay(); updateTop();
    };
    center.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = center.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey || true) E.zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    const ro = new ResizeObserver(() => { if (E.fitted) E.fit(); });
    ro.observe(center);

    /* ---------------------------------------------------------- overlay: grid, selection, guides */
    const toPage = (e) => { const r = stageHost.getBoundingClientRect(); return { x: (e.clientX - r.left) / E.zoom, y: (e.clientY - r.top) / E.zoom }; };
    E.renderOverlay = () => {
        ovl.textContent = "";
        ovl.classList.toggle("preview", E.preview);
        // the top panel of the ND UI mode (logo, tabs), as a ghost over the page itself (not inside a spoiler)
        if (E.ghost !== false && !E.viewScope()) {
            const gl = el("div", "nde-ghost");
            gl.style.cssText = `width:${E.canvas().w * E.zoom}px;height:${E.ui.page.h * E.zoom}px`;
            ovl.append(gl);
            drawGhost(gl, E.ui, E.page, E.zoom, tr, E);
        }
        if (E.preview) return;
        const g = E.grid() * E.zoom;
        if (g >= 7) {
            const bg = el("div", "nde-gridbg");
            bg.style.backgroundImage = "radial-gradient(circle, rgba(255,255,255,.28) 1px, transparent 1.3px)";
            bg.style.backgroundSize = `${g}px ${g}px`;
            ovl.append(bg);
        }
        // the line where the window ends (what lies below is reached by scrolling) and the handle of the length of the page
        if (!E.viewScope()) {
            const cv = E.canvas(), H = E.ui.page.h;
            if (cv.h > H + 1) {
                const f = el("div", "nde-fold"); f.style.cssText = `top:${H * E.zoom}px;width:${cv.w * E.zoom}px`;
                f.append(el("span", "", tr_("Window height")));
                ovl.append(f);
            }
            const lh = el("div", "nde-lenh"); lh.dataset.len = "1";
            lh.style.cssText = `left:${cv.w * E.zoom / 2}px;top:${cv.h * E.zoom}px`;
            lh.title = tr_("Drag to set the length of the page. Double-click: by the lowest widget.");
            const auto = pageLength({ ...E.ui, pages: E.ui.pages.map((p) => (p.id === E.page ? { ...p, len: 0 } : p)) }, E.page);
            lh.append(el("span", "tag", E.curPage()?.len > auto ? tr_("Length {n}", { n: Math.round(cv.h) }) : tr_("Length {n} (auto)", { n: Math.round(cv.h) })));
            ovl.append(lh);
        }
        const sel = E.selected();
        for (const w of sel) {
            const b = el("div", `nde-sel${sel.length > 1 ? " multi" : ""}${w.locked ? " locked" : ""}`);
            b.style.cssText = `left:${w.x * E.zoom}px;top:${w.y * E.zoom}px;width:${w.w * E.zoom}px;height:${w.h * E.zoom}px`;
            b.dataset.id = w.id;
            if (sel.length === 1) b.append(el("div", "tag", `${w.props?.label || tr_(defOf(w.type)?.label || w.type)} · ${Math.round(w.w)}×${Math.round(w.h)}`));
            ovl.append(b);
            if (sel.length === 1 && !w.locked) {
                for (const [dir, px, py] of [["nw", 0, 0], ["n", .5, 0], ["ne", 1, 0], ["e", 1, .5], ["se", 1, 1], ["s", .5, 1], ["sw", 0, 1], ["w", 0, .5]].filter(([d]) => !isSpoiler(w) || d === "e" || d === "w" || d === "s")) {
                    const hd = el("div", "nde-h8"); hd.dataset.dir = dir; hd.style.cssText = `left:${px * 100}%;top:${py * 100}%;cursor:${dir === "n" || dir === "s" ? "ns" : dir === "e" || dir === "w" ? "ew" : dir === "nw" || dir === "se" ? "nwse" : "nesw"}-resize`;
                    b.append(hd);
                }
            }
        }
        // the frame of a widget group that has a selected member: a dashed line round all its members with the name of the group
        const gseen = new Set();
        for (const w of sel) {
            if (!w.group || gseen.has(w.group)) continue;
            gseen.add(w.group);
            const g = E.ui.groups.find((x) => x.id === w.group), ms = membersOf(E.ui, w.group);
            if (!g || !ms.length) continue;
            const gb = bounds(ms), f = el("div", `nde-wgrp${E.inGroup === g.id ? " in" : ""}`);
            f.dataset.gid = g.id;
            f.style.cssText = `left:${(gb.x - 4) * E.zoom}px;top:${(gb.y - 4) * E.zoom}px;width:${(gb.w + 8) * E.zoom}px;height:${(gb.h + 8) * E.zoom}px`;
            f.append(el("span", "tag", g.name));
            ovl.append(f);
        }
        // one common transform frame for a group
        const gws = sel.filter((w) => !w.locked);
        if (sel.length > 1 && gws.length > 1) {
            const gb = bounds(gws);
            const gx = el("div", "nde-grp");
            gx.style.cssText = `left:${gb.x * E.zoom}px;top:${gb.y * E.zoom}px;width:${gb.w * E.zoom}px;height:${gb.h * E.zoom}px`;
            gx.append(el("div", "tag", `${gws.length} · ${Math.round(gb.w)}×${Math.round(gb.h)}`));
            for (const [dir, px, py] of [["nw", 0, 0], ["n", .5, 0], ["ne", 1, 0], ["e", 1, .5], ["se", 1, 1], ["s", .5, 1], ["sw", 0, 1], ["w", 0, .5]]) {
                const hd = el("div", "nde-h8"); hd.dataset.dir = dir; hd.dataset.group = "1";
                hd.style.cssText = `left:${px * 100}%;top:${py * 100}%;cursor:${dir === "n" || dir === "s" ? "ns" : dir === "e" || dir === "w" ? "ew" : dir === "nw" || dir === "se" ? "nwse" : "nesw"}-resize`;
                gx.append(hd);
            }
            ovl.append(gx);
        }
        // handles must take the pointer although the box does not
        for (const hd of ovl.querySelectorAll(".nde-h8")) hd.style.pointerEvents = "auto";
    };
    const guideLayer = () => { let g = ovl.querySelector(".nde-guides"); if (!g) { g = el("div", "nde-guides"); g.style.cssText = "position:absolute;inset:0;pointer-events:none"; ovl.append(g); } return g; };
    const drawGuides = (lines) => {
        const g = guideLayer(); g.textContent = "";
        for (const l of lines) {
            const d = el("div", "nde-guide");
            if (l.v) d.style.cssText = `left:${l.at * E.zoom - 0.5}px;top:${l.a * E.zoom}px;width:1px;height:${(l.b - l.a) * E.zoom}px`;
            else d.style.cssText = `top:${l.at * E.zoom - 0.5}px;left:${l.a * E.zoom}px;height:1px;width:${(l.b - l.a) * E.zoom}px`;
            g.append(d);
        }
    };
    const clearGuides = () => ovl.querySelector(".nde-guides")?.remove();

    /* ---------------------------------------------------------- snapping */
    function candidates(ignore) {
        const cv = E.canvas();
        const dh = E.alignBox().h;
        const xs = [{ v: 0 }, { v: cv.w / 2 }, { v: cv.w }], ys = [{ v: 0 }, { v: dh / 2 }, { v: dh }];
        if (cv.h > dh + 1) ys.push({ v: cv.h });
        const rs = E.reserve();
        if (rs.top) ys.push({ v: rs.top }); if (rs.bottom) ys.push({ v: dh - rs.bottom });
        for (const o of E.widgets()) {
            if (ignore.has(o.id) || o.hidden) continue;
            const r = { x: o.x, y: o.y, w: o.w, h: o.h };
            xs.push({ v: o.x, r }, { v: o.x + o.w / 2, r }, { v: o.x + o.w, r });
            ys.push({ v: o.y, r }, { v: o.y + o.h / 2, r }, { v: o.y + o.h, r });
        }
        return { xs, ys };
    }
    // the shift of `vals` (edges of the moving rect) to the nearest candidate line, or to the grid
    function snap1(vals, cands, thr, grid, useGrid) {
        let best = null;
        for (const v of vals) for (const c of cands) { const d = c.v - v; if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d }; }
        if (best) return best.d;
        if (useGrid && grid > 0 && vals.length) { const v = vals[0]; return Math.round(v / grid) * grid - v; }
        return 0;
    }
    function guidesFor(rect, cands) {
        const out = [], eps = 0.6;
        for (const v of [rect.x, rect.x + rect.w / 2, rect.x + rect.w]) for (const c of cands.xs) if (Math.abs(c.v - v) < eps) out.push({ v: true, at: c.v, a: Math.min(rect.y, c.r ? c.r.y : rect.y), b: Math.max(rect.y + rect.h, c.r ? c.r.y + c.r.h : rect.y + rect.h) });
        for (const v of [rect.y, rect.y + rect.h / 2, rect.y + rect.h]) for (const c of cands.ys) if (Math.abs(c.v - v) < eps) out.push({ v: false, at: c.v, a: Math.min(rect.x, c.r ? c.r.x : rect.x), b: Math.max(rect.x + rect.w, c.r ? c.r.x + c.r.w : rect.x + rect.w) });
        return out;
    }

    /* ---------------------------------------------------------- pointer: select, move, resize, marquee, pan */
    const hit = (p) => {
        const list = E.widgets().filter((w) => !w.locked).sort((a, b) => b.z - a.z);
        return list.find((w) => p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) || null;
    };
    const inField = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

    // one handler for the whole canvas (also the empty area around the page): a handle resizes, a widget moves, an empty place draws a frame.
    // The canvas is moved only by the middle button or Space + the left button.
    // (the widgets under the overlay are not reached in the editor: only the overlay, its handles and the empty canvas)
    const onCanvas = (e) => e.target === center || stageHost === e.target || ovl.contains(e.target);
    center.addEventListener("pointerdown", (e) => {
        if (!onCanvas(e)) return;
        if (e.button === 1 || (e.button === 0 && E.space)) return startPan(e);
        if (E.preview || e.button !== 0) return;
        if (e.target?.dataset?.len) {
            // a double click (the pointer is captured while it is held, so the dblclick event would not reach the handle): by the lowest widget again
            const now = performance.now(), dbl = now - (E.lenAt || 0) < 450;
            E.lenAt = now;
            if (dbl) { E.change(null, (u) => { const pg = u.pages.find((x) => x.id === E.page); if (pg) pg.len = 0; }); return; }
            return startLen(e);
        }
        const dir = e.target?.dataset?.dir;
        const p = toPage(e);
        if (dir) return e.target.dataset.group ? startGroupResize(e, dir) : startResize(e, dir);
        const w = hit(p);
        if (w) {
            if (E.inGroup && w.group !== E.inGroup) E.inGroup = null;
            const ids = e.altKey ? [w.id] : E.groupIds(w);   // a click on a widget of a group takes the whole group (Alt: just this one; a double click: go inside)
            if (e.shiftKey) E.select(ids, true);
            else if (!E.sel.has(w.id)) E.select(ids);
            startMove(e, p);
        } else { E.inGroup = null; startMarquee(e, p); }
    });

    center.addEventListener("dblclick", (e) => {
        if (E.preview || !onCanvas(e)) return;
        const w = hit(toPage(e));
        if (w && isSpoiler(w)) E.enter(w.id);
        else if (w && w.group) { E.inGroup = w.group; E.select([w.id]); }   // inside a group: its widgets are taken one by one
    });
    // into a spoiler (the page of its own) and back
    E.enter = (id) => {
        const s = byId(E.ui, id);
        if (!s || !isSpoiler(s) || s.page !== E.page) return;
        E.scope = id; E.grow = 0; E.sel.clear();
        E.syncScope(); E.fit(); E.refreshAll();
    };
    E.leave = () => {
        const s = E.scope && byId(E.ui, E.scope);
        E.scope = s?.parent || null; E.grow = 0; E.sel.clear();
        if (s) E.sel.add(s.id);
        E.syncScope(); E.fit(); E.refreshAll();
    };

    function startMove(e, p0) {
        const ids = new Set(E.sel);
        const sel = E.selected().filter((w) => !w.locked);
        if (!sel.length) return;
        if (!e.ctrlKey && !e.metaKey) for (const w of [...sel]) if (isPanelLike(w)) for (const c of insidePanel(E.ui, w)) if (!ids.has(c.id) && !c.locked) { ids.add(c.id); sel.push(c); }
        const start = sel.map((w) => ({ w, x: w.x, y: w.y }));
        const box = bounds(sel);
        const cands = candidates(ids);
        let moved = false;
        const sx = e.clientX, sy = e.clientY;
        ovl.setPointerCapture(e.pointerId);
        const mv = (ev) => {
            let dx = (ev.clientX - sx) / E.zoom, dy = (ev.clientY - sy) / E.zoom;
            if (!moved && Math.hypot(dx, dy) * E.zoom < 3) return;
            if (!moved) { moved = true; E.hist.push(E.ui); E.lastKey = ""; }
            if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
            const r = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
            if (!ev.altKey) {
                const thr = SNAP_PX / E.zoom;
                dx += snap1([r.x, r.x + r.w / 2, r.x + r.w], cands.xs, thr, E.grid(), E.ui.view.snap);
                dy += snap1([r.y, r.y + r.h / 2, r.y + r.h], cands.ys, thr, E.grid(), E.ui.view.snap);
            }
            for (const s of start) { s.w.x = Math.round(s.x + dx); s.w.y = Math.round(s.y + dy); }
            for (const s of start) { const f = E.view.frameOf(s.w.id); if (f) E.view.placeFrame(f); }
            if (E.scope) { const need = box.y + dy + box.h + 80; if (need > E.canvas().h) { E.grow = Math.ceil(need + 80); E.layoutStage(); } }
            renderSelBoxes();
            drawGuides(ev.altKey ? [] : guidesFor({ x: box.x + dx, y: box.y + dy, w: box.w, h: box.h }, cands));
            E.syncPosition?.();
        };
        const up = (ev) => {
            ovl.removeEventListener("pointermove", mv); ovl.removeEventListener("pointerup", up); ovl.removeEventListener("pointercancel", up);
            try { ovl.releasePointerCapture(ev.pointerId); } catch {}
            clearGuides();
            E.grow = 0;
            if (moved) { E.dirty = true; E.afterChange({ left: false, inspector: false }); E.syncPosition?.(); }
            else if (!ev.shiftKey && E.sel.size > 1) { const w = hit(toPage(ev)); if (w) E.select(ev.altKey ? [w.id] : E.groupIds(w)); }
        };
        ovl.addEventListener("pointermove", mv); ovl.addEventListener("pointerup", up); ovl.addEventListener("pointercancel", up);
    }
    function renderSelBoxes() {
        for (const b of ovl.querySelectorAll(".nde-sel")) {
            const w = byId(E.ui, b.dataset.id);
            if (w) { b.style.left = `${w.x * E.zoom}px`; b.style.top = `${w.y * E.zoom}px`; b.style.width = `${w.w * E.zoom}px`; b.style.height = `${w.h * E.zoom}px`; const t = b.querySelector(".tag"); if (t) t.textContent = `${w.props?.label || tr_(defOf(w.type)?.label || w.type)} · ${Math.round(w.w)}×${Math.round(w.h)}`; }
        }
    }
    function startGroupResize(e, dir) {
        const ws = E.selected().filter((w) => !w.locked);
        if (ws.length < 2) return;
        e.preventDefault();
        const B = bounds(ws);
        const st = ws.map((w) => ({ w, x: w.x, y: w.y, W: w.w, H: w.h, sp: isSpoiler(w), d: defOf(w.type) }));
        let kxMin = 0, kyMin = 0, kxMax = Infinity, kyMax = Infinity;
        for (const t of st) {
            kxMin = Math.max(kxMin, (t.d?.size?.minW ?? 16) / t.W);
            if (!t.sp) { kyMin = Math.max(kyMin, (t.d?.size?.minH ?? 16) / t.H); if (t.d?.size?.maxH) kyMax = Math.min(kyMax, t.d.size.maxH / t.H); }
        }
        const cands = candidates(new Set(ws.map((w) => w.id)));
        const sx = e.clientX, sy = e.clientY;
        let moved = false;
        ovl.setPointerCapture(e.pointerId);
        const mv = (ev) => {
            if (!moved) { moved = true; E.hist.push(E.ui); E.lastKey = ""; }
            const dx = (ev.clientX - sx) / E.zoom, dy = (ev.clientY - sy) / E.zoom;
            let x0 = B.x, y0 = B.y, x1 = B.x + B.w, y1 = B.y + B.h;
            const thr = SNAP_PX / E.zoom, useGrid = E.ui.view.snap && !ev.altKey, grid = E.grid();
            const sn = (v, cs) => (ev.altKey ? v : v + snap1([v], cs, thr, grid, useGrid));
            if (dir.includes("w")) x0 = sn(x0 + dx, cands.xs); if (dir.includes("e")) x1 = sn(x1 + dx, cands.xs);
            if (dir.includes("n")) y0 = sn(y0 + dy, cands.ys); if (dir.includes("s")) y1 = sn(y1 + dy, cands.ys);
            const hx = dir.includes("w") || dir.includes("e"), hy = dir.includes("n") || dir.includes("s");
            let kx = hx ? (x1 - x0) / B.w : 1, ky = hy ? (y1 - y0) / B.h : 1;
            if (ev.shiftKey && hx && hy) { const k = Math.abs(kx - 1) > Math.abs(ky - 1) ? kx : ky; kx = ky = k; }
            kx = Math.min(kxMax, Math.max(kxMin, kx)); ky = Math.min(kyMax, Math.max(kyMin, ky));
            const ax = dir.includes("w") ? B.x + B.w : B.x, ay = dir.includes("n") ? B.y + B.h : B.y;
            for (const t of st) {
                t.w.x = Math.round(ax + (t.x - ax) * kx); t.w.w = Math.max(1, Math.round(t.W * kx));
                t.w.y = Math.round(ay + (t.y - ay) * ky);
                if (!t.sp) t.w.h = Math.max(1, Math.round(t.H * ky));
            }
            for (const t of st) { const f = E.view.frameOf(t.w.id); if (f) E.view.placeFrame(f); }
            renderSelBoxes();
            const gb = bounds(ws);
            const g = ovl.querySelector(".nde-grp");
            if (g) { g.style.left = `${gb.x * E.zoom}px`; g.style.top = `${gb.y * E.zoom}px`; g.style.width = `${gb.w * E.zoom}px`; g.style.height = `${gb.h * E.zoom}px`; const tg = g.querySelector(".tag"); if (tg) tg.textContent = `${ws.length} · ${Math.round(gb.w)}×${Math.round(gb.h)}`; }
            drawGuides(ev.altKey ? [] : guidesFor(gb, cands));
            E.syncPosition?.();
        };
        const up = (ev) => {
            ovl.removeEventListener("pointermove", mv); ovl.removeEventListener("pointerup", up); ovl.removeEventListener("pointercancel", up);
            try { ovl.releasePointerCapture(ev.pointerId); } catch {}
            clearGuides();
            if (moved) { syncSpoilerHeights(E.ui); E.dirty = true; E.afterChange({ left: false, inspector: false }); E.syncPosition?.(); }
        };
        ovl.addEventListener("pointermove", mv); ovl.addEventListener("pointerup", up); ovl.addEventListener("pointercancel", up);
    }
    function startResize(e, dir) {
        const w = E.selected()[0];
        if (!w || w.locked) return;
        e.preventDefault();
        const def = defOf(w.type);
        const minW = def?.size?.minW ?? 16, minH = def?.size?.minH ?? 16, maxH = def?.size?.maxH ?? Infinity;
        const r0 = { x: w.x, y: w.y, w: w.w, h: w.h };
        const cands = candidates(new Set([w.id]));
        const sx = e.clientX, sy = e.clientY;
        let moved = false;
        ovl.setPointerCapture(e.pointerId);
        const mv = (ev) => {
            if (!moved) { moved = true; E.hist.push(E.ui); E.lastKey = ""; }
            let dx = (ev.clientX - sx) / E.zoom, dy = (ev.clientY - sy) / E.zoom;
            // the bottom edge of a spoiler drags the height of its header
            if (isSpoiler(w) && dir === "s") {
                const hh = Math.max(HEAD_MIN, Math.min(HEAD_MAX, Math.round(r0.h + dy)));
                w.props = w.props || {}; w.props.head_h = hh; w.h = hh;
                E.view.relayout(); renderSelBoxes(); E.syncPosition?.();
                return;
            }
            let x0 = r0.x, y0 = r0.y, x1 = r0.x + r0.w, y1 = r0.y + r0.h;
            const thr = SNAP_PX / E.zoom, useGrid = E.ui.view.snap && !ev.altKey, grid = E.grid();
            const sn = (v, cs) => (ev.altKey ? v : v + snap1([v], cs, thr, grid, useGrid));
            if (dir.includes("w")) x0 = sn(x0 + dx, cands.xs); if (dir.includes("e")) x1 = sn(x1 + dx, cands.xs);
            if (dir.includes("n")) y0 = sn(y0 + dy, cands.ys); if (dir.includes("s")) y1 = sn(y1 + dy, cands.ys);
            if (ev.shiftKey && dir.length === 2) { const ar = r0.w / r0.h; const nw = x1 - x0, nh = y1 - y0; if (nw / nh > ar) { const h2 = nw / ar; if (dir.includes("n")) y0 = y1 - h2; else y1 = y0 + h2; } else { const w2 = nh * ar; if (dir.includes("w")) x0 = x1 - w2; else x1 = x0 + w2; } }
            if (x1 - x0 < minW) { if (dir.includes("w")) x0 = x1 - minW; else x1 = x0 + minW; }
            if (y1 - y0 < minH) { if (dir.includes("n")) y0 = y1 - minH; else y1 = y0 + minH; }
            if (y1 - y0 > maxH) { if (dir.includes("n")) y0 = y1 - maxH; else y1 = y0 + maxH; }
            w.x = Math.round(x0); w.y = Math.round(y0); w.w = Math.round(x1 - x0); w.h = Math.round(y1 - y0);
            const f = E.view.frameOf(w.id); if (f) { E.view.placeFrame(f); }
            renderSelBoxes();
            drawGuides(ev.altKey ? [] : guidesFor({ x: w.x, y: w.y, w: w.w, h: w.h }, cands));
            E.syncPosition?.();
        };
        const up = (ev) => {
            ovl.removeEventListener("pointermove", mv); ovl.removeEventListener("pointerup", up); ovl.removeEventListener("pointercancel", up);
            try { ovl.releasePointerCapture(ev.pointerId); } catch {}
            clearGuides();
            if (moved) { E.dirty = true; E.afterChange({ left: false, inspector: false }); E.syncPosition?.(); if (isSpoiler(w) && dir === "s") E.renderInspector(); }
        };
        ovl.addEventListener("pointermove", mv); ovl.addEventListener("pointerup", up); ovl.addEventListener("pointercancel", up);
    }
    // the handle under the page: the length of the page (never shorter than its content)
    function startLen(e) {
        e.preventDefault();
        const pgm = E.curPage();
        if (!pgm) return;
        const auto = pageLength({ ...E.ui, pages: E.ui.pages.map((p) => (p.id === E.page ? { ...p, len: 0 } : p)) }, E.page);
        const L0 = E.pageLen(), sy = e.clientY;
        let moved = false;
        ovl.setPointerCapture(e.pointerId);
        const mv = (ev) => {
            if (!moved) { moved = true; E.hist.push(E.ui); E.lastKey = ""; }
            let v = L0 + (ev.clientY - sy) / E.zoom;
            if (!ev.altKey && E.grid() > 0) v = Math.round(v / E.grid()) * E.grid();
            v = Math.round(Math.min(LEN_MAX, v));
            pgm.len = v > auto ? v : 0;
            E.layoutStage(); E.renderOverlay();
        };
        const up = (ev) => {
            ovl.removeEventListener("pointermove", mv); ovl.removeEventListener("pointerup", up); ovl.removeEventListener("pointercancel", up);
            try { ovl.releasePointerCapture(ev.pointerId); } catch {}
            if (moved) { E.dirty = true; E.afterChange({ left: false }); }
        };
        ovl.addEventListener("pointermove", mv); ovl.addEventListener("pointerup", up); ovl.addEventListener("pointercancel", up);
    }
    function startMarquee(e, p0) {
        const additive = e.shiftKey;
        if (!additive) { E.sel.clear(); E.renderOverlay(); E.renderInspector(); E.renderLeft(); }
        const base = new Set(E.sel);
        const m = el("div", "nde-marq"); ovl.append(m);
        const sx = e.clientX, sy = e.clientY;
        ovl.setPointerCapture(e.pointerId);
        const mv = (ev) => {
            const p = toPage(ev);
            const x0 = Math.min(p0.x, p.x), y0 = Math.min(p0.y, p.y), x1 = Math.max(p0.x, p.x), y1 = Math.max(p0.y, p.y);
            m.style.cssText = `left:${x0 * E.zoom}px;top:${y0 * E.zoom}px;width:${(x1 - x0) * E.zoom}px;height:${(y1 - y0) * E.zoom}px`;
            const ids = new Set(base);
            for (const w of E.widgets()) if (w.x < x1 && w.x + w.w > x0 && w.y < y1 && w.y + w.h > y0 && !(isPanelLike(w) && (x1 - x0) * (y1 - y0) < w.w * w.h * 0.9 && !(x0 <= w.x && y0 <= w.y && x1 >= w.x + w.w && y1 >= w.y + w.h))) ids.add(w.id);
            if (!E.inGroup) for (const id of [...ids]) { const g = byId(E.ui, id)?.group; if (g) for (const m of membersOf(E.ui, g)) ids.add(m.id); }   // a group is taken whole
            E.sel = ids;
            for (const b of [...ovl.querySelectorAll(".nde-sel")]) b.remove();
            for (const id of ids) { const w = byId(E.ui, id); if (!w) continue; const b = el("div", "nde-sel multi"); b.dataset.id = id; b.style.cssText = `left:${w.x * E.zoom}px;top:${w.y * E.zoom}px;width:${w.w * E.zoom}px;height:${w.h * E.zoom}px`; ovl.insertBefore(b, m); }
        };
        const up = (ev) => {
            ovl.removeEventListener("pointermove", mv); ovl.removeEventListener("pointerup", up); ovl.removeEventListener("pointercancel", up);
            try { ovl.releasePointerCapture(ev.pointerId); } catch {}
            m.remove();
            E.renderOverlay(); E.renderInspector(); E.renderLeft(); updateTop();
        };
        ovl.addEventListener("pointermove", mv); ovl.addEventListener("pointerup", up); ovl.addEventListener("pointercancel", up);
    }

    // pan: the middle button, or the left button with Space held
    function startPan(e) {
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, ox = E.ox, oy = E.oy;
        center.classList.add("pan");
        center.setPointerCapture(e.pointerId);
        const mv = (ev) => { E.ox = ox + ev.clientX - sx; E.oy = oy + ev.clientY - sy; E.fitted = false; E.layoutStage(); E.renderOverlay(); };
        const up = (ev) => { center.classList.remove("pan"); center.removeEventListener("pointermove", mv); center.removeEventListener("pointerup", up); center.removeEventListener("pointercancel", up); try { center.releasePointerCapture(ev.pointerId); } catch {} };
        center.addEventListener("pointermove", mv); center.addEventListener("pointerup", up); center.addEventListener("pointercancel", up);
    }

    // dropping a widget from the library
    center.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("application/x-nd-widget") || e.dataTransfer?.types?.includes("application/x-nd-param")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    center.addEventListener("drop", (e) => {
        const p = toPage(e);
        const par = e.dataTransfer?.getData("application/x-nd-param");
        if (par) {
            e.preventDefault();
            try {
                const { src, name } = JSON.parse(par);
                const entry = E.ui.sources.find((s) => s.uid === src), node = entry && findSource(entry);
                const prm = node && listParams(node).find((x) => x.name === name);
                const type = prm && defaultWidgetFor(prm), d = type && defOf(type);
                if (d) E.createFromParam(entry, prm, { x: Math.round(p.x - d.size.w / 2), y: Math.round(p.y - d.size.h / 2) });
            } catch {}
            return;
        }
        const type = e.dataTransfer?.getData("application/x-nd-widget");
        if (!type) return;
        e.preventDefault();
        const def = defOf(type);
        const pr = def?.presets?.find((x) => x.id === e.dataTransfer?.getData("application/x-nd-preset"));
        if (def) E.addWidget(type, { at: { x: Math.round(p.x - def.size.w / 2), y: Math.round(p.y - def.size.h / 2) }, ...(pr ? { label: pr.label, props: pr.props } : {}) });
    });

    /* ---------------------------------------------------------- keyboard */
    const onKey = (e) => {
        if (E.closed || E.stopPick) return;   // while picking on the canvas / the top bar the pick owns the keys
        if (e.type === "keyup") { if (e.key === " ") { E.space = false; center.style.cursor = ""; } return; }
        if (inField(e.target)) { if (e.key === "Escape") e.target.blur(); return; }
        if (E.tbSel && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); e.stopPropagation(); E.tbRemove(E.tbSel); return; }
        const mod = e.ctrlKey || e.metaKey;
        if (e.key === " ") { E.space = true; center.style.cursor = "grab"; e.preventDefault(); return; }
        if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); }
        else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); E.redo(); }
        else if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); E.copy(); }
        else if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); E.paste(); }
        else if (mod && e.key.toLowerCase() === "g") { e.preventDefault(); e.shiftKey ? E.ungroup([...E.sel]) : E.group([...E.sel]); }
        else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); E.duplicate([...E.sel]); }
        else if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); E.select(E.widgets().filter((w) => !w.locked).map((w) => w.id)); }
        else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
        else if (e.key === "Delete" || e.key === "Backspace") { if (E.sel.size) { e.preventDefault(); E.remove([...E.sel]); } }
        else if (e.key.startsWith("Arrow") && E.sel.size) {
            e.preventDefault();
            const d = e.shiftKey ? 10 : 1;
            const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
            E.change("nudge", () => { for (const w of E.selected()) if (!w.locked) { w.x += dx; w.y += dy; } }, { light: true });
        }
        else if (e.key === "Escape") { if (E.sel.size) E.select([]); else if (E.scope && !E.preview) E.leave(); else tryClose(); }
        else if (e.key === "0" && mod) { e.preventDefault(); E.fit(false); }
        e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);

    /* ---------------------------------------------------------- top bar */
    const tr_ = tr;
    const brand = el("div", "nde-brand"); brand.append(el("i"), el("span", "", tr_("ND UI Editor")));
    const pages = el("div", "nde-pages");
    const sp = el("div", "nde-sp");
    const bUndo = iconBtn("undo", tr_("Undo (Ctrl+Z)"), () => E.undo());
    const bRedo = iconBtn("redo", tr_("Redo (Ctrl+Shift+Z)"), () => E.redo());
    const bSnap = iconBtn("grid", tr_("Snap to the grid. Alt while dragging turns it off for a moment."), () => { E.change("snap", (ui) => { ui.view.snap = !ui.view.snap; }, { light: false }); });
    const bGhost = iconBtn("alignT", tr_("Show the top panel (logo and tabs) as it will be in the ND UI mode, and keep clear of it"), () => { E.ghost = E.ghost === false; E.renderOverlay(); updateTop(); });
    const bPrev = btn(tr_("Preview"), "play", () => setPreview(!E.preview), "sm", tr_("Try the page as it will work: the widgets answer to the mouse and change the real parameters."));
    const zoomBox = el("div", "nde-zoom");
    const zOut = iconBtn("minus", tr_("Zoom out"), () => E.zoomAt(1 / 1.2));
    const zVal = el("span", "", "100%"); const zIn = iconBtn("plus", tr_("Zoom in"), () => E.zoomAt(1.2));
    const zFit = iconBtn("fit", tr_("Fit the page (Ctrl+0)"), () => E.fit(false));
    const zAll = iconBtn("expand", tr_("Fit the whole length of the page"), () => E.fit(true));
    zVal.title = tr_("Zoom: the wheel. Move the canvas: the middle button, or Space and the left button.");
    zoomBox.append(zOut, zVal, zIn, zFit, zAll);
    const bCancel = btn(tr_("Cancel"), "x", () => tryClose(), "", tr_("Close the editor and throw the changes away"));
    const bSave = btn(tr_("Save"), "check", () => save(), "primary", tr_("Write the changes to the node (Ctrl+S)"));
    // the width of the window to try the page in (only in the preview of a page that adapts to the width)
    const pvw = el("select", "nde-pvw"); pvw.title = tr_("The width of the window to try the page in"); pvw.style.display = "none";
    for (const [v, l] of [["1", tr_("Page width")], ["1.25", "1.25 ×"], ["1.5", "1.5 ×"], ["2", "2 ×"], ["win", tr_("This window")]]) { const o = el("option", "", l); o.value = v; pvw.append(o); }
    pvw.addEventListener("change", () => { E.pvw = pvw.value; E.view.fit = "adaptive"; E.fit(); });
    top.append(brand, pages, sp, bUndo, bRedo, bSnap, bGhost, bPrev, pvw, zoomBox, bCancel, bSave);

    function setPreview(on) {
        E.preview = on;
        E.syncScope();
        E.view.fit = on && E.ui.view.fit === "adaptive" ? "adaptive" : "proportions";
        E.view.setMode(on ? "run" : "edit");
        pvw.style.display = E.adaptivePreview() ? "" : "none";
        bPrev.classList.toggle("on", on);
        E.sel.clear();
        E.fit(); E.renderOverlay(); E.renderInspector(); E.renderLeft(); updateTop();
    }
    // breadcrumbs: Main > Settings > Advanced, and the way back
    const crumbs = el("div", "nde-crumbs");
    center.append(crumbs);
    crumbs.addEventListener("pointerdown", (e) => e.stopPropagation());
    crumbs.addEventListener("wheel", (e) => e.stopPropagation());
    const go = (id) => { E.scope = id; E.grow = 0; E.sel.clear(); E.syncScope(); E.fit(); E.refreshAll(); };
    function updateCrumbs() {
        crumbs.textContent = "";
        const chain = E.scopeChain();
        crumbs.style.display = chain.length && !E.preview ? "" : "none";
        if (!chain.length || E.preview) return;
        crumbs.append(btn(tr_("Back"), "chevL", () => E.leave(), "sm", tr_("Back to the level above (Esc)")));
        const pg = E.curPage();
        const part = (label, id, last) => {
            const b = el("button", `crumb${last ? " last" : ""}`, label); b.type = "button";
            if (!last) b.addEventListener("click", () => go(id));
            crumbs.append(el("i", "", "›"), b);
        };
        crumbs.append(el("button", "crumb", pg.name));
        crumbs.lastChild.type = "button";
        crumbs.lastChild.addEventListener("click", () => go(null));
        chain.forEach((s, i) => part(s.props?.title || tr_("Spoiler"), s.id, i === chain.length - 1));
    }
    function updateTop() {
        pages.textContent = "";
        for (const p of E.ui.pages) {
            const b = el("button", `pg${p.id === E.page ? " on" : ""}`, p.name); b.type = "button";
            b.addEventListener("click", () => E.setPage(p.id));
            pages.append(b);
        }
        const add = iconBtn("plus", tr_("Add a page"), () => {
            const id = uid("p");
            E.change(null, (ui) => { ui.pages.push({ id, name: `Page ${ui.pages.length + 1}`, kind: "page", control: { nodes: [], groups: [], how: "mute", bindIndex: null } }); }, { inspector: false });
            E.setPage(id);
        });
        pages.append(add);
        updateCrumbs();
        bUndo.disabled = !E.hist.canUndo; bRedo.disabled = !E.hist.canRedo;
        bSnap.classList.toggle("on", !!E.ui.view.snap);
        bGhost.classList.toggle("on", E.ghost !== false);
        zVal.textContent = `${Math.round(E.zoom * 100)}%`;
    }

    /* ---------------------------------------------------------- left and right */
    const leftBody = left, rightBody = right;
    E.renderLeft = () => renderLeft(E, leftBody);
    E.renderInspector = () => renderInspector(E, rightBody);

    /* ---------------------------------------------------------- save and close */
    function save() {
        onSave?.(normalizeNdUi(E.ui));
        close();
    }
    function close() {
        if (E.closed) return;
        E.closed = true;
        window.removeEventListener("resize", applyW);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("keyup", onKey, true);
        ro.disconnect();
        E.stopPick?.();
        E.view.destroy();
        root.remove();
        onClose?.();
    }
    function tryClose() {
        if (!E.dirty) return close();
        const c = el("div", "nde-confirm");
        const box = el("div");
        box.append(el("b", "", tr_("Throw the changes away?")), el("span", "", tr_("The panel stays as it was when you opened the editor.")));
        const acts = el("div", "acts");
        acts.append(btn(tr_("Keep editing"), null, () => c.remove(), ""), btn(tr_("Throw away"), "trash", () => close(), "danger"), btn(tr_("Save"), "check", () => save(), "primary"));
        box.append(acts); c.append(box); root.append(c);
    }
    E.close = close;

    E.fit();
    E.refreshAll();
    root.focus();
    return E;
}
