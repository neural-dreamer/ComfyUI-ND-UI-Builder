// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widget — Node Embed: shows the own interface of any node (a DOM panel of a custom node) inside the page.
// The panel is carried from the node into the frame while the frame is on the screen and given back afterwards (see embed/).
// In the layout of the editor a card stands in for the panel; the live panel shows in the preview, the ND UI mode and the NDUI node.
import { el, icon } from "./util.js";
import { claim, release, reconcile, boost, isOwner, PRIO } from "../embed/registry.js";
import { DomPart, domWidgets, findDom, autoPart, stampOf } from "../embed/dompart.js";
import { Fitter, prefSize } from "../embed/fit.js";
import { guardHost } from "../embed/guard.js";
import { Mirror } from "../embed/mirror.js";
import { profileOf, defaultPart } from "../embed/profiles.js";
import { EmbedTheme } from "../embed/theme.js";

export const FIT_MODES = [
    ["auto", "Automatic (by the panel)"], ["fill", "Fill the frame"], ["width", "Frame width, scroll down"],
    ["scale", "Whole panel, scaled to the frame"], ["natural", "Its own size, scroll"],
];

// the part to show: what the person chose, else the profile, else the first panel of the node, else the mirror
export function partOf(node, chosen) { return chosen || defaultPart(node, autoPart); }
export function fitOf(node, chosen) {
    if (chosen && chosen !== "auto") return chosen;
    return profileOf(node)?.fit || "fill";
}
// the size the panel asks for, for the inspector and the «Fit the frame» button
export function askedSize(node, part) {
    const d = findDom(node, part);
    if (!d) return null;
    const p = prefSize(node, d, profileOf(node));
    return { w: Math.round(p.w), h: Math.round(p.h), from: p.from };
}
export const COLOR_MODES = [["comfy", "Theme variables of ComfyUI"], ["off", "The panel's own colours"], ["recolor", "Recolour to the theme (experiment)"]];
export const partList = (node) => domWidgets(node).map((d) => d.name);

