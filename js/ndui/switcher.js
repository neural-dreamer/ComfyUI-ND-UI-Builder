// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the workflow switcher: the open workflows of ComfyUI as cards with miniatures, like Alt+Tab of Windows.
// Opened by the button next to the logo (and in the action bar) or by Alt+Q: hold Alt, press Q to move, let Alt go to switch.
// The miniatures are drawn from the graph of every tab: the page of its ND UI panel, or the map of the nodes; with the last picture it made.
import { app } from "../../../scripts/app.js";
import { el } from "./core/dom.js";
import { icon, tokensOf, injectKit } from "./kit.js";
import { normalizeNdUi } from "./model.js";
import { defOf } from "./widgets/index.js";
import { subscribe, latestAny, viewUrl } from "./events.js";
import { isUiMode, exitUiMode } from "./uimode.js";
import { workflowHost } from "./host.js";

const ID = "ndui-switcher";
const lastPic = new Map();   // workflow key -> url of its latest picture

/* ------------------------------------------------------------------ the open workflows */

const mgr = () => { try { return app.extensionManager?.workflow || null; } catch { return null; } };
export const keyOf = (wf) => String(wf?.path || wf?.key || wf?.filename || "");
export function openList() {
    const m = mgr();
    return m ? [...(m.openWorkflows || [])] : [];
}
export const activeOne = () => mgr()?.activeWorkflow || null;
export const canSwitch = () => openList().length > 1;
const stateOf = (wf) => {
    try {
        if (wf === activeOne()) return app.graph.serialize();
        return wf.changeTracker?.activeState || wf.activeState || wf.originalContent && JSON.parse(wf.originalContent) || null;
    } catch { return null; }
};
export const nameOf = (wf) => String(wf?.filename || wf?.path || "Unsaved").replace(/\.json$/i, "");

/** remembers the latest picture of the workflow on the screen */
let tracking = false;
export function trackPictures() {
    if (tracking) return;
    tracking = true;
    subscribe(() => {
        try {
            const li = latestAny("images"), a = activeOne();
            if (a && li?.images?.length) lastPic.set(keyOf(a), viewUrl(li.images[li.images.length - 1]));
        } catch {}
    });
}

/* ------------------------------------------------------------------ miniatures */

