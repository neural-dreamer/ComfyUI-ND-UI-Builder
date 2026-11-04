// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — text: Text (one line) and Prompt (many lines).
import { el, icon } from "./util.js";
import { attachWeightKeys } from "../textedit.js";

const STR = ["STRING"];

export const text = {
    type: "text", label: "Text", icon: "text", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: STR, required: true }],
    size: { w: 300, h: 60, minW: 100, minH: 40, maxH: 120 },
    props: [
        { id: "placeholder", kind: "text", label: "Placeholder", hint: "Shown while the field is empty." },
        { id: "clearable", kind: "bool", label: "Clear button", def: true },
        { id: "spell", kind: "bool", label: "Check spelling", def: true, hint: "The spelling check of the browser." },
        { id: "weights", kind: "bool", label: "Ctrl+Up / Down changes the weight", def: true, hint: "Select a word or a phrase (or put the cursor in it) and press Ctrl+Up or Ctrl+Down: (word:1.05), as in the text fields of ComfyUI." },
    ],
    mount(ctx) {
        const f = el("div", "ndk-field ndk-text");
        const input = el("input", "ndk-input"); input.type = "text"; input.spellcheck = false;
        const clr = el("button", "ndk-iconbtn"); clr.type = "button"; clr.tabIndex = -1; clr.append(icon("x", 14)); clr.title = ctx.tr("Clear");
        f.append(input, clr);
        ctx.body.append(f);
        let last = null;
        const show = () => {
            const v = ctx.get("value") ?? "";
            if (v !== last && v !== input.value) input.value = String(v);
            last = v;
            input.placeholder = ctx.prop("placeholder") || "";
            input.spellcheck = ctx.prop("spell") !== false;
            clr.style.display = ctx.prop("clearable") !== false && input.value ? "" : "none";
        };
        input.addEventListener("input", () => { last = input.value; ctx.set("value", input.value); clr.style.display = ctx.prop("clearable") !== false && input.value ? "" : "none"; });
        attachWeightKeys(input, () => ctx.prop("weights") !== false);
        input.addEventListener("keydown", (e) => e.stopPropagation());
        clr.addEventListener("click", () => { input.value = ""; last = ""; ctx.set("value", ""); show(); input.focus(); });
        show();
        return { update: show };
    },
};

export const prompt = {
    type: "prompt", label: "Prompt", icon: "textarea", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: STR, required: true }],
    size: { w: 460, h: 200, minW: 160, minH: 80 },
    fill: true,
    props: [
        { id: "placeholder", kind: "text", label: "Placeholder", hint: "Shown while the field is empty." },
        { id: "mono", kind: "bool", label: "Monospace font", def: false },
        { id: "counter", kind: "bool", label: "Character counter", def: true },
        { id: "spell", kind: "bool", label: "Check spelling", def: true, hint: "The spelling check of the browser." },
        { id: "weights", kind: "bool", label: "Ctrl+Up / Down changes the weight", def: true, hint: "Select a word or a phrase (or put the cursor in it) and press Ctrl+Up or Ctrl+Down: (word:1.05), as in the text fields of ComfyUI." },
    ],
    mount(ctx) {
        const box = el("div", "ndk-field ndk-area");
        box.style.cssText = "height:auto;flex-direction:column;align-items:stretch;overflow:hidden";
        const ta = el("textarea"); ta.spellcheck = false; ta.setAttribute("data-nd-scroll", "1");
        const foot = el("div", "ndk-area-foot");
        const count = el("span");
        const clr = el("button", "", ctx.tr("Clear")); clr.type = "button";
        foot.append(count, clr);
        box.append(ta, foot);
        ctx.body.append(box);
        let last = null;
        const stats = () => { count.textContent = ctx.prop("counter") !== false ? ctx.tr("{n} characters", { n: ta.value.length }) : ""; };
        const show = () => {
            const v = ctx.get("value") ?? "";
            if (v !== last && v !== ta.value) ta.value = String(v);
            last = v;
            ta.placeholder = ctx.prop("placeholder") || "";
            ta.spellcheck = ctx.prop("spell") !== false;
            box.classList.toggle("mono", !!ctx.prop("mono"));
            stats();
        };
        ta.addEventListener("input", () => { last = ta.value; ctx.set("value", ta.value); stats(); });
        attachWeightKeys(ta, () => ctx.prop("weights") !== false);
        ta.addEventListener("keydown", (e) => e.stopPropagation());
        clr.addEventListener("click", () => { ta.value = ""; last = ""; ctx.set("value", ""); show(); ta.focus(); });
        show();
        return { update: show };
    },
};
