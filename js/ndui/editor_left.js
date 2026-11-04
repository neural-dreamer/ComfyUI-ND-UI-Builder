// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the left column: Link (sources and their parameters), Widgets (the library), Layout (layers and alignment).
import { el, icon } from "./widgets/util.js";
import { btn, iconBtn, textInput, numberInput, selectInput, row } from "./controls.js";
import { WIDGET_LIST, GROUPS } from "./widgets/index.js";
import { virtualParams } from "./virtual.js";
import { addSource, findSource, listParams, taggedNodes, selectedNodes, pickOnCanvas, invalidateSources, nodeScreenRect, paramInfo, defaultWidgetFor, readParam, tagOf } from "./sources.js";
import { app } from "../../../scripts/app.js";
import { levelOf, isSpoiler } from "./model.js";

const TABS = [["link", "link", "Link"], ["widgets", "sliders", "Widgets"], ["layout", "layers", "Layout"]];

const shortVal = (v) => {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "on" : "off";
    if (typeof v === "number") return String(+v.toFixed(4));
    return String(v).replace(/\s+/g, " ").slice(0, 40);
};

export function renderLeft(E, host) {
    E.pickNode = E.pickNode || ((cb) => startPick(E, { single: true, onNode: cb }));
    const { tr } = E;
    const prev = host.querySelector(".nde-scroll")?.scrollTop || 0;
    host.textContent = "";
    const tabs = el("div", "nde-tabs");
    for (const [id, ic, label] of TABS) {
        const b = el("button", E.tab === id ? "on" : ""); b.type = "button";
        b.append(icon(ic, 16), el("span", "", tr(label)));
        b.addEventListener("click", () => E.setTab(id));
        tabs.append(b);
    }
    const body = el("div", "nde-scroll");
    host.append(tabs, body);
    if (E.tab === "link") linkTab(E, body);
    else if (E.tab === "widgets") widgetsTab(E, body);
    else layoutTab(E, body);
    body.scrollTop = prev;
}

/* ------------------------------------------------------------------ Link */

function usedBy(E, entry, name) {
    for (const w of E.ui.widgets) for (const b of Object.values(w.slots)) if (b.src === entry.uid && b.name === name) return true;
    return false;
}

function linkTab(E, body) {
    const { tr } = E;
    const tools = el("div", "nde-tools");
    tools.append(
        btn(tr("Pick on canvas"), "crosshair", () => startPick(E), "", tr("Click nodes (or their parameters) on the canvas to link them. Esc finishes.")),
        btn(tr("Add selected"), "plus", () => addSelected(E), "", tr("Link the nodes that are selected on the canvas")),
    );
    body.append(tools);

    const found = taggedNodes(E.ui);
    if (found.length) {
        const card = el("div", "nde-card");
        const h = el("div", "nde-card-h");
        const t = el("div", "nde-card-t"); t.append(el("b", "", tr("Nodes with a [tag] in the title")), el("small", "", tr("Not linked to the panel yet")));
        h.append(t, btn(tr("Add all"), "plus", () => { E.change(null, (ui) => { for (const n of found) addSource(ui, n); }); }, ""));
        h.style.cursor = "default";
        card.append(h);
        const b = el("div", "nde-card-b");
        for (const n of found) {
            const r = el("div", "nde-param");
            r.append(el("span", "nde-pn", n.title || n.type), el("span", "nde-pv", `[${tagOf(n.title)}]`), iconBtn("plus", tr("Link this node"), () => E.change(null, (ui) => addSource(ui, n))));
            b.append(r);
        }
        card.append(b);
        body.append(card);
    }

    if (!E.ui.sources.length && !found.length) {
        body.append(el("div", "nde-note", tr("The panel controls parameters of other nodes. Put a [tag] in a node title, e.g. «Empty Latent [size]», or use «Pick on canvas». The nodes stay where they are.")));
    }

    for (const entry of E.ui.sources) body.append(sourceCard(E, entry));
}

