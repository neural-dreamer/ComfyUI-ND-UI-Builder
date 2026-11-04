// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — my templates: a page or a whole panel kept as a file in the ComfyUI user folder (user/default/ndui-templates/<name>.json).
// The miniature is not a picture: it is drawn from the template when it is shown.
import { api } from "../../../scripts/api.js";
import { normalizeNdUi, uid, clone } from "./model.js";

export const DIR = "ndui-templates";
export const FORMAT = "neuraldreamer-ndui-template";

export const slugify = (name) => String(name || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "template";
const fileOf = (slug) => `${DIR}/${slug}.json`;
const urlOf = (slug) => `/userdata/${encodeURIComponent(fileOf(slug))}`;

async function listSlugs() {
    try {
        const r = await api.fetchApi(`/userdata?dir=${encodeURIComponent(DIR)}&recurse=false&split=false&full_info=true`);
        if (!r.ok) return [];
        const j = await r.json();
        return (Array.isArray(j) ? j : []).map((x) => String(typeof x === "string" ? x : x?.path || "")).filter((n) => /\.json$/i.test(n) && !n.includes("/")).map((n) => n.replace(/\.json$/i, ""));
    } catch { return []; }
}

/** [{slug, name, kind, thumbPage, created, ui}] newest first; broken files are left out */
export async function listTemplates() {
    const out = [];
    await Promise.all((await listSlugs()).map(async (slug) => {
        try {
            const r = await api.fetchApi(urlOf(slug));
            if (!r.ok) return;
            const d = JSON.parse(await r.text());
            if (d?.format !== FORMAT || !d.ui) return;
            out.push({ slug, name: String(d.name || slug), kind: d.kind === "panel" ? "panel" : "page", thumbPage: String(d.thumbPage || ""), created: Number(d.created) || 0, ui: d.ui });
        } catch {}
    }));
    return out.sort((a, b) => b.created - a.created);
}

export async function writeTemplate(t) {
    const text = JSON.stringify({ format: FORMAT, version: 1, name: t.name, kind: t.kind, thumbPage: t.thumbPage, created: t.created || Date.now(), ui: t.ui }, null, 1);
    const r = await api.fetchApi(`${urlOf(t.slug)}?overwrite=true&full_info=false`, { method: "POST", body: text });
    if (!r.ok) throw new Error(`The template could not be saved (${r.status})`);
}
export async function deleteTemplate(slug) {
    const r = await api.fetchApi(urlOf(slug), { method: "DELETE" });
    if (!r.ok && r.status !== 404) throw new Error(`The template could not be deleted (${r.status})`);
}
/** a file name that is not taken yet */
export async function freeSlug(name) {
    const have = new Set(await listSlugs()), base = slugify(name);
    let s = base, n = 2;
    while (have.has(s)) s = `${base}-${n++}`;
    return s;
}

const usedSources = (u) => {
    const need = new Set();
    for (const w of u.widgets) for (const b of Object.values(w.slots || {})) if (b?.src) need.add(b.src);
    for (const p of u.pages) { p.control.nodes.forEach((x) => need.add(x)); if (p.control.bindIndex?.src) need.add(p.control.bindIndex.src); }
    return need;
};

/** a panel of one page: the widgets of the page and the sources they use */
export function pageUi(ui, pageId) {
    const u = clone(ui);
    u.pages = u.pages.filter((p) => p.id === pageId);
    u.widgets = u.widgets.filter((w) => w.page === pageId);
    const need = usedSources(u);
    u.sources = u.sources.filter((s) => need.has(s.uid));
    u.view = { ...u.view, page: pageId };
    return normalizeNdUi(u);
}

/** adds the first page of `tpl` (a linked panel, see parsePreset) to `u`; returns the id of the new page */
export function importPage(u, tpl, name) {
    const pg = tpl.pages[0];
    const pid = uid("p");
    u.pages.push({ ...clone(pg), id: pid, name: name || pg.name });
    const map = new Map();
    for (const w of tpl.widgets.filter((x) => x.page === pg.id)) map.set(w.id, uid("w"));
    let z = u.widgets.reduce((a, w) => Math.max(a, w.z || 0), 0) + 1;
    for (const w of tpl.widgets.filter((x) => x.page === pg.id).sort((a, b) => a.z - b.z)) {
        const c = clone(w); c.id = map.get(w.id); c.page = pid; c.z = z++;
        if (c.parent) c.parent = map.get(c.parent) || null;
        u.widgets.push(c);
    }
    for (const s of tpl.sources) if (!u.sources.some((x) => x.uid === s.uid)) u.sources.push(clone(s));
    return pid;
}
