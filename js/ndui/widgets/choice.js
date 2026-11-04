// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — choices: Dropdown (a list with search), Segmented, Tabs (the pages of the panel).
import { el, icon, popup } from "./util.js";

const optText = (o) => String(o);
// "folder/sub/name.safetensors" -> ["folder/sub/", "name.safetensors"]
function splitPath(s) {
    const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    return i < 0 ? ["", s] : [s.slice(0, i + 1), s.slice(i + 1)];
}
function highlight(box, text, q) {
    box.textContent = "";
    if (!q) { box.append(text); return; }
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) { box.append(text); return; }
    box.append(text.slice(0, i));
    const m = el("mark", "", text.slice(i, i + q.length));
    box.append(m, text.slice(i + q.length));
}

// The list: filter by every word typed, a window of rows (any number of items), keyboard: arrows, Enter, Esc.
export function openList(ctx, anchor, { options, current, onPick, search = true, footer }) {
    const ROW = 32;
    return popup(ctx, anchor, {
        width: Math.max(anchor.offsetWidth, 260),
        build(box, close) {
            let items = options.map((o, i) => ({ o, s: optText(o), i }));
            let shown = items, hot = Math.max(0, items.findIndex((x) => x.o === current));
            const inputRow = el("div", "ndk-pop-search");
            const input = el("input"); input.placeholder = ctx.tr("Search…"); input.spellcheck = false;
            inputRow.append(icon("search", 16), input);
            if (search && options.length > 6) box.append(inputRow);
            const list = el("div", "ndk-pop-list"); list.setAttribute("data-nd-scroll", "1");
            const sizer = el("div"); sizer.style.cssText = "position:relative;width:100%";
            list.append(sizer);
            box.append(list);
            const foot = el("div", "ndk-pop-foot");
            const paint = () => {
                sizer.style.height = `${shown.length * ROW}px`;
                const top = list.scrollTop, vh = list.clientHeight || 300;
                const from = Math.max(0, Math.floor(top / ROW) - 3), to = Math.min(shown.length, Math.ceil((top + vh) / ROW) + 3);
                sizer.textContent = "";
                if (!shown.length) { sizer.style.height = "auto"; sizer.append(el("div", "ndk-pop-empty", ctx.tr("Nothing found"))); return; }
                const q = input.value.trim().toLowerCase().split(/\s+/)[0] || "";
                for (let k = from; k < to; k++) {
                    const it = shown[k];
                    const row = el("div", `ndk-pop-row${it.o === current ? " sel" : ""}${k === hot ? " hot" : ""}`);
                    row.style.cssText = `position:absolute;left:0;right:0;top:${k * ROW}px`;
                    const [dir, name] = splitPath(it.s);
                    if (dir) { const i = el("i"); highlight(i, dir, q); row.append(i); }
                    const n = el("span"); highlight(n, name, q); row.append(n);
                    row.title = it.s;
                    row.addEventListener("pointerdown", (e) => { e.preventDefault(); onPick(it.o); close(); });
                    row.addEventListener("pointermove", () => { if (hot !== k) { hot = k; paint(); } });
                    sizer.append(row);
                }
            };
            const refilter = () => {
                const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
                shown = words.length ? items.filter((x) => words.every((w) => x.s.toLowerCase().includes(w))) : items;
                hot = 0; list.scrollTop = 0; paint();
                foot.textContent = `${shown.length} / ${items.length}`;
            };
            list.addEventListener("scroll", paint);
            input.addEventListener("input", refilter);
            const move = (d) => {
                if (!shown.length) return;
                hot = (hot + d + shown.length) % shown.length;
                const y = hot * ROW;
                if (y < list.scrollTop) list.scrollTop = y; else if (y + ROW > list.scrollTop + list.clientHeight) list.scrollTop = y + ROW - list.clientHeight;
                paint();
            };
            box.addEventListener("keydown", (e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
                else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
                else if (e.key === "Enter") { e.preventDefault(); if (shown[hot]) { onPick(shown[hot].o); close(); } }
                e.stopPropagation();
            });
            if (options.length > 60) box.append(foot);
            if (footer) box.append(footer);
            requestAnimationFrame(() => {
                paint();
                if (hot > 4) list.scrollTop = Math.max(0, (hot - 3) * ROW);
                paint();
                foot.textContent = `${shown.length} / ${items.length}`;
                if (inputRow.isConnected) input.focus(); else box.tabIndex = -1, box.focus();
            });
        },
    });
}