const SW = 360, SH = 220;   // the box of a miniature
function panelThumb(ui) {
    const tk = tokensOf(ui), pg = ui.view.page && ui.pages.some((p) => p.id === ui.view.page) ? ui.view.page : ui.pages[0]?.id;
    const w = Math.max(200, ui.page.w), h = Math.max(150, ui.page.h), s = Math.min(SW / w, SH / h);
    const box = el("div", "sw-panel"); box.style.cssText = `width:${w * s}px;height:${h * s}px;background:${tk.bg};border:1px solid ${tk.border}`;
    for (const x of ui.widgets) {
        if (x.page !== pg) continue;
        const d = el("div", "sw-w"); d.style.cssText = `left:${x.x * s}px;top:${x.y * s}px;width:${Math.max(3, x.w * s)}px;height:${Math.max(3, x.h * s)}px;background:${tk.s2};border:1px solid ${tk.border};color:${tk.muted}`;
        if (x.type === "generate") { d.style.background = tk.accent; d.style.color = tk.onAccent; }
        const def = defOf(x.type);
        if (def?.icon && x.w * s > 26 && x.h * s > 18) d.append(icon(def.icon, Math.min(16, Math.max(9, x.h * s * 0.5))));
        box.append(d);
    }
    return box;
}
function mapThumb(g) {
    const nodes = Array.isArray(g?.nodes) ? g.nodes : [];
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "sw-map"); svg.setAttribute("width", SW); svg.setAttribute("height", SH);
    if (!nodes.length) return svg;
    const rect = (n) => ({ x: n.pos?.[0] ?? n.pos?.["0"] ?? 0, y: n.pos?.[1] ?? 0, w: n.size?.[0] ?? 160, h: n.size?.[1] ?? 60 });
    const rs = nodes.map((n) => ({ n, ...rect(n) }));
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y)), x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
    const s = Math.min((SW - 16) / Math.max(1, x1 - x0), (SH - 16) / Math.max(1, y1 - y0));
    const ox = 8 + (SW - 16 - (x1 - x0) * s) / 2 - x0 * s, oy = 8 + (SH - 16 - (y1 - y0) * s) / 2 - y0 * s;
    const byId = new Map(rs.map((r) => [r.n.id, r]));
    const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
    for (const l of g.links || []) {
        const [from, to] = Array.isArray(l) ? [l[1], l[3]] : [l?.origin_id, l?.target_id];
        const a = byId.get(from), b = byId.get(to);
        if (a && b) svg.append(mk("line", { x1: ox + (a.x + a.w) * s, y1: oy + (a.y + 14) * s, x2: ox + b.x * s, y2: oy + (b.y + 14) * s, stroke: "rgba(160,170,200,.45)", "stroke-width": 1 }));
    }
    for (const r of rs) svg.append(mk("rect", { x: ox + r.x * s, y: oy + r.y * s, width: Math.max(2, r.w * s), height: Math.max(2, r.h * s), rx: 2, fill: r.n.color || "#3a4156", stroke: "rgba(255,255,255,.2)", "stroke-width": 0.6, opacity: r.n.mode === 2 || r.n.mode === 4 ? 0.4 : 1 }));
    return svg;
}
export function hasPanel(g) {
    const raw = g?.extra?.nd_ui;
    if (!raw || typeof raw !== "object") return false;
    try { return normalizeNdUi(raw).widgets.length > 0; } catch { return false; }
}
export function thumbnail(wf) {
    const g = stateOf(wf), wrap = el("div", "sw-thumb");
    if (!g) { wrap.append(el("div", "sw-none", "…")); return wrap; }
    if (hasPanel(g)) { wrap.append(panelThumb(normalizeNdUi(g.extra.nd_ui))); wrap.classList.add("panel"); }
    else wrap.append(mapThumb(g));
    const pic = lastPic.get(keyOf(wf));
    if (pic) { const im = el("img", "sw-pic"); im.src = pic; im.alt = ""; im.draggable = false; wrap.append(im); }
    return wrap;
}

/* ------------------------------------------------------------------ switching */

export async function switchTo(wf) {
    if (!wf || wf === activeOne()) return false;
    const g = stateOf(wf);
    try {
        if (g) await app.loadGraphData(g, true, true, wf);
        else app.extensionManager?.command?.execute?.("Workspace.NextOpenedWorkflow");
    } catch (e) { console.warn("[ND UI] switch failed", e); return false; }
    // the mode keeps the panel of the new workflow; a workflow without a panel shows its graph
    setTimeout(() => { try { if (isUiMode() && !workflowHost().has) exitUiMode(); } catch {} }, 60);
    return true;
}

/* ------------------------------------------------------------------ the overlay */

const CSS = `
.ndk-sw{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.55);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);font:13px/1.3 system-ui,sans-serif;color:#e8eaf0}
.ndk-sw .grid{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;max-width:min(1500px,94vw);max-height:88vh;overflow:auto;padding:20px}
.ndk-sw .card{width:262px;padding:10px;border:2px solid transparent;border-radius:14px;background:rgba(24,28,38,.82);cursor:pointer;transition:transform .12s,border-color .12s}
.ndk-sw .card:hover{background:rgba(36,42,56,.9)}
.ndk-sw .card.sel{border-color:#7757fa;transform:scale(1.04);background:rgba(40,46,64,.95)}
.ndk-sw .card.cur .name::after{content:"●";color:#35d0ba;margin-left:6px;font-size:9px}
.ndk-sw .sw-thumb{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:150px;border-radius:9px;overflow:hidden;background:#12151c}
.ndk-sw .sw-map{width:100%;height:100%}
.ndk-sw .sw-panel{position:relative;transform-origin:center;zoom:.7;border-radius:6px;overflow:hidden}
.ndk-sw .sw-w{position:absolute;box-sizing:border-box;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.ndk-sw .sw-pic{position:absolute;right:6px;bottom:6px;width:46%;max-height:60%;object-fit:cover;border-radius:6px;border:2px solid rgba(255,255,255,.75);box-shadow:0 4px 14px rgba(0,0,0,.55)}
.ndk-sw .name{margin-top:9px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-sw .name .mod{color:#f2b84b;margin-left:6px}
.ndk-sw .sub{opacity:.55;font-size:11px;margin-top:2px}
`;
let open = null;
export const isOpen = () => !!open;

