// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the data of a panel (what is saved in node.properties.nd_ui) and the history of the editor.
// Everything here is plain data: no DOM, no ComfyUI. normalizeNdUi() accepts anything and returns a valid object.

export const SCHEMA = 1;
export const STYLES = ["filled", "outline", "soft", "glass", "minimal"];
export const SHAPES = ["sharp", "rounded", "pill"];
export const DENSITIES = ["compact", "comfortable", "spacious"];
export const LABEL_POSITIONS = ["top", "left", "inside", "hidden"];
export const PAGE_PRESETS = [
    { id: "16:9", label: "16:9", w: 1280, h: 720 },
    { id: "16:10", label: "16:10", w: 1280, h: 800 },
    { id: "21:9", label: "21:9", w: 1680, h: 720 },
    { id: "4:3", label: "4:3", w: 1200, h: 900 },
    { id: "9:16", label: "9:16", w: 720, h: 1280 },
];
export const BAR_GAP_DEF = 18, BAR_GAP_MIN = 6, BAR_GAP_MAX = 48;
export const SLOT_KINDS = ["widget", "images", "live", "progress", "text", "lorastack", "audio", "video", "videoload", "audioload", "loadimages", "showany", "variantsel", "anynode"];
export const GRID_STEPS = [4, 8, 16, 24];
export const SCALE_RANGE = [50, 200];

// The size of the whole UI: the UI Scale widget of the page, or, when the page has none, the first one on the other pages (the pages in their order).
// null: there is no such widget, the scale of the kit is used.
export function scaleOf(ui, pageId) {
    const list = (ui.widgets || []).filter((w) => w.type === "uiscale");
    if (!list.length) return null;
    const own = list.find((w) => w.page === pageId);
    let pick = own;
    if (!pick) for (const p of ui.pages || []) { pick = list.find((w) => w.page === p.id); if (pick) break; }
    pick = pick || list[0];
    const raw = pick.props?.scale;
    const v = raw == null || raw === "" ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.max(SCALE_RANGE[0], Math.min(SCALE_RANGE[1], Math.round(v))) : null;
}
export const PAGE_MIN = 240;
export const PAGE_MAX = 4000;
export const LEN_MAX = PAGE_MAX * 4;      // the longest page (a page may be longer than the window and then scrolls)
export const TAIL = 24;                   // room kept under the lowest widget of a page that is longer than the window

// how a widget behaves when the window is wider than the page ("Adapt to the width"); see adapt.js
export const ADAPT_MODES = ["auto", "fixed", "stretch", "scale"];
export const ADAPT_ALIGN = ["left", "center", "right"];
export const ADAPT_MAX_DEFAULT = 50;      // the percent that a stretching widget may grow by, unless set otherwise
// only what differs from the defaults is kept (undefined: nothing to keep)
export function normalizeAdapt(a) {
    if (!isObj(a)) return undefined;
    const mode = ADAPT_MODES.includes(a.mode) ? a.mode : "auto";
    const n = Number(a.max);
    const max = a.max === "" || a.max == null || !Number.isFinite(n) ? ADAPT_MAX_DEFAULT : Math.max(0, Math.min(PAGE_MAX, Math.round(n)));
    const unit = a.unit === "px" ? "px" : "%";
    const align = ADAPT_ALIGN.includes(a.align) ? a.align : "left";
    if (mode === "auto" && max === ADAPT_MAX_DEFAULT && unit === "%" && align === "left") return undefined;
    return { mode, max, unit, align };
}

