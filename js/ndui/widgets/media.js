// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — the lightbox of the pictures (the Viewer widget and the image input open it).
import { el, icon } from "./util.js";
import { applyVars } from "../kit.js";

/* ------------------------------------------------------------------ lightbox */

// items: [{url, name}]; the picture opens in a layer over the page (inside the full screen too)
export function openLightbox(ctx, items, start = 0) {
    if (!items.length) return;
    const host = ctx.popupHost?.() || document.body;
    let i = Math.max(0, Math.min(items.length - 1, start));
    const root = el("div", "ndk ndk-lightbox");
    applyVars(root, ctx.vars());
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    const stage = el("div", "stage"), img = el("img"); img.draggable = false;
    stage.append(img);
    const bar = el("div", "bar");
    const mk = (ic, title, fn) => { const b = el("button"); b.type = "button"; b.title = title; b.append(icon(ic, 18)); b.addEventListener("click", (e) => { e.stopPropagation(); fn(); }); return b; };
    const cap = el("div", "cap");
    let z = 1, ox = 0, oy = 0;
    const apply = () => { img.style.transform = `translate(-50%,-50%) translate(${ox}px,${oy}px) scale(${z})`; };
    const show = () => {
        const it = items[i];
        img.src = it.url; z = 1; ox = oy = 0; apply();
        cap.textContent = items.length > 1 ? `${i + 1} / ${items.length}${it.name ? "  ·  " + it.name : ""}` : it.name || "";
        prev.style.display = next.style.display = items.length > 1 ? "" : "none";
    };
    const go = (d) => { i = (i + d + items.length) % items.length; show(); };
    const close = () => { window.removeEventListener("keydown", key, true); root.remove(); };
    const download = () => { const a = document.createElement("a"); a.href = items[i].url; a.download = items[i].name || "image.png"; document.body.append(a); a.click(); a.remove(); };
    bar.append(
        mk("download", ctx.tr("Download"), download),
        mk("external", ctx.tr("Open in a new tab"), () => window.open(items[i].url, "_blank")),
        mk("x", ctx.tr("Close (Esc)"), close),
    );
    const prev = el("button", "nav prev"); prev.type = "button"; prev.append(icon("chevL", 22)); prev.addEventListener("click", (e) => { e.stopPropagation(); go(-1); });
    const next = el("button", "nav next"); next.type = "button"; next.append(icon("chevR", 22)); next.addEventListener("click", (e) => { e.stopPropagation(); go(1); });
    const key = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === "ArrowLeft") { e.stopPropagation(); go(-1); }
        else if (e.key === "ArrowRight") { e.stopPropagation(); go(1); }
        else if (e.key === "+" || e.key === "=") { z = Math.min(8, z * 1.25); apply(); }
        else if (e.key === "-") { z = Math.max(0.2, z / 1.25); apply(); }
        else if (e.key === "0") { z = 1; ox = oy = 0; apply(); }
    };
    window.addEventListener("keydown", key, true);
    stage.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); const f = Math.exp(-e.deltaY * 0.0016); z = Math.max(0.2, Math.min(10, z * f)); apply(); }, { passive: false });
    stage.addEventListener("pointerdown", (e) => {
        if (e.target !== img && e.target !== stage) return;
        const sx = e.clientX, sy = e.clientY, bx = ox, by = oy; let moved = false;
        stage.classList.add("drag"); stage.setPointerCapture(e.pointerId);
        const mv = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.hypot(dx, dy) > 3) moved = true; ox = bx + dx; oy = by + dy; apply(); };
        const up = (ev) => { stage.classList.remove("drag"); stage.removeEventListener("pointermove", mv); stage.removeEventListener("pointerup", up); try { stage.releasePointerCapture(ev.pointerId); } catch {} if (!moved && ev.target === stage) close(); };
        stage.addEventListener("pointermove", mv); stage.addEventListener("pointerup", up);
    });
    stage.addEventListener("dblclick", () => { z = z === 1 ? 2 : 1; ox = oy = 0; apply(); });
    root.append(stage, bar, prev, next, cap);
    host.append(root);
    show();
}
