// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the ND UI mode: a layer over the whole ComfyUI window that shows only our panel and the logo.
// The logo pill is also the switch back. Esc, Ctrl+Enter (run), Ctrl+S (save) work inside.
import { el } from "./core/dom.js";
import { icon, injectKit, applyVars, varsFor, tokensOf, over, toHex, rgba } from "./kit.js";
import { PageView } from "./render.js";
import { drawTabs } from "./tabs.js";
import { LOGO_URI } from "./logo.js";
import { runQueue } from "./events.js";
import { placeTabs, placeSave, placeUnload, sidesOf, dims, LOGO_W, logoWidth, gapOf, toolbarOn, measured } from "./topbar.js";
import { fillToolbar } from "./toolbar.js";
import { mountProgressBar } from "./progressbar.js";
import * as comfybar from "./comfybar.js";
import { installGuard } from "./hotkeys.js";
import { canSwitch, openSwitcher } from "./switcher.js";
import { projectMenu, runProject } from "./project_ui.js";
import { hasHandle } from "./project.js";
import { app } from "../../../scripts/app.js";

let cur = null;
export const isUiMode = () => !!cur;
export const currentMode = () => cur;

const settingOf = (id, d) => { try { return app.extensionManager?.setting?.get?.(id) ?? d; } catch { return d; } };

// whether Esc leaves the mode: the global setting wins over what the panel says
export function escLeaves(ui) {
    const g = settingOf("NeuralDreamerUI.Esc", "panel");
    if (g === "always") return true;
    if (g === "never") return false;
    return ui.view.esc !== "none";
}

