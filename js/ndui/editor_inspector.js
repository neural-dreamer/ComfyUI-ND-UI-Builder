// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the right column: the page settings (nothing selected) or the settings of the selected widget(s).
import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { el, icon, popup } from "./widgets/util.js";
import { section, row, numberInput, textInput, selectInput, segInput, toggleInput, rangeInput, colorInput, btn, iconBtn } from "./controls.js";
import { THEMES, tokensOf, customTheme, frostTheme, frostFromAccent } from "./kit.js";
import { defOf } from "./widgets/index.js";
import { cleanExt, DEFAULT_EXT, human, STYLES, SHAPES, DENSITIES, LABEL_POSITIONS, PAGE_PRESETS, GRID_STEPS, SCALE_RANGE, PAGE_MIN, PAGE_MAX, BAR_GAP_MIN, BAR_GAP_MAX, BAR_GAP_DEF, normalizeLook, sourceOf, descendantsOf } from "./model.js";
import { findSource, listParams, fits, addSource } from "./sources.js";
import { isBridgeNode } from "./events.js";
import { isStackNode } from "./lora/stack_view.js";
import { isLoadImagesNode } from "./widgets/imageinput.js";
import { isShowAnyNode } from "./widgets/showany.js";
import { isVariantNode } from "./widgets/variantsel.js";
import { isLoaderNode } from "./media/trim_view.js";
import { TEMPLATES, addTemplatePage, download, parsePreset } from "./presets.js";
import { toast } from "./core/dom.js";
import { autoModeOf } from "./adapt.js";
import { toolbarSection, toolbarItemSettings } from "./editor_toolbar.js";
import { progressSection } from "./editor_progress.js";
import { templatesTab } from "./editor_templates.js";
import { editorLookTab } from "./editor_look.js";

const DATA_NAMES = { images: "pictures", live: "live frames", progress: "progress", text: "text", audio: "sounds", video: "videos", lorastack: "ND LoRA Stack node", anynode: "any node", videoload: "ND Load Video node", audioload: "ND Load Audio node", loadimages: "ND Load Images node", showany: "ND Show Any As Text node", variantsel: "ND Variant Preview Selector node" };
const DATA_NODE_OK = { lorastack: (node) => isStackNode(node), videoload: (node) => isLoaderNode(node, "video"), audioload: (node) => isLoaderNode(node, "audio"), loadimages: (node) => isLoadImagesNode(node), showany: (node) => isShowAnyNode(node), variantsel: (node) => isVariantNode(node), anynode: () => true };
const LANGS = [["auto", "Auto"], ["en", "English"], ["ru", "Русский"], ["zh", "中文"]];

export function renderInspector(E, host) {
    const prev = host.querySelector(".nde-scroll")?.scrollTop || 0;
    host.textContent = "";
    E.syncPosition = null;
    if (!E.rtab) { try { E.rtab = ["templates", "editor"].includes(localStorage.getItem("ndui-rtab")) ? localStorage.getItem("ndui-rtab") : "settings"; } catch { E.rtab = "settings"; } }
    const tabs = el("div", "nde-tabs nde-rtabs");
    for (const [id, label, ic] of [["settings", E.tr("Settings"), "sliders"], ["templates", E.tr("Templates"), "layers"], ["editor", E.tr("Editor"), "grid"]]) {
        const b = el("button", E.rtab === id ? "on" : ""); b.type = "button"; b.dataset.rtab = id;
        b.append(icon(ic, 15), el("span", "", label));
        b.addEventListener("click", () => { if (E.rtab === id) return; E.rtab = id; try { localStorage.setItem("ndui-rtab", id); } catch {} E.renderInspector(); });
        tabs.append(b);
    }
    host.append(tabs);
    const body = el("div", "nde-scroll");
    host.append(body);
    if (E.rtab === "templates") { templatesTab(E, body); body.scrollTop = prev; return; }
    if (E.rtab === "editor") { editorLookTab(E, body); body.scrollTop = prev; return; }
    const sel = E.selected();
    const tbi = !sel.length && E.tbSel ? E.ui.view.toolbar.items.find((i) => i.id === E.tbSel) : null;
    if (tbi) toolbarItemSettings(E, body, tbi);
    else if (!sel.length) pageSettings(E, body);
    else if (sel.length === 1) widgetSettings(E, body, sel[0]);
    else multiSettings(E, body, sel);
    body.scrollTop = prev;
}

const palette = (E) => {
    const t = tokensOf(E.ui);
    return [["Accent", t.accent], ["Accent 2", t.accent2], ["Text", t.text], ["Muted", t.muted], ["Background", t.bg], ["Surface", t.s1], ["Surface 2", t.s2], ["Surface 3", t.s3], ["White", "#ffffff"], ["Black", "#000000"]].map(([n, c]) => [E.tr(n), c.startsWith("#") ? c : "#7757fa"]);
};
const color = (E, value, onChange, nullable = true) => colorInput({ value, palette: palette(E), onChange, nullable, host: E.root, tr: E.tr });

/* ------------------------------------------------------------------ the page */

