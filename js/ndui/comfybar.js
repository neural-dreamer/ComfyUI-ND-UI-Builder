// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — buttons and blocks of the top bar of ComfyUI, shown on the top panel of the ND UI mode.
// Two ways to show one:
//   MOVE   an element of the old menu API (app.menu.settingsGroup...; the buttons of most packs, the monitor of Crystools) is carried into the
//          toolbar while the mode is on; a comment stays in its place, and the element goes back there when the mode ends. Its handlers and its
//          live parts keep working, because it is the same element.
//   MIRROR a Vue-made element (Run, "0 active", the buttons of the new extension API) is not ours to move: a copy is shown, it is rebuilt when
//          the original changes, and a click on the copy is a click on the original.
// An element is remembered by a fingerprint (the zone, the look of the element, its place among the same ones), not by a pointer.
const LEGACY = "[data-testid=legacy-topbar-container]";
const BARS = ["[data-testid=action-bar-card]", ".actionbar-container", ".comfyui-menu"];
const OURS = ".ndui-ab,.ndui-ab-p,[data-ndui-ab],[data-ndui-ab-p],.ndk-tb-item,.ndk-uimode,.ndk-editor";
const ICON = /(^|\s)((mdi-|pi-|icon-\[)[^\s]*|ndui-ab-[^\s]*)/;
const regs = new Map();   // item id -> { el, ph, wrap, how, obs, stop }
let pending = new Set(), watcher = null, watchTimer = 0;

const root = () => { for (const s of BARS) { const e = document.querySelector(s); if (e) return e.closest("[data-testid=action-bar-card]") || e; } return document.querySelector("header,.comfyui-body-top") || null; };
const legacy = () => document.querySelector(LEGACY) || document.querySelector(".comfyui-menu .comfyui-menu-right");
export const zoneOf = (e) => { const l = legacy(); return l && l.contains(e) ? "legacy" : "vue"; };
const visible = (e) => { const r = e.getBoundingClientRect(); return r.width >= 12 && r.height >= 12; };
const homeless = (e) => !!e.closest(".ndk-tb-item");

/** all the elements of the top bar that can be picked: buttons, groups of buttons, blocks of the old API */
export function candidates({ withMoved = false } = {}) {
    const r = root();
    if (!r) return [];
    const out = new Set();
    const l = legacy();
    const consider = (e) => {
        if (!e || e.closest(OURS) && !(withMoved && e.closest(".ndk-tb-item"))) return;
        if (e.matches(".sr-only,[hidden],[aria-hidden=true],.drag-handle,.p-hidden-accessible") || e.closest(".sr-only")) return;
        if (!withMoved && homeless(e)) return;
        if (e.tagName === "STYLE" || e.tagName === "SCRIPT") return;
        out.add(e);
    };
    if (l) {
        // children of the flex container of the old API (groups, blocks) and the buttons inside them
        for (const w of l.children) for (const c of w.children) if (c.nodeType === 1) consider(c);
        for (const b of l.querySelectorAll("button,[role=button],a,.comfyui-button-group")) consider(b);
    }
    for (const b of r.querySelectorAll("button,[role=button],a")) if (!(l && l.contains(b))) consider(b);
    for (const b of r.querySelectorAll(".actionbar")) consider(b);
    return [...out].filter(visible);
}

const titleOf = (e) => e.getAttribute("title") || e.getAttribute("aria-label") || e.querySelector("[title]")?.getAttribute("title") || e.querySelector("[aria-label]")?.getAttribute("aria-label") || "";
const iconOf = (e) => { for (const n of [e, ...e.querySelectorAll("*")]) { const m = String(n.getAttribute?.("class") || "").match(ICON); if (m) return m[2]; } return ""; };
const STABLE = /^(comfyui-|p-|pi\b|pi-|ndui-|actionbar|action-bar)/;
export function sigOf(e) {
    return {
        tag: e.tagName.toLowerCase(),
        cls: [...e.classList].filter((c) => STABLE.test(c)).slice(0, 8),
        title: titleOf(e).slice(0, 80),
        aria: (e.getAttribute("aria-label") || "").slice(0, 80),
        text: (e.innerText || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24),
        icon: iconOf(e).slice(0, 60),
    };
}
/** how well an element fits a sig: 0 when it is certainly another one */
function score(e, sg) {
    const s = sigOf(e);
    if (s.tag !== sg.tag) return 0;
    let n = 0, possible = 0;
    const cmp = (a, b, w) => { if (!b) return; possible += w; if (a === b) n += w; };
    cmp(s.title, sg.title, 4); cmp(s.aria, sg.aria, 4); cmp(s.icon, sg.icon, 3); cmp(s.text, sg.text, 2);
    if (sg.cls.length) { possible += 1; if (sg.cls.every((c) => s.cls.includes(c))) n += 1; }
    const need = Math.max(2, Math.min(4, possible));
    return n >= need ? n : 0;
}
/** the fingerprint of an element for the saved panel */
export function fingerprintOf(e) {
    const sig = sigOf(e), zone = zoneOf(e);
    const mine = candidates({ withMoved: true }).filter((c) => zoneOf(c) === zone && score(c, sig) > 0);
    const own = score(e, sig);
    const same = mine.filter((c) => score(c, sig) === own);
    return { zone, sig, nth: Math.max(0, same.indexOf(e)) };
}
/** the element a fingerprint stands for, or null */
export function find(fp, { withMoved = false } = {}) {
    if (!fp) return null;
    const list = candidates({ withMoved }).filter((c) => zoneOf(c) === fp.zone).map((c) => [c, score(c, fp.sig)]).filter((x) => x[1] > 0);
    if (!list.length) return null;
    const best = Math.max(...list.map((x) => x[1]));
    const top = list.filter((x) => x[1] === best).map((x) => x[0]);
    return top[Math.min(fp.nth || 0, top.length - 1)];
}
/** a short name for an element: what the user would call it */
export function nameOf(e) {
    const s = sigOf(e);
    return (s.title || s.aria || s.text || s.icon.replace(/^(mdi-|pi-|icon-\[)/, "").replace(/\]$/, "") || (e.classList.contains("comfyui-button-group") ? "Button group" : "Block")).slice(0, 40);
}
export const howFor = (e) => (zoneOf(e) === "legacy" ? "move" : "mirror");

const stripIds = (n) => { n.removeAttribute?.("id"); n.querySelectorAll?.("[id]").forEach((x) => x.removeAttribute("id")); return n; };
/** a still copy of an element (for the ghost of the editor) */
export function preview(item) {
    const e = find(item.fp, { withMoved: true });
    if (!e) return null;
    const c = stripIds(e.cloneNode(true));
    c.style.pointerEvents = "none";
    return c;
}

// ---- the live show ----
function giveBack(r) {
    r.stop?.();
    if (r.how === "move") {
        if (r.ph?.parentNode) r.ph.replaceWith(r.el);
        else if (r.home?.isConnected) r.home.append(r.el);
    }
    r.wrap?.classList.remove("on");
}
const pathOf = (root, n) => { const p = []; while (n && n !== root) { const par = n.parentNode; p.unshift([...par.childNodes].indexOf(n)); n = par; } return n === root ? p : null; };
const byPath = (root, p) => { let n = root; for (const i of p) { n = n?.childNodes?.[i]; } return n; };

function mirror(r, item, wrap) {
    const draw = () => {
        const c = stripIds(r.el.cloneNode(true));
        r.clone = c;
        wrap.replaceChildren(c);
    };
    draw();
    let raf = 0;
    const obs = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (r.el.isConnected) draw(); }); });
    obs.observe(r.el, { attributes: true, childList: true, subtree: true, characterData: true });
    // a click on the copy is a click on the original
    const proxy = (e) => {
        if (!r.clone || !r.el.isConnected) return;
        const p = pathOf(r.clone, e.target);
        const t0 = p ? byPath(r.el, p) : null;
        const t = (t0?.nodeType === 1 ? t0 : t0?.parentElement) || r.el;
        const hit = t.closest?.("button,[role=button],a,[tabindex]") || t;
        e.preventDefault(); e.stopPropagation();
        hit.click?.();
    };
    wrap.addEventListener("click", proxy, true);
    r.stop = () => { obs.disconnect(); cancelAnimationFrame(raf); wrap.removeEventListener("click", proxy, true); wrap.textContent = ""; };
}

