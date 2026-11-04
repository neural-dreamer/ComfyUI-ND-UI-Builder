// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the settings of the progress bar of the mode (page settings).
import { el } from "./widgets/util.js";
import { section, row, selectInput, segInput, toggleInput, rangeInput, colorInput } from "./controls.js";
import { PB_HEIGHT } from "./model.js";
import { makeBar } from "./progressbar.js";

const colorRow = (E, label, value, onChange) => row(label, colorInput({ value: value || null, palette: [], onChange: (v) => onChange(v || ""), nullable: true, host: E.root, tr: E.tr }));

export function progressSection(E, body) {
    const { tr } = E;
    const pb = E.ui.view.progressBar;
    const set = (key, fn) => E.change(key ? `pb:${key}` : null, (u) => fn(u.view.progressBar), key ? { light: true } : undefined);
    body.append(section(tr("Progress bar"), (b) => {
        b.append(el("div", "nde-note", tr("A thin bar along the edge of the ND UI mode that shows how far the run is: the nodes of the run and, on the second half, the steps of the node that runs now.")));
        b.append(row(tr("Show the progress bar"), toggleInput(pb.show, (v) => set(null, (p) => { p.show = v; }))));
        if (!pb.show) return;
        b.append(row(tr("Place"), segInput([["top", tr("Top")], ["bottom", tr("Bottom")]], pb.pos, (v) => set(null, (p) => { p.pos = v; }))));
        b.append(row(tr("Thickness"), rangeInput({ value: pb.height, min: PB_HEIGHT[0], max: PB_HEIGHT[1], step: 1, onInput: (v) => set("h", (p) => { p.height = v; }), fmt: (v) => `${v} px` })));
        b.append(row(tr("Bars"), segInput([["split", tr("Two bars")], ["single", tr("One bar")]], pb.mode, (v) => set(null, (p) => { p.mode = v; })), tr("Two bars: the nodes of the run and the steps of the running node")));
        b.append(row(tr("Fill"), segInput([["accent", tr("Accent")], ["custom", tr("Custom")]], pb.fill, (v) => set(null, (p) => { p.fill = v; }))));
        if (pb.fill === "custom") {
            b.append(colorRow(E, tr("Colour"), pb.c1, (v) => set(null, (p) => { p.c1 = v; })));
            b.append(colorRow(E, tr("Gradient to"), pb.c2, (v) => set(null, (p) => { p.c2 = v; })));
            b.append(row(tr("Gradient angle"), rangeInput({ value: pb.angle, min: 0, max: 360, step: 5, onInput: (v) => set("an", (p) => { p.angle = v; }), fmt: (v) => `${v}°` })));
        }
        b.append(colorRow(E, tr("Track colour"), pb.bg, (v) => set(null, (p) => { p.bg = v; })));
        b.append(row(tr("Glow"), toggleInput(pb.glow, (v) => set(null, (p) => { p.glow = v; }))));
        b.append(row(tr("Text"), selectInput([["none", tr("None")], ["pct", tr("Percent")], ["full", tr("Percent, node and steps")]], pb.text, (v) => set(null, (p) => { p.text = v; }))));
        b.append(row(tr("Hide when idle"), toggleInput(pb.idleHide, (v) => set(null, (p) => { p.idleHide = v; }))));
        // a sample that moves, drawn with the same code as the bar of the mode
        const box = el("div", "ndk-pbar nde-pbsample"); const bar = makeBar(box);
        const demo = { active: true, idle: false, err: false, nodes: 0.42, steps: 0.7, text: "(4/9) 42% - KSampler (70%)", pct: 42 };
        bar.paint({ ...pb, pos: "top" }, demo);
        const wrap = el("div", "nde-pbwrap"); wrap.append(box);
        b.append(row(tr("Preview"), wrap));
    }, { key: "progress" }));
}
