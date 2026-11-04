// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — a miniature of one page of a panel: a box per widget with its icon, drawn from the model (like the miniatures of Alt+Q).
// Nothing is rendered to a picture: the miniature always matches the content.
import { el } from "./core/dom.js";
import { icon, tokensOf } from "./kit.js";
import { defOf } from "./widgets/index.js";

let cssDone = false;
function css() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement("style");
    s.textContent = `.ndt-panel{position:relative;border-radius:6px;overflow:hidden;flex:0 0 auto}
.ndt-w{position:absolute;box-sizing:border-box;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden}`;
    document.head.append(s);
}

/** the page `pageId` of `ui` fitted into a box of w x h px */
export function pageThumb(ui, pageId, bw = 140, bh = 90) {
    css();
    const tk = tokensOf(ui), pg = ui.pages.some((p) => p.id === pageId) ? pageId : ui.pages[0]?.id;
    const W = Math.max(200, ui.page.w), H = Math.max(150, ui.page.h), s = Math.min(bw / W, bh / H);
    const box = el("div", "ndt-panel");
    box.style.cssText = `width:${Math.round(W * s)}px;height:${Math.round(H * s)}px;background:${tk.page && !/gradient/.test(tk.page) ? tk.page : tk.bg};${/gradient/.test(tk.page || "") ? `background-image:${tk.page};` : ""}border:1px solid ${tk.border}`;
    for (const x of ui.widgets) {
        if (x.page !== pg || x.hidden) continue;
        const d = el("div", "ndt-w");
        d.style.cssText = `left:${x.x * s}px;top:${x.y * s}px;width:${Math.max(3, x.w * s)}px;height:${Math.max(3, x.h * s)}px;background:${tk.s2};border:1px solid ${tk.border};color:${tk.muted}`;
        if (x.type === "generate") { d.style.background = tk.accent; d.style.color = tk.onAccent; }
        const def = defOf(x.type);
        if (def?.icon && x.w * s > 22 && x.h * s > 16) d.append(icon(def.icon, Math.min(14, Math.max(8, x.h * s * 0.5))));
        box.append(d);
    }
    return box;
}
