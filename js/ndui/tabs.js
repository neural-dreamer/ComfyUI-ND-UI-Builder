// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the row of page tabs, the same in the node, in the ND UI mode and in the editor preview.
// view.tabs = {show, pos: top|bottom, align: left|center|right}
import { el } from "./core/dom.js";

export function drawTabs(box, ui, cur, tr, pick) {
    box.textContent = "";
    const t = ui.view.tabs;
    box.dataset.align = t.align;
    if (!t.show || ui.pages.length < 2) return false;
    for (const p of ui.pages) {
        const b = el("button", `tab${p.id === cur ? " on" : ""}${p.kind === "mode" ? " mode" : ""}`, p.name);
        if (p.kind === "mode") b.title = tr("Mode: switches the nodes of this mode on");
        b.type = "button";
        b.addEventListener("click", () => pick(p.id));
        box.append(b);
    }
    return true;
}
export const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" };
