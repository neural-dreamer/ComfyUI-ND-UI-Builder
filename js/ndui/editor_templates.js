// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the «Templates» tab of the right panel: ready-made pages, my own templates (a page or the whole panel) with miniatures,
// saving the current work as a template, export and import of the panel as a file.
import { el, toast } from "./core/dom.js";
import { btn, iconBtn, selectInput, segInput, textInput } from "./controls.js";
import { icon } from "./kit.js";
import { clone, normalizeNdUi } from "./model.js";
import { TEMPLATES, addTemplatePage, parsePreset, download } from "./presets.js";
import { pageThumb } from "./thumb.js";
import { listTemplates, writeTemplate, deleteTemplate, freeSlug, pageUi, importPage } from "./templates.js";

const TW = 140, TH = 90;
const cache = { list: null, loading: false };
export const invalidateTemplates = () => { cache.list = null; };

/* ------------------------------------------------------------------ a small dialog */

function dialog(E, { title, build, ok, okIcon = "check", danger = false, onOk }) {
    const { tr } = E;
    const c = el("div", "nde-confirm");
    const box = el("div"); box.style.maxHeight = "calc(100% - 32px)"; box.style.overflow = "auto";
    box.append(el("b", "", title));
    const close = () => { c.remove(); E.root.focus?.(); };
    const acts = el("div", "acts");
    const go = btn(ok, okIcon, async () => { if (go.disabled) return; if ((await onOk?.()) !== false) close(); }, danger ? "danger" : "primary");
    const body = el("div"); body.style.cssText = "display:flex;flex-direction:column;gap:10px";
    build?.(body, go);
    acts.append(btn(tr("Cancel"), null, close, ""), go);
    box.append(body, acts); c.append(box);
    c.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    c.addEventListener("pointerdown", (e) => e.stopPropagation());
    E.root.append(c);
    return { close, go };
}

/* ------------------------------------------------------------------ pieces */

function tile({ thumb, name, badge, hint, actions }) {
    const t = el("div", "nde-tpl");
    const pic = el("div", "nde-tpl-pic"); pic.append(thumb);
    const bar = el("div", "nde-tpl-act"); bar.append(...actions);
    pic.append(bar);
    const meta = el("div", "nde-tpl-meta");
    const nm = el("span", "nde-tpl-name", name); nm.title = hint || name;
    meta.append(nm);
    if (badge) meta.append(el("span", "nde-tpl-badge", badge));
    t.append(pic, meta);
    return t;
}

function applyTemplate(E, t) {
    const { tr } = E;
    const link = () => parsePreset(JSON.stringify(t.ui));
    const report = (r, title) => toast(r.missing.length ? "warn" : "success", title, r.missing.length ? tr("{n} nodes were not found by their tag: {tags}. Pick them in Link.", { n: r.missing.length, tags: r.missing.map((s) => `[${s.tag || s.class}]`).join(", ") }) : "");
    try {
        if (t.kind === "page") {
            const r = link();
            let pid = "";
            E.change(null, (u) => { pid = importPage(u, r.ui, t.name); });
            if (pid) E.setPage(pid);
            report(r, tr("Page added"));
        } else {
            dialog(E, {
                title: tr("Replace the whole panel?"),
                build: (b) => b.append(el("span", "", tr("The panel of this workflow, with all its pages and settings, is replaced by the template «{name}». This can be undone while the editor is open.", { name: t.name }))),
                ok: tr("Replace"), okIcon: "check", danger: true,
                onOk: () => {
                    const r = link();
                    E.change(null, (u) => { for (const k of Object.keys(u)) delete u[k]; Object.assign(u, r.ui); });
                    E.setPage(E.ui.pages[0].id);
                    report(r, tr("Template applied"));
                },
            });
        }
    } catch (e) { toast("error", tr("Cannot use the template"), tr(e.message)); }
}