/** opens the overlay; `holdAlt`: it closes (and switches) when Alt is let go */
export function openSwitcher({ holdAlt = false, step = 1 } = {}) {
    const list = openList();
    if (list.length < 2) return null;
    if (open) { open.move(step); return open; }
    injectKit();
    if (!document.getElementById(ID + "-css")) { const s = document.createElement("style"); s.id = ID + "-css"; s.textContent = CSS; document.head.append(s); }
    const root = el("div", "ndk ndk-sw"); root.id = ID; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Workflows");
    const grid = el("div", "grid"); root.append(grid);
    const act = activeOne();
    let sel = Math.max(0, list.indexOf(act));
    const cards = list.map((wf, i) => {
        const c = el("div", "card" + (wf === act ? " cur" : "")); c.dataset.i = String(i);
        const nm = el("div", "name", nameOf(wf)); if (wf.isModified) nm.append(el("span", "mod", "●"));
        const g = stateOf(wf);
        c.append(thumbnail(wf), nm, el("div", "sub", hasPanel(g) ? "ND UI" : workflowHost().tr("{n} nodes", { n: Array.isArray(g?.nodes) ? g.nodes.length : 0 })));
        c.addEventListener("click", () => { commit(i); });
        c.addEventListener("mousemove", () => { if (sel !== i) { sel = i; mark(); } });
        grid.append(c);
        return c;
    });
    const mark = () => { cards.forEach((c, i) => c.classList.toggle("sel", i === sel)); cards[sel]?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); };
    const move = (d) => { sel = (sel + d + list.length) % list.length; mark(); };
    const close = () => {
        if (!open) return;
        window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onUp, true); window.removeEventListener("blur", cancel);
        root.remove(); open = null;
    };
    const cancel = () => close();
    const commit = (i = sel) => { const wf = list[i]; close(); switchTo(wf); };
    const onKey = (e) => {
        const k = e.key;
        if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (k === "Enter") { e.preventDefault(); e.stopPropagation(); commit(); }
        else if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); e.stopPropagation(); move(1); }
        else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); e.stopPropagation(); move(-1); }
        else if (k === "Tab") { e.preventDefault(); e.stopPropagation(); move(e.shiftKey ? -1 : 1); }
        else if (e.altKey && e.code === "KeyQ") { e.preventDefault(); e.stopPropagation(); move(e.shiftKey ? -1 : 1); }
    };
    const onUp = (e) => { if (holdAlt && e.key === "Alt") { e.preventDefault(); commit(); } };
    root.addEventListener("pointerdown", (e) => { if (e.target === root) close(); });
    window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onUp, true); window.addEventListener("blur", cancel);
    document.body.append(root);
    open = { root, move, close, commit, get sel() { return sel; }, list };
    move(step);
    return open;
}

/** Alt+Q anywhere in ComfyUI: opens the switcher on the next workflow; Q again goes on; letting Alt go switches */
export function installSwitcherKeys() {
    window.addEventListener("keydown", (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyQ" || open) return;
        if (!canSwitch()) return;
        e.preventDefault(); e.stopPropagation();
        openSwitcher({ holdAlt: true, step: e.shiftKey ? -1 : 1 });
    }, true);
}