function pageSettings(E, body) {
    const { tr, ui } = E;
    const set = (key, fn, o) => E.change(key, fn, o);
    body.append(el("div", "nde-note", tr("Nothing is selected: these are the settings of the whole page. Click a widget to edit it.")));

    body.append(section(tr("Page"), (b) => {
        const preset = selectInput([["", tr("Custom")], ...PAGE_PRESETS.map((p) => [p.id, p.label])], PAGE_PRESETS.find((p) => p.w === ui.page.w && p.h === ui.page.h)?.id || "", (v) => {
            const p = PAGE_PRESETS.find((x) => x.id === v); if (p) set(null, (u) => { u.page.w = p.w; u.page.h = p.h; }, {});
            if (p) E.fit();
        });
        b.append(row(tr("Proportions"), preset));
        b.append(row(tr("In the window"), selectInput([["proportions", tr("Proportions")], ["fill", tr("Fill the window")], ["adaptive", tr("Adapt to the window")]], ui.view.fit, (v) => set(null, (u) => { u.view.fit = v; })),
            tr("Proportions: the page is scaled to the window. Fill: it is stretched to the window. Adapt to the window: the page keeps its size, and the width and height that are left over are shared between the widgets. In the ND UI mode and in the node.")));
        if (ui.view.fit !== "fill") b.append(row(tr("Background fills the window"), toggleInput(ui.view.bgFill, (v) => set(null, (u) => { u.view.bgFill = v; })), tr("The page keeps its proportions, but its background is stretched over the whole window, so there is no hard edge")));
        const adaptive = ui.view.fit === "adaptive";
        const pair = el("div", "nde-pair");
        const nw = numberInput({ value: ui.page.w, min: PAGE_MIN, max: PAGE_MAX, int: true, onChange: (v) => { set(null, (u) => { u.page.w = v; }); E.fit(); } });
        const nh = numberInput({ value: ui.page.h, min: PAGE_MIN, max: PAGE_MAX, int: true, onChange: (v) => { set(null, (u) => { u.page.h = v; }); E.fit(); } });
        if (adaptive) {
            b.append(row(tr("Minimum width"), nw, tr("A narrower window shrinks the page; a wider one gives the layout more room")));
            b.append(row(tr("Window height"), nh, tr("The line where the window ends in the editor; what lies below is scrolled to")));
            b.append(row(tr("Maximum width (0: none)"), numberInput({ value: ui.view.maxW || 0, min: 0, max: PAGE_MAX * 4, int: true, onChange: (v) => { set(null, (u) => { u.view.maxW = v || 0; }); } }), tr("The layout does not get wider than this; the page then stands in the middle")));
        } else pair.append(row("W", nw), row("H", nh));
        const cur = ui.pages.find((x) => x.id === E.page);
        const nl = numberInput({ value: cur?.len || 0, min: 0, max: PAGE_MAX * 4, int: true, onChange: (v) => { set(null, (u) => { const pg = u.pages.find((x) => x.id === E.page); if (pg) pg.len = v; }); } });
        nl.title = tr("The least length of this page, if it must be longer than the window (0: by the lowest widget). What lies below the window is scrolled to.");
        if (!adaptive) b.append(pair);
        b.append(row(tr("Length (0: auto)"), nl), row(tr("Corner radius"), rangeInput({ value: ui.page.radius, min: 0, max: 48, onInput: (v) => set("pr", (u) => { u.page.radius = v; }, { light: true }), fmt: (v) => `${v}px` })));
    }, { key: "page" }));

    body.append(section(tr("Background"), (b) => {
        const bg = ui.page.bg;
        b.append(row(tr("Type"), segInput([["theme", tr("Theme")], ["solid", tr("Colour")], ["gradient", tr("Gradient")], ["image", tr("Image")]], bg.type, (v) => set(null, (u) => { u.page.bg.type = v; }))));
        if (bg.type === "solid") b.append(row(tr("Colour"), color(E, bg.color, (v) => set("bgc", (u) => { u.page.bg.color = v || "#0e1014"; }, { light: true }), false)));
        if (bg.type === "gradient") {
            b.append(row(tr("From"), color(E, bg.a, (v) => set("bga", (u) => { u.page.bg.a = v || "#0e1014"; }, { light: true }), false)));
            b.append(row(tr("To"), color(E, bg.b, (v) => set("bgb", (u) => { u.page.bg.b = v || "#1a1d27"; }, { light: true }), false)));
            b.append(row(tr("Angle"), rangeInput({ value: bg.angle, min: 0, max: 360, onInput: (v) => set("bgd", (u) => { u.page.bg.angle = v; }, { light: true }), fmt: (v) => `${v}°` })));
        }
        if (bg.type === "image") {
            b.append(row(tr("Image"), imageField(E, bg.src, (v) => set(null, (u) => { u.page.bg.src = v; }))));
            b.append(row(tr("Fit"), segInput([["cover", tr("Cover")], ["contain", tr("Contain")], ["tile", tr("Tile")]], bg.mode, (v) => set(null, (u) => { u.page.bg.mode = v; }))));
            b.append(row(tr("Dim"), rangeInput({ value: Math.round(bg.dim * 100), min: 0, max: 90, onInput: (v) => set("bgm", (u) => { u.page.bg.dim = v / 100; }, { light: true }), fmt: (v) => `${v}%` })));
        }
    }, { key: "bg" }));

    body.append(section(tr("Theme"), (b) => {
        const g = el("div", "nde-themes");
        const ids = [...THEMES.map((t) => [t.id, t.label, t.tokens]), ["frost", "Frost", frostTheme(ui.theme.frost)], ["custom", "Custom", customTheme(ui.theme.custom.accent, ui.theme.custom.bg)]];
        for (const [id, label, t] of ids) {
            const c = el("button", `nde-theme${ui.theme.id === id ? " on" : ""}`); c.type = "button"; c.dataset.theme = id;
            const sw = el("div", "sw");
            for (const k of t.sw || [t.bg, t.s2, t.accent, t.accent2]) { const i = el("i"); i.style.background = k; sw.append(i); }
            c.append(sw, el("span", "", tr(label)));
            c.addEventListener("click", () => set(null, (u) => { u.theme.id = id; u.theme.overrides = {}; }));
            g.append(c);
        }
        b.append(g);
        const gap = el("div"); gap.style.height = "10px"; b.append(gap);
        if (ui.theme.id === "frost") {
            const fr = ui.theme.frost, fset = (k, key, v) => set(key, (u) => { u.theme.frost[k] = v; }, { light: true });
            b.append(row(tr("Glass tint"), color(E, fr.tint, (v) => fset("tint", "ftn", v || "#ffffff"), false), tr("The colour of the frosted cards")));
            b.append(row(tr("Accent"), color(E, fr.accent, (v) => fset("accent", "fac", v || "#8ee3cf"), false)));
            b.append(row(tr("Gradient 1"), color(E, fr.g1, (v) => fset("g1", "fg1", v || "#12363a"), false)));
            b.append(row(tr("Gradient 2"), color(E, fr.g2, (v) => fset("g2", "fg2", v || "#080c10"), false)));
            b.append(row(tr("Gradient 3"), color(E, fr.g3 || null, (v) => fset("g3", "fg3", v || ""), true), tr("Optional: a third colour of the gradient")));
            b.append(row(tr("Gradient angle"), rangeInput({ value: fr.angle, min: 0, max: 360, step: 5, onInput: (v) => fset("angle", "fan", v), fmt: (v) => `${v}°` })));
            b.append(row(tr("Blur behind the cards"), rangeInput({ value: fr.blur, min: 0, max: 40, step: 1, onInput: (v) => fset("blur", "fbl", v), fmt: (v) => `${v} px` })));
            b.append(row(tr("Opacity of the cards"), rangeInput({ value: Math.round(fr.opacity * 100), min: 2, max: 40, step: 1, onInput: (v) => fset("opacity", "fop", v / 100), fmt: (v) => `${v}%` })));
            b.append(btn(tr("Gradient from the accent"), "sliders", () => set(null, (u) => { Object.assign(u.theme.frost, frostFromAccent(u.theme.frost.accent)); }), "", tr("Makes the three colours of the gradient from the accent colour")));
        } else if (ui.theme.id === "custom") {
            b.append(row(tr("Accent"), color(E, ui.theme.custom.accent, (v) => set("tca", (u) => { u.theme.custom.accent = v || "#7757fa"; }, { light: true }), false)));
            b.append(row(tr("Background"), color(E, ui.theme.custom.bg, (v) => set("tcb", (u) => { u.theme.custom.bg = v || "#0e1014"; }, { light: true }), false)));
        } else {
            b.append(row(tr("Accent colour"), color(E, ui.theme.overrides.accent || null, (v) => set("toa", (u) => { if (v) u.theme.overrides.accent = v; else delete u.theme.overrides.accent; }, { light: true }), true), tr("Replaces the accent colour of the theme everywhere")));
        }
        b.append(row(tr("Borders of the widgets"), toggleInput(ui.theme.borders, (v) => set(null, (u) => { u.theme.borders = v; })), tr("The thin line round the panels, fields and lists. A colour set on a widget still shows")));
        const sh = ui.theme.shadow, shset = (k, key, v) => set(key, (u) => { u.theme.shadow[k] = v; }, { light: true });
        b.append(row(tr("Shadow blur"), rangeInput({ value: sh.blur, min: 0, max: 120, step: 1, onInput: (v) => shset("blur", "shb", v), fmt: (v) => `${v} px` })));
        b.append(row(tr("Shadow strength"), rangeInput({ value: sh.strength, min: 0, max: 300, step: 5, onInput: (v) => shset("strength", "shs", v), fmt: (v) => `${v}%` }), tr("0: no shadow; 100%: as the theme says")));
        b.append(row(tr("Shadow colour"), color(E, sh.color || null, (v) => shset("color", "shc", v || ""), true), tr("Empty: the colour of the theme")));
        b.append(row(tr("Node background"), color(E, ui.view.nodeBg, (v) => set("nbg", (u) => { u.view.nodeBg = v; }, { light: true })), tr("The colour behind the page inside the node")));
    }, { key: "theme" }));

    body.append(section(tr("Style of the kit"), (b) => {
        b.append(row(tr("Style"), segInput(STYLES.map((s) => [s, tr(human(s))]), ui.kit.style, (v) => set(null, (u) => { u.kit.style = v; }))));
        b.append(row(tr("Shape"), segInput(SHAPES.map((s) => [s, tr(human(s))]), ui.kit.shape, (v) => set(null, (u) => { u.kit.shape = v; }))));
        b.append(row(tr("Density"), segInput(DENSITIES.map((s) => [s, tr(human(s))]), ui.kit.density, (v) => set(null, (u) => { u.kit.density = v; }))));
        b.append(row(tr("Font"), segInput([["inter", "Inter"], ["system", tr("System")]], ui.kit.font, (v) => set(null, (u) => { u.kit.font = v; }))));
        b.append(row(tr("Scale"), rangeInput({ value: ui.kit.scale, min: SCALE_RANGE[0], max: SCALE_RANGE[1], step: 5, onInput: (v) => set("ks", (u) => { u.kit.scale = v; }, { light: true }), fmt: (v) => `${v}%` })));
    }, { key: "kit" }));

    body.append(section(tr("View"), (b) => {
        b.append(row(tr("Grid"), selectInput(GRID_STEPS.map((g) => [g, `${g}px`]), ui.view.grid, (v) => set(null, (u) => { u.view.grid = Number(v); }))));
        b.append(row(tr("Snap to the grid"), toggleInput(ui.view.snap, (v) => set(null, (u) => { u.view.snap = v; }))));
        b.append(row(tr("Page tabs"), toggleInput(ui.view.tabs.show, (v) => set(null, (u) => { u.view.tabs.show = v; }))));
        b.append(row(tr("Tabs position"), segInput([["top", tr("Top")], ["bottom", tr("Bottom")]], ui.view.tabs.pos, (v) => set(null, (u) => { u.view.tabs.pos = v; }))));
        b.append(row(tr("Tabs alignment"), segInput([["left", tr("Left")], ["center", tr("Centre")], ["right", tr("Right")]], ui.view.tabs.align, (v) => set(null, (u) => { u.view.tabs.align = v; }))));
        b.append(row(tr("Logo corner in the ND UI mode"), selectInput([["tl", tr("Top left")], ["tr", tr("Top right")], ["bl", tr("Bottom left")], ["br", tr("Bottom right")]], ui.view.logo.corner, (v) => set(null, (u) => { u.view.logo.corner = v; }))));
        b.append(row(tr("Project button"), toggleInput(ui.view.save.show, (v) => set(null, (u) => { u.view.save.show = v; })), tr("A disk next to the logo that saves and opens the work of this workflow as a project file")));
        b.append(row(tr("Project button corner"), selectInput([["tl", tr("Top left")], ["tr", tr("Top right")], ["bl", tr("Bottom left")], ["br", tr("Bottom right")]], ui.view.save.corner, (v) => set(null, (u) => { u.view.save.corner = v; }))));
        b.append(row(tr("Project file type"), textInput({ value: ui.view.save.ext, placeholder: DEFAULT_EXT, onChange: (v) => set(null, (u) => { u.view.save.ext = cleanExt(v); }) }), tr("The extension of the project files of this workflow, letters and digits (2 to 12). Only files of this type can be saved and opened")));
        b.append(row(tr("Space between the buttons of the top panel"), numberInput({ value: ui.view.gap, min: BAR_GAP_MIN, max: BAR_GAP_MAX, int: true, onChange: (v) => set(null, (u) => { u.view.gap = Math.max(BAR_GAP_MIN, Math.min(BAR_GAP_MAX, Math.round(v) || BAR_GAP_DEF)); }) }), tr("Px between the logo, the workflow switcher, the project button and the page tabs, so that a wrong button is not hit by mistake")));
        b.append(row(tr("Strip under the logo and tabs"), segInput([["off", tr("Disable")], ["scroll", tr("While scrolls")], ["always", tr("Always")]], ui.view.strip, (v) => set(null, (u) => { u.view.strip = v; })), tr("A solid strip under the logo and the tabs: never, only while the page scrolls, or always")));
        b.append(row(tr("Keep the page clear of the logo and tabs"), toggleInput(ui.view.reserve, (v) => set(null, (u) => { u.view.reserve = v; })), tr("When the page scrolls, it starts below the top strip and ends above the bottom one. Off: the page does not move")));
        b.append(row(tr("Dim the logo"), toggleInput(ui.view.logo.dim, (v) => set(null, (u) => { u.view.logo.dim = v; })), tr("The logo fades until the mouse comes near; it never disappears")));
        b.append(row(tr("Esc in the ND UI mode"), segInput([["exit", tr("Leaves the mode")], ["none", tr("Does nothing")]], ui.view.esc, (v) => set(null, (u) => { u.view.esc = v; }))));
        b.append(row(tr("Open in the ND UI mode"), toggleInput(ui.view.startInUi, (v) => set(null, (u) => { u.view.startInUi = v; })), tr("The workflow opens straight in the ND UI mode")));
        b.append(row(tr("Language"), selectInput(LANGS.map(([v, l]) => [v, v === "auto" ? tr("Auto") : l]), ui.view.lang, (v) => set(null, (u) => { u.view.lang = v; }))));
    }, { key: "view", open: false }));
    toolbarSection(E, body);
    progressSection(E, body);

    body.append(section(tr("Pages"), (b) => {
        ui.pages.forEach((p, i) => {
            const r = el("div", "nde-pair"); r.style.cssText = "grid-template-columns:1fr auto auto auto;align-items:center";
            const name = textInput({ value: p.name, onInput: (v) => set(`pn${p.id}`, (u) => { u.pages[i].name = v.slice(0, 60) || `Page ${i + 1}`; }, { light: true }) });
            r.append(name,
                iconBtn("up", tr("Move up"), () => { if (i > 0) set(null, (u) => { [u.pages[i - 1], u.pages[i]] = [u.pages[i], u.pages[i - 1]]; }); }),
                iconBtn("down", tr("Move down"), () => { if (i < ui.pages.length - 1) set(null, (u) => { [u.pages[i + 1], u.pages[i]] = [u.pages[i], u.pages[i + 1]]; }); }),
                iconBtn("trash", tr("Delete the page and its widgets"), () => { if (ui.pages.length > 1) set(null, (u) => { u.pages.splice(i, 1); u.widgets = u.widgets.filter((w) => w.page !== p.id); }); }));
            b.append(r);
        });
    }, { key: "pages" }));
    modeSection(E, body);
}

