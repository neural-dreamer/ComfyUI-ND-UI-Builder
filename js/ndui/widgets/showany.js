// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Show Any As Text (id "showany"): the view of an ND Show Any As Text node of Neural Dreamer Nodes.
// The first tab is the preview (the value the node got on the last run); the other tabs are notes. The notes and the preview live in the properties of the node
// (nd_notes, nd_preview_text), so the node and the widget always show the same text. In the ND UI the viewer adds, renames, deletes (asks twice) and drags the tabs.
import { app } from "../../../../scripts/app.js";
import { el, icon } from "./util.js";
import { tabStrip } from "./tabs_strip.js";

export const SHOWANY_CLASS = "NDShowAnyAsText";
export const isShowAnyNode = (n) => !!n && (n.comfyClass || n.type) === SHOWANY_CLASS;
const notesOf = (n) => (Array.isArray(n?.properties?.nd_notes) ? n.properties.nd_notes.filter((x) => x && typeof x === "object").map((x) => ({ title: String(x.title || "Note"), text: String(x.text ?? "") })) : []);
// what makes the widget redraw: the notes and the preview text
export const showAnyStamp = (n) => (n ? JSON.stringify([n.properties?.nd_notes, n.properties?.nd_preview_text]) : "none");
const PV = "pv";

