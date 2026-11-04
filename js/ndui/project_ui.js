// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the project menu (Save, Save as, Open) and what it says after the work. Shared by the pill of the ND UI mode and the action bar button.
import { el } from "./core/dom.js";
import { icon } from "./kit.js";
import { saveProject, openProject, toast, hasHandle } from "./project.js";

/** runs one action; `host` gives the settings of this workflow (host.ui.view.save.ext) and the translator */
export async function runProject(host, what) {
    const tr = (s, v) => host.tr(s, v);
    const ext = host.ui?.view?.save?.ext;
    try {
        if (what === "open") {
            const r = await openProject({ ext });
            if (r.ok) toast("success", tr("Project opened"), r.name);
            else if (r.error) {
                const e = r.error;
                toast("error", tr("The project was not opened"),
                    e.code === "ext" ? tr("This project has the type .{found}, this workflow opens .{wanted}", { found: e.extra.found, wanted: e.extra.wanted })
                    : e.code === "version" ? tr("The file was made by a newer version of ComfyUI ND UI Builder")
                    : e.code === "corrupt" ? tr("The project file is damaged")
                    : tr("This is not an ND UI project file"));
            }
            return r;
        }
        const r = await saveProject({ ext, as: what === "saveas" });
        if (r.ok) toast("success", r.downloaded ? tr("Project file downloaded") : tr("Project saved"), r.name);
        return r;
    } catch (e) {
        console.warn("[ND UI] project", what, e);
        toast("error", tr("The project could not be processed"), String(e?.message || e));
        return { ok: false, error: e };
    }
}

/** the menu under (or above) an element; closes on a click outside, on Esc and after a choice */
export function projectMenu(anchor, host, root = document.body) {
    document.querySelector(".ndk-um-menu")?.remove();
    const tr = (s, v) => host.tr(s, v);
    const m = el("div", "ndk ndk-um-menu"); m.setAttribute("role", "menu");
    const item = (id, ic, label, hint) => {
        const b = el("button", "item"); b.type = "button"; b.setAttribute("role", "menuitem");
        b.append(icon(ic, 16), el("span", "l", label), hint ? el("span", "h", hint) : "");
        b.addEventListener("click", () => { close(); runProject(host, id); });
        return b;
    };
    m.append(item("save", "save", tr("Save project"), hasHandle() ? tr("same file") : ""), item("saveas", "save", tr("Save project as…")), item("open", "download", tr("Open project…")));
    const ext = host.ui?.view?.save?.ext || "ndui";
    m.append(el("div", "ext", tr("File type: .{ext}", { ext })));
    root.append(m);
    const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    const below = r.bottom + mh + 8 < window.innerHeight;
    m.style.top = `${Math.max(8, below ? r.bottom + 6 : r.top - mh - 6)}px`;
    m.style.left = `${Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw))}px`;
    const out = (e) => { if (!m.contains(e.target) && !anchor.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    function close() { m.remove(); document.removeEventListener("pointerdown", out, true); window.removeEventListener("keydown", esc, true); }
    setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
    window.addEventListener("keydown", esc, true);
    m.querySelector(".item")?.focus();
    return close;
}
