// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the live layer of the Video Player: the frames of a sampler (or of an ND UI Live Bridge) over the player while a run goes.
// It works as the live part of the Viewer: a picture or an animated WebP in <img>, a clip (MP4, may carry the sound) in two <video> that take turns,
// the LIVE badge, the progress, the eye, the speaker and the volume. The player below shows the result when the run is over.
import { el, icon } from "./util.js";
import { events, forNode, bridgeFor, bridgeHasAudio, anyBridgeAudio } from "../events.js";
import { registerViewer } from "../live_mark.js";
import { activityLayer, BUSY_PROPS, busyOf } from "./activity.js";

// the settings of the live preview: the same names and meaning as in the Viewer (the Result widget)
export const LIVE_PROPS = [
    { id: "live", kind: "bool", label: "Live preview", def: false, hint: "Shows the frames of the sampler while it works. The eye on the widget turns them off." },
    { id: "progress", kind: "select", label: "Progress", def: "line", options: [["line", "A line at the bottom"], ["steps", "Steps (12 / 30)"], ["both", "Line and steps"], ["off", "Off"]], when: (p) => p.live === true },
    { id: "sound", kind: "bool", label: "Sound of the live preview", def: false, when: (p) => p.live === true, hint: "Plays the sound of the live clip. The bridge needs preview \"animated\" and an audio VAE. The speaker button on the widget turns it on and off." },
    { id: "volume", kind: "int", label: "Volume, %", def: 70, min: 0, max: 100, when: (p) => p.live === true },
    ...BUSY_PROPS,
    { id: "muteComfy", kind: "bool", label: "Silence the preview of ComfyUI", def: false, when: (p) => p.live === true, hint: "While this widget shows frames of an ND UI Live Bridge, the sampler's own preview (on the node) is switched off for the run." },
];
export const LIVE_SLOT = { id: "live", label: "Frames of", data: "live", required: false, when: (p) => p.live === true };

const pill = (ic, title, fn, cls = "") => {
    const b = el("button", cls); b.type = "button"; b.title = title; b.append(icon(ic, 16));
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
};

