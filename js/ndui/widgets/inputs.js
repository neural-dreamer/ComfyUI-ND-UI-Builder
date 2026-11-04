// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — numbers: Number, Slider, Knob, Seed, and the Toggle.
import { el, icon, clampN, snap, decimalsOf, fmt, parseNumber, screenScale, dragger } from "./util.js";

const NUM = ["INT", "FLOAT"];
const numProps = (extra = []) => [
    { id: "min", kind: "number", label: "Min", hint: "Narrows the range of the parameter; it cannot go beyond what the node allows." },
    { id: "max", kind: "number", label: "Max", hint: "Narrows the range of the parameter; it cannot go beyond what the node allows." },
    { id: "step", kind: "number", label: "Step", hint: "Step of the arrows, the keys and the slider." },
    { id: "decimals", kind: "int", label: "Decimals", min: 0, max: 6, hint: "Digits after the point. Empty: as the step says." },
    { id: "unit", kind: "text", label: "Unit", hint: "A short text after the value, e.g. px or %." },
    ...extra,
];

// the precision, step and range a widget works in (what the node allows, narrowed by the person)
function range(ctx, slot) {
    const l = ctx.limits(slot);
    let { min, max, step, precision } = l;
    const dec = ctx.prop("decimals");
    if (dec != null && dec !== "" && Number.isFinite(Number(dec))) precision = Math.max(0, Math.min(6, Math.round(Number(dec))));
    else if (ctx.prop("step") != null && ctx.prop("step") !== "" && precision > 0) precision = Math.max(precision, decimalsOf(step));
    return { min, max, step: step > 0 ? step : 1, precision, int: ctx.info(slot).ptype === "INT" };
}
function commit(ctx, slot, v, r) {
    if (!Number.isFinite(v)) return false;
    v = clampN(snap(v, r.step, r.min), r.min, r.max);
    v = r.int ? Math.round(v) : Number(v.toFixed(Math.max(r.precision, 6)));
    ctx.set(slot, v);
    return true;
}

/* ------------------------------------------------------------------ Number */

export const number = {
    type: "number", label: "Number", icon: "number", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: NUM, required: true }],
    size: { w: 240, h: 60, minW: 96, minH: 40, maxH: 140 },
    props: numProps([{ id: "buttons", kind: "bool", label: "Arrow buttons", def: true }]),
    mount(ctx) {
        const f = el("div", "ndk-field ndk-num");
        const minus = el("button", "ndk-iconbtn"), plus = el("button", "ndk-iconbtn");
        minus.type = plus.type = "button";
        minus.append(icon("minus", 16)); plus.append(icon("plus", 16));
        minus.tabIndex = plus.tabIndex = -1;
        const input = el("input", "ndk-input ndk-scrub");
        input.type = "text"; input.inputMode = "decimal"; input.spellcheck = false;
        const unit = el("span", "ndk-unit");
        f.append(minus, input, unit, plus);
        ctx.body.append(f);
        let last = "";
        const show = () => {
            const r = range(ctx, "value");
            const v = ctx.get("value");
            const text = fmt(v, r.precision);
            if (document.activeElement !== input && text !== last) { input.value = text; last = text; }
            unit.textContent = ctx.prop("unit") || "";
            unit.style.display = unit.textContent ? "" : "none";
            const b = ctx.prop("buttons") !== false;
            minus.style.display = plus.style.display = b ? "" : "none";
            input.style.padding = b ? "0 4px" : "0 12px";
        };
        const bump = (dir, mult = 1) => { const r = range(ctx, "value"); commit(ctx, "value", Number(ctx.get("value") || 0) + dir * r.step * mult, r); show(); };
        minus.addEventListener("click", () => bump(-1));
        plus.addEventListener("click", () => bump(1));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { input.blur(); }
            else if (e.key === "Escape") { last = ""; input.value = ""; input.blur(); show(); }
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); bump(e.key === "ArrowUp" ? 1 : -1, e.shiftKey ? 10 : e.altKey ? 0.1 : 1); input.value = fmt(ctx.get("value"), range(ctx, "value").precision); }
            e.stopPropagation();
        });
        input.addEventListener("blur", () => {
            const r = range(ctx, "value");
            const n = parseNumber(input.value);
            if (Number.isFinite(n)) commit(ctx, "value", n, r);
            last = ""; show();
        });
        // dragging over the value changes it, a click edits it
        let moved = false;
        dragger(input, {
            start(e) { if (document.activeElement === input) return false; e.preventDefault(); moved = false; return { x: e.clientX, v: Number(ctx.get("value") || 0), k: screenScale(f) }; },
            move(e, s) {
                const dx = (e.clientX - s.x) / s.k;
                if (!moved && Math.abs(dx) < 3) return;
                moved = true;
                const r = range(ctx, "value");
                const per = r.int ? 0.25 : 0.1; // steps per pixel
                commit(ctx, "value", s.v + dx * per * r.step * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1), r);
                show();
            },
            end() { if (!moved) { input.focus(); input.select(); } },
        });
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Slider */