export const dropdown = {
    type: "dropdown", label: "Dropdown", icon: "list", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: ["COMBO"], required: true }],
    size: { w: 300, h: 60, minW: 120, minH: 40, maxH: 120 },
    props: [
        { id: "placeholder", kind: "text", label: "Placeholder", hint: "Shown when nothing is chosen." },
        { id: "search", kind: "bool", label: "Search", def: true, hint: "A search field above long lists." },
    ],
    mount(ctx) {
        const f = el("div", "ndk-field ndk-dd");
        f.tabIndex = 0; f.setAttribute("role", "combobox");
        const val = el("span", "ndk-dd-val");
        f.append(val, icon("chevD", 16));
        ctx.body.append(f);
        const show = () => {
            const v = ctx.get("value");
            val.textContent = "";
            if (v == null || v === "") { val.append(ctx.prop("placeholder") || ctx.tr("Choose…")); val.style.color = "var(--ndk-faint)"; return; }
            val.style.color = "";
            const [dir, name] = splitPath(String(v));
            if (dir) val.append(Object.assign(el("i"), { textContent: dir }));
            val.append(name);
            val.title = String(v);
        };
        const open = () => {
            const opts = ctx.info("value").options || [];
            if (!opts.length) return;
            f.classList.add("open");
            const p = openList(ctx, f, { options: opts, current: ctx.get("value"), search: ctx.prop("search") !== false, onPick: (o) => { ctx.set("value", o); show(); } });
            ctx.onPopupClose = () => { f.classList.remove("open"); };
            return p;
        };
        f.addEventListener("click", open);
        f.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); open(); }
            e.stopPropagation();
        });
        f.addEventListener("wheel", (e) => {
            if (!e.shiftKey) return; // a plain wheel zooms the canvas
            e.preventDefault(); e.stopPropagation();
            const opts = ctx.info("value").options || [];
            const i = opts.indexOf(ctx.get("value"));
            const n = Math.max(0, Math.min(opts.length - 1, i + (e.deltaY > 0 ? 1 : -1)));
            if (opts[n] !== undefined && n !== i) { ctx.set("value", opts[n]); show(); }
        }, { passive: false });
        show();
        return { update: show };
    },
};

export const segmented = {
    type: "segmented", label: "Segmented", icon: "segmented", group: "Inputs",
    slots: [{ id: "value", label: "Value", accepts: ["COMBO", "BOOLEAN"], required: true }],
    size: { w: 320, h: 60, minW: 120, minH: 40, maxH: 110 },
    props: [
        { id: "offLabel", kind: "text", label: "Off text", hint: "For a true/false parameter." },
        { id: "onLabel", kind: "text", label: "On text", hint: "For a true/false parameter." },
    ],
    mount(ctx) {
        const seg = el("div", "ndk-seg"); seg.setAttribute("role", "radiogroup");
        ctx.body.append(seg);
        let key = "";
        const show = () => {
            const info = ctx.info("value");
            const bool = info.ptype === "BOOLEAN";
            const opts = bool ? [false, true] : (info.options || []);
            const names = bool ? [ctx.prop("offLabel") || ctx.tr("Off"), ctx.prop("onLabel") || ctx.tr("On")] : opts.map((o) => String(o));
            const cur = ctx.get("value");
            const k = JSON.stringify([names, opts.length]);
            if (k !== key) {
                key = k;
                seg.textContent = "";
                opts.forEach((o, i) => {
                    const b = el("button", "", names[i]); b.type = "button"; b.title = names[i]; b.setAttribute("role", "radio");
                    b.addEventListener("click", () => { ctx.set("value", o); show(); });
                    seg.append(b);
                });
            }
            [...seg.children].forEach((b, i) => { const on = opts[i] === cur; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
        };
        show();
        return { update: show };
    },
};

export const tabs = {
    type: "tabs", label: "Tabs", icon: "page", group: "Layout",
    slots: [],
    size: { w: 360, h: 48, minW: 120, minH: 32, maxH: 80 },
    noLabel: true,
    props: [],
    mount(ctx) {
        const seg = el("div", "ndk-seg");
        ctx.body.append(seg);
        let key = "";
        const show = () => {
            const pages = ctx.pages(), act = ctx.activePage();
            const k = JSON.stringify(pages.map((p) => [p.id, p.name]));
            if (k !== key) {
                key = k; seg.textContent = "";
                for (const p of pages) {
                    const b = el("button", "", p.name); b.type = "button"; b.title = p.name;
                    b.addEventListener("click", () => ctx.goPage(p.id));
                    b.dataset.page = p.id;
                    seg.append(b);
                }
            }
            for (const b of seg.children) b.classList.toggle("on", b.dataset.page === act);
        };
        show();
        return { update: show };
    },
};
