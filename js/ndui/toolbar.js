// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI mode — the toolbar of the top panel: ComfyUI buttons and blocks, the memory buttons, separators.
// One place that builds the items for the mode (live) and for the ghost of the editor (a picture); the sizes live in topbar.js.
import { el } from "./core/dom.js";
import { icon } from "./kit.js";
import { freeMemory } from "./freemem.js";
import * as comfybar from "./comfybar.js";
import { measured } from "./topbar.js";

export const PLATE_PAD = 4;

/** hides the grips that move a panel of ComfyUI around (a user must not drag a panel off the top bar by accident) */
export function hideGrips(wrap) {
    const run = () => {
        for (const n of wrap.querySelectorAll("*")) {
            if (n.classList.contains("ndk-tb-nodrag")) continue;
            const cls = String(n.getAttribute("class") || "");
            let grip = /drag-handle|draghandle|drag_handle|grip|\bdrag\b/i.test(cls);
            if (!grip && n.children.length === 0 && !n.textContent.trim()) {
                const r = n.getBoundingClientRect();
                if (r.width && r.width < 30 && r.height < 40) { const cur = getComputedStyle(n).cursor; grip = cur === "grab" || cur === "move"; }
            }
            if (grip) { n.classList.add("ndk-tb-nodrag"); n.setAttribute("draggable", "false"); }
        }
    };
    run(); setTimeout(run, 400); setTimeout(run, 1800);
}   // px around the items on the plate (only when the plate is drawn)

/** the colours, the scale and the style of one item (the wrapper keeps them; the content is not touched) */
export function styleItem(wrap, it, u) {
    const k = (u.view.toolbar.scale / 100) * (it.scale / 100);
    wrap.className = `ndk-tb-item ${it.kind}`;
    wrap.dataset.id = it.id; wrap.dataset.kind = it.kind;
    wrap.dataset.style = it.kind === "unload" || it.kind === "unloadCache" ? (it.style === "flat" ? "flat" : "pill") : it.style;
    wrap.style.zoom = it.kind === "sep" ? "" : String(k);
    wrap.style.setProperty("--tb-bg", it.bg || "");
    wrap.style.setProperty("--tb-fg", it.fg || "");
    wrap.style.setProperty("--tb-bd", it.border || "");
    wrap.classList.toggle("has-bg", !!it.bg); wrap.classList.toggle("has-fg", !!it.fg); wrap.classList.toggle("has-bd", !!it.border);
    if (it.kind === "sep") {
        wrap.style.width = `${it.w * u.view.toolbar.scale / 100}px`;
        wrap.classList.toggle("line", it.line !== false);
        wrap.classList.toggle("acc", it.variant === "accent");
        wrap.style.setProperty("--tb-th", `${Math.max(1, Math.min(8, it.thick || 1))}px`);
    }
}

function memButton(it, host) {
    const b = el("button", `ndk-um-logobtn sw ${it.kind === "unload" ? "mem-models" : "mem-cache"}`); b.type = "button"; b.append(icon(it.kind, 17));
    b.title = it.kind === "unload" ? host.tr("Unload models") : host.tr("Unload models and the execution cache");
    b.addEventListener("click", async () => {
        if (b.classList.contains("busy")) return;
        b.classList.add("busy"); b.classList.remove("ok", "err");
        let ok = false;
        try { ok = await freeMemory(it.kind === "unloadCache"); } catch { ok = false; }
        b.classList.remove("busy"); b.classList.add(ok ? "ok" : "err");
        setTimeout(() => b.classList.remove("ok", "err"), 1400);
    });
    return b;
}

/** fills the plate with the items. live: the mode (real buttons); otherwise a picture for the ghost of the editor */
export function fillToolbar(plate, u, host, live) {
    comfybar.releaseAll(plate);
    plate.textContent = "";
    const tb = u.view.toolbar;
    plate.classList.toggle("plated", tb.bg === "pill");
    plate.style.setProperty("--tb-pad", `${PLATE_PAD}px`);
    for (const it of tb.items) {
        const wrap = el("div");
        styleItem(wrap, it, u);
        if (it.kind === "unload" || it.kind === "unloadCache") wrap.append(live ? memButton(it, host) : (() => { const b = el("span", "ndk-um-logobtn sw"); b.append(icon(it.kind, 17)); return b; })());
        else if (it.kind === "comfy") {
            if (live) { comfybar.attach(it, wrap); hideGrips(wrap); wrap.addEventListener("nd-tb-attached", () => hideGrips(wrap)); }
            else {
                // the editor shows a plain square: the real element (a monitor with live bars) does not belong in a picture
                wrap.classList.add("sq");
                wrap.style.minWidth = `${Math.max(34, Math.round(measured.get(it.id) || 34))}px`;
                wrap.append(el("span", "", (it.name || "?").slice(0, 14)));
                wrap.title = it.name || "";
            }
        }
        plate.append(wrap);
    }
}
