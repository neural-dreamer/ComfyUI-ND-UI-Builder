// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the page that adapts to the width of the window ("Adapt to the width").
// Pure data in, pure data out (no DOM, no ComfyUI): the same functions are used by the page, the editor preview and the tests.
//
//   adaptGeo(ui, cw, ch)          -> { s, W }   the scale of the page and its width in page units (W >= page.w)
//   adaptWidth(ui, pageId, W)     -> Map id -> { x, w }   the new x and width of every widget of the page (x is in the coordinates of its container,
//                                                         as the widget's own x is); widgets that do not change are not in the map
//   adaptedUi(ui, pageId, W)      -> a copy of `ui` whose widgets of that page carry the new x / w (layoutFlow and everything else read it as it is)
//
// How the width is shared out. The x axis of a container (the page, a panel, the inside of a spoiler) is cut at the edges of its widgets. A piece that
// no widget covers at any height is a GAP (the margins at the sides are gaps too); the others are CONTENT. A widget wants a factor d of its width
// (Proportional: as much as the container grows, Stretch: that, but not more than +N % or +N px, Fixed: none). A piece of content grows by the biggest
// factor of the widgets that cover it; what is left of the new width is shared out EQUALLY between the gaps. So the columns spread evenly, the side
// widgets move off the edges, and two widgets that did not overlap on the x axis never overlap afterwards (the map is monotone and a widget never
// grows beyond the place that its x-range gets). A widget that is narrower than its place stands in it as Align says.

import { levelOf, panelOf, isPanelLike, isSpoiler, spoilerPad, PAGE_MAX, ADAPT_MODES, ADAPT_ALIGN, ADAPT_MAX_DEFAULT } from "./model.js";
export { ADAPT_MODES, ADAPT_ALIGN, ADAPT_MAX_DEFAULT };

/* ------------------------------------------------------------------ what a widget wants */

const SCALE_TYPES = new Set(["panel", "tabbox", "divider", "heading", "textblock", "textout", "viewer", "image", "simpleimage", "imageinput", "prompt", "nodeembed", "spoiler", "tabs", "video", "audio", "player", "videoinput", "audioinput"]);
const FIXED_TYPES = new Set(["activity", "uiscale", "toggle", "knob"]);

// the mode that `auto` stands for
export const autoModeOf = (type) => (SCALE_TYPES.has(type) ? "scale" : FIXED_TYPES.has(type) ? "fixed" : "stretch");

// the settings of a widget with the defaults filled in: { mode: fixed|stretch|scale, max, unit: "%"|"px", align }
export function adaptOf(w) {
    const a = w?.adapt && typeof w.adapt === "object" ? w.adapt : {};
    const mode = ADAPT_MODES.includes(a.mode) && a.mode !== "auto" ? a.mode : autoModeOf(w?.type);
    const max = Number.isFinite(Number(a.max)) && a.max !== "" && a.max != null ? Math.max(0, Math.min(PAGE_MAX, Number(a.max))) : ADAPT_MAX_DEFAULT;
    return { mode, max, unit: a.unit === "px" ? "px" : "%", align: ADAPT_ALIGN.includes(a.align) ? a.align : "left" };
}

// how many times wider a widget would like to be when its container grows k times
export function wantedFactor(w, k) {
    if (!(k > 1)) return 1;
    const a = adaptOf(w);
    if (a.mode === "fixed") return 1;
    if (a.mode === "scale") return k;
    const cap = a.unit === "px" ? (w.w + a.max) / Math.max(1, w.w) : 1 + a.max / 100;
    return Math.max(1, Math.min(k, cap));
}

// how many times taller a widget would like to be when the height of its container grows k times: only the big areas grow (panels, viewers, pictures);
// sliders, buttons and the like keep their height, and the room that is left goes into the gaps between the rows. `adapt.mode` set by hand is respected.
const V_TYPES = new Set(["panel", "tabbox", "viewer", "image", "simpleimage", "imageinput", "prompt", "textout", "nodeembed", "tabs", "video", "player", "videoinput"]);
export function wantedFactorV(w, k) {
    if (!(k > 1)) return 1;
    const a = w?.adapt && typeof w.adapt === "object" ? w.adapt : {};
    if (a.mode === "fixed") return 1;
    if (a.mode === "scale") return k;
    if (a.mode === "stretch") { const o = adaptOf(w); const cap = o.unit === "px" ? (w.h + o.max) / Math.max(1, w.h) : 1 + o.max / 100; return Math.max(1, Math.min(k, cap)); }
    return V_TYPES.has(w?.type) ? k : 1;
}

