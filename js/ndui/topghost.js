// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — a ghost of the top panel of the ND UI mode (the logo pill and the page tabs) over the page, and the band it keeps free.
// The same corners and sides as in uimode.js. In the mode the logo, the tabs and the strip are drawn in screen px over a page that is scaled to the window
// (the scale `s`), so here they are drawn as a miniature of that window: in real px, scaled by zoom / s. The band is where nothing should lie.
import { el } from "./core/dom.js";
import { drawTabs } from "./tabs.js";
import { LOGO_URI } from "./logo.js";
import { placeTabs, placeSave, placeUnload, sidesOf, toolbarOn } from "./topbar.js";
import { fillToolbar } from "./toolbar.js";
import { wireGhost } from "./editor_toolbar.js";
import { icon } from "./kit.js";
import { adaptGeo } from "./adapt.js";

export const BAND = 62;   // screen px, the same as STRIP in uimode.js

// the scale of the page in the ND UI mode (as PageView.resize counts it); the editor takes the window it runs in as the window of the mode
export function modeScale(ui, vw = window.innerWidth, vh = window.innerHeight) {
    const pw = Math.max(1, ui.page.w), ph = Math.max(1, ui.page.h);
    const s = ui.view.fit === "fill" ? vh / ph : ui.view.fit === "adaptive" ? adaptGeo(ui, vw, vh).s : Math.min(vw / pw, vh / ph);
    return Number.isFinite(s) && s > 0.05 ? s : 1;
}

// which sides need room, in page units (the band is BAND screen px, the page is scaled by modeScale)
export function reserveOf(ui) {
    const band = BAND / modeScale(ui), sd = sidesOf(ui);
    return { top: sd.top ? band : 0, bottom: sd.bottom ? band : 0 };
}

// draws into `layer` (an element of the size of the page on the screen)
export function drawGhost(layer, ui, page, zoom, tr, E = null) {
    layer.textContent = "";
    const r = reserveOf(ui);
    const f = zoom / modeScale(ui);   // editor screen px per px of the window of the mode
    const lay = layer;
    layer = el("div"); layer.style.cssText = `position:absolute;left:0;top:0;width:${ui.page.w * zoom / f}px;height:${ui.page.h * zoom / f}px;transform-origin:0 0;transform:scale(${f})`;
    lay.append(layer);
    layer.style.setProperty("--ndk-bar-gap", `${ui.view.gap ?? 18}px`);
    const mk = (cls) => el("div", cls);
    if (r.top) { const b = mk("band top"); b.style.height = `${BAND}px`; layer.append(b); }
    if (r.bottom) { const b = mk("band bottom"); b.style.height = `${BAND}px`; layer.append(b); }
    const c = ui.view.logo.corner, t = ui.view.tabs;
    const logo = el("div", "ndk-um-logo ghost"); logo.dataset.corner = c;
    const lb = el("span", "ndk-um-logobtn");
    const li = el("span", "ndk-um-logoimg"); li.style.backgroundImage = `url("${LOGO_URI}")`;
    lb.append(li, el("span", "ndk-um-logotxt", "UI"), (() => { const sw = el("span", "ndk-um-sw"); sw.append(el("i")); return sw; })());
    logo.append(lb);
    logo.style.opacity = "1";
    layer.append(logo);
    if (ui.view.save.show) {
        const sv = el("div", "ndk-um-logo ndk-um-save ghost");
        const m1 = el("span", "ndk-um-logobtn main"); m1.append(icon("save", 17));
        const m2 = el("span", "ndk-um-logobtn more"); m2.append(el("span", "caret"));
        sv.append(m1, m2); sv.style.opacity = "1";
        placeSave(sv, ui);
        layer.append(sv);
    }
    if (toolbarOn(ui) || E?.tbDrag) {
        const mm = el("div", "ndk-um-logo ndk-um-mem ndk-um-tools ghost"); mm.style.opacity = "1"; mm.style.gap = `${ui.view.gap ?? 18}px`;
        fillToolbar(mm, ui, { tr }, false);
        if (!toolbarOn(ui)) { const ph = el("div", "ndk-tb-item ph", tr("Drop here")); mm.append(ph); }
        if (E) wireGhost(mm, E);
        placeUnload(mm, ui);
        layer.append(mm);
    }
    const bar = el("div", "ndk-strip ndk-um-tabs ghost");
    const box = el("div", "tabs"); bar.append(box);
    if (drawTabs(box, ui, page, tr, () => {})) {
        placeTabs(bar, ui);
        layer.append(bar);
    }
    return r;
}
