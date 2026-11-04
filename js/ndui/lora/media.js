// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the preview of a LoRA (a picture or a video), the common NSFW switch and the person's NSFW marks.
//
// These come from Neural Dreamer Nodes 1.3.0 (its catalog GET /nd/loras and POST /nd/loras/nsfw); without that pack a LoRA only has a picture
// and no NSFW flag, and nothing here changes (isNd(m) is false: no blur, no marks, no eye).
//
// The NSFW switch is the one that Neural Dreamer Nodes has: localStorage["nd-nsfw-show"] = "1" (shown), the attribute data-nd-nsfw="show|hide" on <html>
// (the CSS blurs the NSFW previews of tiles unless it says "show") and the window event "nd-nsfw-change".
import { api } from "../../../../scripts/api.js";
import { el, icon } from "../widgets/util.js";
import { previewOf, previewUrlOf, videoUrlOf, isNd } from "../models.js";

/* ------------------------------------------------------------------ the common switch */

const NSFW_KEY = "nd-nsfw-show";
export const NSFW_EVENT = "nd-nsfw-change";
let memShow = false; // when the browser keeps nothing
export function nsfwShown() {
    try { return localStorage.getItem(NSFW_KEY) === "1"; } catch { return memShow; }
}
function applyNsfw() { document.documentElement.dataset.ndNsfw = nsfwShown() ? "show" : "hide"; }
export function setNsfwShown(on) {
    memShow = !!on;
    try { if (on) localStorage.setItem(NSFW_KEY, "1"); else localStorage.removeItem(NSFW_KEY); } catch {}
    applyNsfw();
    window.dispatchEvent(new CustomEvent(NSFW_EVENT, { detail: { show: !!on } }));
}
if (!window.__ndNsfwBound) {
    window.__ndNsfwBound = true;   // one listener for the page, even when a pack's script is loaded twice
    window.addEventListener("storage", (e) => { if (e.key === NSFW_KEY || e.key === null) { applyNsfw(); window.dispatchEvent(new CustomEvent(NSFW_EVENT, { detail: { show: nsfwShown() } })); } });
}
applyNsfw();

// the eye: shows / hides the NSFW previews everywhere. Follows the switch by itself and lets go of the listener when it leaves the page.
export function nsfwButton(tr, cls = "ndk-iconbtn") {
    const b = el("button", `${cls} ndk-nsfw-eye`); b.type = "button";
    const paint = () => {
        const on = nsfwShown();
        b.classList.toggle("on", on);
        b.replaceChildren(icon(on ? "eye" : "eyeOff", 15));
        b.title = on ? tr("NSFW previews are shown. Click to blur them.") : tr("NSFW previews are blurred. Click to show them.");
        b.setAttribute("aria-pressed", String(on));
    };
    const on = () => { if (!b.isConnected && b.__seen) { window.removeEventListener(NSFW_EVENT, on); return; } if (b.isConnected) b.__seen = true; paint(); };
    window.addEventListener(NSFW_EVENT, on);
    b.addEventListener("click", (e) => { e.stopPropagation(); setNsfwShown(!nsfwShown()); });
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    paint();
    return b;
}

/* ------------------------------------------------------------------ the person's marks */

// true / false / null (automatic). The entry of the catalog is updated in place, so every tile that holds it can be repainted.
export async function markNsfw(m, value) {
    try {
        const r = await api.fetchApi("/nd/loras/nsfw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: m.name, nsfw: value }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        Object.assign(m, await r.json());
        return true;
    } catch { return false; }
}

// the menu stands above its tile (below it when there is no room), inside `host`, so the tile (overflow:hidden) cannot cut it
function placeMenu(menu, tile, host) {
    const hr = host.getBoundingClientRect(), sc = hr.width / (host.offsetWidth || hr.width) || 1;
    const t = tile.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight, W = host.clientWidth, H = host.clientHeight;
    const x = Math.max(6, Math.min((t.right - hr.left) / sc - mw, W - mw - 6));
    let y = (t.top - hr.top) / sc - mh - 4;
    if (y < 6) y = Math.max(6, Math.min((t.bottom - hr.top) / sc + 4, H - mh - 6));
    menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.style.right = "auto";
}

// the menu of the shield: mark as NSFW / as safe / back to automatic. It stands inside the tile or the card (a popup would close the gallery it is opened from).
export function markMenu(ctx, anchor, m, repaint) {
    const tr = (s, v) => (ctx.tr ? ctx.tr(s, v) : s);
    document.querySelectorAll(".ndk-nsfw-menu").forEach((x) => x.remove());
    const menu = el("div", "ndk-nsfw-menu");
    const user = m.nsfw_src === "user";
    const item = (label, value, on, disabled = false) => {
        const r = el("button", `ndk-nsfw-it${on ? " on" : ""}`); r.type = "button"; r.disabled = disabled; r.append(icon(on ? "check" : "shield", 13), el("span", "", label));
        r.addEventListener("click", async (e) => { e.stopPropagation(); off(); if (await markNsfw(m, value)) repaint(); });
        menu.append(r);
    };
    item(tr("Mark as NSFW"), true, user && m.nsfw === true);
    item(tr("Mark as safe"), false, user && m.nsfw === false);
    item(tr("Back to automatic"), null, !user, !user);
    const tile = anchor.closest(".ndk-mp-card, .ndk-lr-card") || anchor.parentElement, host = anchor.closest(".ndk-pop");
    (host || tile).appendChild(menu);
    if (host) placeMenu(menu, tile, host);
    const off = () => { menu.remove(); window.removeEventListener("pointerdown", away, true); window.removeEventListener("scroll", off, true); };
    const away = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) off(); };
    setTimeout(() => { window.addEventListener("pointerdown", away, true); window.addEventListener("scroll", off, true); }, 0);
    return { close: off };
}

