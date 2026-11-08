// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — PageView: draws a page of the panel (in the node, in the editor, on the full screen).
// It keeps one frame per widget, gives each widget its context (ctx), and every frame looks at the bound parameters to keep the widgets in step with the graph.

import { applyVars, varsFor, tokensOf, pageBackground, injectKit } from "./kit.js";
import { defOf, defaultProps } from "./widgets/index.js";
import { resolveSlot, writeSlot, effectiveLimits, stateLabel } from "./bind.js";
import { scaleOf, widgetsOf, panelOf, isPanelLike, tabsOf, pageOf, pageLength, pageBottom, TAIL, clamp, byId, headHOf, syncSpoilerHeights, childrenOf, descendantsOf, isSpoiler } from "./model.js";
import { layoutFlow } from "./flow.js";
import { adaptGeo, adaptedUi } from "./adapt.js";
import { OpenState } from "./openstate.js";
import { touchWorkflow } from "./sources.js";
import { api } from "../../../scripts/api.js";
import { events, startEvents, bridgeFor, bridgeHasAudio, anyBridgeAudio } from "./events.js";
import { modelsVersion } from "./models.js";
import { installTips } from "./tip.js";

const CASCADE = ["style", "shape", "accent", "field", "text", "labelColor", "border", "shadow", "blur"]; // a panel hands these to the widgets lying in it