// ctx: the widget context; root: the element the layer lies over (it must be positioned); hasResult(): a finished video is there
export function liveLayer(ctx, root, wrapForMark, hasResult) {
    const layer = el("div", "ndk-media-main ndk-pwl"); layer.style.display = "none";
    const img = el("img", "ndk-vw-live"); img.alt = ""; img.draggable = false; img.style.display = "none";
    const vids = [0, 1].map(() => { const v = document.createElement("video"); v.className = "ndk-vw-live vid"; v.loop = true; v.muted = true; v.playsInline = true; v.autoplay = false; v.draggable = false; v.style.display = "none"; return v; });
    const badge = el("div", "ndk-live-badge"); badge.append(el("i"), document.createTextNode("LIVE"));
    const stepEl = el("div", "ndk-vw-step"); stepEl.style.display = "none";
    const bar = el("div", "ndk-live-bar"), fill = el("i"); bar.append(fill);
    const hint = el("div", "ndk-vw-hint"); hint.style.display = "none";
    const tools = el("div", "ndk-media-tools ndk-vw-tools");
    layer.append(img, vids[0], vids[1], badge, stepEl, hint, bar);
    root.append(layer);
    // the buttons stay on the widget even while the layer is hidden (the eye brings it back); they live in their own box
    const toolBox = el("div", "ndk-pwl-tools"); toolBox.append(tools); root.append(toolBox);

    let front = 0, clipUrl = "", keyT = "", busyL = null;
    const eyeOn = () => ctx.prop("liveOn") !== false;
    const live = () => ctx.prop("live") === true;
    // the speaker and the volume exist only when an audio VAE is wired to the bridge
    const hasAudio = () => { const ls = ctx.info("live"); if (ls.bound) return !!ls.node && bridgeHasAudio(bridgeFor(ls.node)); return anyBridgeAudio(); };
    const soundOn = () => ctx.prop("sound") === true && hasAudio();
    const volume = () => Math.max(0, Math.min(100, Number(ctx.prop("volume") ?? 70))) / 100;
    const applySound = () => { for (const v of vids) { v.volume = volume(); v.muted = !soundOn(); } };
    const playing = (v) => { const r = v.play?.(); r?.catch?.(() => { v.muted = true; v.play?.().catch?.(() => {}); }); };
    const stopClips = () => { if (!clipUrl) return; clipUrl = ""; for (const v of vids) { v.pause(); v.style.display = "none"; v.removeAttribute("src"); v.load(); } };
    const showClip = (url) => {
        if (url === clipUrl) return;
        clipUrl = url;
        const back = vids[1 - front], old = vids[front];
        const swap = () => { back.removeEventListener("canplay", swap); if (clipUrl !== url) return; applySound(); back.style.display = ""; if (events.run.active) playing(back); old.style.display = "none"; old.pause(); front = 1 - front; };
        back.addEventListener("canplay", swap);
        back.src = url; back.load();
    };
    // an animated picture (WebP) keeps drawing for ever: when the run is over it is turned into one still picture
    let still = "";
    const freeze = (url) => {
        if (still === url) return;
        still = url;
        const i = new Image();
        i.onload = () => { try { const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext("2d").drawImage(i, 0, 0); if (still === url) img.src = c.toDataURL("image/jpeg", 0.9); } catch {} };
        i.src = url;
    };
    const frameOf = () => {
        const ls = ctx.info("live");
        if (ls.bound && ls.node) return forNode(ls.node).live;
        if (!ls.bound) return events.liveAny;
        return null;
    };
    const unregister = registerViewer({
        el: wrapForMark,
        wants: () => live() && eyeOn(),
        bridge: () => { const s = ctx.info("live"); return s.bound && s.node ? bridgeFor(s.node) : null; },
        mute: () => ctx.prop("muteComfy") === true,
        sound: () => soundOn(),
    });

    // -> true while the layer covers the player
    function update() {
        const on = live(), run = events.run.active;
        const frame = on && eyeOn() ? frameOf() : null;
        const shown = !!frame && (run || !hasResult());
        layer.style.display = shown ? "" : "none";
        const clip = shown && frame.kind === "video" && /^video\//.test(frame.mime || "");
        if (shown && !clip) {
            const animated = frame.kind === "video" && !run;
            if (img.dataset.src !== frame.url) { img.dataset.src = frame.url; still = ""; img.src = frame.url; }
            if (animated) freeze(frame.url);
            else if (still && still === frame.url) { still = ""; img.src = frame.url; }
        }
        img.style.display = shown && !clip ? "" : "none";
        if (clip) { showClip(frame.url); applySound(); for (const v of vids) { if (v.style.display === "none" || !events.run.active) v.pause(); else if (v.paused && v.readyState > 2) playing(v); } } else stopClips();
        badge.style.display = shown && run ? "" : "none";
        const progress = ctx.prop("progress") || "line";
        const st = frame?.steps ? [frame.step, frame.steps] : events.run.max ? [events.run.value, events.run.max] : null;
        const pct = st ? Math.min(1, st[0] / st[1]) : 0;
        // the animation of waiting: a run goes and no live frame is shown
        const busy = busyOf(ctx);
        const wantBusy = busy.on && run && !shown;
        if (wantBusy && !busyL) { busyL = activityLayer(busy.style, busy.mark, busy.text); busyL.el.classList.add("layer"); root.insertBefore(busyL.el, toolBox); }
        if (busyL) {
            busyL.el.style.display = wantBusy ? "" : "none";
            if (wantBusy) { busyL.setStyle(busy.style); busyL.setMark(busy.mark, busy.text); busyL.update({ pct: busy.bar ? pct : 0, text: st && busy.steps ? `${st[0]} / ${st[1]}` : "" }); }
        }
        bar.style.display = run && on && (progress === "line" || progress === "both") ? "" : "none"; fill.style.width = `${pct * 100}%`;
        const wantSteps = run && on && (progress === "steps" || progress === "both") && !!st;
        stepEl.style.display = wantSteps ? "" : "none"; if (wantSteps) stepEl.textContent = `${st[0]} / ${st[1]}`;
        // the buttons: the speaker (always seen) and the volume, the eye
        const audio = hasAudio();
        const tk = [on, eyeOn(), soundOn(), audio].join("|");
        if (tk !== keyT) {
            keyT = tk; tools.textContent = "";
            if (on) {
                if (audio) tools.append(pill(soundOn() ? "speaker" : "speakerOff", ctx.tr(soundOn() ? "Turn the sound of the live preview off" : "Turn the sound of the live preview on"), () => { ctx.setProp("sound", !(ctx.prop("sound") === true)); applySound(); keyT = ""; update(); }, "snd"));
                if (soundOn()) {
                    const vol = el("input", "ndk-vw-vol"); vol.type = "range"; vol.min = "0"; vol.max = "100"; vol.step = "1"; vol.value = String(Math.round(volume() * 100)); vol.title = ctx.tr("Volume");
                    vol.addEventListener("input", () => { ctx.setProp("volume", Number(vol.value)); applySound(); });
                    vol.addEventListener("click", (e) => e.stopPropagation()); vol.addEventListener("pointerdown", (e) => e.stopPropagation());
                    tools.append(vol);
                }
                tools.append(pill(eyeOn() ? "eye" : "eyeOff", ctx.tr(eyeOn() ? "Hide the live preview" : "Show the live preview"), () => { ctx.setProp("liveOn", !eyeOn()); keyT = ""; update(); }, "eye"));
            }
        }
        toolBox.style.display = on ? "" : "none";
        tools.classList.toggle("keep", on && !eyeOn());
        return shown || wantBusy;
    }
    return { update, destroy() { unregister(); stopClips(); busyL?.el.remove(); } };
}
