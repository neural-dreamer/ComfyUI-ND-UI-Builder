// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — what is known about a LoRA: the buttons «page» and «info» (in the card of the stack and in the tile of the gallery) and the info panel itself
// (what it was made for, the trigger words that can be switched and copied, the usage tips, the notes).
import { el, icon } from "../widgets/util.js";
import { previewOf } from "../models.js";
import { mediaThumb, showLarge } from "./media.js";

export const hasInfo = (m) => !!(m && ((m.words && m.words.length) || m.usage || m.notes || m.base || m.version));

// «open the page of the LoRA» and «info»; both are dimmed and do nothing when there is nothing behind them
export function infoButtons(m, tr, onInfo, force = false) {   // force: the button works even when nothing is known (the H3 block has something to show)
    const box = el("span", "ndk-lr-ib");
    const page = el("button", "ndk-iconbtn ndk-lr-pg"); page.type = "button"; page.append(icon("external", 14));
    page.title = m?.url ? tr("Open the page of this LoRA") : tr("No page is known for this LoRA");
    page.disabled = !m?.url;
    page.addEventListener("click", (e) => { e.stopPropagation(); if (m?.url) window.open(m.url, "_blank", "noopener,noreferrer"); });
    const inf = el("button", "ndk-iconbtn ndk-lr-inf"); inf.type = "button"; inf.append(icon("info", 14));
    const can = hasInfo(m) || force;
    inf.title = can ? tr("Trigger words and notes of this LoRA") : tr("Nothing is known about this LoRA");
    inf.disabled = !can;
    inf.addEventListener("click", (e) => { e.stopPropagation(); if (can) onInfo(inf); });
    for (const b of [page, inf]) b.addEventListener("pointerdown", (e) => e.stopPropagation());
    box.append(page, inf);
    return box;
}

export async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
        const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;left:-999px;top:0;opacity:0";
        document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok;
    } catch { return false; }
}

// fills `box` with the info of one LoRA. chosen: the trigger words that are on (an array), or null when they cannot be switched here;
// onChosen(newArray) is called when one is switched. picture: {folder} puts the preview (a picture or a video) in the head; it opens large on a click.
export function fillInfo(box, m, { tr, title, chosen = null, onChosen, picture = null }) {
    box.classList.add("ndk-li");
    const head = el("div", "ndk-li-head");
    head.append(el("b", "", title || m?.title || ""));
    const sub = [m?.base, m?.version].filter(Boolean).join(" · ");
    if (sub) head.append(el("small", "", tr("Made for: {base}", { base: sub })));
    if (picture && previewOf(m)) {
        const th = el("button", "ndk-li-pic"); th.type = "button"; th.title = tr("Show the picture large");
        const t = mediaThumb(m, picture.folder, { play: "always" }); t.classList.add("plain"); th.append(t);
        th.addEventListener("click", () => showLarge(th, m, picture.folder, tr));
        head.classList.add("has-pic"); head.prepend(th);
    }
    box.append(head);
    const body = el("div", "ndk-li-body"); box.append(body);
    const sec = (label) => { const s = el("div", "ndk-li-sec"); s.append(el("div", "ndk-li-lab", label)); body.append(s); return s; };
    const words = m?.words || [];
    if (words.length) {
        const s = sec(tr("Trigger words"));
        let on = chosen ? [...chosen] : null;
        for (const [wi, w] of words.entries()) {
            const r = el("div", `ndk-li-word${wi % 2 ? " alt" : ""}`);
            if (on) {
                const cb = el("button", `ndk-li-cb${on.includes(w) ? " on" : ""}`); cb.type = "button"; cb.setAttribute("role", "checkbox"); cb.setAttribute("aria-checked", String(on.includes(w)));
                cb.title = tr("Use this word or phrase"); cb.append(icon("check", 12));
                cb.addEventListener("click", () => { on = on.includes(w) ? on.filter((x) => x !== w) : [...on, w]; cb.classList.toggle("on", on.includes(w)); cb.setAttribute("aria-checked", String(on.includes(w))); onChosen?.(on); });
                r.append(cb);
            }
            r.append(el("span", "ndk-li-txt", w));
            const cp = el("button", "ndk-iconbtn ndk-li-copy"); cp.type = "button"; cp.title = tr("Copy"); cp.append(icon("copy", 14));
            cp.addEventListener("click", async () => { const ok = await copyText(w); cp.classList.toggle("done", ok); cp.replaceChildren(icon(ok ? "check" : "copy", 14)); setTimeout(() => { cp.classList.remove("done"); cp.replaceChildren(icon("copy", 14)); }, 1100); });
            r.append(cp); s.append(r);
        }
    }
    if (m?.usage) { const s = sec(tr("Usage tips")); s.append(el("div", "ndk-li-text", m.usage)); }
    if (m?.notes) { const s = sec(tr("Notes")); s.append(el("div", "ndk-li-text", m.notes)); }
    if (!words.length && !m?.usage && !m?.notes) body.append(el("div", "ndk-pop-empty", tr("No trigger words or tips are known for this LoRA.")));
}