export class PageView {
    // opts: {ui, mode: "run"|"edit", fit: "proportions"|"fill", tr, popupHost, onPage, onChange}
    constructor(host, opts) {
        injectKit();
        startEvents();
        installTips();
        this.host = host;
        this.ui = opts.ui;
        this.mode = opts.mode || "run";
        this.fit = opts.fit || "proportions";
        this.kind = opts.kind || "node";               // where this view lives: "uimode" | "node" | "editor"
        this.tr = opts.tr || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));
        this.popupHost = opts.popupHost || (() => document.body);
        this.onPage = opts.onPage || (() => {});
        this.onChange = opts.onChange || (() => {});
        this.onTabOp = opts.onTabOp || null; this.tabCount = opts.tabCount || (() => 0);
        this.onTab = opts.onTab || null;          // (editor) the open tab of a Tab panel is part of the panel: it goes through the history
        this.page = opts.page || this.ui.view.page;
        this.scope = opts.scope || null;          // the editor shows the inside of one spoiler as a page of its own
        this.scopeDims = null;                     // {w, h} of that page
        this.tabPick = new Map();               // Tab panels: the tab the viewer opened (id of the panel -> id of the tab)
        this.openState = opts.open || new OpenState(() => this.ui);
        this.rects = new Map();                    // id -> {x,y,w,h,vis,clip?} after the flow layout
        this.scrollTops = new Map();               // spoiler id -> how far its inside is scrolled (units of the page)
        this.scrollInfo = new Map();               // spoiler id -> {view, total, top} for the spoilers that scroll
        this.bottom = 0;
        this.laidW = 0;                            // the width of the page (page units) the layout was counted for ("adaptive")
        this.laidH = 0;                            // and its height
        this.padTop = 0; this.padBottom = 0;       // room above / under a scrolling page (screen px) for the strips of the mode
        this.scrolls = false;                      // the page is taller than the host
        this.tail = document.createElement("div");
        this.tail.style.cssText = "position:absolute;left:0;width:1px;height:0;pointer-events:none;visibility:hidden";
        this.frames = new Map(); // widget id -> {frame, inner, label, body, badge, inst, ctx, sig, local}
        this.root = document.createElement("div");
        this.root.className = "ndk ndk-stage";
        this.root.dataset.ndScroll = "";           // a page taller than the host scrolls by the wheel
        this.pageEl = document.createElement("div");
        this.pageEl.className = "ndk-page";
        this.bg = document.createElement("div"); this.bg.className = "ndk-page-bg";
        this.dim = document.createElement("div"); this.dim.className = "ndk-page-dim";
        this.pageEl.append(this.bg, this.dim);
        this.root.append(this.pageEl, this.tail);
        // "Background fills the window": the background of the page also lies behind the page, scaled to the whole host (no hard edge where the proportions end)
        this.fillBg = document.createElement("div"); this.fillBg.className = "ndk-fillbg";
        this.fillDim = document.createElement("div"); this.fillDim.className = "ndk-page-dim";
        this.fillBg.append(this.fillDim);
        host.append(this.fillBg, this.root);
        this.geo = { px: 1, py: 1, su: 1, s: 1, ox: 0, oy: 0 };
        this.alive = true;
        this.root.addEventListener("wheel", (e) => this.onWheel(e), { passive: false, capture: true });
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(host);
        this.offOpen = this.openState.subscribe(() => { this.relayout(); });
        this.refresh();
        this.resize();
        // the widgets are polled ten times a second, not on every frame of the browser, and not while the tab is hidden
        this.lastSync = 0;
        this.loop = (t) => { if (!this.alive) return; if (t - this.lastSync >= 100 && !document.hidden) { this.lastSync = t; if (this.root.isConnected && this.root.getClientRects().length) this.sync(); } this.raf = requestAnimationFrame(this.loop); };
        this.raf = requestAnimationFrame(this.loop);
    }

    destroy() {
        this.alive = false;
        this.offOpen?.();
        cancelAnimationFrame(this.raf);
        this.ro.disconnect();
        for (const f of this.frames.values()) this.dropFrame(f);
        this.frames.clear();
        this.root.remove(); this.fillBg.remove();
    }

    get tokens() { return tokensOf(this.ui); }
    pageModel() { return pageOf(this.ui, this.page); }

    setMode(mode) {
        this.mode = mode;
        this.root.classList.toggle("ndk-edit", mode === "edit");
        this.refresh();
    }
    // the editor looks into a spoiler (id) or back to the page (null); dims = {w, h} of the page of the spoiler
    setScope(id, dims) {
        this.scope = id || null;
        this.scopeDims = id ? dims : null;
        this.refresh();
    }
    isOpen(id) { return this.mode === "edit" ? false : this.openState.isOpen(byId(this.ui, id)); }
    // scroll the inside of a spoiler that has a maximum height
    scrollSpoiler(id, top) {
        const i = this.scrollInfo.get(id);
        if (!i) return false;
        const t = Math.max(0, Math.min(i.total - i.view, top));
        if (Math.abs(t - i.top) < 0.01) return false;
        this.scrollTops.set(id, t);
        this.relayout();
        return true;
    }
    // the wheel over a scrolling spoiler scrolls it (the innermost one that can still move); a list or text area under the pointer keeps its own wheel
    onWheel(e) {
        if (!this.scrollInfo.size || this.mode === "edit") return;
        const rb = this.pageEl.getBoundingClientRect(), g = this.geo;
        const px = (e.clientX - rb.left) / g.px, py = (e.clientY - rb.top) / g.py;
        for (let n = e.target; n && n !== this.root; n = n.parentElement) {
            if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
                const up = e.deltaY < 0;
                if ((up && n.scrollTop > 0) || (!up && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return;
            }
        }
        let best = null;
        for (const [id, i] of this.scrollInfo) {
            const r = this.rects.get(id), w = byId(this.ui, id);
            if (!r || !r.vis || !this.isOpen(id)) continue;
            const pad = Math.max(0, Number(w.props?.pad ?? 12)), HH = headHOf(this.ui, w);
            const x0 = r.x, y0 = r.y + HH, x1 = r.x + r.w, y1 = r.y + HH + 2 * pad + i.view;
            if (px < x0 || px > x1 || py < y0 || py > y1) continue;
            const can = e.deltaY < 0 ? i.top > 0 : i.top < i.total - i.view - 0.5;
            if (can && (!best || y0 >= best.y0)) best = { id, i, y0 };
        }
        if (!best) return;
        e.preventDefault(); e.stopPropagation();
        this.scrollSpoiler(best.id, best.i.top + e.deltaY / g.py);
    }
    toggleOpen(id) { const w = byId(this.ui, id); if (w) this.openState.toggle(w); }
    // the flow layout again (a spoiler was opened or closed, the model changed)
    relayout() {
        this.computeLayout();
        for (const f of this.frames.values()) { this.placeFrame(f); this.showFrame(f); if (f.w.type === "spoiler" || isPanelLike(f.w)) this.update(f); }
        this.resize();
    }
    // "adaptive": the width of the page in page units for the host as it is now (the page is 1:1, the width that is left goes to the layout)
    adaptive() { return this.fit === "adaptive" && !this.scope && this.mode !== "edit"; }
    // the width of the scrollbar of the stage (0 when it has none or draws it over the page)
    sbw() { return Math.max(0, this.root.offsetWidth - this.root.clientWidth); }
    adaptDims() {
        const cw = this.host.clientWidth - this.sbw(), ch = this.host.clientHeight;
        return cw > 0 && ch ? adaptGeo(this.ui, cw, ch, { len: this.pageModel()?.len || 0 }) : { W: this.ui.page.w, H: this.ui.page.h };
    }
    computeLayout() {
        syncSpoilerHeights(this.ui);
        const ad = this.adaptive() ? this.adaptDims() : null;
        this.laidW = ad ? ad.W : 0; this.laidH = ad ? ad.H : 0;
        const grow = this.laidW > this.ui.page.w + 0.01 || this.laidH > this.ui.page.h + 0.01;
        const ui = grow ? adaptedUi(this.ui, this.page, this.laidW, this.laidH) : this.ui;
        const L = layoutFlow(ui, this.page, (id) => this.isOpen(id), this.scope, (id) => this.scrollTops.get(id) || 0);
        this.rects = L.rects; this.bottom = L.bottom; this.scrollInfo = L.info;
        for (const [id, i] of L.info) this.scrollTops.set(id, i.top);
    }
    // the size of the page that is shown: the page, or the inside of the spoiler
    // (the editor shows the whole length of the page; the modes show the window and scroll the rest)
    dims() { return this.scope && this.scopeDims ? this.scopeDims : { w: this.ui.page.w, h: this.mode === "edit" ? pageLength(this.ui, this.page) : this.ui.page.h }; }
    // the length of the page in the modes: the window, or more when the page is set longer, or open spoilers / a low widget need it
    runLength() {
        const h = Math.max(this.ui.page.h, this.laidH || 0), own = this.pageModel()?.len || 0;
        return Math.max(h, own, this.bottom > h ? Math.ceil(this.bottom + TAIL) : 0);
    }
    rectOf(w) { return this.rects.get(w.id) || { x: w.x, y: w.y, w: w.w, h: w.h, vis: true }; }
    setPage(id) {
        if (!this.ui.pages.some((p) => p.id === id)) return;
        this.page = id;
        this.ui.view.page = id;
        this.refresh();
        this.onPage(id);
    }

    /* ------------------------------------------------------------ whole page */

    // brings the DOM in step with the model (widgets added, removed, moved, restyled)
    refresh() {
        const ui = this.ui;
        if (!ui.pages.some((p) => p.id === this.page)) this.page = ui.pages[0].id;
        this.root.classList.toggle("ndk-edit", this.mode === "edit");
        const tokens = this.tokens;
        applyVars(this.root, varsFor(tokens, ui.kit, {}));
        this.applyBackground(tokens);
        this.computeLayout();
        const wanted = new Map(widgetsOf(ui, this.page).filter((w) => this.rects.has(w.id)).map((w) => [w.id, w]));
        for (const [id, f] of [...this.frames]) {
            if (!wanted.has(id) || defOf(wanted.get(id).type) !== f.def) { this.dropFrame(f); this.frames.delete(id); }
        }
        for (const w of wanted.values()) {
            let f = this.frames.get(w.id);
            if (!f) { f = this.makeFrame(w); this.frames.set(w.id, f); }
            f.w = w; f.ctx.w = w;
            this.placeFrame(f);
            this.applyLook(f);
            this.applyState(f, true);
            this.update(f);
        }
        this.layoutPage();
    }

    // paints a background value of pageBackground() on a layer and its dimming layer
    paintBg(b, dim, bg) {
        b.background = ""; b.backgroundImage = ""; b.backgroundSize = ""; b.backgroundRepeat = ""; b.backgroundPosition = "";
        dim.style.background = "";
        if (typeof bg === "string") b.background = bg;
        else {
            b.backgroundImage = `url("${this.imageUrl(bg.image)}")`;
            b.backgroundSize = bg.mode === "tile" ? "auto" : bg.mode;
            b.backgroundRepeat = bg.mode === "tile" ? "repeat" : "no-repeat";
            b.backgroundPosition = "center";
            if (bg.dim > 0) dim.style.background = `rgba(0,0,0,${bg.dim})`;
        }
    }
    // the background fills the whole host (only where the page does not fill it by itself)
    get bgFilled() { return this.mode === "run" && !this.scope && this.fit !== "fill" && this.ui.view.bgFill === true; }
    applyBackground(tokens) {
        const bg = pageBackground(this.ui, tokens);
        this.paintBg(this.bg.style, this.dim, bg);
        this.pageEl.style.borderRadius = `${this.scope ? 12 : this.ui.page.radius}px`;
        if (this.scope) { this.bg.style.background = "var(--ndk-s1)"; this.bg.style.backgroundImage = ""; this.dim.style.background = ""; }
        const fill = this.bgFilled;
        this.fillBg.style.display = fill ? "" : "none";
        if (fill) {
            this.paintBg(this.fillBg.style, this.fillDim, bg);
            this.bg.style.visibility = "hidden"; this.dim.style.visibility = "hidden";
            this.pageEl.style.backgroundColor = "transparent"; this.pageEl.style.borderRadius = "0";
            this.root.style.background = "transparent";
        } else {
            this.bg.style.visibility = ""; this.dim.style.visibility = "";
            this.pageEl.style.backgroundColor = ""; this.root.style.background = "";
        }
    }

    // the scale of the page in its host
    resize() {
        const cw = this.host.clientWidth, ch = this.host.clientHeight;
        if (!cw || !ch) return;
        const { w: pw, h: ph } = this.dims();
        // open spoilers can make the page taller than it was drawn: it is then shown from the top and scrolls
        const effH = this.mode === "run" && !this.scope ? Math.max(ph, this.runLength()) : ph;
        const g = this.geo;
        const st = this.pageEl.style;
        let scrollH;
        if (this.adaptive()) {
            // like a web page: 1:1 (or smaller when the window is narrower than the page), the width left over goes to the layout
            this.usedSb = this.sbw();
            const a = adaptGeo(this.ui, cw - this.usedSb, ch, { len: this.pageModel()?.len || 0 });
            if (Math.abs(a.W - this.laidW) > 0.5 || Math.abs(a.H - this.laidH) > 0.5) this.computeLayout();
            const effA = Math.max(ph, a.H, this.runLength());
            g.px = g.py = 1; g.su = 1; g.s = a.s; g.ox = Math.max(0, (cw - this.usedSb - a.W * a.s) / 2); g.oy = 0;
            st.width = `${a.W}px`; st.height = `${effA}px`; st.left = `${g.ox}px`; st.top = "0px"; st.transform = `scale(${a.s})`;
            scrollH = effA * a.s;
        } else if (this.fit === "fill") {
            g.px = cw / pw; g.py = ch / ph; g.su = Math.min(g.px, g.py); g.s = 1; g.ox = 0; g.oy = 0;
            st.width = `${cw}px`; st.height = `${effH * g.py}px`; st.left = "0px"; st.top = "0px"; st.transform = "none";
            scrollH = effH * g.py;
        } else {
            const s = Math.min(cw / pw, ch / ph);
            g.px = g.py = 1; g.su = 1; g.s = s; g.ox = (cw - pw * s) / 2; g.oy = effH > ph ? 0 : (ch - ph * s) / 2;
            st.width = `${pw}px`; st.height = `${effH}px`; st.left = `${g.ox}px`; st.top = `${g.oy}px`; st.transform = `scale(${s})`;
            scrollH = effH * s;
        }
        const scrolls = scrollH > ch + 1;
        this.scrolls = scrolls;
        // the editor shows what lies outside the page too
        if (this.mode === "edit") this.root.style.overflow = "visible";
        else { this.root.style.overflow = ""; this.root.style.overflowY = scrolls ? "auto" : "hidden"; }
        const pt = scrolls ? this.padTop : 0;
        if (pt) st.top = `${(this.fit === "fill" ? 0 : g.oy) + pt}px`;
        this.tail.style.top = `${(this.fit === "fill" ? 0 : g.oy) + pt + scrollH}px`; this.tail.style.height = scrolls ? `${this.padBottom}px` : "0";
        this.pageEl.classList.toggle("anim", this.mode === "run" && !matchMedia("(prefers-reduced-motion: reduce)").matches);
        for (const f of this.frames.values()) { this.placeFrame(f); this.resizeFrame(f); }
        // the scrollbar came or went: the width that is left changed, once more
        if (this.adaptive() && !this.inResize && Math.abs(this.sbw() - this.usedSb) > 1) { this.inResize = true; try { this.resize(); } finally { this.inResize = false; } }
    }
    layoutPage() { this.resize(); }
    // design px of a screen distance (for dragging in the editor)
    get pageScale() { return this.fit === "fill" ? this.geo.su : this.geo.s; }

    /* ------------------------------------------------------------ one widget */

    makeFrame(w) {
        const def = defOf(w.type);
        const frame = document.createElement("div");
        frame.className = "ndk-w";
        frame.dataset.id = w.id;
        const inner = document.createElement("div"); inner.className = "ndk-wi";
        const label = document.createElement("div"); label.className = "ndk-label";
        const body = document.createElement("div"); body.className = "ndk-body";
        const badge = document.createElement("div"); badge.className = "ndk-badge"; badge.style.display = "none";
        inner.append(label, body);
        frame.append(inner, badge);
        this.pageEl.append(frame);
        const f = { frame, inner, label, body, badge, def, w, inst: null, ctx: null, sig: "", local: {}, vars: {} };
        if (!def) {
            body.append(Object.assign(document.createElement("div"), { className: "ndk-copy", textContent: this.tr("Unknown widget: {type}", { type: w.type }) }));
            f.ctx = { w };
            return f;
        }
        f.ctx = this.makeCtx(f);
        try { f.inst = def.mount(f.ctx) || {}; } catch (e) { console.error("[ND UI] widget failed", w.type, e); body.append(Object.assign(document.createElement("div"), { className: "ndk-copy", textContent: `${w.type}: ${e.message}` })); f.inst = {}; }
        return f;
    }
    dropFrame(f) { try { f.inst?.destroy?.(); } catch {} f.frame.remove(); }

    makeCtx(f) {
        const view = this;
        let writeTimer = 0;
        const slotDef = (id) => f.def.slots.find((s) => s.id === id);
        const state = (id) => {
            const st = resolveSlot(view.ui, f.w, id, slotDef(id));
            if (!st.bound) { if (id in f.local) st.value = f.local[id]; }
            return st;
        };
        return {
            w: f.w, body: f.body, editing: view.mode === "edit",
            tr: (s, v) => view.tr(s, v),
            prop(id) { const v = f.w.props?.[id]; if (v !== undefined) return v; const d = f.def.props?.find((p) => p.id === id); return d ? d.def : undefined; },
            info: state,
            get(id) { return state(id).value; },
            set(id, v) {
                const st = state(id);
                if (!st.bound) { f.local[id] = v; view.update(f); return; }
                if (writeSlot(st, v)) {
                    clearTimeout(writeTimer);
                    writeTimer = setTimeout(touchWorkflow, 300);
                    view.onChange();
                }
            },
            limits(id) { return effectiveLimits(state(id), f.w.props || {}); },
            vars: () => f.vars,
            popupHost: () => view.popupHost(),
            setProp(id, v) { f.w.props = f.w.props || {}; f.w.props[id] = v; clearTimeout(writeTimer); writeTimer = setTimeout(touchWorkflow, 300); view.onChange(); },
            size: () => { const r = view.rectOf(f.w); return { w: r.w, h: r.h }; },
            isOpen: () => view.isOpen(f.w.id),
            toggle: () => { if (view.mode !== "edit") view.toggleOpen(f.w.id); },
            scroll: () => view.scrollInfo.get(f.w.id) || null,
            scrollTo: (v) => view.scrollSpoiler(f.w.id, v),
            unitPx: () => view.geo.py || 1,
            headH: () => headHOf(view.ui, f.w),
            ks: () => view.ksOf(f.w) || 1,
            isEditing: () => view.mode === "edit",
            mode: () => view.mode,
            kind: () => view.kind,
            visible: () => view.alive && f.frame.isConnected && f.frame.style.display !== "none" && f.frame.getClientRects().length > 0 && view.root.getClientRects().length > 0,
            inside: () => descendantsOf(view.ui, f.w.id),
            pages: () => view.ui.pages,
            activePage: () => view.page,
            goPage: (id) => view.setPage(id),
            kitScale: () => scaleOf(view.ui, view.page) ?? view.ui.kit.scale,
            relayout: () => view.resize(),
            tabs: () => tabsOf(f.w),
            activeTab: () => view.activeTab(f.w),
            setTab: (id) => view.setTab(f.w, id),
            tabOp: (op, a, b) => view.onTabOp?.(f.w, op, a, b),
            tabCount: (id) => view.tabCount(f.w, id),
            imageUrl: (s) => view.imageUrl(s),
            onPopupClose: null,
        };
    }

    imageUrl(src) {
        if (!src) return "";
        if (/^(https?:|data:|blob:|\/)/i.test(src)) return src;
        const i = src.lastIndexOf("/");
        const sub = i >= 0 ? src.slice(0, i) : "", name = i >= 0 ? src.slice(i + 1) : src;
        return api.apiURL(`/view?filename=${encodeURIComponent(name)}&type=input&subfolder=${encodeURIComponent(sub)}`);
    }

    placeFrame(f) {
        const w = f.w, g = this.geo, r = this.rectOf(w);
        const s = f.frame.style;
        s.left = `${r.x * g.px}px`; s.top = `${r.y * g.py}px`; s.width = `${r.w * g.px}px`; s.height = `${r.h * g.py}px`;
        s.zIndex = String(Math.round(w.z) + 1 + this.depthOf(w) * 10000);
        // inside a spoiler that scrolls: only the part in the window is seen
        if (r.clip) {
            const c = r.clip;
            const t = Math.max(0, c.y - r.y) * g.py, b = Math.max(0, r.y + r.h - (c.y + c.h)) * g.py, l = Math.max(0, c.x - r.x) * g.px, rr = Math.max(0, r.x + r.w - (c.x + c.w)) * g.px;
            s.clipPath = t || b || l || rr ? `inset(${t}px ${rr}px ${b}px ${l}px)` : "";
        } else s.clipPath = "";
        this.showFrame(f);
        this.resizeFrame(f);
        f.frame.classList.toggle("ndk-outside", this.isOutside(r));
    }
    // (editor) a widget that lies wholly outside the page is not shown in the ND UI
    isOutside(r) {
        if (this.mode !== "edit" || this.scope) return false;
        const { w, h } = this.dims();
        return r.x >= w || r.x + r.w <= 0 || r.y >= h || r.y + r.h <= 0;
    }
    // what lies in a spoiler is above the spoiler
    depthOf(w) { let n = 0, p = w.parent && byId(this.ui, w.parent); while (p && n < 4) { n++; p = p.parent && byId(this.ui, p.parent); } return n; }
    showFrame(f) {
        const r = this.rectOf(f.w);
        f.frame.style.display = ((f.w.hidden && this.mode !== "edit") || !r.vis || this.tabHidden(f.w)) ? "none" : "";
    }
    // Tab panel: the tab that is open (in the editor the one the panel keeps; in the ND UI the one the viewer chose, not saved)
    activeTab(box) {
        const tabs = tabsOf(box), pick = this.mode === "edit" ? null : this.tabPick.get(box.id);
        return tabs.some((t) => t.id === pick) ? pick : tabs.some((t) => t.id === box.props?.active) ? box.props.active : tabs[0].id;
    }
    setTab(box, id) {
        if (this.mode === "edit") { if (this.onTab) { this.onTab(box, id); return; } box.props.active = id; }
        else this.tabPick.set(box.id, id);
        for (const f of this.frames.values()) if (f.w === box || f.w.tab) { this.showFrame(f); if (f.w === box) this.update(f); }
        this.resize();
    }
    // a widget that lies in another tab of a Tab panel than the open one
    tabHidden(w) {
        if (!w.tab) return false;
        const box = panelOf(this.ui, w);
        if (!box || box.type !== "tabbox") return false;
        return w.tab !== this.activeTab(box) || this.tabHidden(box);
    }
    // the inner box: its size is the frame size divided by the UI scale, so that the content scales inside the frame
    // how much the content of a frame is scaled inside it (the UI scale of the page, the scale of the widget, the stretch of a page that fills the window)
    ksOf(w) { return ((scaleOf(this.ui, this.page) ?? this.ui.kit.scale) / 100) * ((w.look?.scale ?? 100) / 100) * (this.fit === "fill" ? this.geo.su : 1); }
    resizeFrame(f) {
        const w = f.w, g = this.geo, r = this.rectOf(w);
        const ks = this.ksOf(w);
        const iw = r.w * g.px / ks, ih = r.h * g.py / ks;
        const s = f.inner.style;
        s.width = `${iw}px`; s.height = `${ih}px`; s.transform = ks === 1 ? "" : `scale(${ks})`;
        f.inst?.resize?.(iw, ih);
    }

    // the effective look: the page, then the panel the widget lies in (the keys it hands on), then the widget itself
    effectiveLook(w) {
        const look = {};
        const panel = isPanelLike(w) && w.type === "panel" ? null : panelOf(this.ui, w);
        if (panel) for (const k of CASCADE) if (panel.look?.[k] != null) look[k] = panel.look[k];
        for (const k of Object.keys(w.look || {})) if (w.look[k] != null && !(k === "scale")) look[k] = w.look[k];
        return look;
    }
    applyLook(f) {
        const w = f.w, def = f.def;
        const look = this.effectiveLook(w);
        const vars = varsFor(this.tokens, this.ui.kit, look);
        if (isPanelLike(w) || w.type === "spoiler") { vars["--ndk-pbg"] = look.bg || vars["--ndk-s1"]; vars["--ndk-ptitle"] = look.labelColor || look.text || vars["--ndk-text"]; vars["--ndk-wbg"] = "transparent"; }
        f.vars = vars;
        applyVars(f.frame, vars);
        const lp = !def || def.noLabel ? "hidden" : (w.look?.label || "top");
        f.frame.className = `ndk-w lp-${lp}${def?.fill ? " fill" : ""}${look.bg && !isPanelLike(w) && !def?.decor ? " has-wbg" : ""}`;
        f.label.textContent = w.props?.label ?? "";
        const tip = this.mode !== "edit" ? String(w.props?.tip ?? "").trim() : "";
        if (tip) f.frame.dataset.ndtip = tip; else delete f.frame.dataset.ndtip;
        if (lp === "inside") f.frame.classList.add("lp-inside");
        this.showFrame(f);
        f.frame.style.opacity = w.hidden ? "0.28" : "";
        this.resizeFrame(f);
        this.applyState(f, true);
    }

    // flags of the frame: wire / muted / lost / unbound
    applyState(f, force) {
        const def = f.def;
        if (!def) return;
        let off = false, tag = "";
        const slots = def.slots.filter((s) => s.required !== false);
        for (const s of slots) {
            const st = resolveSlot(this.ui, f.w, s.id, s);
            const t = stateLabel(st);
            if (t === "lost") { off = true; tag = "lost"; break; }
            if (t === "unbound") { if (this.mode !== "edit") off = true; if (!tag) tag = "unbound"; }
            else if (t && !tag) { tag = t; off = true; }
        }
        if (!slots.length) tag = "";
        const key = `${off}|${tag}|${this.mode}`;
        if (!force && f.stateKey === key) return;
        f.stateKey = key;
        f.frame.classList.toggle("is-off", off && tag !== "lost");
        f.frame.classList.toggle("is-lost", tag === "lost");
        const showBadge = tag && (tag !== "unbound" || this.mode === "edit");
        f.badge.style.display = showBadge ? "" : "none";
        f.badge.className = `ndk-badge ${tag}`;
        f.badge.textContent = showBadge ? this.tr(tag === "wire" ? "wire" : tag) : "";
        f.badge.title = showBadge ? this.tr({ wire: "The parameter is driven by a wire.", muted: "The node is muted.", bypassed: "The node is bypassed.", lost: "The node or the parameter is gone. Bind it again.", unbound: "Not bound to a parameter yet." }[tag] || "") : "";
    }

    update(f) { try { f.inst?.update?.(); } catch (e) { console.error("[ND UI] widget update failed", f.w.type, e); } }

    // one pass over the widgets: only those whose bound values changed are told
    sync() {
        for (const f of this.frames.values()) {
            const def = f.def;
            if (!def) continue;
            let sig = this.page + "|" + (this.mode) + "|m" + modelsVersion + (def.live ? "|e" + events.version : "");
            for (const s of def.slots) {
                const st = resolveSlot(this.ui, f.w, s.id, s);
                const v = st.bound ? st.value : f.local[s.id];
                sig += `|${s.id}:${typeof v === "object" ? JSON.stringify(v) : v}:${st.bound ? 1 : 0}${st.lost ? "L" : ""}${st.linked ? "W" : ""}${st.muted ? "M" : ""}${st.bypassed ? "B" : ""}:${st.options?.length ?? ""}`;
            }
            // the speaker and the volume of a live preview follow the audio VAE pin of the bridge, so a wire put or pulled out redraws the widget
            if (def.live) { try { const ls = def.slots.some((x) => x.id === "live") ? resolveSlot(this.ui, f.w, "live", def.slots.find((x) => x.id === "live")) : null; sig += "|au" + (ls?.bound ? (ls.node && bridgeHasAudio(bridgeFor(ls.node)) ? 1 : 0) : anyBridgeAudio() ? 1 : 0); } catch {} }
            if (sig !== f.sig) {
                f.sig = sig;
                this.applyState(f);
                this.update(f);
            }
        }
    }

    frameOf(id) { return this.frames.get(id) || null; }
}

export { clamp };