function saveDialog(E, after) {
    const { tr, ui } = E;
    const st = { name: "", scope: "page", thumb: E.page };
    let prev, pic, sel;
    const refresh = () => {
        const src = st.scope === "page" ? pageUi(ui, E.page) : normalizeNdUi(clone(ui));
        prev.textContent = ""; prev.append(pageThumb(src, st.scope === "page" ? E.page : st.thumb, TW * 1.6, TH * 1.6));
        pic.style.display = st.scope === "panel" ? "" : "none";
    };
    dialog(E, {
        title: tr("Save as a template"),
        ok: tr("Save"), okIcon: "save",
        build: (b, go) => {
            const name = textInput({ value: "", placeholder: tr("Name of the template"), onInput: (v) => { st.name = v; go.disabled = !v.trim(); } });
            go.disabled = true;
            const fld = (label, ctl) => { const r = el("div"); r.style.cssText = "display:flex;flex-direction:column;gap:5px"; r.append(el("span", "nde-note", label), ctl); return r; };
            b.append(fld(tr("Name"), name));
            b.append(fld(tr("What to save"), segInput([["page", tr("This page only")], ["panel", tr("The whole panel with all its pages")]], st.scope, (v) => { st.scope = v; refresh(); })));
            sel = selectInput(ui.pages.map((p) => [p.id, p.name]), st.thumb, (v) => { st.thumb = v; refresh(); });
            pic = fld(tr("Picture from the page"), sel);
            b.append(pic);
            prev = el("div", "nde-tpl-pic big"); b.append(fld(tr("Miniature"), prev));
            refresh();
            setTimeout(() => name.querySelector?.("input")?.focus?.() || name.focus?.(), 30);
        },
        onOk: async () => {
            try {
                const name = st.name.trim();
                const slug = await freeSlug(name);
                const u = st.scope === "page" ? pageUi(ui, E.page) : normalizeNdUi(clone(ui));
                await writeTemplate({ slug, name, kind: st.scope, thumbPage: st.scope === "page" ? E.page : st.thumb, ui: u, created: Date.now() });
                invalidateTemplates();
                toast("success", tr("Template saved"), name);
                after();
            } catch (e) { toast("error", tr("Cannot save the template"), tr(e.message)); return false; }
        },
    });
}

function menu(E, t, anchor, after) {
    const { tr } = E;
    document.querySelectorAll(".nde-tmenu").forEach((m) => m.remove());
    const m = el("div", "nde-tmenu");
    const item = (label, ic, fn, cls) => { const b = btn(label, ic, () => { m.remove(); fn(); }, cls); m.append(b); };
    item(tr("Rename"), "pencil", () => dialog(E, {
        title: tr("Rename the template"), ok: tr("Save"), okIcon: "save",
        build: (b, go) => { const i = textInput({ value: t.name, onInput: (v) => { t.__n = v; go.disabled = !v.trim(); } }); t.__n = t.name; b.append(i); setTimeout(() => i.querySelector?.("input")?.focus?.() || i.focus?.(), 30); },
        onOk: async () => { try { await writeTemplate({ ...t, name: t.__n.trim() }); invalidateTemplates(); after(); } catch (e) { toast("error", tr("Cannot save the template"), tr(e.message)); return false; } },
    }));
    if (t.kind === "panel" && t.ui.pages.length > 1) {
        item(tr("Picture from the page"), "image", () => dialog(E, {
            title: tr("Picture from the page"), ok: tr("Save"), okIcon: "save",
            build: (b) => { t.__p = t.thumbPage || t.ui.pages[0].id; b.append(selectInput(t.ui.pages.map((p) => [p.id, p.name]), t.__p, (v) => { t.__p = v; })); },
            onOk: async () => { try { await writeTemplate({ ...t, thumbPage: t.__p }); invalidateTemplates(); after(); } catch (e) { toast("error", tr("Cannot save the template"), tr(e.message)); return false; } },
        }));
    }
    item(tr("Export to a file"), "download", () => download(t.ui, t.slug));
    item(tr("Delete"), "trash", () => dialog(E, {
        title: tr("Delete the template?"), ok: tr("Delete"), okIcon: "trash", danger: true,
        build: (b) => b.append(el("span", "", tr("«{name}» will be removed from the templates folder.", { name: t.name }))),
        onOk: async () => { try { await deleteTemplate(t.slug); invalidateTemplates(); after(); } catch (e) { toast("error", tr("Cannot delete the template"), tr(e.message)); return false; } },
    }), "danger");
    anchor.append(m);
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
}

/* ------------------------------------------------------------------ the tab */