function sourceCard(E, entry) {
    const { tr } = E;
    const node = findSource(entry);
    const open = E.openSrc.has(entry.uid);
    const card = el("div", `nde-card${node ? "" : " lost"}`);
    const h = el("div", "nde-card-h");
    const dot = el("span", `nde-dot${node ? "" : " lost"}`);
    const t = el("div", "nde-card-t");
    const title = node ? (node.title || node.type) : (entry.title || entry.class);
    t.append(el("b", "", title), el("small", "", node ? (entry.tag ? `[${entry.tag}] · ${entry.class}` : entry.class) : tr("Node not found. Restore the tag or pick it again.")));
    h.append(dot, t);
    if (node) h.append(iconBtn("crosshair", tr("Show the node on the canvas"), () => locate(node)));
    else h.append(iconBtn("crosshair", tr("Pick the node on the canvas"), () => E.pickNode((n) => {
        if (!n) return;
        n.properties = n.properties || {};
        n.properties.nd_ui_src = { uid: entry.uid, tag: entry.tag || tagOf(n.title) };
        invalidateSources();
        E.change(null, (ui) => { const s = ui.sources.find((x) => x.uid === entry.uid); if (s) { s.class = n.comfyClass || n.type || s.class; s.title = n.title || s.title; } });
    })));
    const used = E.ui.widgets.some((w) => Object.values(w.slots).some((b) => b.src === entry.uid));
    h.append(iconBtn("trash", used ? tr("Unlink (the widgets bound to it will be left without a source)") : tr("Unlink the node"), () => { E.openSrc.delete(entry.uid); E.change(null, (ui) => { ui.sources = ui.sources.filter((s) => s.uid !== entry.uid); }); }));
    h.append(icon(open ? "chevU" : "chevD", 14));
    h.addEventListener("click", () => { if (open) E.openSrc.delete(entry.uid); else E.openSrc.add(entry.uid); E.renderLeft(); });
    card.append(h);
    if (open && node) {
        const b = el("div", "nde-card-b");
        const ps = listParams(node).filter((p) => !p.control);
        const q = E.paramQ.trim().toLowerCase();
        if (ps.length > 8 || q) {
            const s = textInput({ value: E.paramQ, placeholder: tr("Find a parameter"), onInput: (v) => { E.paramQ = v; filterRows(b, v); } });
            s.style.margin = "2px 2px 6px";
            b.append(s);
        }
        if (!ps.length) b.append(el("div", "nde-empty", tr("This node has no parameters to control.")));
        for (const p of ps) {
            const r = el("div", `nde-param${usedBy(E, entry, p.name) ? " used" : ""}`);
            r.dataset.q = `${p.label} ${p.name}`.toLowerCase();
            const val = el("span", "nde-pv", p.ptype === "OTHER" ? "" : shortVal(readParam(p)));
            r.append(el("span", `nde-ty ${p.ptype}`, p.ptype === "OTHER" ? "—" : p.ptype.slice(0, 5)), el("span", "nde-pn", p.label), val);
            const type = p.ptype === "OTHER" ? null : defaultWidgetFor(p);
            if (type) {
                r.append(iconBtn("plus", tr("Create a widget for this parameter"), () => E.createFromParam(entry, p)));
                r.draggable = true;
                r.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-nd-param", JSON.stringify({ src: entry.uid, name: p.name })); e.dataTransfer.effectAllowed = "copy"; });
            } else r.title = tr("This kind of parameter cannot be shown yet");
            if (q && !r.dataset.q.includes(q)) r.style.display = "none";
            b.append(r);
        }
        card.append(b);
    }
    return card;
}

function filterRows(box, q) {
    q = q.trim().toLowerCase();
    for (const r of box.querySelectorAll(".nde-param")) r.style.display = !q || r.dataset.q.includes(q) ? "" : "none";
}

function locate(node) {
    try {
        const c = app.canvas;
        c.centerOnNode?.(node);
        c.selectNode?.(node);
        app.graph.setDirtyCanvas(true, true);
    } catch {}
}

