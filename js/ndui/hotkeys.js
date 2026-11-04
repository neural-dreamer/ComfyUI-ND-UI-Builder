// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — which ComfyUI hotkeys work while the ND UI mode is on.
// The mode covers the whole window, so by default the hotkeys of ComfyUI ("r" refresh, "q" queue, Ctrl+O...) are held back:
// pressing them there should not touch the workflow behind the panel. The user lists the COMMANDS that stay alive (the settings of ComfyUI ->
// ComfyUI ND UI Builder -> Allowed ComfyUI Hotkeys; the commands are picked from the list of the Keybinding tab). Any key that ComfyUI binds to
// such a command works, whatever the key is now. Esc, Ctrl+Enter, Ctrl+S and Alt+Q of the mode itself always work.
// The hotkeys of ComfyUI listen on `window`; a listener on `document` (bubbling) runs just before it and may stop the event there.
// The browser's own action (copy, paste, typing) is not prevented: only the ComfyUI hotkey is held back.
// The commands and the keys come from the keybinding store of ComfyUI (found through the pinia of the app); an entry of the list that is not
// a command id is read as a plain key combination (the first version of this setting kept those).
import { app } from "../../../scripts/app.js";
import { el } from "./core/dom.js";

export const S_HOTKEYS = "NeuralDreamerUI.AllowedHotkeys";
const MODS = ["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock"];

/** "Ctrl+Shift+Z": the same text for the same keys everywhere (what the list keeps) */
export function comboOf(e) {
    const c = e.code || "";
    let k = /^Key[A-Z]$/.test(c) ? c.slice(3) : /^Digit\d$/.test(c) ? c.slice(5) : /^Numpad\d$/.test(c) ? `Num${c.slice(6)}` : e.key;
    if (k === " ") k = "Space";
    if (typeof k === "string" && k.length === 1) k = k.toUpperCase();
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");
    parts.push(k);
    return parts.join("+");
}
export const isModifierKey = (e) => MODS.includes(e.key);

/** the text a user types or an older list holds -> the normal form ("ctrl + z" -> "Ctrl+Z"); "" when there is nothing */
export function normalizeCombo(text) {
    const parts = String(text || "").split("+").map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return "";
    const mods = new Set(); let key = "";
    for (const p of parts) {
        const l = p.toLowerCase();
        if (l === "ctrl" || l === "control") mods.add("Ctrl");
        else if (l === "alt" || l === "option") mods.add("Alt");
        else if (l === "shift") mods.add("Shift");
        else if (l === "meta" || l === "cmd" || l === "win") mods.add("Meta");
        else key = p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1);
    }
    if (!key) return "";
    return [...["Ctrl", "Alt", "Shift", "Meta"].filter((m) => mods.has(m)), key].join("+");
}

const readSetting = () => { try { return app.extensionManager?.setting?.get?.(S_HOTKEYS); } catch { return null; } };
/** the entries of the list: command ids ("Comfy.RefreshNodeDefinitions") or, from the first version, key combinations ("Ctrl+Z") */
export function allowedList() {
    const v = readSetting();
    let a = v;
    if (typeof v === "string") { try { a = JSON.parse(v); } catch { a = v.split(/[\n,;]+/); } }
    return Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === "string" && x.trim()).map((x) => (/^[\w.-]+\.[\w.-]+/.test(x.trim()) && !x.includes("+") ? x.trim() : normalizeCombo(x))).filter(Boolean))] : [];
}

// ---- ComfyUI: its commands and its keybindings
export const keybindingStore = () => { try { return app.extensionManager?._p?._s?.get("keybinding") ?? null; } catch { return null; } };
export const commandList = () => { try { return [...(app.extensionManager?.command?.commands ?? [])]; } catch { return []; } };
export function labelOf(c) {
    let l = c?.label ?? c?._label;
    if (typeof l === "function") { try { l = l(); } catch { l = ""; } }
    return String(l || c?.id || "");
}
const keyText = (k) => (k && k.length === 1 ? k.toUpperCase() : k || "");
export const comboText = (c) => [c?.ctrl && "Ctrl", c?.alt && "Alt", c?.shift && "Shift", keyText(c?.key)].filter(Boolean).join("+");
/** the keys ComfyUI has for a command now: ["R"] */
export function keysOf(id) {
    try {
        const kb = keybindingStore();
        const list = kb?.getKeybindingsByCommandId?.(id) ?? (kb?.keybindings ?? []).filter((k) => k.commandId === id);
        return [...new Set(list.map((k) => comboText(k.combo)).filter(Boolean))];
    } catch { return []; }
}
const sameCombo = (c, e) => !!c && String(c.key || "").toLowerCase() === String(e.key || "").toLowerCase() && !!c.ctrl === !!(e.ctrlKey || e.metaKey) && !!c.alt === !!e.altKey && !!c.shift === !!e.shiftKey;
/** the commands ComfyUI has on this key press; null when the keybinding store cannot be reached */
export function commandsFor(e) {
    const kb = keybindingStore();
    if (!kb || !Array.isArray(kb.keybindings)) return null;
    return kb.keybindings.filter((k) => sameCombo(k.combo, e)).map((k) => k.commandId);
}

