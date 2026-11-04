// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) Comfy Org and the ComfyUI_frontend contributors (https://github.com/Comfy-Org/ComfyUI_frontend,
//   src/extensions/core/editAttention.ts), licensed under the GNU GPL v3.0: see LICENSES/GPL-3.0-only.txt.
// Ported to plain JavaScript and adapted for the fields of ComfyUI ND UI Builder by Ivan Ovchinnikov (Neural Dreamer), 2026; the changes are also GPL-3.0-only.
// This file is a separate GPL-3.0 work combined with the AGPL-3.0 code of this project (GPL-3.0 section 13 / AGPL-3.0 section 13).
// ND UI — what the text fields of ComfyUI do and the fields inside our frames would not:
//  - the weight of a word or a phrase: select it (or put the cursor in it) and press Ctrl+Up / Ctrl+Down (Cmd on a Mac; with Shift too);
//    this is the code of the extension Comfy.EditAttention of the ComfyUI frontend, kept the same on purpose so that both behave alike.
//    ComfyUI listens for the key on `window`; our fields (and the guard of Node Embed) keep keys to themselves, so they call it on their own.
//  - spelling check: the browser's own (the attribute `spellcheck`).
import { app } from "../../../scripts/app.js";

export const isWeightKey = (e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && (e.ctrlKey || e.metaKey);
export const isTextField = (t) => t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && (t.type === "text" || t.type === "search"));

// the step: the setting of ComfyUI "Ctrl+up/down precision" (0.05 by default)
export function weightStep() {
    try { const v = Number(app.extensionManager?.setting?.get?.("Comfy.EditAttention.Delta")); if (Number.isFinite(v) && v > 0) return v; } catch {}
    return 0.05;
}

export function incrementWeight(weight, delta) {
    const f = parseFloat(weight);
    if (Number.isNaN(f)) return weight;
    return String(Number((f + delta).toFixed(10)));
}
// the nearest pair of brackets round the cursor: {start, end} of what is inside, or null
export function findNearestEnclosure(text, cursor) {
    let start = cursor, end = cursor, open = 0, close = 0;
    if (text[cursor] === "(") end = cursor + 1;
    else {
        while (start >= 0) {
            start--;
            if (text[start] === "(" && open === close) break;
            if (text[start] === "(") open++;
            if (text[start] === ")") close++;
        }
        if (start < 0) return null;
        open = 0; close = 0;
    }
    while (end < text.length && (text[end] !== ")" || open !== close)) {
        if (text[end] === "(") open++;
        if (text[end] === ")") close++;
        end++;
    }
    return end === text.length ? null : { start: start + 1, end };
}
export function addWeightToParentheses(text) {
    const m = text.match(/^\((.*)\)$/);
    if (!m) return text;
    const inner = m[1];
    return !/(?:^|\s)\d{1,2}:\d{2}$/.test(inner) && /:[+-]?(?:\d*\.)?\d+(?:[eE][+-]?\d+)?$/.test(inner) ? text : `(${inner}:1.0)`;
}

// changes the weight in the field for the key "ArrowUp" / "ArrowDown"; true when it did something
export function editWeight(field, key, step = weightStep()) {
    if (!isTextField(field) || (key !== "ArrowUp" && key !== "ArrowDown")) return false;
    const v = field.value;
    let a = field.selectionStart, b = field.selectionEnd;
    if (a == null || b == null) return false;
    let sel = v.substring(a, b);
    if (!sel) {
        const en = findNearestEnclosure(v, a);
        if (en) { a = en.start; b = en.end; sel = v.substring(a, b); }
        else {
            const delim = " .,\\/!?%^*;:{}=-_`~()\r\n\t";
            while (!delim.includes(v[a - 1]) && a > 0) a--;
            while (!delim.includes(v[b]) && b < v.length) b++;
            sel = v.substring(a, b);
            if (!sel) return false;
        }
    }
    if (sel[sel.length - 1] === " ") { sel = sel.substring(0, sel.length - 1); b--; }
    if (v[a - 1] === "(" && v[b] === ")") { a--; b++; sel = v.substring(a, b); }
    if (sel[0] !== "(" || sel[sel.length - 1] !== ")") sel = `(${sel})`;
    sel = addWeightToParentheses(sel);
    const d = key === "ArrowUp" ? step : -step;
    const out = sel.replace(/\((.*):([+-]?(?:\d*\.)?\d+(?:[eE][+-]?\d+)?)\)/, (m, text, w) => {
        w = incrementWeight(w, d);
        return Number(w) === 1 ? text : `(${text}:${w})`;
    });
    field.setSelectionRange(a, b);
    // insertText keeps the undo history of the field; where it is not allowed the text is put in by hand
    let done = false;
    try { done = document.execCommand("insertText", false, out); } catch {}
    if (!done || field.value === v) {
        field.setRangeText(out, a, b, "end");
        field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    field.setSelectionRange(a, a + out.length);
    return true;
}

// a field of ours: the key works while `on()` says so
export function attachWeightKeys(field, on = () => true) {
    field.addEventListener("keydown", (e) => {
        if (!isWeightKey(e) || !on()) return;
        if (editWeight(field, e.key)) { e.preventDefault(); e.stopPropagation(); }
    });
}
