// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — groups of widgets (Ctrl+G) and reordering of layers by dragging.
// A group lives on a page and a level (the page or one spoiler). Its members lie side by side in z. In the editor a click on a member takes the
// whole group, so the group moves, copies and deletes as one; a double click goes inside (one member at a time). The page is drawn as before.
import { toast } from "./core/dom.js";
import { byId, uid, levelOf, membersOf, childrenOf, descendantsOf, isSpoiler, innerW, contentBottom, topZ } from "./model.js";

export function installGroups(E) {
    const tr = (s, v) => E.tr(s, v);
    E.inGroup = null;
    const groupsOf = () => E.ui.groups || (E.ui.groups = []);

    /** the ids a click on `w` selects: the whole group, or only `w` while the editor is "inside" its group */
    E.groupIds = (w) => (!w.group || E.inGroup === w.group ? [w.id] : membersOf(E.ui, w.group).map((m) => m.id));

    E.group = (ids) => {
        const ws = ids.map((id) => byId(E.ui, id)).filter(Boolean);
        if (ws.length < 2) { toast("warn", tr("Pick two or more widgets"), tr("Select the widgets that should go together, then press Ctrl+G.")); return; }
        const p0 = ws[0].page, par = ws[0].parent || null;
        if (ws.some((w) => w.page !== p0 || (w.parent || null) !== par)) { toast("warn", tr("Widgets of one level only"), tr("A group holds widgets of the same page and the same spoiler.")); return; }
        let gid = "";
        E.change(null, (ui) => {
            gid = uid("g");
            const n = (ui.groups || []).filter((g) => g.page === p0).length + 1;
            ui.groups = ui.groups || [];
            ui.groups.push({ id: gid, page: p0, parent: par, name: `${tr("Group")} ${n}` });
            for (const w of ws) w.group = gid;   // widgets that were in another group leave it (one level of groups)
        });
        E.inGroup = null;
        E.select(membersOf(E.ui, gid).map((m) => m.id));
    };

    E.ungroup = (ids) => {
        const gids = new Set(ids.map((id) => byId(E.ui, id)?.group).filter(Boolean));
        if (!gids.size) return;
        const members = E.ui.widgets.filter((w) => gids.has(w.group)).map((w) => w.id);
        E.change(null, (ui) => { for (const w of ui.widgets) if (gids.has(w.group)) delete w.group; });
        E.inGroup = null;
        E.select(members);
    };

    E.renameGroup = (gid, name) => E.change(`gn${gid}`, (ui) => { const g = ui.groups.find((x) => x.id === gid); if (g) g.name = String(name).slice(0, 60); }, { light: true });

    /** hide / lock all the members of a group together */
    E.groupFlag = (gid, key) => E.change(null, (ui) => { const ms = membersOf(ui, gid), on = !ms.every((m) => m[key]); for (const m of ms) m[key] = on; });

    /**
     * Layers dropped on a row. target: {kind: "root"} | {kind: "widget", id} | {kind: "group", id}; zone: "above" | "below" | "in"
     * (above = higher in the list = nearer to the front). payload.block = the id of a group dragged as a whole.
     */
    E.dropLayers = (payload, target, zone) => {
        const ws = (payload.ids || []).map((id) => byId(E.ui, id)).filter(Boolean);
        if (!ws.length) return;
        const ids = new Set(ws.map((w) => w.id));
        let parent = null, gid = null, anchor = null, side = "top";
        if (target.kind === "widget") {
            const t = byId(E.ui, target.id);
            if (!t || ids.has(t.id)) return;
            if (zone === "in" && isSpoiler(t)) { parent = t.id; }
            else { parent = t.parent || null; gid = t.group || null; anchor = t; side = zone === "below" ? "below" : "above"; }
        } else if (target.kind === "group") {
            const g = E.ui.groups.find((x) => x.id === target.id);
            if (!g) return;
            const ms = membersOf(E.ui, g.id).sort((a, b) => a.z - b.z);
            if (ms.some((m) => ids.has(m.id))) return;
            parent = g.parent || null;
            if (zone === "in") { gid = g.id; anchor = ms[ms.length - 1]; side = "above"; }
            else if (zone === "below") { anchor = ms[0]; side = "below"; }
            else { anchor = ms[ms.length - 1]; side = "above"; }
        }
        // a spoiler cannot go into itself or into what lies in it
        if (parent && ws.some((w) => w.id === parent || (isSpoiler(w) && descendantsOf(E.ui, w.id).some((d) => d.id === parent)))) return;
        const target0 = parent && byId(E.ui, parent);
        if (parent && (!target0 || !isSpoiler(target0))) return;
        E.sel.clear(); ws.forEach((w) => E.sel.add(w.id));
        E.change(null, (ui) => {
            const page = ws[0].page;
            for (const w of ws) {
                if ((w.parent || null) === (parent || null)) continue;
                const from = w.parent && byId(ui, w.parent);
                if (parent) {
                    const t = byId(ui, parent), n = childrenOf(ui, t.id).length;
                    w.parent = parent; w.w = Math.min(w.w, innerW(t)); w.x = 0; w.y = contentBottom(ui, t) + (n ? 8 : 0);
                } else {
                    w.parent = null;
                    if (from) { w.x = from.x; w.y = from.y + from.h + 8; }
                }
            }
            // the group: a block that is dropped outside every group stays together; otherwise the widgets join the group of the target (or none)
            const keep = payload.block && !gid ? ui.groups.find((g) => g.id === payload.block) : null;
            if (keep) { keep.parent = parent; for (const w of ws) w.group = keep.id; }
            else for (const w of ws) { if (gid) w.group = gid; else delete w.group; }
            // z of the level: the dropped widgets go next to the anchor (or to the front), in the order they had
            const mine = ws.slice().sort((a, b) => a.z - b.z);
            const lv = levelOf(ui, page, parent).filter((w) => !ids.has(w.id)).sort((a, b) => a.z - b.z);
            let at = lv.length;
            if (anchor) { const i = lv.findIndex((w) => w.id === anchor.id); if (i >= 0) at = side === "below" ? i : i + 1; }
            lv.splice(at, 0, ...mine);
            lv.forEach((w, i) => { w.z = i; });
        });
    };
}