/** true when the hotkeys of ComfyUI must not see this key press */
export function heldBack(e, allowed = allowedList()) {
    if (isModifierKey(e)) return false;
    if (allowed.includes(comboOf(e))) return false;           // a plain combination of the first version
    const cmds = commandsFor(e);
    if (cmds) return cmds.length > 0 && !cmds.some((c) => allowed.includes(c));   // only keys that ComfyUI binds to something are held back
    // the store cannot be reached: hold back every combination that looks like a hotkey
    const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""));
    return e.ctrlKey || e.metaKey || e.altKey || /^F\d{1,2}$/.test(e.key) || !typing(e.target);
}

/** installs the guard for the time of the mode; returns the remover */
export function installGuard(isOn) {
    const fn = (e) => { if (isOn() && heldBack(e)) e.stopPropagation(); };
    document.addEventListener("keydown", fn);
    document.addEventListener("keyup", fn);
    return () => { document.removeEventListener("keydown", fn); document.removeEventListener("keyup", fn); };
}

// ---- the field of the settings: the commands that stay alive, and the button "Add ComfyUI Hotkey" that opens the list of the commands
const CSS = `
.ndui-hk{display:flex;flex-direction:column;gap:8px;align-items:flex-start;max-width:460px}
.ndui-hk .list{display:flex;flex-wrap:wrap;gap:6px}
.ndui-hk .chip{display:inline-flex;align-items:center;gap:7px;padding:3px 6px 3px 10px;border-radius:99px;border:1px solid rgba(255,255,255,.22);font:12px/1.3 system-ui,sans-serif}
.ndui-hk .chip kbd,.ndui-hkp kbd{padding:0 6px;border-radius:5px;background:rgba(255,255,255,.14);font:11px/1.6 ui-monospace,Consolas,monospace}
.ndui-hk .chip button{border:0;background:none;color:inherit;cursor:pointer;opacity:.7;padding:0 4px;font-size:14px;line-height:1}
.ndui-hk .chip button:hover{opacity:1}
.ndui-hk .empty{opacity:.6;font-size:12px}
.ndui-hk .add{padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:inherit;cursor:pointer;font:inherit}
.ndui-hk .add:hover{background:rgba(255,255,255,.14)}
.ndui-hk .note{opacity:.6;font-size:11.5px}
.ndui-hkp{position:fixed;z-index:2147483000;pointer-events:auto;width:440px;max-width:calc(100vw - 20px);display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:#15171d;color:#e8eaf0;box-shadow:0 14px 40px rgba(0,0,0,.55);font:13px/1.3 system-ui,sans-serif;overflow:hidden}
.ndui-hkp input{margin:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font:inherit;outline:none}
.ndui-hkp .rows{overflow:auto;max-height:340px;padding:0 6px 8px}
.ndui-hkp .row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ndui-hkp .row:hover,.ndui-hkp .row:focus-visible{background:rgba(255,255,255,.1);outline:none}
.ndui-hkp .row.on{opacity:.45;cursor:default}
.ndui-hkp .row .l{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ndui-hkp .row .src{opacity:.5;font-size:11px}
.ndui-hkp .none{padding:14px;opacity:.6;text-align:center}
`;
const trText = (s) => { try { return app.extensionManager?.t?.(s) ?? s; } catch { return s; } };