export const slider = {
    type: "slider", label: "Slider", icon: "sliders", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: NUM, required: true }],
    size: { w: 320, h: 64, minW: 120, minH: 40, maxH: 110 },
    props: numProps([
        { id: "showValue", kind: "bool", label: "Show the value", def: true },
        { id: "default", kind: "number", label: "Reset to", hint: "The value a double click on the slider goes back to." },
    ]),
    mount(ctx) {
        const row = el("div", "ndk-sl");
        const track = el("div", "ndk-sl-track"), fill = el("div", "ndk-sl-fill"), thumb = el("div", "ndk-sl-thumb");
        track.append(fill, thumb);
        const field = el("div", "ndk-field");
        const input = el("input", "ndk-input"); input.spellcheck = false; input.inputMode = "decimal";
        const unit = el("span", "ndk-unit");
        field.append(input, unit);
        row.append(track, field);
        ctx.body.append(row);
        let last = "";
        const bounds = (r) => (Number.isFinite(r.min) && Number.isFinite(r.max) && r.max > r.min ? [r.min, r.max] : [Number.isFinite(r.min) ? r.min : 0, Number.isFinite(r.max) ? r.max : (Number.isFinite(r.min) ? r.min : 0) + 100]);
        const show = () => {
            const r = range(ctx, "value");
            const [lo, hi] = bounds(r);
            const v = Number(ctx.get("value"));
            const p = Number.isFinite(v) ? clampN((v - lo) / (hi - lo), 0, 1) : 0;
            fill.style.width = `${p * 100}%`;
            thumb.style.left = `${p * 100}%`;
            const text = fmt(v, r.precision);
            if (document.activeElement !== input && text !== last) { input.value = text; last = text; }
            const sv = ctx.prop("showValue") !== false;
            field.style.display = sv ? "" : "none";
            unit.textContent = ctx.prop("unit") || ""; unit.style.display = unit.textContent ? "" : "none";
            field.style.width = unit.textContent ? "92px" : "";
        };
        const fromX = (e, s) => {
            const r = range(ctx, "value");
            const [lo, hi] = bounds(r);
            const rect = track.getBoundingClientRect();
            const p = clampN((e.clientX - rect.left) / rect.width, 0, 1);
            commit(ctx, "value", lo + p * (hi - lo), r);
            show();
        };
        dragger(track, { start(e) { track.classList.add("drag"); fromX(e); return {}; }, move: fromX, end() { track.classList.remove("drag"); } });
        track.addEventListener("dblclick", () => {
            const r = range(ctx, "value");
            const d = ctx.prop("default");
            const def = d != null && d !== "" ? Number(d) : ctx.info("value").def;
            if (Number.isFinite(Number(def))) { commit(ctx, "value", Number(def), r); show(); }
        });
        track.addEventListener("wheel", (e) => {
            if (!e.shiftKey && !e.altKey) return; // a plain wheel zooms the canvas
            e.preventDefault(); e.stopPropagation();
            const r = range(ctx, "value");
            commit(ctx, "value", Number(ctx.get("value") || 0) + (e.deltaY < 0 ? 1 : -1) * r.step, r); show();
        }, { passive: false });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); else if (e.key === "Escape") { last = ""; input.value = ""; input.blur(); show(); } e.stopPropagation(); });
        input.addEventListener("blur", () => { const n = parseNumber(input.value); if (Number.isFinite(n)) commit(ctx, "value", n, range(ctx, "value")); last = ""; show(); });
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Knob */

