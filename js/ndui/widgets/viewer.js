// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widget — Viewer: the results, the live preview and the comparison of pictures in one widget.
//   parts (props live / results / compare) say what is in it; the presets of the library (Result, Live Preview, Compare) are the same widget with other parts.
//   live     frames of the sampler while it works: from a node (KSampler...) or from an ND UI Live Bridge; the eye turns them off.
//   results  the pictures of a node, thumbnails of the earlier runs of the session, Save, and pulling a picture out of the page.
//   compare  picture A and picture B (wipe or side by side): from the results, the run before, a node, a file name or the thumbnails.
import { el, icon } from "./util.js";
import { events, forNode, latestAny, viewUrl, bridgeFor, bridgeHasAudio, anyBridgeAudio } from "../events.js";
import { openLightbox } from "./media.js";
import { makeDraggable, downloadRef, downloadUrl, refFromName } from "../media/io.js";
import { registerViewer } from "../live_mark.js";
import { activityLayer, BUSY_PROPS, busyOf } from "./activity.js";

const urlOf = (r) => (typeof r === "string" ? r : viewUrl(r));
const SRC_OPTIONS = [["result", "The newest result"], ["previous", "The run before"], ["pick", "A thumbnail I choose"], ["node", "A node"], ["file", "A file name"]];

// the pictures of the "Results of" slot: of its node, or the newest of any node when it is not bound
function source(ctx) {
    const st = ctx.info("images");
    if (st.bound && st.node) return { ...forNode(st.node), node: st.node, bound: true };
    if (st.bound) return { images: [], history: [], live: null, bound: true, lost: true };
    const any = latestAny("images");
    return { images: any.images, history: any.history, live: null, bound: false };
}
const runsOf = (s) => (s.history.length ? s.history : s.images.length ? [s.images] : []);

function emptyBox(icn, text) {
    const e = el("div", "ndk-media-empty"); e.append(icon(icn, 32), el("div", "", text));
    return e;
}
const pillBtn = (ic, title, fn, cls = "") => {
    const b = el("button", cls); b.type = "button"; b.title = title; b.append(icon(ic, 16));
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
};