/** the list of the commands, with a search; onPick(id) is called for a click */
function openPicker(anchor, chosen, onPick) {
    document.querySelector(".ndui-hkp")?.remove();
    const box = el("div", "ndui-hkp");
    const q = el("input"); q.type = "search"; q.placeholder = "Search commands or keys..."; q.setAttribute("aria-label", "Search");
    const rows = el("div", "rows");
    box.append(q, rows);
    document.body.append(box);
    const kb = keybindingStore();
    const items = commandList().map((c) => ({ id: c.id, label: labelOf(c), src: c.source || "", keys: keysOf(c.id) }))
        .sort((a, b) => (b.keys.length > 0) - (a.keys.length > 0));   // the commands that have a key now come first
    const draw = () => {
        const t = q.value.trim().toLowerCase();
        rows.textContent = "";
        let n = 0;
        for (const it of items) {
            if (t && !(`${it.label} ${it.id} ${it.keys.join(" ")}`.toLowerCase().includes(t))) continue;
            n++;
            const r = el("button", "row" + (chosen().includes(it.id) ? " on" : "")); r.type = "button";
            r.append(el("span", "l", it.label));
            for (const k of it.keys) r.append(el("kbd", "", k));
            if (it.src && it.src !== "System") r.append(el("span", "src", it.src));
            r.addEventListener("click", () => { if (chosen().includes(it.id)) return; onPick(it.id); close(); });
            rows.append(r);
        }
        if (!n) rows.append(el("div", "none", kb || items.length ? "Nothing found" : "The list of commands is not available in this ComfyUI"));
    };
    const place = () => {
        const a = anchor.getBoundingClientRect(), h = box.offsetHeight || 380;
        const below = a.bottom + 6 + h <= window.innerHeight || a.top < h;
        box.style.top = `${Math.max(8, below ? a.bottom + 6 : a.top - h - 6)}px`;
        box.style.left = `${Math.max(8, Math.min(a.left, window.innerWidth - box.offsetWidth - 8))}px`;
    };
    // The settings of ComfyUI are a modal dialog: it switches the pointer off outside itself (body{pointer-events:none}), closes on a press outside
    // and takes the focus back from anything outside. The list lives on <body>, so it keeps those things away from itself: presses and focus
    // changes that belong to the list are not shown to the dialog (a listener on window in the capture phase comes first).
    const mine = (e) => box.contains(e.target) || (e.relatedTarget instanceof Node && box.contains(e.relatedTarget));
    const shield = (e) => { if (mine(e)) e.stopPropagation(); };
    const SHIELD = ["pointerdown", "mousedown", "focusin", "focusout", "focus", "blur"];
    for (const t of SHIELD) window.addEventListener(t, shield, true);
    const out = (e) => { if (!box.contains(e.target) && e.target !== anchor) close(); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    function close() { for (const t of SHIELD) window.removeEventListener(t, shield, true); document.removeEventListener("pointerdown", out, true); window.removeEventListener("keydown", key, true); box.remove(); }
    q.addEventListener("input", draw);
    document.addEventListener("pointerdown", out, true);
    window.addEventListener("keydown", key, true);
    draw(); place(); q.focus();
    return close;
}

/** the renderer of the setting (ComfyUI calls it with the name, the setter and the value) */
export function renderSetting(name, setter, value) {
    if (!document.getElementById("ndui-hk-css")) { const s = document.createElement("style"); s.id = "ndui-hk-css"; s.textContent = CSS; document.head.append(s); }
    let list = [];
    try { const a = Array.isArray(value) ? value : typeof value === "string" ? JSON.parse(value) : []; list = [...new Set(a.filter((x) => typeof x === "string" && x))]; } catch {}
    const root = el("div", "ndui-hk");
    const box = el("div", "list");
    const add = el("button", "add", "Add ComfyUI Hotkey"); add.type = "button";
    const note = el("div", "note", "Hotkeys of ComfyUI are held back while the ND UI mode is on, except the commands in this list: any key that ComfyUI has for such a command works. Esc, Ctrl+Enter, Ctrl+S and Alt+Q of the mode always work.");
    const save = () => { try { setter(list.slice()); } catch {} };
    const labelFor = (id) => labelOf(commandList().find((c) => c.id === id)) || id;
    const draw = () => {
        box.textContent = "";
        if (!list.length) box.append(el("span", "empty", "No commands added: all hotkeys of ComfyUI are held back in the mode."));
        for (const id of list) {
            const legacy = !/^[\w.-]+\.[\w.-]+/.test(id) || id.includes("+");
            const chip = el("span", "chip", legacy ? id : labelFor(id));
            if (!legacy) for (const k of keysOf(id)) chip.append(el("kbd", "", k));
            if (!legacy) chip.title = id;
            const x = el("button", "", "\u00d7"); x.type = "button"; x.title = "Remove"; x.setAttribute("aria-label", "Remove");
            x.addEventListener("click", () => { list = list.filter((v) => v !== id); save(); draw(); });
            chip.append(x); box.append(chip);
        }
    };
    add.addEventListener("click", () => openPicker(add, () => list, (id) => { list.push(id); save(); draw(); }));
    root.append(box, add, note);
    draw();
    return root;
}