export const knob = {
    type: "knob", label: "Knob", icon: "knob", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: NUM, required: true }],
    size: { w: 120, h: 132, minW: 64, minH: 72, maxH: 320 },
    fill: true,
    props: numProps(),
    mount(ctx) {
        const box = el("div", "ndk-knob");
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        const mk = (cls, d) => { const p = document.createElementNS(NS, "path"); p.setAttribute("class", cls); p.setAttribute("fill", "none"); p.setAttribute("stroke-width", "7"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("d", d); return p; };
        const A0 = -225, A1 = 45; // degrees (0 = right, clockwise): 270° sweep, open at the bottom
        const pt = (a, r = 38) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)];
        const arc = (a, b) => { const [x0, y0] = pt(a), [x1, y1] = pt(b); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A38 38 0 ${b - a > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
        const trk = mk("trk", arc(A0, A1)), val = mk("val", arc(A0, A0 + 0.01));
        const dot = document.createElementNS(NS, "circle"); dot.setAttribute("class", "dot"); dot.setAttribute("r", "5");
        svg.append(trk, val, dot);
        const txt = el("div", "ndk-knob-val");
        box.append(svg, txt);
        ctx.body.append(box);
        const bounds = (r) => (Number.isFinite(r.min) && Number.isFinite(r.max) && r.max > r.min ? [r.min, r.max] : [Number.isFinite(r.min) ? r.min : 0, Number.isFinite(r.max) ? r.max : (Number.isFinite(r.min) ? r.min : 0) + 100]);
        const fit = () => { const s = Math.max(40, Math.min(box.clientWidth, box.clientHeight - 24)); svg.style.width = svg.style.height = `${s}px`; };
        const show = () => {
            fit();
            const r = range(ctx, "value");
            const [lo, hi] = bounds(r);
            const v = Number(ctx.get("value"));
            const p = Number.isFinite(v) ? clampN((v - lo) / (hi - lo), 0, 1) : 0;
            const a = A0 + p * (A1 - A0);
            val.setAttribute("d", arc(A0, Math.max(A0 + 0.01, a)));
            const [dx, dy] = pt(a); dot.setAttribute("cx", dx.toFixed(2)); dot.setAttribute("cy", dy.toFixed(2));
            txt.textContent = fmt(v, r.precision) + (ctx.prop("unit") ? ` ${ctx.prop("unit")}` : "");
        };
        dragger(svg, {
            start(e) { const r = range(ctx, "value"); return { y: e.clientY, v: Number(ctx.get("value") || 0), k: screenScale(svg), r }; },
            move(e, s) {
                const [lo, hi] = bounds(s.r);
                const dy = (s.y - e.clientY) / s.k;
                commit(ctx, "value", s.v + (dy / (e.shiftKey ? 1200 : 160)) * (hi - lo), s.r);
                show();
            },
        });
        svg.addEventListener("dblclick", () => { const d = ctx.info("value").def; if (Number.isFinite(Number(d))) { commit(ctx, "value", Number(d), range(ctx, "value")); show(); } });
        txt.addEventListener("dblclick", () => { const d = ctx.info("value").def; if (Number.isFinite(Number(d))) { commit(ctx, "value", Number(d), range(ctx, "value")); show(); } });
        show();
        return { update: show, resize: show };
    },
};

/* ------------------------------------------------------------------ Seed */

