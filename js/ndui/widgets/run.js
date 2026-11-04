// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — running: Generate, Progress, Queue.
import { el, icon } from "./util.js";
import { events, progressOf, overall, runQueue, stopRun, clearQueue, runToNode, runTargetState } from "../events.js";

/* ------------------------------------------------------------------ Generate */

export const generate = {
    type: "generate", label: "Generate", icon: "bolt", group: "Run", live: true,
    slots: [], noLabel: true,
    size: { w: 320, h: 64, minW: 120, minH: 40, maxH: 120 },
    props: [
        { id: "text", kind: "text", label: "Button text", def: "Generate" },
        { id: "batch", kind: "bool", label: "Batch field", def: true, hint: "How many times to queue the workflow with one click." },
        { id: "stop", kind: "bool", label: "Stop button", def: true },
    ],
    mount(ctx) {
        const row = el("div", "ndk-gen");
        const run = el("button", "ndk-btn primary run"); run.type = "button";
        const batch = el("div", "ndk-field batch"); batch.title = ctx.tr("How many times to queue the workflow");
        const bi = el("input", "ndk-input"); bi.type = "text"; bi.inputMode = "numeric"; bi.value = "1"; bi.spellcheck = false;
        batch.append(bi);
        const stop = el("button", "ndk-btn danger stop"); stop.type = "button"; stop.title = ctx.tr("Stop the current run"); stop.append(icon("stop", 15));
        row.append(run, batch, stop);
        ctx.body.append(row);
        const n = () => Math.max(1, Math.min(64, parseInt(bi.value, 10) || 1));
        const go = () => { if (ctx.editing) return; bi.value = String(n()); runQueue(n()); };
        run.addEventListener("click", go);
        stop.addEventListener("click", () => { if (!ctx.editing) stopRun(); });
        bi.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { bi.blur(); go(); } });
        bi.addEventListener("change", () => { bi.value = String(n()); });
        bi.addEventListener("wheel", (e) => { if (!e.shiftKey) return; e.preventDefault(); e.stopPropagation(); bi.value = String(Math.max(1, Math.min(64, n() + (e.deltaY < 0 ? 1 : -1)))); }, { passive: false });
        let busyKey = "";
        const show = () => {
            const busy = events.run.active;
            const text = ctx.prop("text") || ctx.tr("Generate");
            const k = `${busy}|${text}|${ctx.prop("batch")}|${ctx.prop("stop")}`;
            if (k === busyKey) return;
            busyKey = k;
            run.textContent = "";
            run.append(busy ? el("span", "spin") : icon("bolt", 17), el("span", "", busy ? ctx.tr("Running · add to queue") : text));
            batch.style.display = ctx.prop("batch") === false ? "none" : "";
            stop.style.display = ctx.prop("stop") === false ? "none" : "";
            stop.disabled = !busy;
        };
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Run to node */

export const runto = {
    type: "runto", label: "Run to node", icon: "play", group: "Run", live: true,
    slots: [{ id: "node", label: "Target node", data: "anynode", accepts: ["*"], required: true }],
    noLabel: true,
    size: { w: 260, h: 64, minW: 120, minH: 40, maxH: 120 },
    props: [
        { id: "text", kind: "text", label: "Button text", def: "Run to node" },
        { id: "name", kind: "bool", label: "Show the node name", def: true },
        { id: "batch", kind: "bool", label: "Batch field", def: false, hint: "How many times to run up to the node with one click." },
    ],
    mount(ctx) {
        const row = el("div", "ndk-gen ndk-runto");
        const run = el("button", "ndk-btn run"); run.type = "button";
        const batch = el("div", "ndk-field batch"); batch.title = ctx.tr("How many times to run up to the node");
        const bi = el("input", "ndk-input"); bi.type = "text"; bi.inputMode = "numeric"; bi.value = "1"; bi.spellcheck = false;
        batch.append(bi);
        row.append(run, batch);
        ctx.body.append(row);
        const n = () => Math.max(1, Math.min(64, parseInt(bi.value, 10) || 1));
        const target = () => { const st = ctx.info("node"); return st.bound && !st.lost ? st.node : null; };
        const go = () => { if (ctx.editing || ctx.isEditing?.()) return; const node = target(); if (!node) return; bi.value = String(n()); runToNode(node, n()); };
        run.addEventListener("click", go);
        bi.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { bi.blur(); go(); } });
        bi.addEventListener("change", () => { bi.value = String(n()); });
        let key = "";
        const show = () => {
            const node = target();
            const st = runTargetState(node);
            const busy = events.run.active;
            const label = ctx.prop("text") || ctx.tr("Run to node");
            const title = node ? (node.title || node.type) : "";
            const k = `${st}|${busy}|${label}|${title}|${ctx.prop("name")}|${ctx.prop("batch")}`;
            if (k === key) return;
            key = k;
            run.textContent = "";
            run.append(icon("play", 16), el("span", "", ctx.prop("name") !== false && title ? `${label} · ${title}` : label));
            run.disabled = st !== "ok";
            run.title = st === "ok" ? ctx.tr("Run the workflow only up to the node «{name}»", { name: title }) : st === "none" ? ctx.tr("Choose a target node in the inspector") : st === "subgraph" ? ctx.tr("A node inside a subgraph cannot be a target") : st === "off" ? ctx.tr("The target node is muted or bypassed") : ctx.tr("The target node has no output");
            batch.style.display = ctx.prop("batch") ? "" : "none";
        };
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Progress */

