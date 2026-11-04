// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ComfyUI ND UI Builder — the extension entry: the panel of the workflow works without any node on the canvas.
//  - the panel is kept in graph.extra.nd_ui (ndui/store.js), shown by the ND UI mode (ndui/uimode.js) and edited by the editor;
//  - two buttons ("ND UI" and "Edit") stand in the action bar of ComfyUI next to Run;
//  - settings: Esc in the mode, start in the mode, the buttons in the action bar.
import { app } from "../../scripts/app.js";
import { workflowHost } from "./ndui/host.js";
import { workflowStore, nodeStore } from "./ndui/store.js";
import { toggleUiMode, enterUiMode, exitUiMode, isUiMode } from "./ndui/uimode.js";
import { allNodes, isUiNode, invalidateSources } from "./ndui/sources.js";
import { LOGO_URI } from "./ndui/logo.js";
import { installLiveMark } from "./ndui/live_mark.js";
import { embedCheck } from "./ndui/embed/check.js";
import { projectMenu, runProject } from "./ndui/project_ui.js";
import { S_OPEN } from "./ndui/project.js";
import { S_HOTKEYS, renderSetting } from "./ndui/hotkeys.js";
import { openSwitcher, installSwitcherKeys, trackPictures } from "./ndui/switcher.js";

const S_ESC = "NeuralDreamerUI.Esc";
const S_START = "NeuralDreamerUI.StartInUi";
const S_BAR = "NeuralDreamerUI.ActionBarButtons";
const S_BARPROJ = "NeuralDreamerUI.ActionBarProject";
const getSetting = (id, d) => { try { return app.extensionManager?.setting?.get?.(id) ?? d; } catch { return d; } };

const PENCIL = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4'/></svg>");
const DISK = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 3v5h7V3M8 21v-7h8v7'/></svg>");
const CSS = `
.ndui-ab-logo{display:inline-block;width:20px;height:20px;background:url("${LOGO_URI}") center/contain no-repeat}
.ndui-ab-disk{display:inline-block;width:16px;height:16px;background:currentColor;-webkit-mask:url("${DISK}") center/contain no-repeat;mask:url("${DISK}") center/contain no-repeat}
.ndui-ab-edit{display:inline-block;width:16px;height:16px;background:currentColor;-webkit-mask:url("${PENCIL}") center/contain no-repeat;mask:url("${PENCIL}") center/contain no-repeat}
html.ndui-no-bar .ndui-ab,html.ndui-no-bar [data-ndui-ab],html.ndui-no-proj .ndui-ab-p,html.ndui-no-proj [data-ndui-ab-p]{display:none !important}
`;
function injectCss() {
    if (document.getElementById("ndui-ext-css")) return;
    const s = document.createElement("style"); s.id = "ndui-ext-css"; s.textContent = CSS; document.head.append(s);
}
const applyBarSetting = () => {
    document.documentElement.classList.toggle("ndui-no-bar", getSetting(S_BAR, true) === false);
    document.documentElement.classList.toggle("ndui-no-proj", getSetting(S_BARPROJ, true) === false);
};

// the old way: every NDUI node kept its own panel. The first such panel becomes the panel of the workflow (the node turns into a window).
function migrate() {
    if (workflowStore.read()) return false;
    const owners = allNodes().filter((n) => isUiNode(n) && n.properties?.nd_ui && typeof n.properties.nd_ui === "object");
    if (!owners.length) return false;
    const first = owners[0];
    workflowStore.write(first.properties.nd_ui, { touch: false });
    nodeStore(first).clear();
    return true;
}

function afterLoad() {
    invalidateSources();
    migrate();
    const host = workflowHost();
    host.reload();
    for (const n of allNodes()) if (isUiNode(n)) n.ndUiApi?.reload?.();
    const never = getSetting(S_START, "panel") === "never";
    if (!never && host.has && host.ui.view.startInUi && !isUiMode()) enterUiMode(host);
}

app.registerExtension({
    name: "NeuralDreamer.UI",

    settings: [
        { id: S_ESC, category: ["ComfyUI ND UI Builder", "ND UI mode", "Esc key"], name: "Esc key in the ND UI mode", type: "combo", defaultValue: "panel",
          options: [{ text: "As the panel says", value: "panel" }, { text: "Always leave the mode", value: "always" }, { text: "Never leave the mode", value: "never" }],
          tooltip: "Overrides what a panel says about Esc." },
        { id: S_START, category: ["ComfyUI ND UI Builder", "ND UI mode", "Start in the mode"], name: "Open workflows in the ND UI mode", type: "combo", defaultValue: "panel",
          options: [{ text: "As the panel says", value: "panel" }, { text: "Never", value: "never" }],
          tooltip: "A panel can ask to open its workflow in the ND UI mode; \"Never\" ignores that." },
        { id: S_OPEN, category: ["ComfyUI ND UI Builder", "Project files", "Open a project"], name: "Open a project", type: "combo", defaultValue: "tab",
          options: [{ text: "In a new tab", value: "tab" }, { text: "Replace the current workflow", value: "replace" }],
          tooltip: "Where a project file (.ndui and the like) goes when it is opened." },
        { id: S_HOTKEYS, category: ["ComfyUI ND UI Builder", "ND UI mode", "Allowed ComfyUI Hotkeys"], name: "Allowed ComfyUI Hotkeys", type: renderSetting, defaultValue: [],
          tooltip: "ComfyUI hotkeys that keep working while the ND UI mode is on. Add the ones you need; all the others are held back." },
        { id: S_BAR, category: ["ComfyUI ND UI Builder", "Buttons", "Action bar"], name: "Show the ND UI and Edit buttons next to Run", type: "boolean", defaultValue: true,
          onChange: () => applyBarSetting() },
        { id: S_BARPROJ, category: ["ComfyUI ND UI Builder", "Buttons", "Project button"], name: "Show the Project button next to Run", type: "boolean", defaultValue: true,
          tooltip: "The Project button saves or opens the work as an ND UI project file. In the ND UI mode the project button has its own corner (set in the editor).",
          onChange: () => applyBarSetting() },
    ],

    actionBarButtons: [
        { icon: "ndui-ab-disk", label: "Project", class: "ndui-ab-p", tooltip: "Save or open the work as an ND UI project file", onClick: (e) => { const a = (e?.currentTarget || e?.target || document.body); projectMenu(a?.getBoundingClientRect ? a : document.body, workflowHost()); } },
        { icon: "ndui-ab-logo", label: "ND UI", class: "ndui-ab", tooltip: "Open or close the ND UI mode", onClick: () => toggleUiMode(workflowHost()) },
        { icon: "ndui-ab-edit", label: "Edit", class: "ndui-ab", tooltip: "Edit the ND UI of this workflow", onClick: () => { if (!isUiMode()) workflowHost().openEditor(); } },
    ],

    async setup() {
        injectCss();
        applyBarSetting();
        workflowHost();
        installLiveMark();
        trackPictures();
        installSwitcherKeys();
        window.ndUi = { embedCheck, switcher: openSwitcher, project: (what = "save") => runProject(workflowHost(), what), debug: (on = true) => { try { on ? localStorage.setItem("ndui-debug", "live") : localStorage.removeItem("ndui-debug"); } catch {} return on ? "ND UI debug is ON: run the workflow and look at the console" : "ND UI debug is off"; }, host: workflowHost, enter: () => enterUiMode(workflowHost()), exit: exitUiMode, toggle: () => toggleUiMode(workflowHost()), isMode: isUiMode };
    },

    async afterConfigureGraph() { afterLoad(); },
});
