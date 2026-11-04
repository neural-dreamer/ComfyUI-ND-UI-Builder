// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widget — Activity: a small looped animation with the ND logo (or another mark: video, music, speech, ...) for the time ComfyUI works.
// The same animation is an option of the Viewer ("While it works" → when no live frame comes). Colours come from the theme (accent, accent 2).
import { el } from "./util.js";
import { progressOf } from "../events.js";

export const ACTIVITY_STYLES = [
    ["pulse", "Pulse"], ["orbit", "Orbit (a light runs round)"], ["breathe", "Breathe"],
    ["rings", "Rings"], ["scan", "Scan"], ["dots", "Dots"],
];
// The marks: a rounded tile with a rim and a glyph, painted with the theme colours. `nd` is the ND logo; the others fit any workflow.
// Glyphs are drawn in a 64 x 64 box inside the tile; `g` is the gradient paint, `soft` a lighter shade of it.
const GLYPHS = {
    nd: (g) => `<path fill="${g}" fill-rule="evenodd" d="M13 43V21h5.6l10.2 13.6V21h5.4v22h-5.4L18.4 29.4V43zM37 21h7.2c6.8 0 10.8 4 10.8 11s-4 11-10.8 11H37zM42.4 26v12h1.6c3.6 0 5.5-2.2 5.5-6s-1.9-6-5.5-6z"/>`,
    video: (g) => `<path fill="${g}" d="M13 22a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4zM44 28.5l8-5.5a1 1 0 0 1 1.6.8v16.4a1 1 0 0 1-1.6.8l-8-5.5z"/>`,
    music: (g) => `<circle cx="23" cy="44" r="6" fill="${g}"/><circle cx="43" cy="40" r="6" fill="${g}"/><path fill="${g}" d="M27 44V19.5L47 14v26h-4V21.4L31 24.6V44z"/>`,
    speech: (g) => `<rect x="25" y="13" width="14" height="25" rx="7" fill="${g}"/><path d="M18.5 31.5a13.5 13.5 0 0 0 27 0M32 45v7M24.5 52h15" fill="none" stroke="${g}" stroke-width="3.6" stroke-linecap="round"/>`,
    image: (g) => `<rect x="14.5" y="16.5" width="35" height="31" rx="5" fill="none" stroke="${g}" stroke-width="3.6"/><circle cx="26" cy="27" r="3.6" fill="${g}"/><path fill="${g}" d="M18 44.5l9-11 7 8 5-5 8 8z"/>`,
    spark: (g) => `<path fill="${g}" d="M30 14c1.4 10.5 5.6 15.7 17 19-11.4 3.3-15.6 8.5-17 19-1.4-10.5-5.6-15.7-17-19 11.4-3.3 15.6-8.5 17-19zM47.5 11c.6 3.8 2.2 5.6 6 6.7-3.8 1.1-5.4 2.9-6 6.7-.6-3.8-2.2-5.6-6-6.7 3.8-1.1 5.4-2.9 6-6.7z"/>`,
    bolt: (g) => `<path fill="${g}" d="M37 11L19 36h11l-3 17 19-26H34z"/>`,
    bars: (g) => [[14, 26, 12], [22, 18, 28], [30, 12, 40], [38, 20, 24], [46, 27, 10]].map(([x, y, h]) => `<rect x="${x}" y="${y}" width="5" height="${h}" rx="2.5" fill="${g}"/>`).join(""),
    cube: (g) => `<path fill="${g}" d="M32 12l17 9.5-17 9.5-17-9.5z"/><path fill="${g}" fill-opacity=".72" d="M15 24.5l15 8.4v18.6L15 43z"/><path fill="${g}" fill-opacity=".45" d="M49 24.5V43l-15 8.5V32.9z"/>`,
};
export const ACTIVITY_MARKS = [
    ["nd", "ND logo"], ["video", "Video"], ["music", "Music"], ["speech", "Speech"], ["image", "Picture"],
    ["spark", "Spark"], ["bolt", "Bolt"], ["bars", "Equalizer"], ["cube", "Cube"], ["custom", "Custom text"],
];
export const CUSTOM_TEXT_MAX = 20;
// the text of the "Custom text" mark: at most CUSTOM_TEXT_MAX characters, up to 4 lines (Enter starts a new line)
export const cleanMarkText = (t) => String(t ?? "").replace(/\r/g, "").slice(0, CUSTOM_TEXT_MAX).split("\n").slice(0, 4).join("\n");
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// the glyph of a custom text: the lines, centred in the tile, as large as they fit
function textGlyph(g, text) {
    const lines = cleanMarkText(text).split("\n");
    const longest = Math.max(1, ...lines.map((l) => l.length));
    const fs = Math.max(6, Math.min(26, 40 / (longest * 0.64), 38 / (lines.length * 1.12)));
    const lh = fs * 1.12, y0 = 32 - ((lines.length - 1) * lh) / 2 + fs * 0.35;
    return `<text text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="${fs.toFixed(1)}" fill="${g}">${lines.map((l, i) => `<tspan x="32" y="${(y0 + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join("")}</text>`;
}
const NS = "http://www.w3.org/2000/svg";
let seq = 0;

