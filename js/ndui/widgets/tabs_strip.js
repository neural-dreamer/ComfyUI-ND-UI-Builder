// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — the strip of tabs shared by the Tab panel and the Show Any As Text widget.
// items: [{id, name, fixed}] ("fixed": the first tab that cannot be renamed, deleted or moved). With edit() the viewer may add, rename (double-click), delete (asks twice) and drag tabs.
import { el, icon } from "./util.js";

export function tabStrip(o) {
    const tr = o.tr || ((s) => s);
    const root = el("div", "ndk-ts");
    const navL = el("button", "ndk-ts-nav"), navR = el("button", "ndk-ts-nav"), strip = el("div", "ndk-ts-strip"), add = el("button", "ndk-ts-add");
    for (const b of [navL, navR, add]) b.type = "button";
    navL.append(icon("chevL", 13)); navR.append(icon("chevR", 13)); add.append(icon("plus", 14));
    navL.title = tr("Scroll the tabs left"); navR.title = tr("Scroll the tabs right"); add.title = tr("Add a tab");
    root.append(navL, strip, navR, add);
    let dragEnded = 0;

    const updateNav = () => {
        const over = strip.scrollWidth > strip.clientWidth + 1;
        navL.style.display = navR.style.display = over ? "" : "none";
        navL.disabled = strip.scrollLeft <= 0; navR.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    };
    strip.addEventListener("scroll", updateNav);
    const hold = (b, dir) => {
        let t1 = 0, t2 = 0;
        const step = () => strip.scrollBy({ left: dir * 140, behavior: "smooth" });
        const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = 0; };
        b.addEventListener("pointerdown", (e) => { if (e.button !== 0 || b.disabled) return; e.preventDefault(); e.stopPropagation(); step(); t1 = setTimeout(() => { t2 = setInterval(step, 140); }, 380); });
        for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
    };
    hold(navL, -1); hold(navR, 1);
    const ro = new ResizeObserver(updateNav); ro.observe(strip);
    strip.addEventListener("wheel", (e) => {
        if (e.ctrlKey || strip.scrollWidth <= strip.clientWidth) return;
        strip.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    add.addEventListener("click", (e) => { e.stopPropagation(); o.onAdd?.(); });

    function rename(it, label) {
        const input = el("input", "ndk-ts-rename"); input.type = "text"; input.value = it.name; input.spellcheck = false; input.maxLength = 40;
        label.replaceWith(input); input.focus(); input.select();
        let done = false;
        const fin = (save) => { if (done) return; done = true; const v = input.value.trim(); if (save && v && v !== it.name) o.onRename?.(it.id, v); else render(); };
        input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") fin(true); else if (e.key === "Escape") fin(false); });
        input.addEventListener("pointerdown", (e) => e.stopPropagation());
        input.addEventListener("blur", () => fin(true));
    }

    // drag a tab to change the order: the others make room while it moves (the fixed first tab stays first)
    function drag(t, i, items) {
        t.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 || e.target.closest(".ndk-ts-x, .ndk-ts-rename")) return;
            const els = [...strip.querySelectorAll(".ndk-ts-tab")], rects = els.map((x) => x.getBoundingClientRect());
            const first = items.findIndex((x) => !x.fixed);
            const sx = e.clientX, sc0 = strip.scrollLeft, gap = 2;
            let on = false, to = i, last = sx;
            const place = () => {
                const dx = last - sx + (strip.scrollLeft - sc0), me = rects[i], cx = me.left + me.width / 2 + dx;
                to = i;
                rects.forEach((r, j) => { if (j < first) return; const c = r.left + r.width / 2; if (j < i && cx < c) to = Math.min(to, j); if (j > i && cx > c) to = Math.max(to, j); });
                els.forEach((x, j) => {
                    if (j === i) { x.style.transform = `translateX(${dx}px)`; return; }
                    const sh = to < i && j >= to && j < i ? me.width + gap : to > i && j > i && j <= to ? -(me.width + gap) : 0;
                    x.style.transform = sh ? `translateX(${sh}px)` : "";
                });
            };
            const move = (ev) => {
                last = ev.clientX;
                if (!on) { if (Math.abs(ev.clientX - sx) < 5) return; on = true; t.classList.add("dragging"); strip.classList.add("sorting"); try { t.setPointerCapture(e.pointerId); } catch {} }
                const r = strip.getBoundingClientRect();
                if (ev.clientX < r.left + 24) strip.scrollLeft -= 14; else if (ev.clientX > r.right - 24) strip.scrollLeft += 14;
                place();
            };
            const end = () => {
                t.removeEventListener("pointermove", move); t.removeEventListener("pointerup", end); t.removeEventListener("pointercancel", end);
                if (!on) return;
                dragEnded = Date.now();
                for (const x of els) x.style.transform = "";
                t.classList.remove("dragging"); strip.classList.remove("sorting");
                if (to !== i) o.onMove?.(items[i].id, to);
            };
            t.addEventListener("pointermove", move); t.addEventListener("pointerup", end); t.addEventListener("pointercancel", end);
        });
    }

    function render() {
        const items = o.items(), act = o.active(), edit = !!o.edit?.();
        root.classList.toggle("edit", edit);
        add.style.display = edit && (!o.max || items.length < o.max) ? "" : "none";
        strip.replaceChildren();
        items.forEach((it, i) => {
            const t = el("div", `ndk-ts-tab${it.id === act ? " on" : ""}${it.fixed ? " pin" : ""}`);
            t.dataset.id = it.id;
            const label = el("span", "ndk-ts-l", it.name);
            t.append(label);
            if (edit && !it.fixed) {
                label.title = tr("Double-click to rename. Drag the tab to change the order");
                const x = el("button", "ndk-ts-x", "×"); x.type = "button"; x.title = tr("Delete tab");
                let timer = 0;
                x.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!o.needConfirm?.(it.id) || x.classList.contains("armed")) { o.onDelete?.(it.id); return; }
                    x.classList.add("armed"); x.textContent = tr("Delete?");
                    clearTimeout(timer); timer = setTimeout(() => { x.classList.remove("armed"); x.textContent = "×"; }, 2500);
                });
                x.addEventListener("pointerdown", (e) => e.stopPropagation());
                if (!o.min || items.length > o.min) t.append(x);
                label.addEventListener("dblclick", (e) => { e.stopPropagation(); rename(it, label); });
                drag(t, i, items);
            }
            t.addEventListener("click", () => { if (Date.now() - dragEnded < 80) return; if (it.id !== o.active()) o.onSelect?.(it.id); });
            strip.append(t);
        });
        const a = strip.querySelector(".ndk-ts-tab.on");
        if (a) {
            const ar = a.getBoundingClientRect(), sr = strip.getBoundingClientRect();
            const l = ar.left - sr.left + strip.scrollLeft, r = l + ar.width;
            if (sr.width) { if (l < strip.scrollLeft) strip.scrollLeft = Math.max(0, l - 6); else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth + 6; }
        }
        updateNav();
    }
    return { el: root, render, destroy() { ro.disconnect(); } };
}