// the settings of the page on view as a mode: which nodes it owns, how the others are switched off, the INT parameter that follows it
function modeSection(E, body) {
    const { tr, ui } = E;
    const set = (key, fn, o) => E.change(key, fn, o);
    const i = ui.pages.findIndex((p) => p.id === E.page);
    if (i < 0) return;
    const pg = ui.pages[i];
    body.append(section(tr("Mode of this page"), (b) => {
        b.append(row(tr("The page is"), segInput([["page", tr("Page")], ["mode", tr("Mode")]], pg.kind, (v) => set(null, (u) => { u.pages[i].kind = v; }))));
        if (pg.kind !== "mode") { b.append(el("div", "nde-note", tr("A mode switches nodes on and off: while another mode tab is open, the nodes of this mode are muted or bypassed and stay out of the request."))); return; }
        const c = pg.control;
        b.append(row(tr("Inactive nodes are"), segInput([["mute", tr("Muted")], ["bypass", tr("Bypassed")]], c.how, (v) => set(null, (u) => { u.pages[i].control.how = v; }))));
        b.append(el("div", "nde-note", tr("The nodes bound to the widgets of this page belong to the mode by themselves. Add more nodes or whole groups:")));
        const list = (title, items, has, toggle) => {
            const box = el("div", "nde-modelist");
            box.append(el("div", "nde-note", title));
            if (!items.length) box.append(el("div", "nde-note", tr("Nothing to choose from")));
            for (const [id, label] of items) {
                const r = el("label", "nde-modeitem"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = has(id);
                cb.addEventListener("change", () => toggle(id, cb.checked));
                r.append(cb, el("span", "", label)); box.append(r);
            }
            b.append(box);
        };
        const flip = (key) => (id, on) => set(null, (u) => { const a = u.pages[i].control[key]; const k = a.indexOf(id); if (on && k < 0) a.push(id); if (!on && k >= 0) a.splice(k, 1); });
        list(tr("Nodes"), ui.sources.map((s) => [s.uid, s.title || s.tag || s.class]), (id) => c.nodes.includes(id), flip("nodes"));
        let groups = [];
        try { groups = [...new Set((app.graph?._groups || []).map((g) => g.title).filter(Boolean))]; } catch {}
        list(tr("Groups"), groups.map((g) => [g, g]), (id) => c.groups.includes(id), flip("groups"));
        // the INT parameter that holds the number of the active mode
        const opts = [["", tr("None")]];
        for (const s of ui.sources) { const n = findSource(s); if (!n) continue; for (const pr of listParams(n)) if (pr.ptype === "INT" || pr.ptype === "BOOLEAN") opts.push([`${s.uid}|${pr.name}`, `${s.title || s.tag || s.class} · ${pr.name}`]); }
        const cur = c.bindIndex?.src ? `${c.bindIndex.src}|${c.bindIndex.name}` : "";
        b.append(row(tr("Parameter of the active mode"), selectInput(opts, cur, (v) => set(null, (u) => { const [src, name] = v ? v.split("|") : ["", ""]; u.pages[i].control.bindIndex = v ? { src, name } : null; })), tr("An INT or BOOLEAN parameter (for example, the condition of ND Multi Switch) that follows the active mode and can change it")));
    }, { key: "mode" }));
}

/* ------------------------------------------------------------------ a widget */

function widgetSettings(E, body, w) {
    const { tr } = E;
    const def = defOf(w.type);
    const head = el("div", "nde-card-h"); head.style.cssText = "cursor:default;padding:0 0 10px";
    const t = el("div", "nde-card-t"); t.append(el("b", "", tr(def?.label || w.type)), el("small", "", `${Math.round(w.w)}×${Math.round(w.h)}`));
    head.append(icon(def?.icon || "panel", 20), t, iconBtn("copy", tr("Duplicate (Ctrl+D)"), () => E.duplicate([w.id])), iconBtn("trash", tr("Delete (Del)"), () => E.remove([w.id])));
    body.append(head);
    if (w.group) groupSection(E, body, [w]);

    if (def?.slots?.some((s) => !s.when || s.when(w.props))) {
        body.append(section(tr("Bind"), (b) => {
            b.style.gap = "8px";
            for (const s of def.slots) { if (s.when && !s.when(w.props)) continue; b.append(slotCard(E, w, s)); }
        }, { key: "bind" }));
    }

    if (def?.inspect) {
        body.append(section(tr("Panel"), (b) => { b.style.gap = "8px"; def.inspect(E, w, b, { tr, el, row, btn, selectInput, findSource, sourceOf }); }, { key: "panel" }));
    }

    const props = (def?.props || []);
    if (props.length || !def?.noLabel) {
        body.append(section(tr("Values"), (b) => {
            if (!def?.noLabel) {
                b.append(row(tr("Label"), textInput({ value: w.props.label ?? "", onInput: (v) => E.change(`lb${w.id}`, () => { w.props.label = v; }, { light: true }) })));
                b.append(row(tr("Label position"), selectInput([["", tr("Default")], ...LABEL_POSITIONS.map((p) => [p, tr(human(p))])], w.look.label || "", (v) => E.change(null, () => { w.look.label = v || null; }, { inspector: false }))));
            }
            if (def && !def.decor && def.slots?.length) {
                b.append(row(tr("Tooltip"), textInput({ value: w.props.tip ?? "", placeholder: tr("No tooltip"), onInput: (v) => E.change(`tip${w.id}`, () => { w.props.tip = v; }, { light: true }) }), tr("A hint that appears when the pointer rests on the widget. Empty: no hint.")));
            }
            for (const p of props) {
                if (p.when && !p.when(w.props)) continue;
                b.append(propRow(E, w, p));
            }
        }, { key: "values" }));
    }

    body.append(section(tr("Look"), (b) => lookControls(E, b, [w]), { key: "look", open: false }));

    if (E.ui.view.fit === "adaptive") body.append(adaptSection(E, [w]));

    body.append(section(tr("Position"), (b) => {
        const mk = (k, label, min) => numberInput({ value: w[k], int: true, min, onChange: (v) => E.change(`pos${k}`, () => { w[k] = v; }, { light: true }) });
        const nx = mk("x", "X", -9999), ny = mk("y", "Y", -9999), nw = mk("w", "W", 8), nh = mk("h", "H", 8);
        const p1 = el("div", "nde-pair"); p1.append(row("X", nx), row("Y", ny));
        const p2 = el("div", "nde-pair"); p2.append(row("W", nw), row("H", nh));
        b.append(p1, p2);
        // where the widget lies: on the page or in one of the spoilers of this page (not in itself or in what lies in it)
        const spoilers = E.ui.widgets.filter((o) => o.page === w.page && o.type === "spoiler" && o.id !== w.id && !descendantsOf(E.ui, w.id).some((d) => d.id === o.id));
        if (spoilers.length || w.parent) b.append(row(tr("Inside"), selectInput([["", tr("Page")], ...spoilers.map((o) => [o.id, o.props?.title || tr("Spoiler")])], w.parent || "", (v) => E.moveTo([w.id], v || null)), tr("Where the widget lies: on the page or inside a spoiler")));
        if (w.type === "spoiler") b.append(row(tr("The inside"), btn(tr("Open the inside"), "pencil", () => E.enter(w.id), "sm", tr("Edit what lies in this spoiler as on a page of its own"))));
        b.append(row(tr("Locked"), toggleInput(w.locked, (v) => E.change(null, () => { w.locked = v; }))));
        b.append(row(tr("Hidden"), toggleInput(w.hidden, (v) => E.change(null, () => { w.hidden = v; }))));
        E.syncPosition = () => { nx.set(w.x); ny.set(w.y); nw.set(w.w); nh.set(w.h); };
    }, { key: "pos" }));
}

// "When the window is wider": how the widget takes part in sharing out the width of an adaptive page
function adaptSection(E, ws) {
    const { tr } = E;
    return section(tr("When the window is wider"), (b) => {
        const get = (k, d) => { const v = ws.map((w) => w.adapt?.[k] ?? d); return v.every((x) => x === v[0]) ? v[0] : MIXED; };
        const set = (k, v) => E.change(null, () => { for (const w of ws) w.adapt = { mode: "auto", ...(w.adapt || {}), [k]: v }; });
        const mode = get("mode", "auto");
        b.append(row(tr("Width"), selectInput([...(mode === MIXED ? [[MIXED, tr("Mixed")]] : []), ["auto", tr("Auto (by the kind of widget)")], ["fixed", tr("Fixed")], ["stretch", tr("Stretches, up to")], ["scale", tr("Proportional")]], mode, (v) => { if (v !== MIXED) set("mode", v); }),
            tr("Auto: panels, headings, pictures and viewers grow with the page; fields and lists grow by half at most; switches and the Activity icon keep their size.")));
        const eff = ws.map((w) => (w.adapt?.mode && w.adapt.mode !== "auto" ? w.adapt.mode : autoModeOf(w.type)));
        if (eff.some((m) => m === "stretch")) {
            const mx = get("max", 50), un = get("unit", "%");
            const pair = el("div", "nde-pair");
            pair.append(numberInput({ value: mx === MIXED ? null : mx, min: 0, max: 4000, int: true, placeholder: mx === MIXED ? tr("Mixed") : "", onChange: (v) => { if (v != null) set("max", v); } }),
                selectInput([...(un === MIXED ? [[MIXED, tr("Mixed")]] : []), ["%", "%"], ["px", "px"]], un, (v) => { if (v !== MIXED) set("unit", v); }));
            b.append(row(tr("Up to"), pair, tr("How much wider it may get than it is drawn: a percent of its width, or pixels")));
        }
        const al = get("align", "left");
        b.append(row(tr("Place"), selectInput([...(al === MIXED ? [[MIXED, tr("Mixed")]] : []), ["left", tr("Left")], ["center", tr("Centre")], ["right", tr("Right")]], al, (v) => { if (v !== MIXED) set("align", v); }),
            tr("Where the widget stands in its place when it is narrower than that")));
    }, { key: "adapt", open: false });
}

function propRow(E, w, p) {
    const { tr } = E;
    const cur = w.props[p.id] ?? p.def;
    // a widget whose settings show or hide other settings or slots needs the inspector drawn again
    const wd = defOf(w.type), again = !!(wd?.props?.some((x) => x.when) || wd?.slots?.some((x) => x.when));
    const apply = (v, light) => E.change(light ? `pp${w.id}${p.id}` : null, () => { w.props[p.id] = v; }, light ? { light: true } : again ? {} : { inspector: false });
    let c;
    switch (p.kind) {
        case "bool": c = toggleInput(!!cur, (v) => apply(v)); break;
        case "int": case "number": c = numberInput({ value: cur, min: p.min, max: p.max, int: p.kind === "int", placeholder: p.placeholder || "", onInput: (v) => apply(v, true), onChange: (v) => apply(v) }); break;
        case "select": c = selectInput((p.options || []).map(([v, l]) => [v, tr(l)]), cur, (v) => apply(v)); break;
        case "textarea": c = textInput({ value: cur ?? "", multiline: true, rows: p.max ? 3 : 4, onInput: (v) => apply(p.max ? v.slice(0, p.max) : v, true) });
            if (p.max) (c.tagName === "TEXTAREA" ? c : c.querySelector?.("textarea"))?.setAttribute("maxlength", String(p.max)); break;
        case "image": c = imageField(E, cur, (v) => apply(v)); break;
        default: c = textInput({ value: cur ?? "", placeholder: p.placeholder ? tr(p.placeholder) : "", onInput: (v) => apply(v, true) });
    }
    return row(tr(p.label), c, p.hint ? tr(p.hint) : "");
}

// a field with an address and an upload button (the file goes to the input folder of ComfyUI)
function imageField(E, value, onChange) {
    const { tr } = E;
    const wrap = el("div"); wrap.style.cssText = "display:flex;gap:6px;min-width:0;flex:1";
    const t = textInput({ value: value || "", placeholder: tr("Address or file name"), onChange: (v) => onChange(v.trim()) });
    t.style.flex = "1 1 auto"; t.style.minWidth = "0";
    const file = el("input"); file.type = "file"; file.accept = "image/*"; file.style.display = "none";
    const up = iconBtn("upload", tr("Upload a picture"), () => file.click());
    file.addEventListener("change", async () => {
        const f = file.files?.[0]; if (!f) return;
        try {
            const fd = new FormData(); fd.append("image", f, f.name); fd.append("type", "input"); fd.append("overwrite", "true");
            const r = await api.fetchApi("/upload/image", { method: "POST", body: fd });
            const j = await r.json();
            const v = j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
            t.value = v; onChange(v);
        } catch (e) { t.value = ""; t.placeholder = tr("Upload failed"); }
        file.value = "";
    });
    wrap.append(t, up, file);
    return wrap;
}

/* ------------------------------------------------------------------ binding */

function slotCard(E, w, s) {
    const { tr } = E;
    const b = w.slots[s.id];
    const entry = b ? sourceOf(E.ui, b.src) : null;
    const node = entry ? findSource(entry) : null;
    const prm = node && !s.data ? listParams(node).find((p) => p.name === b.name) : null;
    const lost = !!b && (s.data ? !node : !prm);
    const card = el("div", `nde-slot${lost ? " lost" : ""}`);
    const h = el("div", "nde-slot-h");
    h.append(el("b", "", tr(s.label)), el("span", "", s.data ? tr(DATA_NAMES[s.data] || s.data) + (s.required === false ? " · " + tr("optional") : "") : s.accepts.join(" · ")));
    const btnEl = el("div", `nde-slot-b${b ? "" : " empty"}`);
    btnEl.tabIndex = 0;
    const label = !b ? tr(s.data ? "Not bound. Click to choose a node" : "Not bound. Click to choose a parameter") : s.data && node ? (node.title || node.type) : prm ? `${node.title || node.type} · ${prm.label}` : tr("Lost: {name}", { name: `${entry?.title || entry?.tag || b.src} · ${b.name}` });
    btnEl.append(icon(lost ? "warning" : b ? "link" : "plus", 15), el("span", "", label));
    if (b) { const x = iconBtn("unlink", tr("Unbind"), () => E.bindSlot(w, s.id, null)); btnEl.append(x); }
    btnEl.addEventListener("click", () => openBindPopup(E, w, s, btnEl));
    card.append(h, btnEl);
    return card;
}

function openBindPopup(E, w, s, anchor) {
    const { tr } = E;
    const ctx = { vars: () => ({}), popupHost: () => E.root };
    popup(ctx, anchor, {
        width: 300, maxH: 380,
        build(box, close) {
            box.classList.add("nde-bindpop");
            // a search line (when there is much to look through), a list that scrolls on its own, and a fixed foot
            const searchRow = el("div", "ndk-pop-search"), input = el("input");
            input.placeholder = tr("Search…"); input.spellcheck = false; searchRow.append(icon("search", 16), input);
            const list = el("div", "ndk-pop-list"); list.setAttribute("data-nd-scroll", "1");
            box.append(list);
            const groups = [];   // { head, rows: [{ el, text }] }: what the search shows and hides
            let total = 0;
            const addGroup = (head) => { const g = { head, rows: [] }; groups.push(g); if (head) list.append(head); return g; };
            const addRow = (g, row, text, pick) => {
                row.addEventListener("click", () => { close(); pick(); });
                list.append(row); g.rows.push({ el: row, text: text.toLowerCase(), pick }); total++;
            };
            let foot = null;
            if (s.data) {
                const okNode = DATA_NODE_OK[s.data] || (() => true);
                // live frames: the ND UI Live Bridge nodes of the workflow come first (linked or not: a click links the node), then the other linked nodes
                const live = s.data === "live";
                const bridges = live ? (app.graph?._nodes || []).filter((n) => isBridgeNode(n)) : [];
                if (bridges.length) {
                    const gb = addGroup(el("div", "nde-pgrp", tr("ND UI Live Bridge nodes")));
                    for (const node of bridges) {
                        const r = el("div", "nde-param");
                        r.append(icon("cube", 15), el("span", "nde-pn", node.title || node.type), el("span", "nde-pv", node.comfyClass || node.type));
                        addRow(gb, r, `${node.title || ""} ${node.type || ""} bridge`, () => {
                            let entry = E.ui.sources.find((x) => findSource(x) === node);
                            if (!entry) E.change(null, (ui) => { entry = addSource(ui, node); });
                            if (entry) E.bindData(w, s.id, entry, s.data);
                        });
                    }
                }
                const g = addGroup(live && bridges.length ? el("div", "nde-pgrp", tr("Other nodes (a sampler uses the bridge on its model wire)")) : null);
                for (const entry of E.ui.sources) {
                    const node = findSource(entry);
                    if (!node || !okNode(node) || (live && isBridgeNode(node))) continue;
                    const r = el("div", "nde-param");
                    r.append(icon("cube", 15), el("span", "nde-pn", node.title || node.type), el("span", "nde-pv", node.comfyClass || node.type));
                    addRow(g, r, `${node.title || ""} ${node.type || ""} ${node.comfyClass || ""}`, () => E.bindData(w, s.id, entry, s.data));
                }
                if (!total) list.append(el("div", "nde-empty", tr(s.data === "lorastack" ? "No ND LoRA Stack node linked yet. Pick it on the canvas." : s.data === "videoload" ? "No ND Load Video node linked yet. Pick it on the canvas." : s.data === "audioload" ? "No ND Load Audio node linked yet. Pick it on the canvas." : s.data === "loadimages" ? "No ND Load Images node linked yet. Pick it on the canvas." : s.data === "showany" ? "No ND Show Any As Text node linked yet. Pick it on the canvas." : s.data === "variantsel" ? "No ND Variant Preview Selector node linked yet. Pick it on the canvas." : s.data === "anynode" ? "No nodes linked yet. Pick the node whose own interface you want to show." : "No nodes linked yet. Pick the node that shows or saves the picture (Preview Image, Save Image...).")));
                foot = el("div", "nde-param"); foot.style.borderTop = "1px solid var(--ndk-border)";
                foot.append(icon("crosshair", 15), el("span", "nde-pn", tr("Pick a node on the canvas")));
                foot.addEventListener("click", () => { close(); E.pickNode((entry) => { if (okNode(findSource(entry))) E.bindData(w, s.id, entry, s.data); }); });
            } else {
                for (const entry of E.ui.sources) {
                    const node = findSource(entry);
                    if (!node) continue;
                    const ps = listParams(node).filter((p) => fits(s.accepts, p.ptype));
                    if (!ps.length) continue;
                    const title = node.title || node.type;
                    const g = addGroup(el("div", "nde-pgrp", title));
                    for (const p of ps) {
                        const r = el("div", "nde-param");
                        r.append(el("span", `nde-ty ${p.ptype}`, p.ptype.slice(0, 5)), el("span", "nde-pn", p.label));
                        addRow(g, r, `${title} ${node.type || ""} ${p.label} ${p.name} ${p.ptype}`, () => E.bindSlot(w, s.id, entry, p));
                    }
                }
                if (!total) list.append(el("div", "nde-empty", tr("No suitable parameters. Link a node on the «Link» tab first.")));
            }
            if (foot) box.append(foot);
            if (total > 8) {
                box.insertBefore(searchRow, list);
                const none = el("div", "ndk-pop-empty", tr("Nothing found")); none.style.display = "none"; list.append(none);
                const refilter = () => {
                    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
                    let shown = 0;
                    for (const g of groups) {
                        let n = 0;
                        for (const r of g.rows) { const ok = words.every((x) => r.text.includes(x)); r.el.style.display = ok ? "" : "none"; if (ok) n++; }
                        if (g.head) g.head.style.display = n ? "" : "none";
                        shown += n;
                    }
                    none.style.display = shown ? "none" : "";
                    list.scrollTop = 0;
                };
                input.addEventListener("input", refilter);
                input.addEventListener("keydown", (e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const first = groups.flatMap((g) => g.rows).find((r) => r.el.style.display !== "none");
                    if (first) { close(); first.pick(); }
                });
                setTimeout(() => input.focus(), 0);
            }
        },
    });
}

/* ------------------------------------------------------------------ look */

function lookControls(E, b, ws) {
    const { tr } = E;
    const w0 = ws[0], L = w0.look;
    const all = (fn, key, light) => E.change(key, () => { for (const w of ws) fn(w.look, w); }, light ? { light: true } : { inspector: false });
    const opt = (list, none) => [["", none], ...list.map((v) => [v, tr(human(v))])];
    b.append(row(tr("Style"), selectInput(opt(STYLES, tr("As the kit")), L.style || "", (v) => all((l) => { l.style = v || null; }))));
    b.append(row(tr("Shape"), selectInput(opt(SHAPES, tr("As the kit")), L.shape || "", (v) => all((l) => { l.shape = v || null; }))));
    for (const [k, label] of [["accent", "Accent"], ["bg", "Background"], ["field", "Field"], ["text", "Text"], ["labelColor", "Label"], ["border", "Border"]]) {
        b.append(row(tr(label), color(E, L[k], (v) => all((l) => { l[k] = v; }, `lk${k}`, true))));
    }
    b.append(row(tr("Corner radius"), numberInput({ value: L.radius, min: 0, max: 64, int: true, placeholder: tr("Auto"), onInput: (v) => all((l) => { l.radius = v; }, "lkr", true), onChange: (v) => all((l) => { l.radius = v; }) })));
    b.append(row(tr("Shadow"), selectInput([["", tr("As the kit")], ["1", tr("On")], ["0", tr("Off")]], L.shadow == null ? "" : L.shadow ? "1" : "0", (v) => all((l) => { l.shadow = v === "" ? null : v === "1"; }))));
    b.append(row(tr("Use blur"), toggleInput(L.blur !== false, (v) => all((l) => { l.blur = v ? null : false; })), tr("Blurs what lies behind the widget and its drop-down lists (when the theme has blur)")));
    b.append(row(tr("Content scale"), rangeInput({ value: L.scale, min: SCALE_RANGE[0], max: SCALE_RANGE[1], step: 5, onInput: (v) => all((l) => { l.scale = v; }, "lks", true), fmt: (v) => `${v}%` })));
    b.append(btn(tr("Reset the look"), "undo", () => E.change(null, () => { for (const w of ws) w.look = normalizeLook({}); }), ""));
}

// several widgets at once: what they share (values, size, state) is edited for all of them; a value that differs shows "Mixed"
const MIXED = "\u0001mixed";
// the group of the selected widgets: its name, Ungroup, or a button that makes a group of them
function groupSection(E, body, ws) {
    const { tr } = E;
    const gids = [...new Set(ws.map((w) => w.group || ""))];
    const g = gids.length === 1 && gids[0] ? E.ui.groups.find((x) => x.id === gids[0]) : null;
    if (!g && ws.length < 2) return;
    body.append(section(tr("Group"), (b) => {
        if (g) {
            b.append(row(tr("Name"), textInput({ value: g.name, onInput: (v) => E.renameGroup(g.id, v || tr("Group")) })));
            const t = el("div", "nde-tools");
            if (ws.length === 1) t.append(btn(tr("Select the whole group"), "group", () => { E.inGroup = null; E.select(E.groupIds(ws[0])); }));
            t.append(btn(tr("Ungroup"), "ungroup", () => E.ungroup([ws[0].id]), "", "Ctrl+Shift+G"));
            b.append(t);
        } else {
            b.append(el("div", "nde-note", tr("A group moves, copies and deletes as one. Double-click a widget of a group to take it alone.")));
            b.append(btn(tr("Group"), "group", () => E.group(ws.map((w) => w.id)), "primary", "Ctrl+G"));
        }
    }, { key: "group" }));
}

function multiSettings(E, body, ws) {
    const { tr } = E;
    const types = [...new Set(ws.map((w) => w.type))];
    groupSection(E, body, ws);
    body.append(el("div", "nde-note", tr("{n} widgets selected ({t} kinds). What they have in common is edited for all of them at once; a value that differs shows «Mixed». Align and spread them on the «Layout» tab.", { n: ws.length, t: types.length })));
    const same = (vals) => vals.every((v) => JSON.stringify(v) === JSON.stringify(vals[0]));
    // an on / off value that may differ between the widgets
    const triBool = (vals, set) => same(vals) ? toggleInput(!!vals[0], set) : selectInput([[MIXED, tr("Mixed")], ["1", tr("On")], ["0", tr("Off")]], MIXED, (v) => { if (v !== MIXED) set(v === "1"); });

    // 1. the settings that every selected widget has (same id and kind)
    const defs = ws.map((w) => defOf(w.type));
    const common = (defs[0]?.props || []).filter((p) => p.kind !== "image" && defs.every((d) => d?.props?.some((q) => q.id === p.id && q.kind === p.kind)) && ws.every((w) => !p.when || p.when(w.props)));
    if (common.length) {
        body.append(section(tr("Values"), (b) => {
            const setAll = (p, v, light) => E.change(light ? `mp${p.id}` : null, () => { for (const w of ws) { w.props = w.props || {}; w.props[p.id] = v; } }, light ? { light: true } : {});
            for (const p of common) {
                const vals = ws.map((w) => w.props?.[p.id] ?? p.def), eq = same(vals);
                let c;
                switch (p.kind) {
                    case "bool": c = triBool(vals, (v) => setAll(p, v)); break;
                    case "int": case "number": c = numberInput({ value: eq ? vals[0] : null, min: p.min, max: p.max, int: p.kind === "int", placeholder: eq ? (p.placeholder || "") : tr("Mixed"), onInput: (v) => setAll(p, v, true), onChange: (v) => setAll(p, v) }); break;
                    case "select": c = selectInput([...(eq ? [] : [[MIXED, tr("Mixed")]]), ...(p.options || []).map(([v, l]) => [v, tr(l)])], eq ? vals[0] : MIXED, (v) => { if (v !== MIXED) setAll(p, v); }); break;
                    case "textarea": c = textInput({ value: eq ? vals[0] ?? "" : "", multiline: true, rows: 3, placeholder: eq ? "" : tr("Mixed"), onInput: (v) => setAll(p, v, true) }); break;
                    default: c = textInput({ value: eq ? vals[0] ?? "" : "", placeholder: eq ? (p.placeholder ? tr(p.placeholder) : "") : tr("Mixed"), onInput: (v) => setAll(p, v, true) });
                }
                b.append(row(tr(p.label), c, p.hint ? tr(p.hint) : ""));
            }
            const labelled = ws.filter((w) => !defOf(w.type)?.noLabel);
            if (labelled.length === ws.length) {
                const lv = ws.map((w) => w.look?.label || "");
                b.append(row(tr("Label position"), selectInput([...(same(lv) ? [] : [[MIXED, tr("Mixed")]]), ["", tr("Default")], ...LABEL_POSITIONS.map((q) => [q, tr(human(q))])], same(lv) ? lv[0] : MIXED, (v) => { if (v !== MIXED) E.change(null, () => { for (const w of ws) w.look.label = v || null; }, { inspector: false }); })));
            }
        }, { key: "mvalues" }));
    }

    // 2. size: the same width / height, and scaling of the frames
    body.append(section(tr("Size"), (b) => {
        const free = ws.filter((w) => !w.locked);
        const setDim = (k, v) => E.change(`ms${k}`, () => { for (const w of free) { if (k === "h" && w.type === "spoiler") continue; w[k] = Math.max(defOf(w.type)?.size?.[k === "w" ? "minW" : "minH"] || 8, v); } }, { light: true });
        const dim = (k) => { const vals = ws.map((w) => Math.round(w[k])); return numberInput({ value: same(vals) ? vals[0] : null, min: 8, int: true, placeholder: same(vals) ? "" : tr("Mixed"), onChange: (v) => { if (v != null) setDim(k, v); } }); };
        const p2 = el("div", "nde-pair"); p2.append(row("W", dim("w")), row("H", dim("h")));
        b.append(p2);
        // scale the frames of all of them by a percentage; with «Keep the gaps» the places move too, so the layout is only larger or smaller
        let pct = 110, gaps = true;
        const apply = (k) => E.change(null, () => {
            if (!free.length) return;
            const ox = Math.min(...free.map((w) => w.x)), oy = Math.min(...free.map((w) => w.y));
            for (const w of free) {
                if (gaps) { w.x = Math.round(ox + (w.x - ox) * k); w.y = Math.round(oy + (w.y - oy) * k); }
                w.w = Math.max(defOf(w.type)?.size?.minW || 8, Math.round(w.w * k));
                if (w.type !== "spoiler") w.h = Math.max(defOf(w.type)?.size?.minH || 8, Math.round(w.h * k));
            }
        });
        const pn = numberInput({ value: pct, min: 10, max: 500, int: true, onChange: (v) => { if (v != null) pct = v; } });
        const go = btn(tr("Scale"), "zoomIn", () => apply(pct / 100), "sm", tr("Make the frames of the selected widgets this many percent of their size"));
        const r = el("div", "nde-row"); r.append(el("label", "nde-lab", tr("Frames, %")), pn, go);
        b.append(r);
        b.append(row(tr("Keep the gaps"), toggleInput(true, (v) => { gaps = v; }), tr("The places of the widgets are scaled from the top left corner of the selection too.")));
        b.append(el("div", "nde-note", tr("The scale of what is inside the frames is in «Look» below (Content scale).")));
    }, { key: "msize" }));

    if (E.ui.view.fit === "adaptive") body.append(adaptSection(E, ws));

    // 3. state
    body.append(section(tr("State"), (b) => {
        b.append(row(tr("Locked"), triBool(ws.map((w) => !!w.locked), (v) => E.change(null, () => { for (const w of ws) w.locked = v; }))));
        b.append(row(tr("Hidden"), triBool(ws.map((w) => !!w.hidden), (v) => E.change(null, () => { for (const w of ws) w.hidden = v; }))));
        b.append(el("div", "nde-tools"));
        const tools = b.lastChild;
        tools.append(btn(tr("Duplicate"), "copy", () => E.duplicate(ws.map((w) => w.id)), "sm"), btn(tr("Delete"), "trash", () => E.remove(ws.map((w) => w.id)), "sm"));
    }, { key: "mstate" }));

    body.append(section(tr("Look"), (b) => lookControls(E, b, ws), { key: "look" }));
}