const CONTROLS = ["fixed", "increment", "decrement", "randomize"];
const CONTROL_TEXT = { fixed: "Fixed", increment: "+1", decrement: "−1", randomize: "Random" };

export const seed = {
    type: "seed", label: "Seed", icon: "seed", group: "Inputs",
    slots: [
        { id: "value", label: "Seed", accepts: ["INT"], required: true },
        { id: "control", label: "Control after generate", accepts: ["COMBO"], required: false, hint: "The widget control_after_generate of the node: what happens to the seed after each run." },
    ],
    size: { w: 280, h: 60, minW: 160, minH: 40, maxH: 96 },
    props: [],
    mount(ctx) {
        const f = el("div", "ndk-field ndk-seed");
        const input = el("input", "ndk-input"); input.type = "text"; input.inputMode = "numeric"; input.spellcheck = false;
        const mode = el("button", "ndk-pill"); mode.type = "button";
        const dice = el("button", "ndk-iconbtn"); dice.type = "button"; dice.append(icon("dice", 18));
        f.append(input, mode, dice);
        ctx.body.append(f);
        let last = "";
        const maxSeed = () => { const m = ctx.limits("value").max; return Number.isFinite(m) ? Math.min(m, Number.MAX_SAFE_INTEGER) : 2 ** 32 - 1; };
        const show = () => {
            const text = String(Math.round(Number(ctx.get("value")) || 0));
            if (document.activeElement !== input && text !== last) { input.value = text; last = text; }
            const ci = ctx.info("control");
            const c = ci.bound ? ctx.get("control") : null;
            mode.style.display = ci.bound ? "" : "none";
            mode.textContent = ctx.tr(CONTROL_TEXT[c] || String(c ?? ""));
            mode.title = ctx.tr("What happens to the seed after each run. Click to change.");
        };
        dice.title = ctx.tr("A new random seed");
        dice.addEventListener("click", () => { ctx.set("value", Math.floor(Math.random() * maxSeed())); show(); });
        mode.addEventListener("click", () => {
            const opts = ctx.info("control").options?.length ? ctx.info("control").options : CONTROLS;
            const i = opts.indexOf(ctx.get("control"));
            ctx.set("control", opts[(i + 1) % opts.length]);
            show();
        });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); else if (e.key === "Escape") { last = ""; input.value = ""; input.blur(); show(); } e.stopPropagation(); });
        input.addEventListener("blur", () => { const n = parseNumber(input.value); if (Number.isFinite(n)) ctx.set("value", Math.max(0, Math.round(n))); last = ""; show(); });
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Toggle */

export const toggle = {
    type: "toggle", label: "Toggle", icon: "toggle", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: ["BOOLEAN"], required: true }],
    size: { w: 260, h: 52, minW: 100, minH: 28, maxH: 120 },
    noLabel: true, // the switch has its own text
    props: [
        { id: "text", kind: "text", label: "Text", hint: "The text next to the switch. Empty: the name of the parameter." },
        { id: "description", kind: "text", label: "Description", hint: "A small line under the text." },
    ],
    mount(ctx) {
        const t = el("div", "ndk-tg"); t.tabIndex = 0; t.setAttribute("role", "switch");
        const sw = el("span", "ndk-tg-sw");
        const txt = el("span", "ndk-tg-txt"), b = el("b"), small = el("small");
        txt.append(b, small);
        t.append(sw, txt);
        ctx.body.append(t);
        const show = () => {
            const on = !!ctx.get("value");
            t.classList.toggle("on", on);
            t.setAttribute("aria-checked", String(on));
            b.textContent = ctx.prop("text") || ctx.prop("label") || ctx.w.props.label || "";
            small.textContent = ctx.prop("description") || "";
            small.style.display = small.textContent ? "" : "none";
        };
        const flip = () => { ctx.set("value", !ctx.get("value")); show(); };
        t.addEventListener("click", flip);
        t.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } e.stopPropagation(); });
        show();
        return { update: show };
    },
};