export const showany = {
    type: "showany", label: "Show Any As Text", icon: "text", group: "Results", fill: true,
    slots: [{ id: "node", label: "ND Show Any As Text node", data: "showany", accepts: [SHOWANY_CLASS], required: true, watch: showAnyStamp }],
    size: { w: 460, h: 300, minW: 160, minH: 120 },
    props: [
        { id: "edit", kind: "bool", label: "Tabs can be changed", def: true, hint: "In the ND UI: add, rename, delete and move the note tabs." },
        { id: "copy", kind: "bool", label: "Copy button", def: true },
    ],
    mount(ctx) {
        const root = el("div", "ndk-sa"); ctx.body.append(root);
        let node = null, active = PV, sig = "", strip = null, areas = new Map(), pv = null, copy = null, body = null;

        const note = (text, warn) => { strip?.destroy(); strip = null; root.textContent = ""; sig = ""; const n = el("div", `ndk-lr-empty${warn ? " warn" : ""}`); n.append(icon(warn ? "warning" : "text", 18), el("span", "", text)); root.append(n); };
        // the notes go to the properties of the node; the node redraws its own tabs only when the order or the names change (typing would throw its cursor away)
        const save = (notes, redraw) => {
            node.properties = node.properties || {};
            node.properties.nd_notes = notes.map((n) => ({ title: n.title, text: n.text }));
            app.graph?.change?.();
            if (redraw) { try { node.ndApi?.restore?.(); } catch {} }
            sig = showAnyStamp(node) + "|" + ctx.prop("edit") + "|" + ctx.prop("copy");
        };
        const items = () => [{ id: PV, name: ctx.tr("Preview"), fixed: true }, ...notesOf(node).map((n, i) => ({ id: `n${i}`, name: n.title }))];
        const idx = (id) => Number(String(id).slice(1));
        const nextTitle = (notes) => { let k = 0; for (const t of notes) { const m = /^Note (\d+)$/.exec(t.title || ""); if (m) k = Math.max(k, Number(m[1])); } return `Note ${Math.max(k, notes.length) + 1}`; };

        function build() {
            strip?.destroy(); root.textContent = ""; areas = new Map();
            const notes = notesOf(node);
            if (active !== PV && !notes[idx(active)]) active = PV;
            strip = tabStrip({
                tr: ctx.tr, max: 20, items, active: () => active,
                edit: () => !ctx.isEditing() && ctx.prop("edit") !== false,
                needConfirm: (id) => !!(notesOf(node)[idx(id)]?.text || "").trim(),
                onSelect: (id) => { active = id; paintTabs(); },
                onAdd: () => { const n = notesOf(node); n.push({ title: nextTitle(n), text: "" }); save(n, true); active = `n${n.length - 1}`; build(); areas.get(active)?.focus(); },
                onRename: (id, name) => { const n = notesOf(node); if (n[idx(id)]) { n[idx(id)].title = name; save(n, true); build(); } },
                onMove: (id, to) => {
                    const n = notesOf(node), from = idx(id), a = idx(active);
                    const [x] = n.splice(from, 1); n.splice(Math.max(0, to - 1), 0, x);       // "to" counts the preview tab
                    if (active !== PV) { if (a === from) active = `n${Math.max(0, to - 1)}`; else if (from < a && to - 1 >= a) active = `n${a - 1}`; else if (from > a && to - 1 <= a) active = `n${a + 1}`; }
                    save(n, true); build();
                },
                onDelete: (id) => { const n = notesOf(node), i = idx(id); n.splice(i, 1); if (active === id) active = PV; else if (active !== PV && idx(active) > i) active = `n${idx(active) - 1}`; save(n, true); build(); },
            });
            body = el("div", "ndk-sa-body");
            pv = el("textarea", "ndk-sa-text pv"); pv.readOnly = true; pv.spellcheck = false; pv.placeholder = ctx.tr("Run the workflow to see the value");
            pv.value = String(node.properties?.nd_preview_text ?? "");
            body.append(pv);
            copy = el("button", "ndk-sa-copy"); copy.type = "button"; copy.title = ctx.tr("Copy the text"); copy.append(icon("copy", 14));
            copy.addEventListener("click", async () => {
                let ok = false;
                try { await navigator.clipboard.writeText(pv.value); ok = true; } catch { try { pv.select(); ok = document.execCommand("copy"); pv.setSelectionRange(0, 0); } catch {} }
                copy.classList.toggle("done", ok); copy.title = ok ? ctx.tr("Copied") : ctx.tr("Copy failed: select the text and press Ctrl+C");
                setTimeout(() => { copy.classList.remove("done"); copy.title = ctx.tr("Copy the text"); }, 1400);
            });
            body.append(copy);
            notes.forEach((nt, i) => {
                const ta = el("textarea", "ndk-sa-text"); ta.spellcheck = false; ta.placeholder = ctx.tr("Write a note…"); ta.value = nt.text; ta.dataset.ndScroll = "";
                ta.addEventListener("input", () => { const n = notesOf(node); if (n[i]) { n[i].text = ta.value; save(n, false); } });
                ta.addEventListener("change", () => { try { node.ndApi?.restore?.(); } catch {} });
                ta.addEventListener("keydown", (e) => e.stopPropagation());
                areas.set(`n${i}`, ta); body.append(ta);
            });
            root.append(strip.el, body);
            paintTabs();
        }
        function paintTabs() {
            strip.render();
            pv.style.display = active === PV ? "" : "none";
            for (const [id, ta] of areas) ta.style.display = id === active ? "" : "none";
            copy.style.display = active === PV && ctx.prop("copy") !== false && pv.value ? "" : "none";
            root.classList.toggle("first", active === PV);
        }
        function show() {
            const s = ctx.info("node");
            if (!s.bound) return note(ctx.tr("Bind an ND Show Any As Text node"));
            if (s.lost || !s.node) return note(ctx.tr("The node is gone. Bind it again."), true);
            if (!isShowAnyNode(s.node)) return note(ctx.tr("This node is not an ND Show Any As Text"), true);
            node = s.node;
            const next = showAnyStamp(node) + "|" + ctx.prop("edit") + "|" + ctx.prop("copy");
            if (!strip) { sig = next; return build(); }
            if (next === sig) return;
            sig = next;
            // the node changed outside the widget (a run, an edit in the node): the texts are refreshed, the one being typed in is left alone
            const notes = notesOf(node);
            if (notes.length !== areas.size || notes.some((n, i) => items()[i + 1]?.name !== n.title)) return build();
            pv.value = String(node.properties?.nd_preview_text ?? "");
            notes.forEach((n, i) => { const ta = areas.get(`n${i}`); if (ta && ta !== root.ownerDocument.activeElement && ta.value !== n.text) ta.value = n.text; });
            paintTabs();
        }
        show();
        return { update: show, resize: () => strip?.render(), destroy() { strip?.destroy(); } };
    },
};
