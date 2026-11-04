// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the progress bar along the top or bottom edge of the ND UI mode (like the one of rgthree).
// Two bars (split): nodes of the run on one half, steps of the running node on the other; or one bar (single).
import { events, subscribe, progressOf } from "./events.js";

const el = (cls) => { const e = document.createElement("div"); e.className = cls; return e; };

/** the data the bar shows: {active, idle, err, nodes, steps, text} (text: "(2/9) 34% - KSampler (45%)") */
export function barData(tr = (s) => s) {
    const p = progressOf(null), run = events.run;
    const err = !!events.lastError && !p.active;
    const done = run.complete && !p.active;
    const nodes = done ? 1 : p.pct;
    const parts = [];
    if (p.active || done || nodes > 0) {
        if (p.total > 1 || p.done) parts.push(`(${Math.min(p.done + (p.active ? 1 : 0), p.total)}/${p.total})`);
        parts.push(`${Math.round(nodes * 100)}%`);
        if (p.name && p.active) parts.push(`- ${p.name}`);
        if (p.active && p.max) parts.push(`(${Math.round(p.steps * 100)}%)`);
    }
    return { active: p.active, idle: !p.active && !done && !err, err, nodes, steps: p.active ? p.steps : done ? 1 : 0, text: err ? events.lastError : parts.join(" ") || tr("Idle"), pct: Math.round(nodes * 100) };
}

/** builds the bar inside `box` once; paint(cfg, data) draws the state */
export function makeBar(box) {
    box.textContent = "";
    const track = el("ndk-pb-track"), a = el("ndk-pb-fill a"), b = el("ndk-pb-fill b"), txt = el("ndk-pb-text");
    track.append(a, b); box.append(track, txt);
    return {
        paint(cfg, d) {
            const split = cfg.mode === "split";
            box.dataset.pos = cfg.pos; box.dataset.mode = cfg.mode;
            box.classList.toggle("err", d.err); box.classList.toggle("idle", d.idle); box.classList.toggle("glow", !!cfg.glow);
            box.style.setProperty("--pb-h", `${cfg.height}px`);
            box.style.setProperty("--pb-bg", cfg.bg || "");
            const c1 = cfg.fill === "custom" && cfg.c1 ? cfg.c1 : "var(--ndk-accent,#7757fa)";
            const c2 = cfg.fill === "custom" && cfg.c1 ? (cfg.c2 || cfg.c1) : c1;
            box.style.setProperty("--pb-fill", c1 === c2 ? c1 : `linear-gradient(${cfg.angle}deg, ${c1}, ${c2})`);
            box.style.setProperty("--pb-glow", c2);
            a.style.width = `${Math.round(d.nodes * 1000) / 10}%`;
            b.style.width = `${Math.round(d.steps * 1000) / 10}%`;
            b.style.display = split ? "" : "none";
            txt.style.display = cfg.text === "none" ? "none" : "";
            txt.textContent = cfg.text === "pct" ? (d.err ? d.text : `${d.pct}%`) : d.text;
        },
    };
}

/** the bar of the mode: `root` is the element of the mode, `getUi` gives the panel */
export function mountProgressBar(root, getUi, tr) {
    const box = el("ndk-pbar");
    root.append(box);
    const bar = makeBar(box);
    const show = () => {
        const cfg = getUi().view.progressBar;
        if (!cfg?.show) { box.style.display = "none"; return; }
        const d = barData(tr);
        box.style.display = cfg.idleHide && d.idle ? "none" : "";
        bar.paint(cfg, d);
    };
    const unsub = subscribe(show);
    show();
    return { update: show, destroy() { unsub(); box.remove(); } };
}