export function enterUiMode(host) {
    if (cur) { if (cur.host === host) return cur; exitUiMode(); }
    injectKit();
    const root = el("div", "ndk ndk-uimode");
    root.setAttribute("role", "region"); root.setAttribute("aria-label", "ND UI");   // not a "dialog": ComfyUI then thinks a dialog is open and ignores its hotkeys
    root.tabIndex = -1;
    const stage = el("div", "ndk-um-stage");
    const bar = el("div", "ndk-strip ndk-um-tabs");
    const tabsBox = el("div", "tabs");
    bar.append(tabsBox);
    const logo = el("div", "ndk-um-logo");
    const lb = el("button", "ndk-um-logobtn"); lb.type = "button";
    const li = el("span", "ndk-um-logoimg"); li.style.backgroundImage = `url("${LOGO_URI}")`;
    const lt = el("span", "ndk-um-logotxt", "UI");
    const sw = el("span", "ndk-um-sw"); sw.append(el("i"));
    lb.append(li, lt, sw);
    // the switcher button joins the logo while several workflows are open
    const swb = el("button", "ndk-um-logobtn sw"); swb.type = "button"; swb.append(icon("layers", 17));
    logo.append(lb, swb);
    // the project pill: a disk (Save) and an arrow (the menu), in a corner of its own
    const save = el("div", "ndk-um-logo ndk-um-save");
    const sb = el("button", "ndk-um-logobtn main"); sb.type = "button"; sb.append(icon("save", 17));
    const sm = el("button", "ndk-um-logobtn more"); sm.type = "button"; sm.append(el("span", "caret"));
    save.append(sb, sm);
    // the toolbar: ComfyUI buttons and blocks, the memory buttons, separators (the editor sets them)
    const mem = el("div", "ndk-um-logo ndk-um-mem ndk-um-tools");
    // solid strips under the logo and the tabs: they show when the page is scrolled, so that nothing shows through them
    const stripT = el("div", "ndk-um-strip top"), stripB = el("div", "ndk-um-strip bottom");
    root.append(stage, stripT, stripB, bar, logo, save, mem);
    document.body.append(root);
    document.documentElement.classList.add("ndk-um-open");

    const S = { host, root, view: null, closed: false, prevFocus: document.activeElement };
    const ui = () => host.ui;
    const tr = (s, v) => host.tr(s, v);
    const pbar = mountProgressBar(root, ui, tr);
    S.pbar = pbar;

    let swShown = false, toolSig = "";
    // the widths of the ComfyUI items change (they load late, their text changes): the tabs keep clear of the toolbar
    const measure = () => {
        if (S.closed) return;
        let changed = false;
        for (const w of mem.querySelectorAll(".ndk-tb-item.comfy")) {
            const r = w.getBoundingClientRect().width;
            if (Math.abs((measured.get(w.dataset.id) ?? 0) - r) > 1) { measured.set(w.dataset.id, r); changed = true; }
        }
        if (changed) layout();
    };
    const ro = new ResizeObserver(() => measure());
    const watchTools = () => { ro.disconnect(); for (const w of mem.querySelectorAll(".ndk-tb-item.comfy")) ro.observe(w); requestAnimationFrame(measure); };
    const layout = () => {
        const u = ui(), c = u.view.logo.corner, t = u.view.tabs;
        swShown = canSwitch();
        swb.style.display = swShown ? "" : "none";
        swb.title = tr("Switch between the open workflows (Alt+Q)");
        dims.logo = logoWidth(u, swShown);
        root.style.setProperty("--ndk-bar-gap", `${gapOf(u)}px`);
        logo.dataset.corner = c;
        logo.classList.toggle("dim", u.view.logo.dim);
        lb.title = tr("Leave the ND UI mode");
        // the project pill
        save.style.display = u.view.save.show ? "" : "none";
        save.classList.toggle("dim", u.view.logo.dim);
        placeSave(save, u);
        sb.title = tr("Save the project");
        sm.title = tr("Project menu: save as, open");
        // the toolbar
        mem.style.display = toolbarOn(u) ? "" : "none";
        mem.style.setProperty("gap", `${gapOf(u)}px`);
        mem.classList.toggle("dim", u.view.toolbar.dim);
        const sig = JSON.stringify(u.view.toolbar) + host.lang();
        if (sig !== toolSig) { toolSig = sig; fillToolbar(mem, u, host, true); watchTools(); }
        placeUnload(mem, u);
        pbar.update();
        // tabs: top or bottom, left / centre / right; they keep clear of the pills when these sit on the same side
        placeTabs(bar, u);
    };
    // strips: while the page scrolls, a solid strip lies under the logo and the tabs (top and / or bottom); the page keeps clear of it
    // and the track of the scrollbar runs between the strips
    const STRIP = 62;
    const strips = () => {
        const sc = S.view?.root, u = ui();
        if (!sc) return;
        const { top: wantTop, bottom: wantBottom } = sidesOf(u);
        const mode = u.view.strip;                  // the solid strip under the logo and the tabs: off | scroll | always
        const keep = mode !== "off";
        const pt = u.view.reserve === true && wantTop ? STRIP : 0, pb = u.view.reserve === true && wantBottom ? STRIP : 0;   // the page keeps clear of them only when asked
        if (S.view.padTop !== pt || S.view.padBottom !== pb) { S.view.padTop = pt; S.view.padBottom = pb; S.view.resize(); }
        const on = S.view.scrolls || mode === "always";
        stripT.classList.toggle("on", keep && on && wantTop);
        stripB.classList.toggle("on", keep && on && wantBottom);
        sc.style.setProperty("--ndk-sb-top", keep && on && wantTop ? `${STRIP}px` : "6px");
        sc.style.setProperty("--ndk-sb-bot", keep && on && wantBottom ? `${STRIP}px` : "6px");
    };
    for (const sp of [stripT, stripB]) sp.addEventListener("wheel", (e) => { e.preventDefault(); if (S.view) S.view.root.scrollTop += e.deltaY; }, { passive: false });
    const tabs = () => {
        const shown = drawTabs(tabsBox, ui(), S.view?.page, tr, (id) => S.view?.setPage(id));
        bar.style.display = shown ? "" : "none";
    };
    const theme = () => {
        const u = ui(), tokens = tokensOf(u);
        applyVars(root, varsFor(tokens, u.kit, {}));
        // the top panel follows the theme (shape, colours, glass) unless the page sets its own look for it
        const bar = u.view.bar, rad = { sharp: 6, rounded: 12, pill: 99 }[bar.shape || u.kit.shape] || 12;
        root.style.setProperty("--ndk-bar-r", `${rad}px`);
        root.style.setProperty("--ndk-bar-r2", `${Math.max(3, rad - 4)}px`);
        root.style.setProperty("--ndk-bar-bg", bar.bg || rgba(toHex(over(tokens.s2, tokens.bg)), bar.opacity / 100));
        root.style.setProperty("--ndk-bar-fg", bar.fg || tokens.text);
        root.style.setProperty("--ndk-bar-bd", bar.border || (tokens.noBorders ? "transparent" : tokens.borderStrong));
        root.style.setProperty("--ndk-bar-blur", `${bar.blur}px`);
        if (bar.strip) root.style.setProperty("--ndk-bar-strip", bar.strip); else root.style.removeProperty("--ndk-bar-strip");
        root.style.setProperty("--ndk-stage-bg", u.view.nodeBg || tokens.bg);
        root.style.background = u.view.nodeBg || tokens.bg;
    };
    const empty = () => {
        stage.querySelector(".ndk-um-empty")?.remove();
        if (host.has && ui().widgets.length) return;
        const e = el("div", "ndk-um-empty");
        e.append(el("div", "t", tr("This workflow has no ND UI yet")));
        e.append(el("div", "s", tr("Leave the mode and press Edit next to Run to build one.")));
        stage.append(e);
    };
    const build = () => {
        S.view?.destroy();
        theme(); layout();
        const u = ui();
        S.view = new PageView(stage, {
            ui: u, mode: "run", kind: "uimode", fit: u.view.fit, tr, open: host.open, popupHost: () => root,
            onPage: (id) => { host.pageChanged(id, S); tabs(); },
            onChange: () => {},
        });
        S.view.root.addEventListener("scroll", strips, { passive: true });
        S.view.root.addEventListener("transitionend", strips);
        tabs(); empty(); strips();
    };
    build();

    const stripTimer = setInterval(() => { strips(); if (swShown !== canSwitch()) { layout(); tabs(); } }, 250);   // an open spoiler or a resize can make the page scrollable without a scroll event
    const unsub = host.subscribe((kind, src) => {
        if (S.closed) return;
        if (kind === "rebuild") build();
        else if (kind === "page") { if (src !== S && S.view && S.view.page !== host.cur) S.view.setPage(host.cur); tabs(); }
        else if (kind === "lang") { S.view?.refresh(); tabs(); layout(); empty(); }
    });

    const close = () => {
        if (S.closed) return;
        S.closed = true; cur = null; try { pbar.destroy(); } catch {}
        unsub();
        clearInterval(stripTimer);
        dims.logo = LOGO_W;
        window.removeEventListener("keydown", key, true);
        S.guardOff?.();
        ro.disconnect(); comfybar.releaseAll(mem); document.documentElement.classList.remove("ndk-um-open");
        document.removeEventListener("fullscreenchange", fsChange);
        S.view?.destroy();
        const wasScreen = document.fullscreenElement === root;
        root.remove();
        if (wasScreen) { try { const r = document.exitFullscreen(); r?.catch?.(() => {}); } catch {} }
        try { S.prevFocus?.focus?.({ preventScroll: true }); } catch {}
        window.dispatchEvent(new CustomEvent("nd-uimode", { detail: false }));
    };
    const key = (e) => {
        if (S.closed) return;
        const k = e.key;
        if (k === "Escape") {
            if (document.querySelector(".ndk-lightbox, .ndk-pop, .ndk-um-menu, .ndk-sw, .nde")) return; // they take their own Esc
            if (!escLeaves(ui())) return;
            e.preventDefault(); e.stopPropagation(); close();
        } else if (k === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault(); e.stopPropagation(); runQueue(1);
        } else if ((k === "s" || k === "S") && (e.ctrlKey || e.metaKey) && !document.querySelector(".nde")) {
            e.preventDefault(); e.stopPropagation();
            // a workflow that already has a project file saves into it; otherwise Ctrl+S is the ComfyUI save as before
            if (ui().view.save.show && hasHandle()) runProject(host, "save");
            else { try { app.extensionManager?.command?.execute?.("Comfy.SaveWorkflow"); } catch {} }
        }
    };
    const fsChange = () => { if (!document.fullscreenElement && !S.closed && ui().view.fullscreen === "screen") close(); };
    window.addEventListener("keydown", key, true);
    S.guardOff = installGuard(() => !S.closed);
    lb.addEventListener("click", close);
    swb.addEventListener("click", () => openSwitcher());
    sb.addEventListener("click", () => runProject(host, "save"));
    sm.addEventListener("click", () => projectMenu(sm, host, root));
    if (ui().view.fullscreen === "screen") {
        document.addEventListener("fullscreenchange", fsChange);
        try { const r = root.requestFullscreen?.(); r?.catch?.(() => document.removeEventListener("fullscreenchange", fsChange)); } catch {}
    }
    root.focus({ preventScroll: true });
    S.close = close;
    cur = S;
    window.dispatchEvent(new CustomEvent("nd-uimode", { detail: true }));
    return S;
}

export const exitUiMode = () => cur?.close();
export function toggleUiMode(host) { if (cur) cur.close(); else enterUiMode(host); }