/* ------------------------------------------------------------------ the geometry of the page */

// The page is shown 1:1 (like a web page): narrower than its width, the whole page shrinks to fit; wider, the extra width goes to the layout.
// opts.maxW: the layout does not get wider than that (the page then stands in the middle). opts.model "scaled": the old way, the page is first
// scaled to the window (by the smaller side) and only the proportions left over are shared out.
// -> { s, W, H }: H is the height of the page in page units: the window is taller than the page, so the layout grows downwards too (opts.len: the least length of the page)
export function adaptGeo(ui, cw, ch, opts = {}) {
    const pw = Math.max(1, ui.page.w), ph = Math.max(1, ui.page.h);
    const maxW = Number(opts.maxW ?? ui.view?.maxW) || 0;
    let s, W;
    if (opts.model === "scaled") {
        s = Math.min(cw / pw, ch / ph);
        W = Math.max(pw, cw / s);
    } else {
        s = Math.min(1, cw / pw);
        W = Math.max(pw, cw / s);
    }
    if (!(s > 0) || !Number.isFinite(s)) s = 1;
    if (maxW > 0) W = Math.min(W, Math.max(pw, maxW));
    const len = Math.max(ph, Number(opts.len) || 0);
    let H = ph;
    if (ch > 0 && Number.isFinite(ch / s) && ch / s > len + 0.5) H = ch / s;
    return { s, W: Number.isFinite(W) ? W : pw, H: Number.isFinite(H) ? H : ph };
}

/* ------------------------------------------------------------------ one container */

// items: [{ id, x, w, w0: the widget, hidden }] with x counted from the left edge of the container, P: its width, Pn: its new width
// -> Map id -> { x, w } (the same coordinates); an empty map when nothing changes
export function adaptContainer(items, P, Pn, want = wantedFactor, alignOf = (w0) => adaptOf(w0).align) {
    const out = new Map();
    if (!items.length || !(Pn > P + 0.01) || !(P > 0)) return out;
    const k = Pn / P;
    const vis = items.filter((i) => !i.hidden);
    const d = new Map(items.map((i) => [i.id, want(i.w0, k)]));

    // the cuts of the x axis (only the visible widgets hold room); everything that lies outside 0..P keeps its size
    const cuts = new Set([0, P]);
    for (const i of vis) { if (i.x > 0 && i.x < P) cuts.add(i.x); const e = i.x + i.w; if (e > 0 && e < P) cuts.add(e); }
    const xs = [...cuts].sort((a, b) => a - b);
    const segs = [];
    for (let n = 0; n + 1 < xs.length; n++) {
        const a = xs[n], b = xs[n + 1];
        if (b - a < 1e-9) continue;
        let c = 0, covered = false;
        for (const i of vis) if (i.x < b - 1e-9 && i.x + i.w > a + 1e-9) { covered = true; c = Math.max(c, d.get(i.id)); }
        segs.push({ a, b, len: b - a, covered, c: covered ? c : 1 });
    }
    let used = 0, gaps = 0;
    for (const s of segs) { if (s.covered) used += s.len * s.c; else { used += s.len; gaps++; } }
    const rest = Math.max(0, Pn - used);
    const share = gaps ? rest / gaps : 0, lead = gaps ? 0 : rest / 2;     // nothing to spread it into: the layout stands in the middle
    // the monotone map: the knots (old x, new x)
    const knots = [{ o: 0, n: lead }];
    let at = lead;
    for (const s of segs) { at += s.covered ? s.len * s.c : s.len + share; knots.push({ o: s.b, n: at }); }
    const f = (x) => {
        if (x <= 0) return knots[0].n + x;
        if (x >= P) return knots[knots.length - 1].n + (x - P);
        let lo = 0, hi = knots.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (knots[m].o <= x) lo = m; else hi = m; }
        const A = knots[lo], B = knots[hi];
        return A.n + (x - A.o) * (B.n - A.n) / Math.max(1e-9, B.o - A.o);
    };
    for (const i of items) {
        const x0 = f(i.x), x1 = f(i.x + i.w), T = x1 - x0;
        const D = Math.max(Math.min(i.w * d.get(i.id), T), Math.min(i.w, T));
        const al = alignOf(i.w0);
        const x = al === "right" ? x1 - D : al === "center" ? x0 + (T - D) / 2 : x0;
        out.set(i.id, { x, w: D });
    }
    return out;
}

