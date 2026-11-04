// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — language of the interface (English, Russian, Chinese).
// The English text of a string is its key: T(lang, "Fix random"). A missing translation shows the English text.
// The language is shared with Neural Dreamer Nodes (same storage key and event), but the pack works without it.
// Translations live in js/i18n/<lang>.json under "ui".

import { app } from "../../../../scripts/app.js";

export const LANGS = [
    { id: "en", label: "English" },
    { id: "ru", label: "Русский" },
    { id: "zh", label: "中文" },
];
export const LANG_IDS = LANGS.map((l) => l.id);
const COMMON_KEY = "nd-builder-lang";
export const LANG_EVENT = "nd-lang-change";

/* ------------------------------------------------------------------ choice */

// The language of ComfyUI itself ("ru", "zh", "zh-TW"…), used until the person chooses one.
export function localeLang() {
    let loc = "";
    try { loc = String(app.extensionManager?.setting?.get?.("Comfy.Locale") ?? app.ui?.settings?.getSettingValue?.("Comfy.Locale") ?? ""); } catch {}
    loc = loc.toLowerCase();
    if (loc.startsWith("ru")) return "ru";
    if (loc.startsWith("zh")) return "zh";
    return "en";
}

// The language shared by every builder that follows "the common one".
export function commonLang() {
    try {
        const v = localStorage.getItem(COMMON_KEY);
        if (LANG_IDS.includes(v)) return v;
    } catch {}
    return localeLang();
}
export function setCommonLang(id) {
    if (!LANG_IDS.includes(id)) return;
    try { localStorage.setItem(COMMON_KEY, id); } catch {}
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang: id } }));
}
// a node keeps "auto" (the common language) or its own choice
export const resolveLang = (own) => (LANG_IDS.includes(own) ? own : commonLang());
export const validOwnLang = (v) => (v === "auto" || LANG_IDS.includes(v) ? v : "auto");

/* ------------------------------------------------------------------ files */

const dicts = new Map(); // id -> dictionary (an object) once loaded
const loading = new Map();
export function loadLang(id) {
    if (id === "en" || !LANG_IDS.includes(id)) return Promise.resolve({});
    if (dicts.has(id)) return Promise.resolve(dicts.get(id));
    if (!loading.has(id)) {
        loading.set(id, fetch(new URL(`../../i18n/${id}.json`, import.meta.url))
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`i18n/${id}.json: HTTP ${r.status}`))))
            .catch((e) => {
                console.warn(`[ComfyUI ND UI Builder] cannot load the ${id} translation`, e);
                return {};
            })
            .then((d) => { dicts.set(id, d); return d; }));
    }
    return loading.get(id);
}
export const dictOf = (id) => dicts.get(id) || null;

/* ---------------------------------------------------------------- interface */

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

// An interface string: the translation when there is one, else the English text itself.
export function T(lang, en, vars) {
    const d = lang === "en" ? null : dicts.get(lang);
    return fill(d?.ui?.[en] ?? en, vars);
}