function addSelected(E) {
    const ns = selectedNodes();
    if (!ns.length) { toast(E, E.tr("No nodes are selected on the canvas. Use «Pick on canvas» instead.")); return; }
    E.change(null, (ui) => { for (const n of ns) addSource(ui, n); });
}

function toast(E, text) {
    const t = el("div", "nde-hint"); t.style.top = "auto"; t.style.bottom = "24px"; t.append(el("span", "", text));
    E.root.append(t); setTimeout(() => t.remove(), 3600);
}

// the editor hides itself, the person clicks nodes (or their parameters) on the canvas, Esc / Done brings the editor back
function startPick(E, opts = {}) {
    const { tr } = E;
    if (E.stopPick) return;
    E.root.style.display = "none";
    const bar = el("div", "nde-hint");
    // below the top bar of ComfyUI, not over it
    const tb = document.querySelector("[data-testid=action-bar-card], .actionbar-container")?.getBoundingClientRect();
    bar.style.top = `${Math.max(84, Math.round((tb?.bottom || 0) + 16))}px`;
    const count = el("b", "", "0");
    const done = btn(opts.single ? tr("Cancel") : tr("Done"), opts.single ? "x" : "check", () => finish(), opts.single ? "" : "primary");
    bar.append(icon("crosshair", 16), el("span", "", opts.single ? tr("Click the node to use.") : tr("Click a node to link it, or one of its parameters to also create a widget.")), opts.single ? el("span") : count, done);
    document.body.append(bar);
    const hl = el("div", "nde-hl"); hl.style.display = "none"; document.body.append(hl);
    let n = 0;
    const stop = pickOnCanvas({
        skip: bar,
        onHover(node) {
            const r = node && nodeScreenRect(node);
            if (!r) { hl.style.display = "none"; return; }
            hl.style.cssText = `display:block;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
        },
        onPick(node, widget) {
            let entry = null;
            E.change(null, (ui) => { entry = addSource(ui, node); });
            E.openSrc.add(entry.uid);
            if (opts.onNode) { opts.onNode(entry, node, widget); if (opts.single) { finish(); return; } }
            else {
                const vp = virtualParams(node);
                const p = (widget ? paramInfo(node, widget) : null) || (!widget && vp.length === 1 ? vp[0] : null);
                if (p && defaultWidgetFor(p)) E.createFromParam(entry, p);
            }
            n++; count.textContent = String(n);
        },
        onCancel() { finish(true); },
    });
    function finish(already) {
        if (!E.stopPick) return;
        if (!already) stop();
        E.stopPick = null;
        bar.remove(); hl.remove();
        E.root.style.display = "";
        E.renderLeft(); E.root.focus();
    }
    E.stopPick = () => { stop(); finish(true); };
}

/* ------------------------------------------------------------------ Widgets */

import { toolbarTiles } from "./editor_toolbar.js";
function widgetsTab(E, body) {
    const { tr } = E;
    body.append(el("div", "nde-note", tr("Click a widget to add it, or drag it onto the page. Then bind it to a parameter in the right column.")));
    for (const g of GROUPS) {
        body.append(el("div", "nde-pgrp", tr(g)));
        const grid = el("div", "nde-lib");
        for (const d of WIDGET_LIST.filter((x) => x.group === g)) {
            // a widget with presets shows a tile for every preset (the same widget with other props)
            const tiles = d.presets?.length ? d.presets.map((pr) => ({ label: pr.label, icon: pr.icon || d.icon, preset: pr })) : [{ label: d.label, icon: d.icon, preset: null }];
            for (const t of tiles) {
                const i = el("div", "nde-lib-i"); i.draggable = true; i.title = tr(t.label);
                i.append(icon(t.icon, 22), el("span", "", tr(t.label)));
                const opts = t.preset ? { label: t.preset.label, props: t.preset.props } : {};
                i.addEventListener("click", () => E.addWidget(d.type, opts));
                i.addEventListener("dragstart", (e) => {
                    e.dataTransfer.setData("application/x-nd-widget", d.type);
                    if (t.preset) e.dataTransfer.setData("application/x-nd-preset", t.preset.id);
                    e.dataTransfer.effectAllowed = "copy";
                });
                grid.append(i);
            }
        }
        body.append(grid);
    }
    toolbarTiles(E, body);
}

/* ------------------------------------------------------------------ Layout */

// the settings of the two Spread buttons: evenly between the outermost widgets, by a gap, or within margins
function spreadBox(E) {
    const { tr } = E;
    const sp = E.spread;
    const box = el("div", "nde-spread");
    const modes = [["margins", tr("Within margins")], ["gap", tr("By gap")], ["even", tr("Evenly between the outer ones")]];
    const num = (key) => numberInput({ value: sp[key], min: -500, max: 4000, int: true, width: 70, onChange: (v) => { if (v != null) sp[key] = v; } });
    const pair = (a, b) => { const d = el("div", "nde-pair"); d.append(a, b); return d; };
    // the margins serve the Align buttons (when they align to the margins) and Spread within margins
    const margins = el("div", "nde-spread-f");
    margins.append(pair(row(tr("Left"), num("mL")), row(tr("Right"), num("mR"))), pair(row(tr("Top"), num("mT")), row(tr("Bottom"), num("mB"))));
    const alignTo = selectInput([["margins", tr("Margins of the page")], ["selection", tr("The selection")]], sp.alignTo, (v) => { sp.alignTo = v; });
    alignTo.title = tr("The Align buttons put the widgets against the margins, or against the outermost widget of the selection.");
    const fields = el("div", "nde-spread-f");
    const draw = () => {
        fields.textContent = "";
        if (sp.mode === "gap") fields.append(row(tr("Gap, horizontal"), num("gapH")), row(tr("Gap, vertical"), num("gapV")), row(tr("Stays in place"), selectInput([["start", tr("Top / left widget")], ["end", tr("Bottom / right widget")]], sp.anchor, (v) => { sp.anchor = v; })));
        else if (sp.mode === "margins") fields.append(el("div", "nde-spread-hint", tr("Horizontally: widgets one under another are stretched to the full width between the margins, widgets side by side are spread with equal gaps. Vertically: the top one touches the top margin, the bottom one the bottom margin, the others lie between them with equal gaps.")));
    };
    const sel = selectInput(modes, sp.mode, (v) => { sp.mode = v; draw(); });
    box.append(row(tr("Margins"), el("span")), margins, row(tr("Align to"), alignTo), row(tr("Spread"), sel), fields);
    draw();
    return box;
}

function layoutTab(E, body) {
    const { tr } = E;
    const t1 = el("div", "nde-tools");
    const A = (ic, title, how) => iconBtn(ic, title, () => E.align(how));
    t1.append(
        A("alignL", tr("Align left"), "L"), A("alignCX", tr("Align to the centre"), "CX"), A("alignR", tr("Align right"), "R"),
        el("div", "sep"),
        A("alignT", tr("Align to the top"), "T"), A("alignCY", tr("Align to the middle"), "CY"), A("alignB", tr("Align to the bottom"), "B"),
        el("div", "sep"),
        A("distH", tr("Spread horizontally (see the mode below)"), "distH"), A("distV", tr("Spread vertically (see the mode below)"), "distV"),
    );
    const t2 = el("div", "nde-tools");
    t2.append(
        iconBtn("front", tr("Bring to the front"), () => E.zOrder("front")), iconBtn("up", tr("Forward"), () => E.zOrder("up")),
        iconBtn("down", tr("Backward"), () => E.zOrder("down")), iconBtn("back", tr("Send to the back"), () => E.zOrder("back")),
        el("div", "sep"),
        iconBtn("group", tr("Group (Ctrl+G)"), () => E.group([...E.sel])), iconBtn("ungroup", tr("Ungroup (Ctrl+Shift+G)"), () => E.ungroup([...E.sel])),
        el("div", "sep"),
        iconBtn("copy", tr("Duplicate (Ctrl+D)"), () => E.duplicate([...E.sel])), iconBtn("trash", tr("Delete (Del)"), () => E.remove([...E.sel])),
    );
    body.append(t1, spreadBox(E), t2);

    const all = E.ui.widgets.filter((w) => w.page === E.page);
    if (!all.length) { body.append(el("div", "nde-empty", tr("The page is empty."))); return; }
    const head = el("div", "nde-pgrp", tr("Layers"));
    head.title = tr("Drop a layer here to take it out of its spoiler or group");
    layerDrop(E, head, () => ({ kind: "root" }), tr("Out to the page"), { root: true });
    body.append(head);
    const closed = E.layerClosed || (E.layerClosed = new Set());
    const labelOf = (w) => w.props?.label || w.props?.text || w.props?.title || tr(WIDGET_LIST.find((d) => d.type === w.type)?.label || w.type);
    const widgetRow = (w, depth, grp) => {
        const def = WIDGET_LIST.find((d) => d.type === w.type);
        const sp = isSpoiler(w);
        const r = el("div", `nde-layer${E.sel.has(w.id) ? " on" : ""}${w.hidden ? " dim" : ""}${grp ? " in-grp" : ""}`);
        r.style.position = "relative"; r.style.paddingLeft = `${8 + depth * 16}px`; r.draggable = true;
        r.dataset.id = w.id;
        const nm = el("span", "nm", labelOf(w));
        nm.append(el("small", "", tr(def?.label || w.type)));
        const chev = el("span", "chev");
        if (sp) { chev.append(icon(closed.has(w.id) ? "chevR" : "chevD", 14)); chev.addEventListener("click", (e) => { e.stopPropagation(); closed.has(w.id) ? closed.delete(w.id) : closed.add(w.id); E.renderLeft(); }); }
        r.append(chev, icon(def?.icon || "panel", 16), nm);
        if (sp) r.append(iconBtn("pencil", tr("Open the inside of the spoiler"), () => E.enter(w.id)));
        r.append(
            iconBtn(w.hidden ? "eyeOff" : "eye", tr(w.hidden ? "Show" : "Hide"), () => E.change(null, () => { w.hidden = !w.hidden; })),
            iconBtn(w.locked ? "lock" : "unlock", tr(w.locked ? "Unlock" : "Lock"), () => E.change(null, () => { w.locked = !w.locked; })));
        r.addEventListener("click", (e) => {
            if ((w.parent || null) !== (E.scope || null) && !E.preview) { E.scope = w.parent || null; E.grow = 0; E.syncScope(); E.fit(); E.refreshAll(); }
            E.inGroup = w.group || null;   // a click on a layer takes this one widget, even inside a group
            E.select([w.id], e.shiftKey);
        });
        r.addEventListener("dblclick", () => { if (sp) E.enter(w.id); });
        r.addEventListener("dragstart", (e) => {
            const ids = E.sel.has(w.id) ? [...E.sel] : [w.id];
            e.dataTransfer.setData("application/x-nd-layer", JSON.stringify({ ids })); e.dataTransfer.effectAllowed = "move";
        });
        // a spoiler takes the layer in; any other row puts it above or below itself (into its group, if it is in one)
        layerDrop(E, r, () => ({ kind: "widget", id: w.id }), sp ? tr("Into “{name}”", { name: w.props?.title || tr("Spoiler") }) : tr("Here"), { into: sp });
        body.append(r);
        if (sp && !closed.has(w.id)) draw(w.id, depth + 1);
    };
    const groupRow = (g, ms, depth) => {
        const on = ms.every((m) => E.sel.has(m.id));
        const r = el("div", `nde-layer grp${on ? " on" : ""}${ms.every((m) => m.hidden) ? " dim" : ""}`);
        r.style.position = "relative"; r.style.paddingLeft = `${8 + depth * 16}px`; r.draggable = true;
        r.dataset.gid = g.id;
        const chev = el("span", "chev"); chev.append(icon(closed.has(g.id) ? "chevR" : "chevD", 14));
        chev.addEventListener("click", (e) => { e.stopPropagation(); closed.has(g.id) ? closed.delete(g.id) : closed.add(g.id); E.renderLeft(); });
        const nm = el("span", "nm", g.name); nm.append(el("small", "", tr("Group") + ` · ${ms.length}`));
        r.append(chev, icon("group", 16), nm);
        r.append(
            iconBtn("ungroup", tr("Ungroup (Ctrl+Shift+G)"), () => E.ungroup([ms[0].id])),
            iconBtn(ms.every((m) => m.hidden) ? "eyeOff" : "eye", tr("Show or hide the whole group"), () => E.groupFlag(g.id, "hidden")),
            iconBtn(ms.every((m) => m.locked) ? "lock" : "unlock", tr("Lock or unlock the whole group"), () => E.groupFlag(g.id, "locked")));
        r.addEventListener("click", (e) => {
            if ((g.parent || null) !== (E.scope || null) && !E.preview) { E.scope = g.parent || null; E.grow = 0; E.syncScope(); E.fit(); E.refreshAll(); }
            E.inGroup = null;
            E.select(ms.map((m) => m.id), e.shiftKey);
        });
        r.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            const inp = document.createElement("input"); inp.className = "nde-in nde-text"; inp.value = g.name; inp.style.cssText = "flex:1;min-width:0;height:24px";
            const done = (ok) => { if (ok && inp.value.trim()) E.renameGroup(g.id, inp.value.trim()); E.renderLeft(); };
            inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); });
            inp.addEventListener("blur", () => done(true));
            nm.replaceWith(inp); inp.focus(); inp.select();
        });
        r.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("application/x-nd-layer", JSON.stringify({ ids: ms.map((m) => m.id), block: g.id })); e.dataTransfer.effectAllowed = "move";
        });
        layerDrop(E, r, () => ({ kind: "group", id: g.id }), tr("Into “{name}”", { name: g.name }), { into: true });
        body.append(r);
    };
    const draw = (parent, depth) => {
        const lv = levelOf(E.ui, E.page, parent).sort((a, b) => b.z - a.z), seen = new Set();
        for (const w of lv) {
            if (!w.group) { widgetRow(w, depth, false); continue; }
            if (seen.has(w.group)) continue;
            seen.add(w.group);
            const g = E.ui.groups.find((x) => x.id === w.group);
            const ms = lv.filter((m) => m.group === w.group);
            if (!g) { ms.forEach((m) => widgetRow(m, depth, false)); continue; }
            groupRow(g, ms, depth);
            if (!closed.has(g.id)) ms.forEach((m) => widgetRow(m, depth + 1, true));
        }
    };
    draw(null, 0);
}

// a row that takes layers dropped on it: the upper part puts them above the row, the lower part below it, the middle part (spoiler, group) inside
function layerDrop(E, row, target, hint, o = {}) {
    let tag = null;
    const cls = ["drop-above", "drop-below", "drop-in", "drop-out"];
    const clear = () => { row.classList.remove(...cls); tag?.remove(); tag = null; };
    const zoneOf = (e) => {
        if (o.root) return "in";
        const r = row.getBoundingClientRect(), f = (e.clientY - r.top) / Math.max(1, r.height);
        if (o.into) return f < 0.28 ? "above" : f > 0.72 ? "below" : "in";
        return f < 0.5 ? "above" : "below";
    };
    row.addEventListener("dragover", (e) => {
        if (!e.dataTransfer?.types?.includes("application/x-nd-layer")) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        const z = zoneOf(e);
        row.classList.remove(...cls);
        row.classList.add(o.root ? "drop-out" : `drop-${z === "in" ? "in" : z}`);
        if (z === "in" && !o.root) { if (!tag) { tag = el("span", "drophint", hint); row.append(tag); } } else if (tag) { tag.remove(); tag = null; }
    });
    row.addEventListener("dragleave", (e) => { if (!row.contains(e.relatedTarget)) clear(); });
    row.addEventListener("drop", (e) => {
        const t = e.dataTransfer?.getData("application/x-nd-layer");
        const z = zoneOf(e);
        clear();
        if (!t) return;
        e.preventDefault();
        try { const p = JSON.parse(t); E.dropLayers(Array.isArray(p) ? { ids: p } : p, target(), z); } catch {}
    });
}