// a shield for a tile or a card: its colour tells the state, a click opens the menu. Only for LoRAs of the catalog of Neural Dreamer Nodes.
export function shieldButton(ctx, m, cls, onRepaint) {
    const tr = (s, v) => (ctx.tr ? ctx.tr(s, v) : s);
    const b = el("button", `${cls} ndk-nsfw-shield`); b.type = "button"; b.append(icon("shield", 14));
    const paint = () => { b.classList.toggle("on", !!m.nsfw); b.classList.toggle("user", m.nsfw_src === "user"); b.title = m.nsfw ? tr("NSFW. Change the mark") : tr("Mark as NSFW or as safe"); };
    paint();
    b.addEventListener("click", (e) => { e.stopPropagation(); markMenu(ctx, b, m, () => { paint(); onRepaint?.(); }); });
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    return b;
}

/* ------------------------------------------------------------------ the picture or the video */

const io = typeof IntersectionObserver === "function" ? new IntersectionObserver((list) => { for (const en of list) en.target.__ndVis?.(en.isIntersecting); }, { rootMargin: "160px" }) : null;
const safePlay = (v) => { try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch {} };

// A video element that plays while the pointer is over `hover` (or always), muted, from the first frame. It gets its source only when it is on the screen.
export function videoEl(m, folder, { play = "hover", hover = null, box = null, onError } = {}) {
    const p = previewOf(m);
    const v = document.createElement("video");
    v.className = "ndk-mv"; v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = "metadata"; v.disablePictureInPicture = true; v.controls = false;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    if (p?.image) v.poster = previewUrlOf(m, folder);
    let loaded = false, vis = !io;
    const load = () => { if (loaded) return; loaded = true; v.src = `${videoUrlOf(m)}#t=0.001`; };
    const stop = () => { try { v.pause(); if (v.readyState > 0) v.currentTime = 0; } catch {} };
    const seen = box || v;
    seen.__ndVis = (on) => { vis = on; if (on) { load(); if (play === "always") safePlay(v); } else { try { v.pause(); } catch {} } };
    if (io) io.observe(seen); else load();
    const target = hover || seen;
    target.addEventListener("pointerenter", () => { if (play === "hover") { load(); safePlay(v); } });
    target.addEventListener("pointerleave", () => { if (play === "hover") stop(); });
    v.addEventListener("error", () => { if (loaded && v.src) onError?.(); });
    v.addEventListener("loadeddata", () => { if (play === "always" && vis) safePlay(v); });
    return v;
}

// A small square preview (the picture of a card of the stack, of the picker). opts: {play, hover}. The result has .setNsfw(bool).
export function mediaThumb(m, folder, { play = "hover", hover = null } = {}) {
    const box = el("div", "ndk-lmedia");
    const p = previewOf(m);
    box.setNsfw = (on) => box.classList.toggle("nsfw", !!on && !!p);
    if (!p) { box.classList.add("empty"); box.append(icon("cube", 16)); return box; }
    box.append(el("span", "ndk-nsfwtag", "NSFW"));
    box.setNsfw(isNd(m) && m.nsfw);
    const fail = () => { box.classList.add("empty"); box.replaceChildren(icon("cube", 16)); };
    if (p.kind === "video") box.prepend(videoEl(m, folder, { play, hover, box, onError: fail }));
    else { const im = el("img", "ndk-mi"); im.loading = "lazy"; im.decoding = "async"; im.alt = ""; im.draggable = false; im.addEventListener("error", fail); im.src = previewUrlOf(m, folder); box.prepend(im); }
    return box;
}

// the picture or the video large, over everything; a click or Esc closes only it (the video is muted)
export function showLarge(anchor, m, folder, tr) {
    const p = previewOf(m);
    if (!p) return;
    const ov = el("div", "ndk-li-big"); ov.title = tr("Click to close");
    let node;
    if (p.kind === "video") {
        node = document.createElement("video"); node.src = videoUrlOf(m); node.muted = true; node.defaultMuted = true; node.loop = true; node.autoplay = true; node.playsInline = true; node.controls = false;
        node.setAttribute("muted", "");
        if (p.image) node.poster = previewUrlOf(m, folder, true);
    } else { node = el("img"); node.alt = ""; node.src = previewUrlOf(m, folder, true); }
    ov.append(node);
    const off = () => { ov.remove(); window.removeEventListener("keydown", key, true); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); off(); } };
    ov.addEventListener("click", (e) => { e.stopPropagation(); off(); });
    ov.addEventListener("pointerdown", (e) => e.stopPropagation());
    window.addEventListener("keydown", key, true);
    (anchor.closest(".ndk") || document.body).appendChild(ov);
    if (node.tagName === "VIDEO") safePlay(node);
}