export function templatesTab(E, body) {
    const { tr, ui } = E;
    if (!E.tplSeen) { E.tplSeen = true; invalidateTemplates(); }   // every opening of the editor reads the folder again
    const head = el("div", "nde-tools");
    head.append(btn(tr("Save as a template"), "save", () => saveDialog(E, () => E.renderInspector()), "primary", tr("Keep this page, or the whole panel, as a template of your own")));
    body.append(head);

    // ready-made pages
    body.append(el("div", "nde-tpl-h", tr("Ready-made pages")));
    const g1 = el("div", "nde-tpl-grid");
    for (const t of TEMPLATES) {
        const tmp = clone(ui), pid = addTemplatePage(tmp, t.id, tr(t.label));
        const add = () => { let np = ""; E.change(null, (u) => { np = addTemplatePage(u, t.id, tr(t.label)); }); if (np) E.setPage(np); };
        const tl = tile({ thumb: pageThumb(tmp, pid, TW, TH), name: tr(t.label), hint: tr(t.hint), badge: tr("Page"), actions: [iconBtn("plus", tr("Add as a new page"), add)] });
        tl.dataset.id = t.id; tl.addEventListener("dblclick", add);
        g1.append(tl);
    }
    body.append(g1);

    // my templates
    body.append(el("div", "nde-tpl-h", tr("My templates")));
    const mine = el("div"); body.append(mine);
    const draw = () => {
        mine.textContent = "";
        const list = cache.list || [];
        if (!list.length) { mine.append(el("div", "nde-note", tr("Nothing yet. «Save as a template» keeps a page or the whole panel in the templates folder of ComfyUI."))); return; }
        const g = el("div", "nde-tpl-grid");
        for (const t of list) {
            const more = iconBtn("more", tr("More"), () => menu(E, t, tl, () => E.renderInspector()));
            const use = iconBtn("plus", t.kind === "page" ? tr("Add as a new page") : tr("Replace the panel with it"), () => applyTemplate(E, t));
            let thumb;
            try { const tu = normalizeNdUi(t.ui); thumb = pageThumb(tu, t.thumbPage, TW, TH); } catch { thumb = el("div", "nde-note", "?"); }
            const tl = tile({ thumb, name: t.name, badge: t.kind === "panel" ? tr("Panel") : tr("Page"), actions: [use, more] });
            tl.dataset.slug = t.slug; tl.dataset.kind = t.kind;
            tl.addEventListener("dblclick", () => applyTemplate(E, t));
            g.append(tl);
        }
        mine.append(g);
    };
    if (cache.list) draw();
    else {
        mine.append(el("div", "nde-note", tr("Loading…")));
        if (!cache.loading) {
            cache.loading = true;
            listTemplates().then((l) => { cache.list = l; }).catch(() => { cache.list = []; }).finally(() => { cache.loading = false; if (E.rtab === "templates" && !E.closed) E.renderInspector(); });
        }
    }

    // the panel as a file
    body.append(el("div", "nde-tpl-h", tr("The panel as a file")));
    body.append(el("div", "nde-note", tr("A preset is the panel in a file. Its nodes are found again by their [tag] in the workflow you load it into.")));
    const file = document.createElement("input"); file.type = "file"; file.accept = ".json,application/json"; file.style.display = "none";
    file.addEventListener("change", async () => {
        const f = file.files?.[0]; file.value = "";
        if (!f) return;
        try {
            const r = parsePreset(await f.text());
            E.change(null, (u) => { for (const k of Object.keys(u)) delete u[k]; Object.assign(u, r.ui); });
            E.setPage(E.ui.pages[0].id);
            toast(r.missing.length ? "warn" : "success", tr("Preset loaded"), r.missing.length ? tr("{n} nodes were not found by their tag: {tags}. Pick them in Link.", { n: r.missing.length, tags: r.missing.map((s) => `[${s.tag || s.class}]`).join(", ") }) : "");
        } catch (e) { toast("error", tr("Cannot load the preset"), tr(e.message)); }
    });
    const tools = el("div", "nde-tools");
    tools.append(btn(tr("Export"), "download", () => download(E.ui, "nd-panel"), "", tr("Save the panel as a .ndui.json file")), btn(tr("Import"), "upload", () => file.click(), "", tr("Load a panel from a .ndui.json file (it replaces this one)")), file);
    body.append(tools);
}