export const human = (s) => { const t = String(s || "").replace(/[_-]+/g, " ").trim(); return t ? t[0].toUpperCase() + t.slice(1) : ""; };
export const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const uid = (prefix = "w") => prefix + Math.random().toString(36).slice(2, 8);
export const clone = (x) => JSON.parse(JSON.stringify(x));
const int = (v, d, lo = -1e6, hi = 1e6) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, lo, hi) : d; };
const str = (v, d = "", max = 400) => (typeof v === "string" ? v.slice(0, max) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
export const DEFAULT_EXT = "ndui";
/** the extension of project files: letters and digits, 2-12 signs, lower case; a bad one becomes the default */
export const cleanExt = (s) => { const e = String(s ?? "").toLowerCase().replace(/^\.+/, "").replace(/[^a-z0-9]/g, "").slice(0, 12); return e.length >= 2 ? e : DEFAULT_EXT; };

const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
export const isColor = (v) => typeof v === "string" && (COLOR.test(v) || v === "transparent");
const color = (v) => (isColor(v) ? v.toLowerCase() : null);

// "look" of a widget: everything is null (= as the theme says) until the person changes it
export const LOOK_KEYS = ["style", "shape", "accent", "bg", "field", "text", "labelColor", "border", "radius", "shadow", "label", "scale"];
// props saved by an older version
function migrateProps(p) {
    if ("busy" in p) { const old = p.busy; delete p.busy; if (p.busyOn === undefined && old && old !== "off") { p.busyOn = true; p.busyStyle = String(old).slice(0, 12); } }
    if (typeof p.markText === "string") p.markText = p.markText.replace(/\r/g, "").slice(0, 20).split("\n").slice(0, 4).join("\n");
    if (typeof p.busyText === "string") p.busyText = p.busyText.replace(/\r/g, "").slice(0, 20).split("\n").slice(0, 4).join("\n");
    return p;
}
export function normalizeLook(raw) {
    const r = isObj(raw) ? raw : {};
    const radius = Number(r.radius);
    return {
        style: oneOf(r.style, STYLES, null),
        shape: oneOf(r.shape, SHAPES, null),
        accent: color(r.accent),
        bg: color(r.bg),
        field: color(r.field),
        text: color(r.text),
        labelColor: color(r.labelColor),
        border: color(r.border),
        radius: r.radius != null && Number.isFinite(radius) ? clamp(Math.round(radius), 0, 64) : null,
        shadow: r.shadow === true || r.shadow === false ? r.shadow : null,
        blur: r.blur === false ? false : null,          // "Use blur": false = no blur behind this widget and its lists (null = as the theme)
        label: oneOf(r.label, LABEL_POSITIONS, null),
        scale: clamp(int(r.scale, 100), SCALE_RANGE[0], SCALE_RANGE[1]),
    };
}

function normalizeBg(raw) {
    const r = isObj(raw) ? raw : {};
    return {
        type: oneOf(r.type, ["theme", "solid", "gradient", "image"], "theme"),
        color: color(r.color) || "#0e1014",
        a: color(r.a) || "#0e1014",
        b: color(r.b) || "#1a1d27",
        angle: int(r.angle, 160, 0, 360),
        src: str(r.src, "", 600),
        mode: oneOf(r.mode, ["cover", "contain", "tile"], "cover"),
        dim: clamp(Number(r.dim) || 0, 0, 0.9),
    };
}

export function defaultUi() {
    return normalizeNdUi({
        pages: [{ id: "p1", name: "Page 1" }],
    });
}

// the page tabs: shown or not, on top or at the bottom, aligned left / centre / right (the old view.showTabs becomes tabs.show)
// ---- the toolbar of the top panel in the ND UI mode ----
export const TB_KINDS = ["comfy", "unload", "unloadCache", "sep"];
export const TB_STYLES = ["native", "pill", "flat"];
export const TB_SCALE = [50, 250];
export const SEP_W = [2, 200];
const CORNERS = ["tl", "tr", "bl", "br"];
function normalizeFp(fp) {
    if (!isObj(fp)) return null;
    const sg = isObj(fp.sig) ? fp.sig : {};
    return {
        zone: str(fp.zone, "legacy", 12),
        nth: int(fp.nth, 0, 0, 99),
        sig: { tag: str(sg.tag, "", 16), cls: (Array.isArray(sg.cls) ? sg.cls : []).filter((c) => typeof c === "string").slice(0, 8).map((c) => c.slice(0, 60)), title: str(sg.title, "", 80), aria: str(sg.aria, "", 80), text: str(sg.text, "", 24), icon: str(sg.icon, "", 60) },
    };
}
// ---- the look of the top panel (logo, tabs, buttons): "" = as the theme says ----
function normalizeBar(r) {
    const o = isObj(r) ? r : {};
    return { shape: oneOf(o.shape, ["", ...SHAPES], ""), bg: color(o.bg) || "", fg: color(o.fg) || "", border: color(o.border) || "", strip: color(o.strip) || "", opacity: int(o.opacity, 78, 0, 100), blur: int(o.blur, 10, 0, 40) };
}
// ---- the shadow of the cards (the whole theme): how soft it is, how strong, and its colour ("" = the colour of the theme) ----
function normalizeShadow(r) {
    const o = isObj(r) ? r : {};
    return { blur: int(o.blur, 30, 0, 120), strength: int(o.strength, 100, 0, 300), color: color(o.color) || "" };
}
// ---- the Frost theme: frosted glass over a gradient ----
function normalizeFrost(r) {
    const o = isObj(r) ? r : {};
    const g3 = "g3" in o ? color(o.g3) || "" : "#171a33";
    const op = Number(o.opacity);
    return {
        tint: color(o.tint) || "#ffffff", accent: color(o.accent) || "#8ee3cf",
        g1: color(o.g1) || "#12363a", g2: color(o.g2) || "#080c10", g3,
        angle: int(o.angle, 140, 0, 360), blur: int(o.blur, 18, 0, 40),
        opacity: Number.isFinite(op) ? Math.round(Math.min(0.4, Math.max(0.02, op)) * 100) / 100 : 0.07,
    };
}
// ---- the progress bar along the top or the bottom edge of the ND UI mode ----
export const PB_HEIGHT = [2, 24];
export function normalizeProgressBar(r) {
    const o = isObj(r) ? r : {};
    return {
        show: o.show === true,
        pos: oneOf(o.pos, ["top", "bottom"], "top"),
        height: int(o.height, 6, PB_HEIGHT[0], PB_HEIGHT[1]),
        mode: oneOf(o.mode, ["split", "single"], "split"),          // split: nodes on one half, steps of the node on the other
        fill: oneOf(o.fill, ["accent", "custom"], "accent"),
        c1: color(o.c1) || "", c2: color(o.c2) || "",
        angle: int(o.angle, 90, 0, 360),
        bg: color(o.bg) || "",
        glow: o.glow === true,
        text: oneOf(o.text, ["none", "pct", "full"], "none"),
        idleHide: o.idleHide !== false,
    };
}
function normalizeToolbar(t, old) {
    const tb = isObj(t) ? t : {};
    const seen = new Set();
    const items = [];
    for (const r of Array.isArray(tb.items) ? tb.items : []) {
        if (!isObj(r) || !TB_KINDS.includes(r.kind)) continue;
        let id = str(r.id, "", 24) || uid("t");
        if (seen.has(id)) id = uid("t");
        seen.add(id);
        const it = { id, kind: r.kind, scale: int(r.scale, 100, TB_SCALE[0], TB_SCALE[1]) };
        it.style = oneOf(r.style, TB_STYLES, r.kind === "comfy" ? "native" : r.kind === "sep" ? "flat" : "pill");
        if (r.kind === "comfy") {
            it.name = str(r.name, "", 60);
            it.fp = normalizeFp(r.fp);
            if (!it.fp) continue;
            it.how = r.how === "mirror" ? "mirror" : "move";
        }
        if (r.kind === "sep") { it.w = int(r.w, 12, SEP_W[0], SEP_W[1]); it.line = r.line !== false; it.variant = r.variant === "accent" ? "accent" : "line"; it.thick = int(r.thick, 1, 1, 8); }
        it.bg = color(r.bg) || ""; it.fg = color(r.fg) || ""; it.border = color(r.border) || "";
        items.push(it);
    }
    // the old settings of the memory buttons become items of the toolbar (once, while there are none)
    let corner = oneOf(tb.corner, CORNERS, "");
    if (!items.length && !isObj(t) && isObj(old)) {
        corner = oneOf(old.corner, CORNERS, "tr");
        for (const [k, kind] of [["models", "unload"], ["cache", "unloadCache"]]) if (old[k] === true) items.push({ id: `t-${kind}`, kind, scale: 100, style: "pill", bg: "", fg: "", border: "" });
    }
    return { corner: corner || "tr", scale: int(tb.scale, 100, TB_SCALE[0], TB_SCALE[1]), bg: oneOf(tb.bg, ["none", "pill"], "none"), dim: tb.dim === true, items };
}

function normalizeTabs(t, legacyShow) {
    const o = isObj(t) ? t : {};
    return {
        show: typeof o.show === "boolean" ? o.show : legacyShow !== false,
        pos: oneOf(o.pos, ["top", "bottom"], "top"),
        align: oneOf(o.align, ["left", "center", "right"], "left"),
    };
}

export function normalizeNdUi(raw) {
    const r = isObj(raw) ? raw : {};
    const page = isObj(r.page) ? r.page : {};
    const theme = isObj(r.theme) ? r.theme : {};
    const kit = isObj(r.kit) ? r.kit : {};
    const view = isObj(r.view) ? r.view : {};
    const ov = {};
    if (isObj(theme.overrides)) for (const [k, v] of Object.entries(theme.overrides)) if (/^[a-z0-9-]{1,24}$/.test(k) && isColor(v)) ov[k] = v.toLowerCase();
    const custom = isObj(theme.custom) ? theme.custom : {};

    const ui = {
        v: SCHEMA,
        id: str(r.id, "", 24) || uid("u"),
        page: {
            w: int(page.w, 1280, PAGE_MIN, PAGE_MAX),
            h: int(page.h, 720, PAGE_MIN, PAGE_MAX),
            bg: normalizeBg(page.bg),
            radius: int(page.radius, 14, 0, 48),
        },
        theme: { borders: theme.borders !== false, shadow: normalizeShadow(theme.shadow), id: oneOf(theme.id, ["midnight", "studio", "neon", "comfyui", "glass", "sakura", "limenoir", "mono", "frost", "custom"], "midnight"), overrides: ov, custom: { accent: color(custom.accent) || "#7757fa", bg: color(custom.bg) || "#0e1014" }, frost: normalizeFrost(theme.frost) },
        kit: {
            style: oneOf(kit.style, STYLES, "soft"),
            shape: oneOf(kit.shape, SHAPES, "rounded"),
            font: oneOf(kit.font, ["inter", "system"], "inter"),
            scale: clamp(int(kit.scale, 100), SCALE_RANGE[0], SCALE_RANGE[1]),
            density: oneOf(kit.density, DENSITIES, "comfortable"),
        },
        view: {
            fullscreen: oneOf(view.fullscreen, ["window", "screen"], "window"),
            fit: oneOf(view.fit, ["proportions", "fill", "adaptive"], "proportions"),
            maxW: int(view.maxW, 0, 0, LEN_MAX),     // adaptive: the layout does not get wider than this (0: no limit)
            tabs: normalizeTabs(view.tabs, view.showTabs),
            esc: oneOf(view.esc, ["exit", "none"], "exit"),
            startInUi: view.startInUi === true,
            reserve: view.reserve === true,
            strip: view.strip === false || view.strip === "off" ? "off" : view.strip === "always" ? "always" : "scroll",   // the solid strip under the logo and tabs: off | while the page scrolls | always
            bgFill: view.bgFill === true,                 // proportions / adaptive: the background also fills what lies outside the page
            logo: { corner: oneOf(isObj(view.logo) ? view.logo.corner : "", ["tl", "tr", "bl", "br"], "tl"), dim: isObj(view.logo) && view.logo.dim === true },
            save: { show: !isObj(view.save) || view.save.show !== false, corner: oneOf(isObj(view.save) ? view.save.corner : "", ["tl", "tr", "bl", "br"], "tr"), ext: cleanExt(isObj(view.save) ? view.save.ext : "") },
            progressBar: normalizeProgressBar(view.progressBar),
            bar: normalizeBar(view.bar),                   // the look of the top panel: shape, colours, opacity, blur
            toolbar: normalizeToolbar(view.toolbar, view.unload),   // the buttons and blocks on the top panel (ComfyUI buttons, memory buttons, separators)
            gap: int(view.gap, BAR_GAP_DEF, BAR_GAP_MIN, BAR_GAP_MAX),   // the room between the buttons of the top panel and the tabs (px)
            grid: oneOf(Number(view.grid), GRID_STEPS, 8),
            snap: view.snap !== false,
            nodeBg: color(view.nodeBg),
            page: str(view.page, "", 40),
            lang: str(view.lang, "auto", 8),
            modePage: str(view.modePage, "", 40),
        },
        sources: [],
        pages: [],
        widgets: [],
        groups: [],
    };

    const seenSrc = new Set();
    for (const s of Array.isArray(r.sources) ? r.sources.slice(0, 200) : []) {
        if (!isObj(s) || typeof s.uid !== "string" || !s.uid || seenSrc.has(s.uid)) continue;
        seenSrc.add(s.uid);
        ui.sources.push({ uid: s.uid.slice(0, 40), tag: str(s.tag, "", 60), class: str(s.class, "", 120), title: str(s.title, "", 200) });
    }

    const seenPage = new Set();
    for (const p of Array.isArray(r.pages) ? r.pages.slice(0, 24) : []) {
        if (!isObj(p)) continue;
        let id = str(p.id, "", 40) || uid("p");
        if (seenPage.has(id)) id = uid("p");
        seenPage.add(id);
        const c = isObj(p.control) ? p.control : {};
        ui.pages.push({
            id,
            name: str(p.name, `Page ${ui.pages.length + 1}`, 60),
            kind: oneOf(p.kind, ["page", "mode"], "page"),
            len: int(p.len, 0, 0, LEN_MAX),     // the least length of the page (0: by the lowest widget)
            control: {
                nodes: (Array.isArray(c.nodes) ? c.nodes : []).filter((x) => typeof x === "string").slice(0, 100),
                groups: (Array.isArray(c.groups) ? c.groups : []).filter((x) => typeof x === "string").slice(0, 100),
                how: oneOf(c.how, ["mute", "bypass"], "mute"),
                bindIndex: isObj(c.bindIndex) ? { src: str(c.bindIndex.src, "", 40), name: str(c.bindIndex.name, "", 120) } : null,
            },
        });
    }
    if (!ui.pages.length) ui.pages.push({ id: "p1", name: "Page 1", kind: "page", len: 0, control: { nodes: [], groups: [], how: "mute", bindIndex: null } });
    if (!ui.pages.some((p) => p.id === ui.view.page)) ui.view.page = ui.pages[0].id;

    const seenW = new Set();
    for (const w0 of Array.isArray(r.widgets) ? r.widgets.slice(0, 600) : []) {
        const w = migrateWidget(w0);
        if (!isObj(w) || typeof w.type !== "string") continue;
        let id = str(w.id, "", 40) || uid("w");
        if (seenW.has(id)) id = uid("w");
        seenW.add(id);
        const slots = {};
        if (isObj(w.slots)) {
            for (const [k, b] of Object.entries(w.slots)) {
                if (!/^[a-z0-9_]{1,24}$/i.test(k) || !isObj(b) || typeof b.src !== "string") continue;
                slots[k] = { src: b.src.slice(0, 40), kind: oneOf(b.kind, SLOT_KINDS, "widget"), name: str(b.name, "", 120) };
            }
        }
        ui.widgets.push({
            id,
            type: w.type.slice(0, 24),
            page: ui.pages.some((p) => p.id === w.page) ? w.page : ui.pages[0].id,
            x: int(w.x, 0, -ui.page.w, ui.page.w * 2),
            y: int(w.y, 0, -ui.page.h, LEN_MAX),
            w: int(w.w, 240, 8, PAGE_MAX),
            h: int(w.h, 56, 8, PAGE_MAX),
            z: int(w.z, ui.widgets.length, -1000, 100000),
            parent: typeof w.parent === "string" && w.parent ? w.parent.slice(0, 40) : null,
            ...(typeof w.group === "string" && w.group ? { group: w.group.slice(0, 40) } : {}),
            ...(typeof w.tab === "string" && w.tab ? { tab: w.tab.slice(0, 40) } : {}),
            hidden: w.hidden === true,
            locked: w.locked === true,
            slots,
            props: migrateProps(isObj(w.props) ? clone(w.props) : {}),
            look: normalizeLook(w.look),
            ...(normalizeAdapt(w.adapt) ? { adapt: normalizeAdapt(w.adapt) } : {}),
        });
    }
    fixParents(ui);
    fixTabs(ui);
    const seenG = new Set();
    for (const g of Array.isArray(r.groups) ? r.groups.slice(0, 300) : []) {
        if (!isObj(g) || typeof g.id !== "string" || !g.id || seenG.has(g.id)) continue;
        seenG.add(g.id);
        ui.groups.push({ id: g.id.slice(0, 40), page: str(g.page, "", 40), parent: typeof g.parent === "string" && g.parent ? g.parent.slice(0, 40) : null, name: str(g.name, "", 60) });
    }
    fixGroups(ui);
    syncSpoilerHeights(ui);
    return ui;
}

/* ------------------------------------------------------------------ groups of widgets (a thing of the editor: the page is drawn as before) */

// A group lives on a page and a level (the page itself or one spoiler); one level of groups, no group in a group.
// A widget with a `group` that does not fit (another page / level, no such group) is let out; an empty group goes; the members of a group lie
// side by side in z (as in Figma), at the place of its topmost member.
export function fixGroups(ui) {
    ui.groups = Array.isArray(ui.groups) ? ui.groups : [];
    const gs = new Map(ui.groups.map((g) => [g.id, g]));
    for (const w of ui.widgets) {
        if (!w.group) { delete w.group; continue; }
        const g = gs.get(w.group);
        if (!g || g.page !== w.page || (g.parent || null) !== (w.parent || null)) delete w.group;
    }
    const used = new Set(ui.widgets.map((w) => w.group).filter(Boolean));
    ui.groups = ui.groups.filter((g) => used.has(g.id));
    for (const g of ui.groups) if (!g.name) g.name = "Group";
    const levels = new Map();
    for (const w of ui.widgets) if (w.group) levels.set(`${w.page}|${w.parent || ""}`, [w.page, w.parent || null]);
    for (const [, [page, parent]] of levels) {
        const lv = levelOf(ui, page, parent).sort((a, b) => a.z - b.z);
        const last = new Map();
        lv.forEach((w, i) => { if (w.group) last.set(w.group, i); });
        const order = [];
        lv.forEach((w, i) => {
            if (!w.group) order.push(w);
            else if (last.get(w.group) === i) for (const m of lv) if (m.group === w.group) order.push(m);
        });
        if (order.some((w, i) => w !== lv[i])) order.forEach((w, i) => { w.z = i; });
    }
}
export const groupOf = (ui, w) => (w?.group ? ui.groups.find((g) => g.id === w.group) || null : null);
export const membersOf = (ui, gid) => ui.widgets.filter((w) => w.group === gid);

/* ------------------------------------------------------------------ old widgets */

// Result, Live Preview and Compare became parts of the Viewer widget; a saved panel is brought to the new shape on load
export function migrateWidget(w) {
    if (!isObj(w) || !["result", "live", "compare"].includes(w.type)) return w;
    const p = isObj(w.props) ? { ...w.props } : {};
    const s = isObj(w.slots) ? { ...w.slots } : {};
    const out = { ...w, type: "viewer", props: p, slots: s };
    if (w.type === "result") {
        Object.assign(p, { live: false, results: true, compare: false, progress: "off", thumbs: p.history === false ? "off" : "bottom" });
        delete p.history;
    } else if (w.type === "live") {
        Object.assign(p, { live: true, results: true, compare: false, thumbs: "off", progress: p.bar === false ? "off" : "line" });
        delete p.bar;
    } else {
        Object.assign(p, { live: false, results: false, compare: true, progress: "off", srcA: "node", srcB: "node", labelA: p.nameA ?? "A", labelB: p.nameB ?? "B" });
        delete p.nameA; delete p.nameB;
    }
    return out;
}

/* ------------------------------------------------------------------ spoilers */

export const SPOILER_DEPTH = 2;                 // spoilers inside spoilers: at most two levels
export const HEAD_H = { compact: 36, comfortable: 44, spacious: 52 };
export const headH = (ui) => HEAD_H[ui.kit.density] || 44;
// a spoiler may have a header of its own (props.head_h, 24 to 72 px); 0 or nothing: the one of the density of the kit
export const HEAD_MIN = 24, HEAD_MAX = 72;
export const headHOf = (ui, w) => { const v = Math.round(Number(w?.props?.head_h)); return Number.isFinite(v) && v > 0 ? clamp(v, HEAD_MIN, HEAD_MAX) : headH(ui); };
export const spoilerPad = (w) => clamp(int(w.props?.pad, 12, 0, 48), 0, 48);
export const innerW = (w) => Math.max(40, w.w - 2 * spoilerPad(w));
export const isSpoiler = (w) => w?.type === "spoiler";

// "parent" must be a spoiler of the same page, never a cycle, and no deeper than SPOILER_DEPTH (a deeper one comes up a level)
export function fixParents(ui) {
    const by = new Map(ui.widgets.map((w) => [w.id, w]));
    for (const w of ui.widgets) {
        const p = w.parent && by.get(w.parent);
        if (!p || !isSpoiler(p) || p.page !== w.page || p === w) w.parent = null;
    }
    for (const w of ui.widgets) {
        const seen = new Set([w.id]);
        let p = w.parent && by.get(w.parent);
        while (p) { if (seen.has(p.id)) { w.parent = null; break; } seen.add(p.id); p = p.parent && by.get(p.parent); }
    }
    // the number of spoilers above a spoiler (a plain widget may lie in one more level than a spoiler)
    const chain = (w) => { let n = 0, p = w.parent && by.get(w.parent); while (p) { n++; p = p.parent && by.get(p.parent); } return n; };
    for (const w of ui.widgets) {
        if (!isSpoiler(w)) continue;
        let guard = 0;
        while (w.parent && chain(w) >= SPOILER_DEPTH && guard++ < 8) w.parent = by.get(w.parent)?.parent || null;
    }
}
// the height of a spoiler in the model is the height of its header (the rest is computed by flow.js)
export function syncSpoilerHeights(ui) {
    for (const w of ui.widgets) if (isSpoiler(w)) w.h = headHOf(ui, w);
}
// children that stick out when the spoiler got narrower are shrunk, and shifted back when shrinking is not enough
export function fitChildren(ui, s) {
    const iw = innerW(s);
    for (const c of childrenOf(ui, s.id)) {
        if (c.x + c.w > iw) { c.w = Math.max(24, iw - c.x); if (c.x + c.w > iw) c.x = Math.max(0, iw - c.w); }
    }
}
export const childrenOf = (ui, id) => ui.widgets.filter((w) => w.parent === id);
export const levelOf = (ui, pageId, parent = null) => ui.widgets.filter((w) => w.page === pageId && (w.parent || null) === (parent || null));
// the widgets under a spoiler, deep
export function descendantsOf(ui, id) {
    const out = [];
    const walk = (p) => { for (const c of childrenOf(ui, p)) { out.push(c); if (isSpoiler(c)) walk(c.id); } };
    walk(id);
    return out;
}
// the height of what lies in a spoiler, in "closed" coordinates
// the lowest edge of the widgets that lie on the page itself (not in a spoiler)
export const pageBottom = (ui, pageId) => levelOf(ui, pageId, null).reduce((m, w) => Math.max(m, w.y + w.h), 0);
// the length of a page: the height of the window, or more when the page is set longer or a widget lies lower (then with room under it)
export function pageLength(ui, pageId, bottom = pageBottom(ui, pageId)) {
    const h = ui.page.h, own = pageOf(ui, pageId)?.len || 0;
    return Math.max(h, own, bottom > h ? Math.ceil(bottom + TAIL) : 0);
}
export const contentBottom = (ui, w) => childrenOf(ui, w.id).reduce((m, c) => Math.max(m, c.y + c.h), 0);

/* ------------------------------------------------------------------ queries */

export const widgetsOf = (ui, pageId) => ui.widgets.filter((w) => w.page === pageId);
export const byId = (ui, id) => ui.widgets.find((w) => w.id === id) || null;
export const pageOf = (ui, id) => ui.pages.find((p) => p.id === id) || ui.pages[0];
export const sourceOf = (ui, id) => ui.sources.find((s) => s.uid === id) || null;
export const topZ = (ui, pageId) => widgetsOf(ui, pageId).reduce((m, w) => Math.max(m, w.z), 0) + 1;

export const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The first free place for a new widget (looking left to right, top to bottom, on the grid).
export function freeSpot(ui, pageId, w, h, step = 8, parent = null, canvas = null) {
    const others = levelOf(ui, pageId, parent).filter((o) => !isPanelLike(o));
    const gap = step * 2;
    const CW = canvas?.w ?? ui.page.w, CH = canvas?.h ?? ui.page.h;
    const top = Math.max(0, canvas?.top || 0), bot = Math.max(0, canvas?.bottom || 0);
    for (let y = top ? Math.ceil((top + gap) / (step * 2)) * step * 2 : gap; y + h <= CH - bot; y += step * 2) {
        for (let x = gap; x + w <= CW; x += step * 2) {
            const r = { x, y, w, h };
            if (!others.some((o) => rectsOverlap(r, { x: o.x - gap / 2, y: o.y - gap / 2, w: o.w + gap, h: o.h + gap }))) return { x, y };
        }
    }
    return { x: gap, y: gap };
}

// The panel a widget lies in (its centre inside a panel that is lower in the stack) and the widgets lying in a panel.
export function panelOf(ui, w) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    let best = null;
    for (const p of levelOf(ui, w.page, w.parent)) {
        if (!isPanelLike(p) || p.id === w.id || p.z >= w.z) continue;
        if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h && (!best || p.z > best.z)) best = p;
    }
    return best;
}
/* ------------------------------------------------------------------ the Tab panel: a panel whose widgets are shown tab by tab */
export const isPanelLike = (w) => w?.type === "panel" || w?.type === "tabbox";
export const TABS_MAX = 12;
export const tabsOf = (box) => (Array.isArray(box?.props?.tabs) && box.props.tabs.length ? box.props.tabs : [{ id: "t1", name: "Tab 1" }]);
export function cleanBoxTabs(box) {
    const raw = Array.isArray(box.props.tabs) ? box.props.tabs : [];
    const seen = new Set(), out = [];
    for (const t of raw.slice(0, TABS_MAX)) {
        if (!isObj(t) || typeof t.id !== "string" || !t.id || seen.has(t.id)) continue;
        seen.add(t.id); out.push({ id: t.id.slice(0, 24), name: str(t.name, "Tab", 40) || "Tab" });
    }
    if (!out.length) out.push({ id: "t1", name: "Tab 1" }, { id: "t2", name: "Tab 2" });
    box.props.tabs = out;
    if (!out.some((t) => t.id === box.props.active)) box.props.active = out[0].id;
}
// every widget that lies in a Tab panel belongs to one of its tabs (new ones to the tab that is open); elsewhere the mark is dropped
export function fixTabs(ui) {
    for (const w of ui.widgets) if (w.type === "tabbox") { w.props = w.props || {}; cleanBoxTabs(w); }
    for (const w of ui.widgets) {
        const box = panelOf(ui, w);
        if (box?.type === "tabbox") { if (!box.props.tabs.some((t) => t.id === w.tab)) w.tab = box.props.active; }
        else delete w.tab;
    }
}
export function insidePanel(ui, panel) {
    return levelOf(ui, panel.page, panel.parent).filter((w) => w.id !== panel.id && w.z > panel.z && w.x + w.w / 2 >= panel.x && w.x + w.w / 2 <= panel.x + panel.w && w.y + w.h / 2 >= panel.y && w.y + w.h / 2 <= panel.y + panel.h);
}

/* ------------------------------------------------------------------ history */

// Snapshots of the whole panel as JSON text. push() before a change, undo() / redo() take the current state in.
export class History {
    constructor(limit = 100) { this.limit = limit; this.past = []; this.future = []; }
    push(ui) {
        const s = JSON.stringify(ui);
        if (this.past[this.past.length - 1] === s) return;
        this.past.push(s);
        if (this.past.length > this.limit) this.past.shift();
        this.future.length = 0;
    }
    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }
    undo(current) {
        if (!this.past.length) return null;
        this.future.push(JSON.stringify(current));
        return JSON.parse(this.past.pop());
    }
    redo(current) {
        if (!this.future.length) return null;
        this.past.push(JSON.stringify(current));
        return JSON.parse(this.future.pop());
    }
}