export function logoMark(mark = "nd", text = "") {
    const id = `ndka${++seq}`, g = `url(#${id})`;
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 64 64"); s.setAttribute("class", "ndk-act-mark");
    s.innerHTML = `<defs><linearGradient id="${id}" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--ndk-accent)"/><stop offset="1" style="stop-color:var(--ndk-accent2)"/></linearGradient></defs>`
        + `<rect x="5" y="5" width="54" height="54" rx="15" style="fill:var(--ndk-s1)" stroke="${g}" stroke-width="4.5"/>`
        + (mark === "custom" ? textGlyph(g, text) : (GLYPHS[mark] || GLYPHS.nd)(g));
    return s;
}

// A layer that shows one animation. update({on, pct, text}) keeps it in step with the run.
export function activityLayer(style, mark = "nd", markText = "") {
    const root = el("div", "ndk-act");
    const stage = el("div", "ndk-act-stage");
    const logo = el("div", "ndk-act-logo"); logo.append(logoMark(mark, markText)); logo.dataset.mark = `${mark}|${markText}`;
    const txt = el("div", "ndk-act-text"), bar = el("div", "ndk-act-bar"), fill = el("i"); bar.append(fill);
    stage.append(logo);
    root.append(stage, txt, bar);
    const set = (st) => {
        root.dataset.style = st;
        stage.querySelectorAll(".ndk-act-fx").forEach((n) => n.remove());
        if (st === "rings") for (let i = 0; i < 3; i++) { const r = el("i", "ndk-act-fx ring"); r.style.animationDelay = `${i * 0.8}s`; stage.append(r); }
        if (st === "dots") { const d = el("div", "ndk-act-fx dots"); d.append(el("i"), el("i"), el("i")); stage.append(d); }
        if (st === "scan") stage.append(el("i", "ndk-act-fx scan"));
        if (st === "orbit") stage.append(el("i", "ndk-act-fx orbit"));
    };
    set(style || "pulse");
    return {
        el: root,
        setStyle(st) { if (root.dataset.style !== st) set(st); },
        setMark(m, t = "") { const k = `${m}|${t}`; if (logo.dataset.mark !== k) { logo.dataset.mark = k; logo.textContent = ""; logo.append(logoMark(m, t)); } },
        update({ pct = 0, text = "", showBar = true } = {}) {
            // the text line and the bar keep their room (they are only hidden): when they came and went the logo moved by some pixels (the centred column changed its height)
            txt.textContent = text || "\u00A0"; txt.style.visibility = text ? "" : "hidden";
            bar.style.visibility = showBar && pct > 0 ? "" : "hidden"; fill.style.width = `${Math.min(1, pct) * 100}%`;
        },
    };
}

// "While it works (no live frame)" of the Viewer, the Result and the Video Player: a switch, and when it is on the same settings as the Activity widget
export const BUSY_PROPS = [
    { id: "busyOn", kind: "bool", label: "While it works (no live frame)", def: false, hint: "An animation over the widget while ComfyUI works and no live picture comes (the live preview is off or not available)." },
    { id: "busyMark", kind: "select", label: "Icon", def: "nd", options: ACTIVITY_MARKS, when: (p) => p.busyOn === true },
    { id: "busyText", kind: "textarea", label: "Text in the icon", def: "ND", max: CUSTOM_TEXT_MAX, when: (p) => p.busyOn === true && p.busyMark === "custom", hint: "Up to 20 characters; Enter starts a new line." },
    { id: "busyStyle", kind: "select", label: "Animation", def: "pulse", options: ACTIVITY_STYLES, when: (p) => p.busyOn === true },
    { id: "busyBar", kind: "bool", label: "Progress", def: true, when: (p) => p.busyOn === true },
    { id: "busySteps", kind: "bool", label: "Step counter", def: true, when: (p) => p.busyOn === true },
];
// the settings of the waiting animation of a widget
export const busyOf = (ctx) => ({
    on: ctx.prop("busyOn") === true, style: ctx.prop("busyStyle") || "pulse", mark: ctx.prop("busyMark") || "nd", text: ctx.prop("busyText") ?? "ND",
    bar: ctx.prop("busyBar") !== false, steps: ctx.prop("busySteps") !== false,
});
function progressText(pr) {
    if (pr.max > 0) return `${pr.value} / ${pr.max}`;
    return "";
}

