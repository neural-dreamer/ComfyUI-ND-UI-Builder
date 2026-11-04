// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — where the definition of a panel is kept.
//   workflowStore: graph.extra.nd_ui of the root graph (saved with the workflow, no node needed);
//   nodeStore(node): node.properties.nd_ui (a panel that belongs to one NDUI node, the older way).
// read() gives the raw saved object (or null), write(ui, {touch}) puts the live object back; touch tells ComfyUI "changed".
import { app } from "../../../scripts/app.js";
import { touchWorkflow } from "./sources.js";

export const rootGraph = () => app.rootGraph ?? app.graph;

export const workflowStore = {
    kind: "workflow",
    read() { const x = rootGraph()?.extra?.nd_ui; return x && typeof x === "object" ? x : null; },
    write(ui, { touch = true } = {}) {
        const g = rootGraph();
        if (!g) return;
        g.extra = g.extra || {};
        g.extra.nd_ui = ui;
        if (touch) touchWorkflow();
    },
    clear() { const g = rootGraph(); if (g?.extra) delete g.extra.nd_ui; },
};

export const nodeStore = (node) => ({
    kind: "node",
    read() { const x = node.properties?.nd_ui; return x && typeof x === "object" ? x : null; },
    write(ui, { touch = true } = {}) {
        node.properties = node.properties || {};
        node.properties.nd_ui = ui;
        if (touch) touchWorkflow();
    },
    clear() { if (node.properties) delete node.properties.nd_ui; },
});