export const viewer = {
    type: "viewer", label: "Viewer", icon: "gallery", group: "Results", live: true, fill: true,
    slots: [
        { id: "live", label: "Frames of", data: "live", required: false, when: (p) => p.live === true },
        { id: "images", label: "Results of", data: "images", required: false, when: (p) => p.results !== false || p.compare === true },
        { id: "a", label: "Picture A", data: "images", required: false, when: (p) => p.compare === true && p.srcA === "node" },
        { id: "fileA", label: "File of picture A", accepts: ["COMBO"], required: false, when: (p) => p.compare === true && p.srcA === "file" },
        { id: "b", label: "Picture B", data: "images", required: false, when: (p) => p.compare === true && p.srcB === "node" },
        { id: "fileB", label: "File of picture B", accepts: ["COMBO"], required: false, when: (p) => p.compare === true && p.srcB === "file" },
    ],
    size: { w: 520, h: 520, minW: 140, minH: 120 },
    presets: [
        { id: "viewer", label: "Viewer", icon: "gallery", props: { live: true, results: true, compare: true, progress: "line" } },
        { id: "result", label: "Result", icon: "image", props: { live: false, results: true, compare: false, progress: "off" } },
        { id: "livepreview", label: "Live Preview", icon: "live", props: { live: true, results: true, compare: false, thumbs: "off", progress: "line" } },
        { id: "compare", label: "Compare", icon: "compare", props: { live: false, results: false, compare: true, progress: "off" } },
    ],
    props: [
        { id: "live", kind: "bool", label: "Live preview", def: false, hint: "Shows the frames of the sampler while it works. The eye on the widget turns them off." },
        { id: "results", kind: "bool", label: "Results", def: true },
        { id: "compare", kind: "bool", label: "Compare", def: false },
        { id: "progress", kind: "select", label: "Progress", def: "line", options: [["line", "A line at the bottom"], ["steps", "Steps (12 / 30)"], ["both", "Line and steps"], ["off", "Off"]], when: (p) => p.live === true || p.progress !== "off" },
        { id: "sound", kind: "bool", label: "Sound of the live preview", def: false, when: (p) => p.live === true, hint: "Plays the sound of the live clip. The bridge needs preview \"animated\" and an audio VAE. The speaker button on the widget turns it on and off." },
        { id: "volume", kind: "int", label: "Volume, %", def: 70, min: 0, max: 100, when: (p) => p.live === true },
        { id: "muteComfy", kind: "bool", label: "Silence the preview of ComfyUI", def: false, when: (p) => p.live === true, hint: "While this viewer shows frames of an ND UI Live Bridge, the sampler's own preview (on the node) is switched off for the run." },
        { id: "thumbs", kind: "select", label: "Thumbnails", def: "bottom", options: [["bottom", "Below"], ["right", "On the right"], ["off", "Off"]], when: (p) => p.results !== false || p.compare === true },
        { id: "save", kind: "bool", label: "Save button", def: true, hint: "Downloads the picture. A picture can also be pulled out of the page onto the desktop or an image input." },
        { id: "tools", kind: "bool", label: "Buttons on the picture", def: true },
        ...BUSY_PROPS,
        { id: "cmpMode", kind: "select", label: "Comparison", def: "wipe", options: [["wipe", "Wipe (a slider)"], ["side", "Side by side"]], when: (p) => p.compare === true },
        { id: "srcA", kind: "select", label: "Picture A comes from", def: "previous", options: SRC_OPTIONS, when: (p) => p.compare === true },
        { id: "srcB", kind: "select", label: "Picture B comes from", def: "result", options: SRC_OPTIONS, when: (p) => p.compare === true },
        { id: "labelA", kind: "text", label: "Name of A", def: "A", when: (p) => p.compare === true },
        { id: "labelB", kind: "text", label: "Name of B", def: "B", when: (p) => p.compare === true },
    ],
    mount(ctx) {
        const wrap = el("div", "ndk-media ndk-viewer");
        const stage = el("div", "ndk-media-main");
        const resView = el("div", "ndk-vw-layer"), cmpView = el("div", "ndk-vw-layer");
        const liveImg = el("img", "ndk-vw-live"); liveImg.alt = ""; liveImg.draggable = false; liveImg.style.display = "none";
        // a live clip (MP4, may carry the sound): two players take turns so that a new clip replaces the old one without a blink
        const vids = [0, 1].map(() => { const v = document.createElement("video"); v.className = "ndk-vw-live vid"; v.loop = true; v.muted = true; v.playsInline = true; v.autoplay = false; v.draggable = false; v.style.display = "none"; return v; });
        let front = 0, clipUrl = "";
        const emptyEl = el("div", "ndk-vw-layer");
        const badge = el("div", "ndk-live-badge"); badge.append(el("i"), document.createTextNode("LIVE")); badge.style.display = "none";
        const stepEl = el("div", "ndk-vw-step"); stepEl.style.display = "none";
        const bar = el("div", "ndk-live-bar"), barFill = el("i"); bar.append(barFill);
        const hintEl = el("div", "ndk-vw-hint"); hintEl.style.display = "none";
        let busyL = null;
        const tools = el("div", "ndk-media-tools ndk-vw-tools");
        const tabs = el("div", "ndk-vw-tabs");
        const strip = el("div", "ndk-media-strip");
        stage.append(resView, cmpView, liveImg, vids[0], vids[1], emptyEl, badge, stepEl, hintEl, bar, tabs, tools);
        wrap.append(stage, strip);
        ctx.body.append(wrap);
        liveImg.addEventListener("click", () => { if (liveImg.src) openLightbox(ctx, [{ url: liveImg.src, name: "preview" }], 0); });

        const P = () => ({
            live: ctx.prop("live") === true, results: ctx.prop("results") !== false, compare: ctx.prop("compare") === true,
            progress: ctx.prop("progress") || "line", thumbs: ctx.prop("thumbs") || "bottom", save: ctx.prop("save") !== false, tools: ctx.prop("tools") !== false,
            cmpMode: ctx.prop("cmpMode") || "wipe", srcA: ctx.prop("srcA") || "previous", srcB: ctx.prop("srcB") || "result",
            labelA: ctx.prop("labelA") ?? "A", labelB: ctx.prop("labelB") ?? "B", mute: ctx.prop("muteComfy") === true,
        });
        const eyeOn = () => ctx.prop("liveOn") !== false;
        // the speaker and the volume exist only when an audio VAE is wired to the bridge
        const hasAudio = () => { const ls = ctx.info("live"); if (ls.bound) return !!ls.node && bridgeHasAudio(bridgeFor(ls.node)); return anyBridgeAudio(); };
        const soundOn = () => ctx.prop("sound") === true && hasAudio();
        const volume = () => Math.max(0, Math.min(100, Number(ctx.prop("volume") ?? 70))) / 100;
        const applySound = () => { for (const v of vids) { v.volume = volume(); v.muted = !soundOn(); } };
        const playing = (v) => { const r = v.play?.(); r?.catch?.(() => { v.muted = true; v.play?.().catch?.(() => {}); }); };   // the browser may refuse sound before a click
        const showClip = (url) => {
            if (url === clipUrl) return;
            clipUrl = url;
            const back = vids[1 - front], old = vids[front];
            const swap = () => { back.removeEventListener("canplay", swap); if (clipUrl !== url) return; applySound(); back.style.display = ""; if (events.run.active) playing(back); old.style.display = "none"; old.pause(); front = 1 - front; };
            back.addEventListener("canplay", swap);
            back.src = url; back.load();
        };
        const stopClips = () => { if (!clipUrl) return; clipUrl = ""; for (const v of vids) { v.pause(); v.style.display = "none"; v.removeAttribute("src"); v.load(); } };

        // the live preview needs a bridge to be marked in the prompt (see live_mark.js)
        const unregister = registerViewer({
            el: wrap,
            wants: () => P().live && eyeOn(),
            bridge: () => { const s = ctx.info("live"); return s.bound && s.node ? bridgeFor(s.node) : null; },
            mute: () => P().mute,
            sound: () => soundOn(),
        });

        let picked = -1, tab = "results", lastFrame = "";
        const picks = { a: null, b: null };
        let keys = { res: "", cmp: "", strip: "", tools: "", tabs: "" };

        const frameOf = () => {
            const ls = ctx.info("live");
            if (ls.bound && ls.node) return forNode(ls.node).live;
            if (!ls.bound) return events.liveAny;
            return null;
        };
        const mode = (p) => {
            if (!p.compare) return "results";
            if (!p.results && !p.live) return "compare";
            return tab === "compare" ? "compare" : "results";
        };

        /* ------------------------------------------------ compare */
        const cmpRef = (side, p, s, runs) => {
            const how = side === "a" ? p.srcA : p.srcB;
            if (how === "result") return runs[0]?.[0] || null;
            if (how === "previous") return runs[1]?.[0] || null;
            if (how === "pick") return picks[side];
            if (how === "node") { const st = ctx.info(side); return st.bound && st.node ? forNode(st.node).images[0] || null : null; }
            if (how === "file") { const v = ctx.get(side === "a" ? "fileA" : "fileB"); return v ? refFromName(v) : null; }
            return null;
        };
        const buildCompare = (a, b, p) => {
            cmpView.textContent = "";
            if (!a && !b) { cmpView.append(emptyBox("compare", ctx.tr("Choose where picture A and picture B come from"))); return; }
            const mk = (r, cls) => { const im = el("img", cls); im.alt = ""; im.draggable = false; if (r) im.src = urlOf(r); else im.style.visibility = "hidden"; return im; };
            if (p.cmpMode === "side") {
                const g = el("div", "ndk-vw-side");
                for (const [r, name] of [[a, p.labelA], [b, p.labelB]]) {
                    const cell = el("div", "cell"); cell.append(mk(r), el("div", "tag", name));
                    if (r) cell.querySelector("img").addEventListener("click", () => openLightbox(ctx, [{ url: urlOf(r), name: r.filename }], 0));
                    g.append(cell);
                }
                cmpView.append(g);
                return;
            }
            const box = el("div", "ndk-cmp"); box.style.border = "0";
            const under = mk(b), top = mk(a, "top"), bar2 = el("div", "bar");
            const ta = el("div", "tag a", p.labelA), tb = el("div", "tag b", p.labelB);
            box.append(under, top, bar2, ta, tb);
            const set = (v) => { const q = Math.max(0, Math.min(1, v)); top.style.clipPath = `inset(0 ${(1 - q) * 100}% 0 0)`; bar2.style.left = `${q * 100}%`; };
            set(0.5);
            box.addEventListener("pointerdown", (e) => {
                box.setPointerCapture(e.pointerId);
                const mv = (ev) => { const r = box.getBoundingClientRect(); set((ev.clientX - r.left) / r.width); };
                mv(e);
                const up = (ev) => { box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); try { box.releasePointerCapture(ev.pointerId); } catch {} };
                box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up);
            });
            cmpView.append(box);
        };

        /* ------------------------------------------------ results */
        const buildResults = (set, s, p) => {
            resView.textContent = "";
            if (!set.length) { resView.append(emptyBox("image", s.lost ? ctx.tr("The node is gone. Bind it again.") : p.live ? ctx.tr("The picture appears here while the sampler works") : ctx.tr("No results yet"))); return; }
            const open = (idx) => openLightbox(ctx, set.map((r) => ({ url: urlOf(r), name: r.filename })), idx);
            const img = (r, n) => { const im = el("img"); im.src = urlOf(r); im.alt = ""; im.addEventListener("click", () => open(n)); makeDraggable(im, () => r); return im; };
            if (set.length === 1) resView.append(img(set[0], 0));
            else {
                const cols = Math.ceil(Math.sqrt(set.length));
                const g = el("div", "ndk-media-grid"); g.style.gridTemplateColumns = `repeat(${cols},1fr)`;
                set.forEach((r, n) => { const im = img(r, n); im.style.cursor = "zoom-in"; g.append(im); });
                resView.append(g);
            }
        };

        /* ------------------------------------------------ one pass */
        const render = () => {
            const p = P(), s = source(ctx), runs = runsOf(s);
            wrap.classList.toggle("right", p.thumbs === "right");
            const m = mode(p);
            if (picked >= runs.length) picked = -1;
            const set = picked >= 0 ? runs[picked] : runs[0] || [];

            // what the live layer shows
            const frame = p.live && eyeOn() ? frameOf() : null;
            const run = events.run.active;
            const liveNow = !!frame && run;
            if (frame?.url) lastFrame = frame.url;
            const showLiveImg = m === "results" && !!frame && (liveNow || !set.length);

            // the results and the comparison
            const rkey = m === "results" ? set.map((r) => r.rand ?? r.filename).join("|") + "|" + (s.lost ? "L" : "") + (p.live ? "l" : "") : "";
            if (rkey !== keys.res) { keys.res = rkey; if (m === "results") buildResults(set, s, p); }
            resView.style.display = m === "results" && !showLiveImg ? "" : "none";
            let a = null, b = null;
            if (m === "compare") {
                a = cmpRef("a", p, s, runs); b = cmpRef("b", p, s, runs);
                const ck = [a && urlOf(a), b && urlOf(b), p.cmpMode, p.labelA, p.labelB].join("|");
                if (ck !== keys.cmp) { keys.cmp = ck; buildCompare(a, b, p); }
            } else keys.cmp = "";
            cmpView.style.display = m === "compare" ? "" : "none";
            const clip = showLiveImg && frame.kind === "video" && /^video\//.test(frame.mime || "");   // an animated WebP plays in the picture
            if (showLiveImg && !clip) { if (liveImg.dataset.src !== frame.url) { liveImg.dataset.src = frame.url; liveImg.src = frame.url; } }
            liveImg.style.display = showLiveImg && !clip ? "" : "none";
            if (clip) { showClip(frame.url); applySound(); for (const v of vids) { if (v.style.display === "none" || !events.run.active) v.pause(); else if (v.paused && v.readyState > 2) playing(v); } } else stopClips();
            emptyEl.style.display = "none";

            // the badge and the progress
            badge.style.display = liveNow && showLiveImg ? "" : "none";
            const stepsInfo = frame?.steps ? [frame.step, frame.steps] : events.run.max ? [events.run.value, events.run.max] : null;
            const pct = stepsInfo ? Math.min(1, stepsInfo[0] / stepsInfo[1]) : 0;
            const wantBar = run && (p.progress === "line" || p.progress === "both"), wantSteps = run && (p.progress === "steps" || p.progress === "both") && !!stepsInfo;
            bar.style.display = wantBar ? "" : "none"; barFill.style.width = `${pct * 100}%`;
            stepEl.style.display = wantSteps ? "" : "none";
            if (wantSteps) stepEl.textContent = `${stepsInfo[0]} / ${stepsInfo[1]}`;

            // a run that is going and no frame comes: say why it can be
            const ls0 = ctx.info("live");
            const stalled = m === "results" && p.live && eyeOn() && run && !frame && events.run.startedAt && Date.now() - events.run.startedAt > 5000;
            hintEl.style.display = stalled ? "" : "none";
            if (stalled) hintEl.textContent = ls0.bound && ls0.node && bridgeFor(ls0.node) === ls0.node
                ? ctx.tr("The bridge sends no frames. Press F12 and look for [ND UI Live] in the console of ComfyUI.")
                : ctx.tr("ComfyUI sends no preview for this sampler. Put an ND UI Live Bridge on the model wire in front of it.");

            // the animation of waiting: a run goes and no live frame is shown
            const busy = busyOf(ctx);
            const wantBusy = busy.on && run && !showLiveImg && m === "results";
            if (wantBusy && !busyL) { busyL = activityLayer(busy.style, busy.mark, busy.text); busyL.el.classList.add("layer"); stage.insertBefore(busyL.el, badge); }
            if (busyL) {
                busyL.el.style.display = wantBusy ? "" : "none";
                if (wantBusy) { busyL.setStyle(busy.style); busyL.setMark(busy.mark, busy.text); busyL.update({ pct: busy.bar ? pct : 0, text: stepsInfo && busy.steps ? `${stepsInfo[0]} / ${stepsInfo[1]}` : "" }); }
            }

            // tabs (Results | Compare) and the buttons
            const tk = `${p.compare && (p.results || p.live) ? 1 : 0}|${m}|${p.live ? 1 : 0}|${eyeOn() ? 1 : 0}`;
            if (tk !== keys.tabs) {
                keys.tabs = tk; tabs.textContent = "";
                if (p.compare && (p.results || p.live)) {
                    for (const [id, ic, title] of [["results", "image", ctx.tr("Results")], ["compare", "compare", ctx.tr("Compare")]]) {
                        const b2 = el("button", m === id ? "on" : ""); b2.type = "button"; b2.title = title; b2.append(icon(ic, 14));
                        b2.addEventListener("click", (e) => { e.stopPropagation(); tab = id; keys.res = ""; keys.cmp = ""; keys.strip = ""; keys.tabs = ""; keys.tools = ""; render(); });
                        tabs.append(b2);
                    }
                }
            }
            tabs.style.display = tabs.childElementCount ? "" : "none";

            const toolKey = [m, set.map((r) => r.filename).join(","), p.save, p.tools, p.live, eyeOn(), showLiveImg ? 1 : 0, hasAudio() ? 1 : 0, soundOn() ? 1 : 0].join("|");
            if (toolKey !== keys.tools) {
                keys.tools = toolKey; tools.textContent = "";
                if (p.live && hasAudio()) {
                    tools.append(pillBtn(soundOn() ? "speaker" : "speakerOff", ctx.tr(soundOn() ? "Turn the sound of the live preview off" : "Turn the sound of the live preview on"), () => { ctx.setProp("sound", !(ctx.prop("sound") === true)); applySound(); keys.tools = ""; render(); }, "snd"));
                    if (soundOn()) {
                        const vol = el("input", "ndk-vw-vol"); vol.type = "range"; vol.min = "0"; vol.max = "100"; vol.step = "1"; vol.value = String(Math.round(volume() * 100)); vol.title = ctx.tr("Volume");
                        vol.addEventListener("input", () => { ctx.setProp("volume", Number(vol.value)); applySound(); });
                        vol.addEventListener("click", (e) => e.stopPropagation()); vol.addEventListener("pointerdown", (e) => e.stopPropagation());
                        tools.append(vol);
                    }
                }
                if (p.live) tools.append(pillBtn(eyeOn() ? "eye" : "eyeOff", ctx.tr(eyeOn() ? "Hide the live preview" : "Show the live preview"), () => { ctx.setProp("liveOn", !eyeOn()); keys.tools = ""; keys.tabs = ""; render(); }, "eye"));
                if (m === "results" && (set.length || showLiveImg)) {
                    if (p.save) tools.append(pillBtn("download", ctx.tr("Save"), () => {
                        if (showLiveImg && !set.length) downloadUrl(frame.url, "preview.jpg");
                        else for (const r of set) downloadRef(r);
                    }, "save"));
                    if (p.tools) {
                        const items = () => (showLiveImg ? [{ url: frame.url, name: "preview" }] : set.map((r) => ({ url: urlOf(r), name: r.filename })));
                        tools.append(
                            pillBtn("external", ctx.tr("Open in a new tab"), () => { const it = items()[0]; if (it) window.open(it.url, "_blank"); }),
                            pillBtn("expand", ctx.tr("Full size"), () => openLightbox(ctx, items(), 0)),
                        );
                    }
                }
            }
            tools.classList.toggle("keep", p.live && !eyeOn());

            // the thumbnails of the earlier runs
            const usesPick = m === "compare" && (p.srcA === "pick" || p.srcB === "pick");
            const showStrip = p.thumbs !== "off" && (p.results || p.compare) && (runs.length > 1 || (usesPick && runs.length >= 1));
            strip.style.display = showStrip ? "" : "none";
            const sk = showStrip ? runs.map((r) => r[0]?.rand ?? r[0]?.filename).join("|") + "|" + picked + "|" + (usesPick ? "p" + (picks.a?.filename || "") + (picks.b?.filename || "") : "") + "|" + m : "";
            if (sk !== keys.strip) {
                keys.strip = sk; strip.textContent = "";
                if (showStrip) runs.forEach((r, n) => {
                    const cell = el("div", "cell" + (m === "results" && n === (picked < 0 ? 0 : picked) ? " on" : ""));
                    const bt = el("button"); bt.type = "button"; bt.title = r[0]?.filename || "";
                    const im = el("img"); im.src = urlOf(r[0]); im.alt = ""; im.loading = "lazy";
                    bt.append(im); makeDraggable(bt, () => r[0]);
                    bt.addEventListener("click", () => { picked = n === 0 ? -1 : n; if (m === "compare" && usesPick) return; keys.res = ""; keys.strip = ""; render(); });
                    cell.append(bt);
                    if (usesPick) {
                        const ab = el("span", "ab");
                        for (const side of ["a", "b"]) {
                            if ((side === "a" ? p.srcA : p.srcB) !== "pick") continue;
                            const x = el("i", picks[side]?.filename === r[0]?.filename && picks[side]?.rand === r[0]?.rand ? "on" : "", side.toUpperCase());
                            x.title = ctx.tr(side === "a" ? "Use as picture A" : "Use as picture B");
                            x.addEventListener("click", (e) => { e.stopPropagation(); picks[side] = r[0]; keys.strip = ""; keys.cmp = ""; render(); });
                            ab.append(x);
                        }
                        cell.append(ab);
                    }
                    strip.append(cell);
                });
            }
        };
        render();
        return { update: render, destroy() { unregister(); } };
    },
};