export const activity = {
    type: "activity", label: "Activity", icon: "bolt", group: "Run", live: true, fill: true,
    slots: [],
    size: { w: 220, h: 180, minW: 80, minH: 80 },
    props: [
        { id: "mark", kind: "select", label: "Icon", def: "nd", options: ACTIVITY_MARKS },
        { id: "markText", kind: "textarea", label: "Text in the icon", def: "ND", max: CUSTOM_TEXT_MAX, when: (p) => p.mark === "custom", hint: "Up to 20 characters; Enter starts a new line." },
        { id: "style", kind: "select", label: "Animation", def: "pulse", options: ACTIVITY_STYLES },
        { id: "when", kind: "select", label: "Shows", def: "run", options: [["run", "Only while ComfyUI works"], ["always", "Always"]] },
        { id: "progress", kind: "bool", label: "Progress", def: true },
        { id: "steps", kind: "bool", label: "Step counter", def: true },
    ],
    mount(ctx) {
        const L = activityLayer(ctx.prop("style") || "pulse", ctx.prop("mark") || "nd", ctx.prop("markText") ?? "ND");
        L.el.classList.add("solo");
        ctx.body.append(L.el);
        const render = () => {
            const pr = progressOf(null), st = ctx.prop("style") || "pulse", always = ctx.prop("when") === "always";
            L.setStyle(st); L.setMark(ctx.prop("mark") || "nd", ctx.prop("markText") ?? "ND");
            L.el.classList.toggle("idle", !pr.active);
            L.el.style.visibility = pr.active || always ? "" : "hidden";
            L.update({ pct: ctx.prop("progress") !== false && pr.active ? pr.pct : 0, text: ctx.prop("steps") !== false && pr.active ? progressText(pr) : "" });
        };
        render();
        return { update: render };
    },
};

export const ACTIVITY_CSS = `
.ndk-act{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;container-type:size;overflow:hidden;pointer-events:none}
.ndk-act.solo{position:relative;width:100%;height:100%}
.ndk-act.layer{background:color-mix(in srgb,var(--ndk-bg) 72%,transparent);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.ndk-act-stage{position:relative;width:clamp(30px,46cqmin,150px);height:clamp(30px,46cqmin,150px);display:flex;align-items:center;justify-content:center}
.ndk-act-logo{position:relative;width:100%;height:100%;filter:drop-shadow(0 0 10px color-mix(in srgb,var(--ndk-accent) 55%,transparent))}
.ndk-act-mark{display:block;width:100%;height:100%}
.ndk-act-text{font-size:12px;font-weight:600;color:var(--ndk-muted);font-variant-numeric:tabular-nums;letter-spacing:.04em}
.ndk-act-bar{width:min(60%,160px);height:3px;border-radius:2px;background:var(--ndk-border);overflow:hidden}
.ndk-act-bar i{display:block;height:100%;width:0;border-radius:2px;background:linear-gradient(90deg,var(--ndk-accent),var(--ndk-accent2));transition:width .2s}
.ndk-act-fx{position:absolute;pointer-events:none}
/* pulse */
.ndk-act[data-style=pulse] .ndk-act-logo{animation:ndk-act-pulse 1.6s ease-in-out infinite}
@keyframes ndk-act-pulse{0%,100%{transform:scale(.92);filter:drop-shadow(0 0 4px color-mix(in srgb,var(--ndk-accent) 35%,transparent))}50%{transform:scale(1.04);filter:drop-shadow(0 0 18px color-mix(in srgb,var(--ndk-accent) 80%,transparent))}}
/* breathe */
.ndk-act[data-style=breathe] .ndk-act-logo{animation:ndk-act-breathe 3.6s ease-in-out infinite}
@keyframes ndk-act-breathe{0%,100%{opacity:.45;transform:scale(.98)}50%{opacity:1;transform:scale(1)}}
/* orbit: a light runs round the logo */
.ndk-act-fx.orbit{inset:-12%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 62%,var(--ndk-accent2) 82%,var(--ndk-accent) 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:ndk-act-spin 1.8s linear infinite;filter:drop-shadow(0 0 6px var(--ndk-accent))}
@keyframes ndk-act-spin{to{transform:rotate(360deg)}}
/* rings */
.ndk-act-fx.ring{inset:0;border-radius:24%;border:2px solid var(--ndk-accent);opacity:0;animation:ndk-act-ring 2.4s ease-out infinite}
@keyframes ndk-act-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}
/* scan: a bright line goes down over the logo */
.ndk-act-fx.scan{left:-6%;right:-6%;top:0;height:3px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--ndk-accent),var(--ndk-accent2),transparent);box-shadow:0 0 12px var(--ndk-accent);animation:ndk-act-scan 1.8s ease-in-out infinite}
@keyframes ndk-act-scan{0%{top:4%;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:94%;opacity:0}}
/* dots */
.ndk-act-fx.dots{left:0;right:0;bottom:-18%;display:flex;justify-content:center;gap:6px}
.ndk-act-fx.dots i{width:7px;height:7px;border-radius:50%;background:var(--ndk-accent);animation:ndk-act-dot 1.1s ease-in-out infinite}
.ndk-act-fx.dots i:nth-child(2){animation-delay:.18s;background:color-mix(in srgb,var(--ndk-accent) 50%,var(--ndk-accent2))}
.ndk-act-fx.dots i:nth-child(3){animation-delay:.36s;background:var(--ndk-accent2)}
@keyframes ndk-act-dot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
.ndk-act.solo.idle .ndk-act-logo,.ndk-act.solo.idle .ndk-act-fx{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){
.ndk-act *{animation:none!important}
.ndk-act[data-style=pulse] .ndk-act-logo,.ndk-act[data-style=breathe] .ndk-act-logo{opacity:.85}
.ndk-act-fx.orbit,.ndk-act-fx.ring,.ndk-act-fx.scan{display:none}
}
`;