export const nodeembed = {
    type: "nodeembed", label: "Node Embed", icon: "plug", group: "Inputs", fill: true, noLabel: false,
    slots: [{ id: "node", label: "Node", data: "anynode", accepts: ["*"], required: true, watch: stampOf }],
    size: { w: 420, h: 360, minW: 80, minH: 60 },
    props: [
        { id: "fit", kind: "select", label: "Fit", def: "auto", options: FIT_MODES },
        { id: "zoom", kind: "int", label: "Zoom, %", def: null, min: 25, max: 400, placeholder: "100" },
        { id: "title", kind: "bool", label: "Show the node title (mirror)", def: false },
        { id: "colors", kind: "select", label: "Colours", def: "comfy", options: COLOR_MODES },
        { id: "css", kind: "textarea", label: "Own CSS (works only inside this frame)", def: "" },
        { id: "spell", kind: "bool", label: "Check spelling", def: true, hint: "The spelling check of the browser in the text fields of the panel." },
        { id: "weights", kind: "bool", label: "Ctrl+Up / Down changes the weight", def: true, hint: "In the text fields of the panel: select a word or a phrase and press Ctrl+Up or Ctrl+Down, as in the text fields of ComfyUI." },
        { id: "interact", kind: "bool", label: "Can be used", def: true },
        { id: "placeholder", kind: "bool", label: "Mark the empty place in the node", def: true },
    ],
    // the extra part of the inspector (the part to show, its size, buttons); H = helpers of the inspector
    inspect(E, w, b, H) {
        const { tr, el: mk, row, btn, selectInput } = H;
        const entry = w.slots?.node ? H.sourceOf(E.ui, w.slots.node.src) : null;
        const node = entry ? H.findSource(entry) : null;
        if (!node) { b.append(mk("div", "nde-note", tr("Bind a node first. Its own interface will appear here."))); return; }
        const names = partList(node);
        const cur = w.props.part || "";
        b.append(row(tr("Part"), selectInput([["", tr("Automatic")], ...names.map((n) => [n, n]), ["@mirror", tr("Whole node (live mirror)")]], cur, (v) => E.change(null, () => { w.props.part = v; }, { inspector: false })), tr("Which panel of the node to show")));
        const shown = partOf(node, cur);
        const ask = shown && shown !== "@mirror" ? askedSize(node, shown) : null;
        b.append(mk("div", "nde-note", shown === "@mirror" ? tr("A live mirror of the node: its controls work as in the graph.") : ask ? tr("Asks for {w}×{h}", { w: ask.w, h: ask.h }) : names.length ? tr("This part has no panel.") : tr("This node draws its controls on the canvas, it has no panel to show.")));
        if (ask) {
            const z = Math.max(25, Number(w.props.zoom) || 100) / 100;
            b.append(btn(tr("Fit the frame to the panel"), "fit", () => E.change(null, () => { w.w = Math.max(8, Math.round(ask.w * z)); w.h = Math.max(8, Math.round(ask.h * z)); }), "", tr("Make the frame as big as the panel asks for")));
        }
        b.append(btn(tr("Make ND widgets for its parameters"), "plus", () => E.embedParams(w), "", tr("Create an ND widget for every parameter of the node")));
    },
    mount(ctx) {
        const area = el("div", "ndk-emb"), box = el("div", "ndk-emb-box");
        area.append(box);
        const card = el("div", "ndk-emb-card"), other = el("div", "ndk-emb-other");
        card.style.display = "none"; other.style.display = "none";
        ctx.body.append(area, card, other);
        const fitter = new Fitter(area, box), part = new DomPart(box);
        part.onRestore = (e) => fitter.restore(e);
        part.onChange = (what) => { if (what === "gaveup") showOther(ctx.tr("ComfyUI keeps this panel. Open the graph to see it.")); };
        const unguard = guardHost(area, { editor: ctx.kind() === "editor", spell: () => ctx.prop("spell") !== false, weights: () => ctx.prop("weights") !== false });
        const theme = new EmbedTheme(area); let themeTick = 0;
        const mh = el("div", "ndk-emb-mir"), layer = el("div", "ndk-emb-layer");
        mh.append(layer); mh.style.display = "none"; area.append(mh);
        let mir = null; const hy = new Map();   // hy: name -> {box, part, cl}
        let frame = { w: 0, h: 0 }, cl = null, key = "", node = null, name = "", hiddenSince = 0, prefKey = "", dead = false;

        const hideAll = () => { card.style.display = "none"; other.style.display = "none"; };
        const showCard = (title, sub, ic = "plug") => {
            card.replaceChildren(icon(ic, 26), el("div", "t", title), ...(sub ? [el("div", "s", sub)] : []));
            card.style.display = ""; other.style.display = "none"; area.style.visibility = "hidden";
        };
        function showOther(text) {
            other.replaceChildren(el("div", "", text));
            if (cl && !isOwner(cl)) { const b = el("button", "", ctx.tr("Show here")); b.type = "button"; b.addEventListener("click", () => boost(cl)); other.append(b); }
            other.style.display = ""; card.style.display = "none"; area.style.visibility = "hidden";
        }
        const prio = () => PRIO[ctx.kind()] || 1;
        const live = () => !ctx.isEditing() && !!node && !!name && name !== "@mirror" && !!findDom(node, name);
        const mirrorLive = () => !ctx.isEditing() && !!node && name === "@mirror";
        const visibleNow = () => {
            if (ctx.visible()) { hiddenSince = 0; return true; }
            hiddenSince = hiddenSince || performance.now();
            return performance.now() - hiddenSince < 300;
        };
        const mirFit = () => { const f = ctx.prop("fit"); const v = f && f !== "auto" ? f : profileOf(node)?.fit || "width"; return v === "scale" ? "fill" : v; };

        // ---- the mirror and the DOM parts laid over it (a part of a node that has both)
        function placeHybrid() {
            if (!mir || !node) return;
            const k = mir.k, title = ctx.prop("title") === true, th = title ? (globalThis.LiteGraph?.NODE_TITLE_HEIGHT || 30) : 0;
            for (const [nm, h] of hy) {
                const d = findDom(node, nm);
                if (!d) continue;
                const hh = Number(d.widget.computedHeight) || Number(d.widget.last_h) || Number(d.element.offsetHeight) || 32;
                const b = h.box.style;
                // CSS zoom scales the box's own lengths too, so top / width / height are in unzoomed units
                b.left = "0px"; b.top = `${(d.widget.y || 0) + th + 4}px`;
                b.width = `${node.size[0]}px`; b.height = `${hh}px`; b.zoom = k === 1 ? "" : String(k);
            }
        }
        function syncHybrid() {
            if (!mirrorLive() || !mir) return dropHybrid();
            const names = new Set(domWidgets(node).filter((d) => !d.widget.hidden && !d.widget.options?.hidden && d.element.style.display !== "none").map((d) => d.name));
            for (const nm of names) {
                if (hy.has(nm)) continue;
                const hb = el("div", "ndk-emb-hbox"), hp = new DomPart(hb);
                layer.append(hb);
                const h = { box: hb, part: hp, cl: null, name: nm };
                hy.set(nm, h);
                h.cl = claim(`${node.id}:${nm}`, {
                    prio: prio(), want: () => mirrorLive() && visibleNow(),
                    grant() { hp.attach(node, nm, { placeholder: ctx.prop("placeholder") !== false }); placeHybrid(); },
                    revoke() { hp.detach(true); },
                });
            }
            for (const [nm, h] of [...hy]) if (!names.has(nm)) dropOne(nm, h);
        }
        function dropOne(nm, h) { release(h.cl); h.part.detach(true); h.box.remove(); hy.delete(nm); }
        function dropHybrid() { for (const [nm, h] of [...hy]) dropOne(nm, h); }
        function stopMirror() {
            dropHybrid();
            if (mir) { mir.destroy(); mir = null; }
            mh.style.display = "none"; box.style.display = "";
        }
        function layoutMirror() {
            if (!mir) return;
            const w = frame.w || ctx.body.clientWidth, h = frame.h || ctx.body.clientHeight;
            if (w && h) mir.layout(w, h, mirFit(), ctx.prop("zoom"));
        }
        function startMirror() {
            setClaim("");
            fitter.reset(null);
            if (mir && (mir.node !== node || mir.title !== (ctx.prop("title") === true))) stopMirror();
            if (!mir) { mir = new Mirror(mh, node, { title: ctx.prop("title") === true }); mir.onLayout = placeHybrid; }
            mh.style.display = ""; box.style.display = "none";
            area.style.visibility = ""; hideAll();
            area.style.overflow = "hidden";
            layoutMirror(); syncHybrid();
        }
        const wantNow = () => live() && visibleNow();

        function layout() {
            if (!part.attached) return;
            const d = findDom(node, name);
            if (!d) return;
            const prof = profileOf(node);
            const w = frame.w || ctx.body.clientWidth, h = frame.h || ctx.body.clientHeight;
            if (!w || !h) return;
            const pref = prefSize(node, d, prof);
            fitter.apply(d.element, pref, w, h, { fit: fitOf(node, ctx.prop("fit")), zoom: ctx.prop("zoom") });
            prefKey = `${pref.w}x${pref.h}`;
            theme.recolor();
        }

        function setClaim(k) {
            if (cl) { release(cl); cl = null; }
            key = k;
            if (!k) return;
            cl = claim(k, {
                prio: prio(),
                want: wantNow,
                grant() {
                    if (!part.attach(node, name, { placeholder: ctx.prop("placeholder") !== false })) { showOther(ctx.tr("The panel is not there")); return; }
                    hideAll(); area.style.visibility = "";
                    layout();
                },
                revoke(why) {
                    part.detach(true);
                    fitter.reset(null);
                    if (why === "taken" && !dead) showOther(ctx.tr("Shown in another view"));
                    else if (!dead) { hideAll(); area.style.visibility = "hidden"; }
                },
            });
        }

        // looks at the binding and the mode and brings the claim in step
        function render() {
            if (dead) return;
            const st = ctx.info("node");
            node = st.bound && !st.lost ? st.node : null;
            const chosen = ctx.prop("part") || "";
            name = node ? partOf(node, chosen) : "";
            area.classList.toggle("noint", ctx.prop("interact") === false);
            theme.set({ mode: ctx.prop("colors"), css: ctx.prop("css"), node });
            const editing = ctx.isEditing();
            if (!node) {
                stopMirror(); setClaim("");
                if (editing) showCard(ctx.tr("Node Embed"), ctx.tr(st.lost ? "The node is gone. Bind it again." : "Choose a node in the inspector. Its own interface will be shown here."));
                else { hideAll(); area.style.visibility = "hidden"; }
                return;
            }
            const isMirror = name === "@mirror";
            if (!isMirror && !findDom(node, name)) {
                stopMirror(); setClaim("");
                showCard(node.title || node.type, ctx.tr("The node has no panel «{name}».", { name }));
                return;
            }
            if (editing) {
                stopMirror(); setClaim("");
                const a = isMirror ? null : askedSize(node, name);
                showCard(node.title || node.type, `${isMirror ? ctx.tr("Whole node (live mirror)") : name}${a ? ` · ${a.w}×${a.h}` : ""}\n${ctx.tr("Shown live in the preview and in ND UI mode.")}`);
                card.querySelector(".s").style.whiteSpace = "pre-line";
                return;
            }
            if (isMirror) { startMirror(); return; }
            stopMirror();
            const k = `${node.id}:${name}`;
            if (k !== key || !cl) setClaim(k);
            reconcile(key);
            if (isOwner(cl)) { const r = part.check(); if (r === "swapped") layout(); else if (r === "gone") hideAll(); }
            else if (wantNow()) showOther(ctx.tr("Shown in another view"));
        }

        const timer = setInterval(() => {
            if (dead) return;
            try {
                if (++themeTick % 8 === 0) theme.recolor();
                if (mir) {
                    mir.setRunning(ctx.visible());
                    mir.tick(); syncHybrid(); placeHybrid();
                    for (const h of hy.values()) {
                        reconcile(h.cl.key);
                        if (isOwner(h.cl)) { const r = h.part.check(); if (r === "swapped") placeHybrid(); if (!h.part.attached) { h.part.attach(node, h.name, {}); placeHybrid(); } }
                    }
                }
                if (cl) reconcile(key);
                if (cl && isOwner(cl) && part.attached) {
                    const r = part.check();
                    if (r === "swapped") layout();
                    else if (r === "same" && node && name) { const d = findDom(node, name); if (d) { const p = prefSize(node, d, profileOf(node)); if (`${p.w}x${p.h}` !== prefKey) layout(); } }
                    if (part.gaveUp) showOther(ctx.tr("ComfyUI keeps this panel. Open the graph to see it."));
                } else if (cl && isOwner(cl) && !part.attached) {
                    if (part.attach(node, name, { placeholder: ctx.prop("placeholder") !== false })) { hideAll(); area.style.visibility = ""; layout(); }
                }
            } catch (e) { console.warn("[ND UI] embed tick failed", e); }
        }, 250);

        render();
        return {
            update: render,
            resize(w, h) { frame = { w, h }; layout(); layoutMirror(); },
            destroy() {
                dead = true;
                clearInterval(timer);
                if (cl) { release(cl); cl = null; }
                part.detach(true);
                stopMirror();
                unguard();
                theme.destroy();
            },
        };
    },
};
