// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widget — UI Scale: the size of the whole ND UI (text, fields, buttons) with one slider.
// It works on the page it stands on; a page without its own UI Scale takes the first one found on the other pages (in the order of the pages).
import { el } from "./util.js";

const RANGE = [50, 200];
export const uiscale = {
    type: "uiscale", label: "UI Scale", icon: "zoomIn", group: "Run",
    slots: [],
    size: { w: 320, h: 64, minW: 140, minH: 40 },
    props: [
        { id: "scale", kind: "int", label: "Scale, %", min: RANGE[0], max: RANGE[1], step: 5, hint: "Empty: the scale of the style (Look → Scale). A page without its own UI Scale uses the first UI Scale of another page." },
        { id: "step", kind: "select", label: "Step", def: "5", options: [["1", "1%"], ["5", "5%"], ["10", "10%"]] },
    ],
    mount(ctx) {
        const root = el("div", "ndk-us");
        const rg = el("input"); rg.type = "range"; rg.min = RANGE[0]; rg.max = RANGE[1];
        const num = el("input", "num"); num.type = "text"; num.inputMode = "numeric"; num.spellcheck = false;
        const reset = el("button", "rst", "100%"); reset.type = "button"; reset.title = ctx.tr("Back to 100%");
        root.append(rg, num, reset);
        ctx.body.append(root);
        let typing = false;
        const paint = () => {
            const v = Math.round(ctx.kitScale());
            rg.step = ctx.prop("step") || 5;
            if (document.activeElement !== num) num.value = `${v}%`;
            if (+rg.value !== v) rg.value = v;
            rg.style.setProperty("--p", `${((v - RANGE[0]) / (RANGE[1] - RANGE[0])) * 100}%`);
        };
        const apply = (v) => { v = Math.max(RANGE[0], Math.min(RANGE[1], Math.round(v))); ctx.setProp("scale", v); ctx.relayout(); paint(); };
        rg.addEventListener("input", () => apply(+rg.value));
        rg.addEventListener("keydown", (e) => e.stopPropagation());
        num.addEventListener("focus", () => { typing = true; num.value = String(Math.round(ctx.kitScale())); num.select(); });
        num.addEventListener("change", () => { const n = Number(num.value.replace(/[%\s]/g, "").replace(",", ".")); if (Number.isFinite(n)) apply(n); });
        num.addEventListener("blur", () => { typing = false; paint(); });
        num.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") num.blur(); });
        reset.addEventListener("click", () => apply(100));
        paint();
        return { update() { if (!typing) paint(); } };
    },
};
