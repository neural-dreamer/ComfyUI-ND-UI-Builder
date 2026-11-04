// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// Prints, as JSON, every English string of the interface of ND UI that the person reads: { "ui": [..sorted..] }.
// Used by tools/i18n_tool.py. Needs `acorn` (a dev tool only, it is not shipped with the pack).
"use strict";
const fs = require("fs");
const path = require("path");

function loadAcorn() {
    for (const p of [process.env.ACORN, "acorn", "/opt/node-tools/node_modules/acorn", "/opt/npm-tools/node_modules/acorn"]) {
        if (!p) continue;
        try { return require(p); } catch {}
    }
    throw new Error("acorn is not installed (npm i acorn, or set ACORN to its folder)");
}
const acorn = loadAcorn();
const SRC = path.resolve(__dirname, "..", "js", "ndui");
const letters = /\p{L}/u;
// callee -> indexes of the arguments that hold English words
const CALLS = { tr: [0], tr_: [0], T: [1], pillBtn: [1], iconBtn: [1], emptyBox: [1], section: [0], note: [0], row: [0, 2], tool: [0, 1] };
// properties whose string values are shown to the person
const PROPS = new Set(["label", "hint", "placeholder", "title", "note", "empty", "desc", "tip", "message"]);
// names of tables made of words
const HUMAN = new Set(["STYLES", "SHAPES", "DENSITIES", "LABEL_POSITIONS"]); // lists of ids shown as human(id) = the id with a capital
const EXTRA = ["wire", "muted", "bypassed", "lost", "unbound"]; // status badges (render.js)
const TABLES = new Set(["TABS", "DATA_NAMES", "CONTROL_TEXT", "GROUPS", "SRC_OPTIONS", "ACTIVITY_STYLES", "PAGE_PRESETS", "TEMPLATES", "THEMES"]);

function strings(node, out) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Literal" && typeof node.value === "string") { if (letters.test(node.value)) out.add(node.value); return; }
    if (node.type === "TemplateLiteral") {
        if (!node.expressions.length) { const v = node.quasis[0].value.cooked; if (letters.test(v)) out.add(v); }
        return;
    }
    if (node.type === "ConditionalExpression") { strings(node.consequent, out); strings(node.alternate, out); return; }
    if (node.type === "LogicalExpression") { strings(node.left, out); strings(node.right, out); return; }
    // {a: "...", b: "..."}[key]
    if (node.type === "MemberExpression" && node.object.type === "ObjectExpression") { for (const p of node.object.properties) strings(p.value, out); return; }
    if (node.type === "CallExpression" || node.type === "MemberExpression" || node.type === "Identifier") return;
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === "string" && strings(x, out));
        else if (v && typeof v.type === "string") strings(v, out);
    }
}
function walk(node, fn) {
    fn(node);
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === "string" && walk(x, fn));
        else if (v && typeof v.type === "string") walk(v, fn);
    }
}
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.js$/.test(e.name) ? [path.join(dir, e.name)] : []));
const calleeName = (c) => (c.type === "Identifier" ? c.name : c.type === "MemberExpression" && !c.computed ? c.property.name : null);

function main() {
    const ui = new Set();
    for (const f of files(SRC)) {
        if (/[\\/]core[\\/]i18n\.js$/.test(f)) continue;
        const ast = acorn.parse(fs.readFileSync(f, "utf8"), { ecmaVersion: "latest", sourceType: "module" });
        walk(ast, (n) => {
            if (n.type === "CallExpression") {
                const name = calleeName(n.callee);
                if (name && Object.hasOwn(CALLS, name)) for (const i of CALLS[name]) strings(n.arguments[i], ui);
            }
            if (n.type === "Property" && PROPS.has(n.key.name || n.key.value) && n.value.type !== "ObjectExpression") strings(n.value, ui);
            // [id, "Label", "hint"] lists (options of a select, buttons...)
            if (n.type === "ArrayExpression" && n.elements.length && n.elements.some((e) => e && e.type === "ArrayExpression") && n.elements.every((e) => e && (e.type === "ArrayExpression" || e.type === "SpreadElement"))) {
                for (const row of n.elements) { if (row.type !== "ArrayExpression") continue;
                    const [id, label, hint] = row.elements;
                    if (id?.type === "Literal" && label?.type === "Literal" && /^[a-z]+$/.test(label.value) && hint?.type === "Literal" && /^[A-Z]/.test(hint.value)) { strings(hint, ui); continue; }
                    if (id?.type === "Literal" && /^[a-z_0-9-]*$/i.test(String(id.value)) && label?.type === "Literal" && /^[A-Z]/.test(label.value)) { strings(label, ui); if (hint?.type === "Literal") strings(hint, ui); }
                }
            }
            if (n.type === "VariableDeclarator" && HUMAN.has(n.id?.name) && n.init?.type === "ArrayExpression") for (const e of n.init.elements) if (e?.type === "Literal") ui.add(e.value[0].toUpperCase() + e.value.slice(1));
            if (n.type === "VariableDeclarator" && TABLES.has(n.id?.name) && n.init) {
                if (n.init.type === "ArrayExpression" && n.init.elements.every((e) => e?.type === "Literal")) strings(n.init, ui);
                if (n.init.type === "ObjectExpression") for (const p of n.init.properties) strings(p.value, ui);
            }
        });
    }
    for (const e of EXTRA) ui.add(e);
    process.stdout.write(JSON.stringify({ ui: [...ui].sort() }));
}
main();
