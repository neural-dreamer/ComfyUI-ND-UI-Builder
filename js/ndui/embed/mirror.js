// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — a live mirror of a node: a second LGraphCanvas on its own <canvas> draws only this node and takes the clicks,
// so a node that draws its controls on the canvas (Value Presets) can be used inside the page like in the graph.
// The graph does not know the difference: both canvases are attached to it and both are told to redraw when something changes.
import { app } from "../../../../scripts/app.js";

const TITLE_H = () => globalThis.LiteGraph?.NODE_TITLE_HEIGHT || 30;

export class Mirror {
    // host: the element the canvas lives in; opts: {title}
    constructor(host, node, opts = {}) {
        this.host = host; this.node = node; this.title = !!opts.title;
        this.gc = null; this.cv = null; this.onLayout = null; this.w = 0; this.h = 0; this.k = 1; this.running = false; this.sig = "";
        this.make();
    }
    make() {
        const LG = globalThis.LiteGraph;
        const graph = this.node.graph || app.graph;
        const cv = document.createElement("canvas");
        cv.className = "ndk-emb-cv";
        cv.style.cssText = "position:absolute;left:0;top:0;display:block;outline:none";
        cv.tabIndex = -1;
        this.host.append(cv);
        this.cv = cv;
        const gc = new LG.LGraphCanvas(cv, graph, { skip_render: false });
        this.gc = gc;
        gc.render_info = false; gc.render_canvas_border = false;
        gc.allow_dragnodes = false; gc.allow_dragcanvas = false; gc.allow_reconnect_links = false; gc.allow_searchbox = false;
        gc.show_info = false; gc.render_connections_shadows = false;
        gc.background_image = null; gc.clear_background = false; gc.clear_background_color = "rgba(0,0,0,0)";
        gc.render_shadows = false; gc.render_connections_arrows = false;
        try { gc.drawBackground = () => {}; } catch {}
        try { gc.processContextMenu = () => {}; } catch {}
        try { gc.showSearchBox = () => {}; } catch {}
        // only this node is drawn
        gc.computeVisibleNodes = (nodes, out) => { const o = out || []; o.length = 0; if (this.node?.graph) o.push(this.node); return o; };
        // no links, no selection frame
        try { gc.drawConnections = () => {}; } catch {}
        try { gc.drawGroups = () => {}; } catch {}      // the groups of the graph that lie under the node are not ours to show
        gc.render_connections = false;
        this.running = true;
    }
    setNode(node) { this.node = node; this.layout(this.w, this.h, this.fit, this.zoom); }

    // fit: width | fill | natural; fw, fh: the frame in css px
    layout(fw, fh, fit = "width", zoom = 100) {
        this.fit = fit; this.zoom = zoom;
        const n = this.node;
        if (!this.gc || !n || !fw || !fh) return 1;
        const z = Math.max(0.25, Math.min(4, (Number(zoom) || 100) / 100));
        const nw = Math.max(40, n.size?.[0] || 200), nh = Math.max(20, (n.size?.[1] || 100) + (this.title ? TITLE_H() : 0));
        let k = z;
        if (fit === "width") k = (fw / nw) * z;
        else if (fit === "fill" || fit === "scale") k = Math.min(fw / nw, fh / nh) * z;
        this.k = k;
        // The page around the frame is scaled (a transform), but LiteGraph reads the mouse as clientX - rect.left in canvas pixels.
        // So the canvas gets as many pixels as it takes on the screen: then a pixel on the screen is a pixel of the canvas.
        this.w = fw; this.h = fh;
        this.cv.style.width = `${fw}px`; this.cv.style.height = `${fh}px`;
        const r = this.cv.getBoundingClientRect();
        let st = r.width > 0 ? r.width / fw : this.st || 1;
        st = Math.max(0.1, Math.min(8, st));
        this.st = st;
        const pw = Math.max(1, Math.round(fw * st)), ph = Math.max(1, Math.round(fh * st));
        if (this.cv.width !== pw || this.cv.height !== ph) {
            this.cv.width = pw; this.cv.height = ph;
            try { this.gc.resize?.(pw, ph); } catch {}
        }
        const ds = this.gc.ds;
        ds.scale = k * st;
        // the body of the node at the top left; the title bar (30 graph px) stays above the canvas unless it is wanted
        ds.offset[0] = -n.pos[0] / 1; ds.offset[1] = -n.pos[1] + (this.title ? TITLE_H() : 0);
        this.dirty();
        this.onLayout?.(k);
        return k;
    }
    dirty() { try { this.gc?.setDirty(true, true); } catch {} }
    // the widget values changed? (the graph tells its canvases, this is for values written by us)
    tick() {
        const n = this.node;
        if (!n?.graph || !this.gc) return;
        let s = `${n.size?.[0]}x${n.size?.[1]}|${n.mode}|${n.pos?.[0]},${n.pos?.[1]}`;
        if (this.w && this.cv?.isConnected) { const r = this.cv.getBoundingClientRect(); if (r.width > 0 && Math.abs(r.width / this.w - (this.st || 1)) > 0.003 * (this.st || 1)) s += "|r" + Math.round((r.width / this.w) * 1000); }
        for (const w of n.widgets || []) { const v = w.value; s += `|${typeof v === "object" ? "o" : v}`; }
        if (s !== this.sig) { this.sig = s; this.layout(this.w, this.h, this.fit, this.zoom); }
    }
    // draw only while the frame is on the screen
    setRunning(on) {
        if (!this.gc || on === this.running) return;
        this.running = on;
        try { on ? (this.gc.startRendering?.(), this.dirty()) : this.gc.stopRendering?.(); } catch {}
    }
    destroy() {
        const gc = this.gc, g = this.node?.graph || app.graph;
        this.gc = null;
        try { gc?.stopRendering?.(); } catch {}
        try { gc?.unbindEvents?.(); } catch {}
        try { g?.detachCanvas?.(gc); } catch {}
        try { if (g && gc) { const i = g.list_of_graphcanvas?.indexOf(gc); if (i >= 0) g.list_of_graphcanvas.splice(i, 1); } } catch {}
        this.cv?.remove(); this.cv = null;
    }
}
