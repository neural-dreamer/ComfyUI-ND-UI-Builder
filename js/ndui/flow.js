// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the layout of a page with spoilers.
// On the page every position is written as if all the spoilers were closed. An open spoiler pushes down what lies below it:
//   offset(W) = sum of extra(S) over the open spoilers S of the same level for which W lies under the header of S
//   and W overlaps the band of S horizontally. The band is S itself; for a spoiler lying in a panel the band is
//   that panel for the neighbours outside it (they lie below the panel). A panel grows by the spoilers inside it.
// Pure data in, pure data out: layoutFlow(ui, pageId, isOpen, rootId) -> {rects: Map id -> {x,y,w,h,vis}, bottom}
// The rects are absolute in the coordinates of the root (the page, or the content area of the spoiler `rootId`).
import { levelOf, isSpoiler, spoilerPad, headHOf, panelOf, insidePanel } from "./model.js";

const MIN_INNER = 24;

// A spoiler with a maximum height (props.max_h > 0) shows at most that much of its inside; the rest scrolls (scrollOf(id) = offset).
// The result also has `info`: id -> {view, total, top} of the spoilers that scroll, and each rect may carry `clip` = {x,y,w,h}, the window
// of the scrolling spoilers it lies in (absolute, like the rect).
export const maxInner = (w) => { const m = Math.round(Number(w.props?.max_h)); return Number.isFinite(m) && m > 0 ? Math.max(MIN_INNER, m) : 0; };

export function layoutFlow(ui, pageId, isOpen, rootId = null, scrollOf = () => 0) {
    const info = new Map();

    function level(parentId) {
        const list = levelOf(ui, pageId, parentId);
        const subs = new Map();
        const extra = new Map();
        for (const s of list) {
            if (!isSpoiler(s)) continue;
            const sub = level(s.id);
            subs.set(s.id, sub);
            const open = !!isOpen(s.id);
            const mi = maxInner(s), total = Math.max(MIN_INNER, sub.bottom), view = mi ? Math.min(mi, total) : total;
            if (mi && total > view) info.set(s.id, { view, total, top: Math.max(0, Math.min(total - view, Number(scrollOf(s.id)) || 0)) });
            extra.set(s.id, open ? 2 * spoilerPad(s) + view : 0);
        }
        const panelOfS = new Map(), insideOf = new Map();
        for (const [id, e] of extra) {
            if (e <= 0) continue;
            const s = list.find((w) => w.id === id);
            const p = panelOf(ui, s);
            if (p) { panelOfS.set(id, p); if (!insideOf.has(p.id)) insideOf.set(p.id, new Set(insidePanel(ui, p).map((w) => w.id))); }
        }
        const rects = new Map();
        let bottom = 0;
        for (const w of list) {
            let off = 0, grow = 0;
            for (const [sid, e] of extra) {
                if (e <= 0 || sid === w.id) continue;
                const s = list.find((x) => x.id === sid);
                const p = panelOfS.get(sid);
                if (p && w.id === p.id) { grow += e; continue; }
                let band = s, thr = s.y + headHOf(ui, s);
                if (p && !insideOf.get(p.id).has(w.id)) { band = p; thr = p.y + p.h; }
                if (w.y >= thr - 0.5 && w.x < band.x + band.w && band.x < w.x + w.w) off += e;
            }
            const h = isSpoiler(w) ? headHOf(ui, w) + (extra.get(w.id) || 0) : w.h + grow;
            rects.set(w.id, { x: w.x, y: w.y + off, w: w.w, h });
            bottom = Math.max(bottom, w.y + off + h);
        }
        return { list, subs, rects, bottom };
    }

    const out = new Map();
    const meet = (a, b) => { if (!a) return b; if (!b) return a; const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h); return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }; };
    const place = (lv, ox, oy, vis, clip) => {
        for (const w of lv.list) {
            const r = lv.rects.get(w.id);
            const rect = { x: ox + r.x, y: oy + r.y, w: r.w, h: r.h, vis };
            if (clip) {
                rect.clip = clip;
                // a widget that lies wholly outside the window is hidden
                if (rect.x + rect.w <= clip.x || rect.x >= clip.x + clip.w || rect.y + rect.h <= clip.y || rect.y >= clip.y + clip.h) rect.vis = false;
            }
            out.set(w.id, rect);
            if (isSpoiler(w)) {
                const pad = spoilerPad(w), inf = info.get(w.id);
                const cx = rect.x + pad, cy = rect.y + headHOf(ui, w) + pad;
                const open = !!isOpen(w.id);
                const win = inf ? { x: cx, y: cy, w: Math.max(0, rect.w - 2 * pad), h: inf.view } : null;
                place(lv.subs.get(w.id), cx, cy - (inf?.top || 0), rect.vis && open, win ? meet(clip, win) : clip);
            }
        }
    };
    const top = level(rootId);
    place(top, 0, 0, true, null);
    return { rects: out, bottom: top.bottom, info };
}
