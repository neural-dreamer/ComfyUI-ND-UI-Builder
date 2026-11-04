// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — ndUi.embedCheck(): a diagnostic for the console. It says which frontend this is, whether Nodes 2.0 is on, which DOM panels the selected node has,
// and tries to move one of them out of its wrapper and back, watching what the frontend does meanwhile.
import { app } from "../../../../scripts/app.js";
import { domWidgets, isPanel } from "./dompart.js";

const frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
const setting = (id) => { try { return app.extensionManager?.setting?.get?.(id); } catch { return undefined; } };

export function frontendInfo() {
    let version = globalThis.__COMFYUI_FRONTEND_VERSION__ || app.frontendVersion || "";
    if (!version) { try { version = document.querySelector('meta[name="comfyui-frontend-version"]')?.content || ""; } catch {} }
    const nodes2 = setting("Comfy.VueNodes.Enabled");
    return { version: version || "unknown", nodes2: nodes2 === true ? "on" : nodes2 === false ? "off" : "unknown" };
}

const pickNode = () => {
    const sel = Object.values(app.canvas?.selected_nodes || {});
    const ok = (n) => domWidgets(n).length > 0;
    return sel.find(ok) || (app.graph?._nodes || []).find(ok) || sel[0] || null;
};

// the trial for one panel: out of the wrapper into a hidden box and back
async function trial(d) {
    const el = d.element, home = el.parentElement, widget = d.widget;
    if (!home) return { verdict: "the panel has no wrapper right now (it may lie in an ND UI frame)", moved: false };
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-99999px;top:0;width:400px;height:300px;overflow:hidden;pointer-events:none";
    document.body.append(box);
    box.append(el);
    await frames(3);
    const stayed = el.parentElement === box;
    const sameEl = widget.element === el;
    let back = "";
    if (el.parentElement === box) { if (home.isConnected) home.append(el); else back = "the wrapper was recreated: the panel could not go home"; }
    await frames(2);
    box.remove();
    const wrapperKept = home.isConnected;
    const home2 = el.parentElement;
    const verdict = !stayed ? "the frontend took the element back while it was in the box"
        : !sameEl ? "the panel was rebuilt (a new element) during the trial"
        : !wrapperKept ? "the wrapper was recreated"
        : home2 === home ? "OK" : "the element went home to another place";
    return { verdict, moved: true, stayed, sameElement: sameEl, wrapperKept, wrapperClass: String(home.className || home.tagName), note: back };
}

export async function embedCheck() {
    const fe = frontendInfo();
    const node = pickNode();
    const out = { frontend: fe.version, nodes2: fe.nodes2, node: node ? `${node.title || node.type} (#${node.id})` : "(none)", panels: [] };
    if (node) {
        for (const d of domWidgets(node)) {
            const wrapper = d.element.parentElement;
            const row = { widget: d.name, tag: d.element.tagName, panel: isPanel(d), wrapper: wrapper ? String(wrapper.className || wrapper.tagName) : "(none)" };
            if (row.panel) Object.assign(row, await trial(d));
            out.panels.push(row);
        }
    }
    const lines = [
        `ND UI embed check — frontend ${out.frontend}, Nodes 2.0 ${out.nodes2}`,
        `node: ${out.node}`,
        ...out.panels.map((p) => `  ${p.widget} <${p.tag.toLowerCase()}> wrapper «${p.wrapper}»${p.panel ? ` — panel: ${p.verdict}` : " — not a panel (text box)"}`),
        out.node === "(none)" ? "  Select a node with a panel (or add one) and run it again." : (out.panels.length ? "" : "  This node has no DOM panels."),
    ].filter(Boolean);
    console.log(lines.join("\n"));
    console.log(out);
    out.text = lines.join("\n");
    return out;
}