function tryAttach(item, wrap) {
    const e = find(item.fp);
    if (!e || homeless(e)) return false;
    const how = zoneOf(e) === "legacy" ? "move" : "mirror";
    const r = { el: e, wrap, how };
    if (how === "move") {
        r.home = e.parentNode;
        r.ph = document.createComment(`nd-tb:${item.id}`);
        e.parentNode.insertBefore(r.ph, e);
        wrap.replaceChildren(e);
    } else mirror(r, item, wrap);
    wrap.classList.remove("missing"); wrap.classList.add("on"); wrap.removeAttribute("title");
    regs.set(item.id, r);
    return true;
}
function nameChip(item, wrap) {
    wrap.classList.add("missing");
    wrap.title = `Not found: ${item.name || ""}`;
    wrap.replaceChildren(Object.assign(document.createElement("span"), { className: "ndk-tb-name", textContent: item.name || "?" }));
}
function retry() {
    for (const pr of [...pending]) {
        const [item, wrap] = pr;
        if (!wrap.isConnected) { pending.delete(pr); continue; }
        if (tryAttach(item, wrap)) { pending.delete(pr); wrap.dispatchEvent(new CustomEvent("nd-tb-attached", { bubbles: true })); }
    }
    if (!pending.size) stopWatch();
}
function stopWatch() { watcher?.disconnect(); watcher = null; clearTimeout(watchTimer); }
function startWatch() {
    if (watcher) return;
    const r = root();
    if (!r) return;
    let t = 0;
    watcher = new MutationObserver(() => { clearTimeout(t); t = setTimeout(retry, 120); });
    watcher.observe(r, { childList: true, subtree: true });
    watchTimer = setTimeout(stopWatch, 60000);   // a pack that loads later is still found; after a minute the item stays "not found" until the next start
}

/** shows the item inside `wrap` (live). Not found: a dashed chip, and a search that goes on for a while */
export function attach(item, wrap) {
    if (tryAttach(item, wrap)) return true;
    nameChip(item, wrap);
    pending.add([item, wrap]);
    startWatch();
    return false;
}
/** gives every moved element back to its place, drops the copies */
export function releaseAll() {
    for (const r of regs.values()) giveBack(r);
    regs.clear();
    pending = new Set();
    stopWatch();
}
window.addEventListener("beforeunload", releaseAll);