export const progress = {
    type: "progress", label: "Progress", icon: "gauge", group: "Run", live: true,
    slots: [{ id: "progress", label: "Node", data: "progress", required: false }],
    size: { w: 360, h: 64, minW: 120, minH: 36, maxH: 120 },
    props: [
        { id: "name", kind: "bool", label: "Show the node name", def: true },
        { id: "steps", kind: "bool", label: "Show the step count", def: true },
    ],
    mount(ctx) {
        const box = el("div", "ndk-prog idle");
        const bar = el("div", "ndk-prog-bar"), fill = el("div", "ndk-prog-fill"); bar.append(fill);
        const row = el("div", "ndk-prog-row"), left = el("span"), mid = el("span", "mid"), right = el("span", "end");
        row.append(left, mid, right);
        box.append(bar, row);
        ctx.body.append(box);
        const show = () => {
            const st = ctx.info("progress");
            const run = events.run;
            let pct, name = "", steps = "", active;
            if (st.bound && st.node) {
                const p = progressOf(st.node);
                pct = p.pct; active = p.active; name = st.node.title || st.node.type; steps = p.max ? `${p.value}/${p.max}` : "";
            } else {
                pct = overall(); active = run.active; name = run.current; steps = run.max ? `${run.value}/${run.max}` : "";
            }
            const err = !!events.lastError && !active;
            box.classList.toggle("idle", !active && pct < 1);
            box.classList.toggle("err", err);
            fill.style.width = `${Math.round(pct * 1000) / 10}%`;
            const pctText = active || pct > 0 ? `${Math.round(pct * 100)}%` : "";
            left.textContent = err ? events.lastError : active ? (ctx.prop("name") === false ? ctx.tr("Running") : name || ctx.tr("Running")) : pct >= 1 ? ctx.tr("Done") : ctx.tr("Idle");
            mid.textContent = steps && ctx.prop("steps") !== false && active ? steps : "";
            right.textContent = ""; right.append(el("b", "", pctText));
        };
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Queue */

export const queue = {
    type: "queue", label: "Queue", icon: "queue", group: "Run", live: true,
    slots: [], noLabel: true,
    size: { w: 240, h: 48, minW: 100, minH: 32, maxH: 80 },
    props: [{ id: "clear", kind: "bool", label: "Clear button", def: true }],
    mount(ctx) {
        const row = el("div", "ndk-queue");
        const num = el("span", "num", "0"), txt = el("span", "txt");
        const clr = el("button", "ndk-btn danger"); clr.type = "button"; clr.title = ctx.tr("Remove everything that waits in the queue"); clr.append(icon("trash", 15));
        clr.style.padding = "0 10px";
        clr.addEventListener("click", () => { if (!ctx.editing) clearQueue(); });
        row.append(num, txt, clr);
        ctx.body.append(row);
        const show = () => {
            const q = events.queue;
            const waiting = q.pending;
            num.textContent = String(waiting + (events.run.active ? 1 : 0));
            row.classList.toggle("busy", events.run.active || waiting > 0);
            txt.textContent = events.run.active ? (waiting ? ctx.tr("running, {n} waiting", { n: waiting }) : ctx.tr("running")) : waiting ? ctx.tr("{n} waiting", { n: waiting }) : ctx.tr("queue is empty");
            clr.style.display = ctx.prop("clear") === false ? "none" : "";
            clr.disabled = waiting === 0;
        };
        show();
        return { update: show };
    },
};
