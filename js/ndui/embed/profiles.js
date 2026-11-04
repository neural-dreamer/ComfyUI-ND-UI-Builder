// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — what is known about popular panels: which part to show and how to fit it. A node without a profile gets the general rules.
//   match   class (or title) of the node        part   the name of the DOM widget (or "@mirror")
//   roles   {"#rrggbb": "accent|danger|success|warning"}: how the recolour reads a colour of the panel (the others are guessed by hue)
//   fit     natural | width | fill | scale       pref   [w, h] the panel asks for      min  [w, h] the least that makes sense
const FANTASTIC = { "#ffb84d": "accent" };
export const PROFILES = [
    { match: "MiniMaxH3MediaLoader", roles: FANTASTIC, part: "mml_panel", fit: "scale", pref: [640, 476] },
    { match: "MiniMaxH3RefModStack", roles: FANTASTIC, part: "mmr_panel", fit: "scale", pref: [580, 620] },
    { match: "H3Timeline", part: "mctx_timeline", fit: "fill", min: [340, 320] },
    { match: "H3ResultPreview", part: "mctx_result", fit: "fill", min: [200, 160] },
    { match: "ValuePresets (obvpm)", part: "@mirror", fit: "width" },
    { match: "MiniMaxH3PromptBuilder", roles: FANTASTIC, parts: ["mmh3_summary", "mmh3_reforder", "mmh3_mapbox"], fit: "width" },
];
export function profileOf(node) {
    if (!node) return null;
    const keys = [node.comfyClass, node.type, node.title].filter(Boolean);
    return PROFILES.find((p) => keys.includes(p.match)) || null;
}
// the part shown by default
export function defaultPart(node, autoPart) {
    const p = profileOf(node);
    if (p) {
        if (p.part) return p.part;
        const names = (node.widgets || []).map((w) => w.name);
        const hit = p.parts?.find((n) => names.includes(n));
        if (hit) return hit;
    }
    return autoPart(node) || "@mirror";
}
