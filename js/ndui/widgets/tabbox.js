// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — the Tab panel (id "tabbox"): a panel with tabs. The widgets that lie in it belong to the tab that was open when they were put there;
// in the ND UI the viewer switches the tabs. The tabs themselves are made in the inspector (add, rename, move, delete).
import { el } from "./util.js";
import { tabStrip } from "./tabs_strip.js";
import { TABS_MAX } from "../model.js";

export const tabbox = {
    type: "tabbox", label: "Tab panel", icon: "layers", group: "Layout",
    slots: [], noLabel: true, decor: true,
    size: { w: 520, h: 360, minW: 80, minH: 60 },
    props: [
        { id: "shadow", kind: "bool", label: "Shadow", def: true },
    ],
    // the tabs of the panel: the same strip as in the ND UI, but with editing
    inspect(E, w, b, H) {
        const { tr } = H;
        b.append(H.el("div", "nde-note", tr("Put widgets on the panel: they join the tab that is open. Switch the tab here to fill the next one.")));
        const strip = tabStrip({
            tr, max: TABS_MAX, min: 1,
            items: () => w.props.tabs.map((t) => ({ id: t.id, name: t.name })),
            active: () => w.props.active,
            edit: () => true,
            needConfirm: (id) => E.tabCount(w, id) > 0,
            onSelect: (id) => E.change(`tab:${w.id}`, () => { w.props.active = id; }),
            onAdd: () => E.tabOp(w, "add"),
            onRename: (id, name) => E.tabOp(w, "rename", id, name),
            onMove: (id, to) => E.tabOp(w, "move", id, to),
            onDelete: (id) => E.tabOp(w, "del", id),
        });
        strip.el.classList.add("inspector");
        strip.render();
        b.append(strip.el);
    },
    mount(ctx) {
        const box = el("div", "ndk-panel-box"), inner = el("div", "ndk-tbx");
        const strip = tabStrip({
            tr: ctx.tr,
            items: () => ctx.tabs().map((t) => ({ id: t.id, name: t.name })),
            active: () => ctx.activeTab(),
            edit: () => false,
            onSelect: (id) => ctx.setTab(id),
        });
        inner.append(strip.el); box.append(inner); ctx.body.append(box);
        const show = () => { box.classList.toggle("noshadow", ctx.prop("shadow") === false); strip.render(); };
        show();
        return { update: show, resize: show, destroy() { strip.destroy(); } };
    },
};
