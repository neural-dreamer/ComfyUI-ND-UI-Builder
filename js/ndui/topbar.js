// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI mode — the pills of the top panel (the logo switch and the project button) and the page tabs that keep clear of them.
// Used by the mode (uimode.js) and by the ghost of the top panel in the editor (topghost.js): one place for the numbers.
export const LOGO_W = 92;   // the width of the logo pill
export const SAVE_W = 65;   // the width of the project pill (disk + arrow)
export const UNLOAD_BTN = 34;   // the memory buttons: round, side by side with the gap of the panel
export const SWITCH_BTN = 34;  // the round switcher button that joins the logo pill when several workflows are open
/** the room between the buttons of the panel (a setting of the editor) */
export const gapOf = (u) => u.view.gap ?? 18;
/** the width of the logo group: the logo pill and, when several workflows are open, the switcher button after a gap */
export const logoWidth = (u, switcher) => LOGO_W + (switcher ? gapOf(u) + SWITCH_BTN : 0);
export const dims = { logo: LOGO_W };   // the width of the logo group now (the mode keeps it up to date)

/** the widths of the ComfyUI items of the toolbar as they were last shown (px, on the screen); the mode keeps it up to date */
export const measured = new Map();
export const toolbarOn = (u) => u.view.toolbar.items.length > 0;
/** the width of one item of the toolbar on the screen */
export function itemWidth(u, it) {
    const k = u.view.toolbar.scale / 100;
    if (it.kind === "sep") return it.w * k;
    if (it.kind === "comfy") return measured.get(it.id) ?? 34 * k * it.scale / 100;
    return UNLOAD_BTN * k * it.scale / 100;
}
/** the width of the whole toolbar: its items with the gap of the panel between them */
export function toolbarWidth(u) {
    const list = u.view.toolbar.items;
    return list.length ? list.reduce((w, it) => w + itemWidth(u, it), 0) + (list.length - 1) * gapOf(u) : 0;
}

/** px taken by the pills on the tabs' side of the window, at the left and at the right */
export function occupied(u) {
    const tabTop = u.view.tabs.pos === "top";
    const out = { left: 0, right: 0 };
    const gap = gapOf(u);
    const add = (corner, w) => { if ((corner[0] === "t") === tabTop) out[corner[1] === "l" ? "left" : "right"] += w + gap; };
    add(u.view.logo.corner, dims.logo);
    if (u.view.save.show) add(u.view.save.corner, SAVE_W);
    if (toolbarOn(u)) add(u.view.toolbar.corner, toolbarWidth(u));
    return out;
}

/** the pills that share a corner stand in a row: the logo, then the project button, then the memory buttons */
function offsetIn(corner, u, upto) {
    let x = 14;
    const rows = [["logo", u.view.logo.corner, () => dims.logo], ["save", u.view.save.corner, () => (u.view.save.show ? SAVE_W : 0)], ["unload", u.view.toolbar.corner, () => toolbarWidth(u)]];
    for (const [name, c, w] of rows) {
        if (name === upto) break;
        const width = w();
        if (c === corner && width) x += width + gapOf(u);
    }
    return x;
}
function placeIn(node, kind, u) {
    const c = kind === "save" ? u.view.save.corner : u.view.toolbar.corner;
    node.dataset.corner = c;
    node.style.left = node.style.right = "";
    const x = offsetIn(c, u, kind);
    if (x !== 14) node.style[c[1] === "l" ? "left" : "right"] = `${x}px`;
}
/** puts the pill of the project next to the logo pill when they share a corner */
export const placeSave = (save, u) => placeIn(save, "save", u);
/** the same for the toolbar: after the logo and the project button of its corner */
export const placeUnload = (node, u) => placeIn(node, "unload", u);

/** positions the bar of the page tabs: top or bottom, left / centre / right, clear of the pills */
export function placeTabs(bar, u) {
    const t = u.view.tabs, o = occupied(u);
    bar.style.cssText = "";
    if (!t.show || u.pages.length < 2) bar.style.display = "none";
    bar.style[t.pos === "top" ? "top" : "bottom"] = "14px";
    if (t.align === "center") {
        const m = 14 + Math.max(o.left, o.right);
        bar.style.left = "50%"; bar.style.transform = "translateX(-50%)";
        bar.style.maxWidth = `calc(100% - ${2 * m}px)`;
    } else {
        bar.style[t.align] = `${14 + o[t.align]}px`;
        bar.style.maxWidth = `calc(100% - ${28 + o.left + o.right}px)`;
    }
    bar.dataset.pos = t.pos;
}

/** which sides of the window carry a pill or the tabs */
export function sidesOf(u) {
    const t = u.view.tabs, tabsOn = t.show && u.pages.length > 1;
    const corners = [u.view.logo.corner, ...(u.view.save.show ? [u.view.save.corner] : []), ...(toolbarOn(u) ? [u.view.toolbar.corner] : [])];
    return { top: corners.some((c) => c[0] === "t") || (tabsOn && t.pos === "top"), bottom: corners.some((c) => c[0] === "b") || (tabsOn && t.pos === "bottom") };
}