/* ------------------------------------------------------------------ the page */

// The widgets that stand in a container: those of one level (the page or a spoiler). A panel is a box that holds the widgets lying in it:
// they are laid out in the panel's own width (height), so that they stay in it.
// axis "x": the width, `Pn` the new width of the page; axis "y": the height. -> Map id -> { p, s } (the new place and size on that axis)
function adaptAxis(ui, pageId, Pn, axis) {
    const res = new Map();
    const V = axis === "y";
    const pos = V ? "y" : "x", size = V ? "h" : "w";
    const want = V ? wantedFactorV : wantedFactor;
    const alignOf = V ? () => "left" : undefined;
    const P0 = V ? ui.page.h : ui.page.w;

    // `container` is a level (parent id) and the box of the container in that level's coordinates, Pn the new size
    function level(parentId, P, Pn) {
        const list = levelOf(ui, pageId, parentId);
        if (!list.length) return;
        const owner = new Map();                // widget id -> the panel that holds it (the innermost one) or null
        for (const w of list) owner.set(w.id, panelOf(ui, w)?.id || null);
        const box = (ownerId, Pc, Pcn) => {
            const members = list.filter((w) => owner.get(w.id) === ownerId);
            const base = ownerId ? list.find((w) => w.id === ownerId)[pos] : 0;
            const items = members.map((w) => ({ id: w.id, x: w[pos] - base, w: w[size], w0: w, hidden: w.hidden === true }));
            const m = adaptContainer(items, Pc, Pcn, want, alignOf);
            return { m, base };
        };
        // top-down: the level itself, then each panel in the box it got
        const place = new Map();                // id -> { p, s } in the coordinates of the level
        const walk = (ownerId, Pc, Pcn, nbase) => {
            const { m, base } = box(ownerId, Pc, Pcn);
            for (const w of list) {
                if (owner.get(w.id) !== ownerId) continue;
                const r = m.get(w.id);
                const np = r ? nbase + r.x : nbase + (w[pos] - base), ns = r ? r.w : w[size];
                place.set(w.id, { p: np, s: ns });
                if (isPanelLike(w)) walk(w.id, w[size], ns, np);
            }
        };
        walk(null, P, Pn, 0);
        for (const w of list) {
            const r = place.get(w.id);
            if (r && (Math.abs(r.p - w[pos]) > 0.01 || Math.abs(r.s - w[size]) > 0.01)) res.set(w.id, r);
            // the inside of a spoiler: its width changed, so its content is laid out again in the new inner width (the height of a spoiler does not follow the window)
            if (!V && isSpoiler(w)) {
                const pad = spoilerPad(w), inner = Math.max(40, w.w - 2 * pad), nw = place.get(w.id)?.s ?? w.w;
                level(w.id, inner, Math.max(40, nw - 2 * pad));
            }
        }
    }
    level(null, P0, Pn);
    return res;
}

// the new x and width of every widget of the page for the page width W
export function adaptWidth(ui, pageId, W) {
    const out = new Map();
    for (const [id, r] of adaptAxis(ui, pageId, W, "x")) out.set(id, { x: r.p, w: r.s });
    return out;
}
// the new y and height of every widget of the page for the page height H (the big areas grow, the rest keeps its height)
export function adaptHeight(ui, pageId, H) {
    const out = new Map();
    for (const [id, r] of adaptAxis(ui, pageId, H, "y")) out.set(id, { y: r.p, h: r.s });
    return out;
}

// a copy of the model in which the widgets of the page have their new x / w (and y / h, when H is given)
export function adaptedUi(ui, pageId, W, H = 0) {
    const mx = W > ui.page.w + 0.01 ? adaptWidth(ui, pageId, W) : new Map();
    const my = H > ui.page.h + 0.01 ? adaptHeight(ui, pageId, H) : new Map();
    if (!mx.size && !my.size) return ui;
    return { ...ui, widgets: ui.widgets.map((w) => { const a = mx.get(w.id), b = my.get(w.id); return a || b ? { ...w, ...(a || {}), ...(b || {}) } : w; }) };
}
