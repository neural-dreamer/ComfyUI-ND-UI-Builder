// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the view of the loaders (ND Load Video / ND Load Audio): choose a file, watch it, cut a segment, crop, set the frame rate.
// One view for two places: the node itself (compact) and the widgets "Video Input" / "Audio Input" of the ND UI panel.
// Everything is written to the hidden text widget `settings` (JSON) of the node, the file name to its combo `video` / `audio`.
import { api } from "../../../../scripts/api.js";
import { el, icon, dragger } from "../widgets/util.js";
import { createPlayer, fmtTime, loadPeaks } from "./player.js";
import { uploadFile, readDrop, hasDrop, takeDrop, refFromName, fileUrl } from "./io.js";
import { touchWorkflow } from "../sources.js";

export const VIDEO_CLASS = "NDLoadVideo", AUDIO_CLASS = "NDLoadAudio";
export const isLoaderNode = (node, kind) => !!node && ((node.comfyClass || node.type) === (kind === "audio" ? AUDIO_CLASS : VIDEO_CLASS));
export const VIDEO_DEFAULTS = { start: 0, end: 0, fps: 0, max_frames: 0, crop: null, fit: "crop", pad_color: "#000000", scale: "lanczos", audio: true, rotate_auto: true, memory_gb: 0 };
export const AUDIO_DEFAULTS = { start: 0, end: 0, sample_rate: 0, mono: false, gain_db: 0 };
export const FITS = [["crop", "Crop to fill"], ["pad color", "Bars of a colour"], ["pad edge", "Repeat the edge"], ["pad edge color", "Bars of the edge colour"], ["stretch", "Stretch"], ["original", "Keep the proportions"]];
export const ASPECTS = [["", "Free"], ["1:1", "1:1"], ["4:3", "4:3"], ["3:4", "3:4"], ["16:9", "16:9"], ["9:16", "9:16"], ["target", "As the target size"]];
const GB = 1024 ** 3;
// the limit of the RAM for the decoded frames, as the server counts it: a number of GB, 0 = 70 % of the free RAM now (6 GB when unknown), -1 = none
const memLimit = (gb, info) => (gb < 0 ? Infinity : gb > 0 ? gb * GB : info?.ram_free ? info.ram_free * 0.7 : 6 * GB);

/* ------------------------------------------------------------------ the node's widgets */

export const settingsWidget = (node) => node?.widgets?.find((w) => w.name === "settings") || null;
export const fileWidget = (node, kind) => node?.widgets?.find((w) => w.name === (kind === "audio" ? "audio" : "video")) || null;
const intWidget = (node, name) => node?.widgets?.find((w) => w.name === name) || null;

export function readSettings(node, kind) {
    let d = {};
    try { d = JSON.parse(settingsWidget(node)?.value || "{}"); } catch {}
    if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
    return { ...(kind === "audio" ? AUDIO_DEFAULTS : VIDEO_DEFAULTS), ...d };
}
export function writeSettings(node, s) {
    const w = settingsWidget(node);
    if (!w) return false;
    const v = JSON.stringify(s);
    if (w.value === v) return true;
    w.value = v;
    try { w.callback?.(v, null, node); } catch {}
    try { node.graph?.setDirtyCanvas?.(true, false); } catch {}
    touchWorkflow();
    return true;
}
export function hideWidget(w) {
    if (!w || w.nd_hidden) return;
    w.nd_hidden = true; w.hidden = true; w.computeSize = () => [0, -4];
    if (w.options) w.options.hidden = true;
    for (const k of ["element", "inputEl"]) if (w[k]?.style) w[k].style.display = "none";
}
export const hideLoaderWidgets = (node, kind) => { hideWidget(settingsWidget(node)); hideWidget(fileWidget(node, kind)); };
export const settingsText = (node, kind) => `${fileWidget(node, kind)?.value ?? ""}|${settingsWidget(node)?.value ?? ""}|${["width", "height", "multiple_of"].map((n) => intWidget(node, n)?.value ?? "").join(",")}`;

/* ------------------------------------------------------------------ numbers */

// the same rules as the Python side (ndui_py/media_load.py: target_size)
export function targetSize(cw, ch, width, height, multiple, fit) {
    width = Math.max(0, Math.round(width) || 0); height = Math.max(0, Math.round(height) || 0);
    const m = Math.max(1, Math.round(multiple) || 1);
    let tw, th;
    if (!width && !height) { tw = cw; th = ch; }
    else if (!height) { tw = width; th = Math.round(ch * width / cw); }
    else if (!width) { tw = Math.round(cw * height / ch); th = height; }
    else if (fit === "original") { const s = Math.min(width / cw, height / ch); tw = Math.round(cw * s); th = Math.round(ch * s); }
    else { tw = width; th = height; }
    if (m > 1) { tw = Math.max(m, Math.floor(tw / m + 0.5) * m); th = Math.max(m, Math.floor(th / m + 0.5) * m); }
    return [Math.max(1, tw), Math.max(1, th)];
}
export function cropPixels(w, h, crop) {
    if (!crop) return [0, 0, w, h];
    const x0 = Math.min(w - 1, Math.round(crop[0] * w)), y0 = Math.min(h - 1, Math.round(crop[1] * h));
    const x1 = Math.max(x0 + 1, Math.min(w, Math.round((crop[0] + crop[2]) * w))), y1 = Math.max(y0 + 1, Math.min(h, Math.round((crop[1] + crop[3]) * h)));
    return [x0, y0, x1, y1];
}
export const fmtBytes = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`);
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// a text field for numbers: arrows and Shift+wheel change it, Enter / leaving the field sets it
function numField(label, { get, set, step = 0.01, min = 0, max = Infinity, digits = 2, width = 64, title = "" }) {
    const wrap = el("label", "ndk-tv-f"); if (title) wrap.title = title;
    const inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.spellcheck = false; inp.style.width = `${width}px`;
    const show = () => { inp.value = String(+Number(get()).toFixed(digits)); };
    const commit = (v) => { const n = clamp(Number(v), min, max); if (Number.isFinite(n)) set(n); show(); };
    inp.addEventListener("change", () => commit(inp.value.replace(",", ".")));
    inp.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") inp.blur();
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); commit(Number(get()) + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1)); }
    });
    inp.addEventListener("wheel", (e) => { if (!e.shiftKey) return; e.preventDefault(); e.stopPropagation(); commit(Number(get()) + (e.deltaY < 0 ? 1 : -1) * step); }, { passive: false });
    wrap.append(el("span", "", label), inp);
    return { el: wrap, show, input: inp };
}
const selectField = (label, options, get, set, title = "") => {
    const wrap = el("label", "ndk-tv-f"); if (title) wrap.title = title;
    const s = el("select"); for (const [v, t] of options) { const o = el("option", "", t); o.value = v; s.append(o); }
    s.addEventListener("change", () => set(s.value)); s.addEventListener("keydown", (e) => e.stopPropagation());
    wrap.append(el("span", "", label), s);
    return { el: wrap, show: () => { s.value = String(get()); }, select: s };
};
const checkField = (label, get, set, title = "") => {
    const wrap = el("label", "ndk-tv-f chk"); if (title) wrap.title = title;
    const c = el("input"); c.type = "checkbox"; c.addEventListener("change", () => set(c.checked));
    wrap.append(c, el("span", "", label));
    return { el: wrap, show: () => { c.checked = !!get(); } };
};

/* ------------------------------------------------------------------ files */

const infoCache = new Map(), listCache = { video: null, audio: null };
export async function fetchInfo(name) {
    if (!name) return null;
    if (infoCache.has(name)) return infoCache.get(name);
    let info = null;
    try { const r = await api.fetchApi(`/ndui/media/info?name=${encodeURIComponent(name)}`); if (r.ok) info = await r.json(); } catch {}
    if (info) infoCache.set(name, info);
    return info;
}
export async function fetchList(kind, force = false) {
    if (listCache[kind] && !force) return listCache[kind];
    try { const r = await api.fetchApi(`/ndui/media/list?kind=${kind}`); if (r.ok) listCache[kind] = await r.json(); } catch {}
    return listCache[kind] || [];
}
export const forgetInfo = (name) => infoCache.delete(name);

// frames of a video for the strip: [seconds...] drawn in a canvas; the result is kept by address and width
const stripCache = new Map();
async function drawFrames(canvas, url, dur, alive) {
    const w = canvas.width, h = canvas.height, key = `${url}|${w}x${h}`;
    const g = canvas.getContext("2d");
    if (stripCache.has(key)) { g.drawImage(stripCache.get(key), 0, 0); return true; }
    const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.src = url; v.crossOrigin = "anonymous";
    const once = (ev, ms = 2500) => new Promise((res) => { const t = setTimeout(() => res(false), ms); v.addEventListener(ev, () => { clearTimeout(t); res(true); }, { once: true }); });
    try {
        if (!(await once("loadeddata", 4000))) return false;
        const n = clamp(Math.round(w / (h * 1.4)), 4, 16), cw = w / n;
        g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < n; i++) {
            if (!alive()) return false;
            const p = once("seeked"); v.currentTime = clamp(((i + 0.5) / n) * dur, 0, Math.max(0, dur - 0.05));
            await p;
            const vw = v.videoWidth || 1, vh = v.videoHeight || 1, k = Math.max(cw / vw, h / vh), sw = cw / k, sh = h / k;
            g.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, i * cw, 0, cw, h);
        }
        const keep = document.createElement("canvas"); keep.width = w; keep.height = h; keep.getContext("2d").drawImage(canvas, 0, 0);
        if (stripCache.size > 30) stripCache.clear();
        stripCache.set(key, keep);
        return true;
    } catch { return false; } finally { v.removeAttribute("src"); try { v.load(); } catch {} }
}

/* ------------------------------------------------------------------ the view */

// opts: {kind: "video" | "audio", node, tr, vars(), popupHost(), compact}
export function trimView(opts) {
    const { kind, node, compact = false } = opts;
    let collapsible = !!opts.collapsible, open = opts.open === true;
    const isV = kind === "video";
    const tr = (s, v) => opts.tr(s, v);
    const root = el("div", `ndk-tv ${kind}${compact ? " compact" : ""}`);
    let st = readSettings(node, kind), name = "", info = null, dead = false, segOnly = false, cropMode = false, stripKey = "", seenText = null;
    const commit = (patch) => { st = { ...st, ...patch }; writeSettings(node, st); seenText = settingsText(node, kind); paint(); };
    const dur = () => info?.duration || (Number.isFinite(player.media.duration) ? player.media.duration : 0);
    const endEff = () => (st.end > 0 && st.end < dur() ? st.end : dur());

    /* --- file row */
    const fileRow = el("div", "ndk-tv-file");
    const sel = el("select", "ndk-tv-sel"); sel.title = tr("Files of the input folder");
    const bUp = el("button", "ndk-tv-btn"); bUp.type = "button"; bUp.title = tr("Load a file from the computer"); bUp.append(icon("plus", 14), el("span", "", tr("Load")));
    const fin = el("input"); fin.type = "file"; fin.accept = isV ? "video/*,.mkv,.mov,.avi" : "audio/*,video/*,.flac,.m4a"; fin.style.display = "none";
    fileRow.append(sel, bUp, fin);
    const fillSelect = async (force) => {
        const list = await fetchList(kind, force);
        if (dead) return;
        const names = new Set(list); if (name) names.add(name);
        sel.textContent = "";
        const none = el("option", "", tr(isV ? "Choose a video" : "Choose a sound")); none.value = ""; sel.append(none);
        for (const n of names) { const o = el("option", "", n); o.value = n; sel.append(o); }
        sel.value = name || "";
    };
    const setFile = (n, fresh) => {
        const w = fileWidget(node, kind);
        if (!w) return;
        const vals = w.options?.values;
        if (Array.isArray(vals) && n && !vals.includes(n)) vals.push(n);
        w.value = n; try { w.callback?.(n, null, node); } catch {}
        if (fresh) { forgetInfo(n); st = { ...st, start: 0, end: 0, crop: null }; writeSettings(node, st); }
        touchWorkflow();
        name = String(n || ""); seenText = settingsText(node, kind);
        load();
    };
    sel.addEventListener("change", () => setFile(sel.value, true));
    sel.addEventListener("focus", () => fillSelect(true));
    sel.addEventListener("keydown", (e) => e.stopPropagation());
    bUp.addEventListener("click", () => fin.click());
    const take = async (items) => {
        try { const got = await takeDrop(items); if (got[0]) { listCache[kind] = null; setFile(got[0].name, true); fillSelect(true); } }
        catch (e) { note(String(e?.message || e), true); }
    };
    fin.addEventListener("change", () => { const f = Array.from(fin.files || []).map((file) => ({ kind: "file", file })); fin.value = ""; if (f.length) take(f); });
    root.addEventListener("dragover", (e) => { if (hasDrop(e.dataTransfer)) { e.preventDefault(); root.classList.add("drop"); } });
    root.addEventListener("dragleave", (e) => { if (!root.contains(e.relatedTarget)) root.classList.remove("drop"); });
    root.addEventListener("drop", (e) => { root.classList.remove("drop"); const it = readDrop(e.dataTransfer); if (it.length) { e.preventDefault(); e.stopPropagation(); take(it); } });

    /* --- player (+ crop overlay for a video) */
    const player = createPlayer(kind, { props: () => ({ loop: false, muted: false, volume: 1, fit: "contain", wave: false, save: false }), setProp: () => {}, tr: (s) => tr(s) });
    const m = player.media;
    const stage = player.el.querySelector(".stage");
    const msg = el("div", "ndk-tv-note"); msg.style.display = "none";
    let pic = null, box = null, aspectSel = null, cropBtn = null;
    const targetRatio = () => { const w = +intWidget(node, "width")?.value, h = +intWidget(node, "height")?.value; return w > 0 && h > 0 ? w / h : null; };
    const ratioOf = () => { const a = st.aspect; if (!a) return null; if (a === "target") return targetRatio(); const [x, y] = a.split(":").map(Number); return x > 0 && y > 0 ? x / y : null; };
    const picSize = () => { const w = m.videoWidth || info?.display_w || 0, h = m.videoHeight || info?.display_h || 0; return [w, h]; };
    function layoutPic() {
        if (!isV || !pic) return;
        const [vw, vh] = picSize(), sw = stage.clientWidth, sh = stage.clientHeight;
        if (!vw || !vh || !sw || !sh) { pic.style.display = "none"; return; }
        const k = Math.min(sw / vw, sh / vh), w = vw * k, h = vh * k;
        Object.assign(pic.style, { display: "block", left: `${(sw - w) / 2}px`, top: `${(sh - h) / 2}px`, width: `${w}px`, height: `${h}px` });
        paintCrop();
    }
    function paintCrop() {
        if (!box) return;
        const c = st.crop;
        box.style.display = c ? "" : "none";
        if (c) Object.assign(box.style, { left: `${c[0] * 100}%`, top: `${c[1] * 100}%`, width: `${c[2] * 100}%`, height: `${c[3] * 100}%` });
        pic.classList.toggle("on", cropMode);
        cropBtn?.classList.toggle("on", cropMode);
    }
    // the crop rectangle changes with a handle; r = wanted proportions (pixels) or null; all in 0..1 of the picture
    function dragCrop(h, p, s0) {
        const [vw, vh] = picSize(), r = ratioOf();
        let l = s0[0], t = s0[1], rr = s0[0] + s0[2], b = s0[1] + s0[3];
        const MIN = 0.02;
        if (h.includes("w")) l = clamp(p.x, 0, rr - MIN); if (h.includes("e")) rr = clamp(p.x, l + MIN, 1);
        if (h.includes("n")) t = clamp(p.y, 0, b - MIN); if (h.includes("s")) b = clamp(p.y, t + MIN, 1);
        if (r && vw && vh) {
            const k = vh / vw;  // normalized height = normalized width * (vw / vh) / r
            const wantH = (w) => (w * vw) / r / vh, wantW = (hh) => (hh * vh * r) / vw;
            const horiz = h.includes("w") || h.includes("e"), vert = h.includes("n") || h.includes("s");
            if (horiz && !vert) { const w = rr - l, nh = Math.min(1, wantH(w)), cy = (s0[1] + s0[3] / 2); t = clamp(cy - nh / 2, 0, 1 - nh); b = t + nh; const w2 = wantW(nh); if (w2 < w) { if (h.includes("w")) l = rr - w2; else rr = l + w2; } }
            else if (vert && !horiz) { const hh = b - t, nw = Math.min(1, wantW(hh)), cx = (s0[0] + s0[2] / 2); l = clamp(cx - nw / 2, 0, 1 - nw); rr = l + nw; const h2 = wantH(nw); if (h2 < hh) { if (h.includes("n")) t = b - h2; else b = t + h2; } }
            else { // a corner: the width leads
                let w = rr - l, hh = wantH(w);
                const room = h.includes("n") ? b : 1 - t;
                if (hh > room) { hh = room; w = wantW(hh); if (h.includes("w")) l = rr - w; else rr = l + w; }
                if (h.includes("n")) t = b - hh; else b = t + hh;
            }
            void k;
        }
        return [r3(l), r3(t), r3(rr - l), r3(b - t)];
    }
    // the largest rectangle of the wanted proportions inside the current crop (or the whole picture)
    function fitAspect() {
        const r = ratioOf(), [vw, vh] = picSize();
        if (!r || !vw || !vh) return;
        const c = st.crop || [0, 0, 1, 1];
        let w = c[2] * vw, h = c[3] * vh;
        if (w / h > r) w = h * r; else h = w / r;
        const nw = w / vw, nh = h / vh;
        commit({ crop: nw > 0.999 && nh > 0.999 ? null : [r3(c[0] + (c[2] - nw) / 2), r3(c[1] + (c[3] - nh) / 2), r3(nw), r3(nh)] });
    }
    if (isV) {
        pic = el("div", "ndk-tv-pic"); box = el("div", "ndk-tv-crop");
        for (const h of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) { const hd = el("i", `hd ${h}`); hd.dataset.h = h; box.append(hd); }
        pic.append(box); stage.append(pic);
        const norm = (e) => { const r = pic.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
        dragger(pic, {
            start: (e) => {
                if (!cropMode) return false;
                e.stopPropagation(); e.preventDefault();
                const h = e.target?.dataset?.h;
                if (h) return { h, s0: st.crop || [0, 0, 1, 1] };
                if (st.crop && box.contains(e.target)) return { move: true, s0: st.crop, p0: norm(e) };
                const p = norm(e); return { h: "se", s0: [p.x, p.y, 0.02, 0.02], fresh: true };
            },
            move: (e, s) => {
                const p = norm(e);
                if (s.move) { const dx = p.x - s.p0.x, dy = p.y - s.p0.y; commit({ crop: [r3(clamp(s.s0[0] + dx, 0, 1 - s.s0[2])), r3(clamp(s.s0[1] + dy, 0, 1 - s.s0[3])), s.s0[2], s.s0[3]] }); }
                else commit({ crop: dragCrop(s.h, p, s.s0) });
            },
            end: () => { const c = st.crop; if (c && (c[2] < 0.03 || c[3] < 0.03)) commit({ crop: null }); },
        });
        pic.addEventListener("dblclick", (e) => { if (cropMode) { e.stopPropagation(); commit({ crop: null }); } });
        new ResizeObserver(layoutPic).observe(stage);
        m.addEventListener("loadedmetadata", layoutPic);
    }
    const bar2 = el("div", "ndk-tv-tools");
    if (isV) {
        cropBtn = el("button", "ndk-tv-btn"); cropBtn.type = "button"; cropBtn.title = tr("Draw the crop on the picture"); cropBtn.append(icon("ratio", 14), el("span", "", tr("Crop")));
        cropBtn.addEventListener("click", () => { cropMode = !cropMode; if (cropMode && m.paused === false) m.pause(); paintCrop(); });
        aspectSel = selectField(tr("Shape"), ASPECTS.map(([v, t]) => [v, tr(t)]), () => st.aspect || "", (v) => { commit({ aspect: v }); fitAspect(); });
        const reset = el("button", "ndk-tv-btn"); reset.type = "button"; reset.title = tr("Remove the crop"); reset.append(icon("undo", 14));
        reset.addEventListener("click", () => commit({ crop: null }));
        bar2.append(cropBtn, aspectSel.el, reset);
    }

    /* --- the strip with the segment */
    const strip = el("div", "ndk-tv-strip");
    const cv = el("canvas", "bg"), shL = el("i", "dim l"), shR = el("i", "dim r"), seg = el("div", "seg"), hL = el("i", "hd l"), hR = el("i", "hd r"), head = el("i", "head");
    seg.append(hL, hR); strip.append(cv, shL, shR, seg, head);
    const stripW = () => strip.clientWidth || 300;
    const tAt = (e) => clamp((e.clientX - strip.getBoundingClientRect().left) / strip.getBoundingClientRect().width, 0, 1) * dur();
    dragger(strip, {
        start: (e) => {
            const d = dur(); if (!d) return false;
            e.stopPropagation();
            const x = e.clientX - strip.getBoundingClientRect().left, W = strip.getBoundingClientRect().width;
            const xs = (st.start / d) * W, xe = (endEff() / d) * W;
            const what = Math.abs(x - xs) <= 9 ? "start" : Math.abs(x - xe) <= 9 ? "end" : x > xs && x < xe ? "move" : "seek";
            if (what === "seek") m.currentTime = tAt(e);
            return { what, t0: tAt(e), s0: st.start, e0: endEff(), moved: false };
        },
        move: (e, s) => {
            const d = dur(), t = tAt(e);
            if (Math.abs(t - s.t0) > d * 0.003) s.moved = true;
            if (s.what === "seek") { m.currentTime = t; return; }
            if (!s.moved) return;
            if (s.what === "start") commit({ start: r3(clamp(t, 0, endEff() - 0.01)) });
            else if (s.what === "end") { const v = clamp(t, st.start + 0.01, d); commit({ end: v >= d - 0.005 ? 0 : r3(v) }); }
            else { const len = s.e0 - s.s0, a = clamp(s.s0 + (t - s.t0), 0, d - len); commit({ start: r3(a), end: a + len >= d - 0.005 ? 0 : r3(a + len) }); }
        },
        end: (e, s) => { if (!s.moved && s.what !== "seek") m.currentTime = tAt(e); },
    });
    const paintStrip = () => {
        const d = dur();
        const f = (t) => (d ? (clamp(t, 0, d) / d) * 100 : 0);
        const a = f(st.start), z = f(endEff());
        seg.style.left = `${a}%`; seg.style.width = `${Math.max(0, z - a)}%`;
        shL.style.width = `${a}%`; shR.style.left = `${z}%`; shR.style.width = `${100 - z}%`;
        head.style.left = `${f(m.currentTime || 0)}%`;
    };
    const buildStrip = async () => {
        const d = dur(), W = Math.round(stripW()), H = isV ? 44 : 52, key = `${name}|${W}|${H}|${d}`;
        if (!name || !d || !W || key === stripKey) return;
        stripKey = key;
        cv.width = W; cv.height = H;
        const g = cv.getContext("2d"); g.clearRect(0, 0, W, H);
        const url = fileUrl(refFromName(name)), tok = key;
        const alive = () => !dead && stripKey === tok;
        if (isV) { if (!(await drawFrames(cv, url, d, alive)) && alive()) { g.fillStyle = "rgba(128,128,128,.25)"; g.fillRect(0, 0, W, H); } }
        else {
            const pk = await loadPeaks(url, 600);
            if (!alive()) return;
            const cs = getComputedStyle(root), col = cs.getPropertyValue("--ndk-faint").trim() || "#8893a5";
            g.fillStyle = col; g.globalAlpha = 0.85;
            const n = Math.floor(W / 3);
            for (let i = 0; i < n; i++) {
                let v = pk ? 0 : 0.1;
                if (pk) { const a = Math.floor((i / n) * pk.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * pk.length)); for (let k = a; k < b; k++) v = Math.max(v, pk[k]); v = clamp(v * 1.15, 0.04, 1); }
                const bh = Math.max(2, v * H * 0.9); g.fillRect(i * 3, (H - bh) / 2, 2, bh);
            }
            g.globalAlpha = 1;
        }
    };
    new ResizeObserver(() => { buildStrip(); paintStrip(); }).observe(strip);

    /* --- the segment fields */
    const fStart = numField(tr("Start"), { get: () => st.start, set: (v) => commit({ start: r3(clamp(v, 0, Math.max(0, endEff() - 0.01))) }), title: tr("Start of the segment, seconds. Arrows and Shift + wheel change it by 0.01") });
    const fEnd = numField(tr("End"), { get: () => endEff(), set: (v) => { const d = dur(); const n = clamp(v, st.start + 0.01, d || v); commit({ end: d && n >= d - 0.005 ? 0 : r3(n) }); }, title: tr("End of the segment, seconds (the end of the file when it is at the right edge)") });
    const mkMark = (txt, title, fn) => { const b = el("button", "ndk-tv-btn mark", txt); b.type = "button"; b.title = title; b.addEventListener("click", fn); return b; };
    const bIn = mkMark("[", tr("Start here (the position of the player)"), () => commit({ start: r3(clamp(m.currentTime, 0, Math.max(0, endEff() - 0.01))) }));
    const bOut = mkMark("]", tr("End here (the position of the player)"), () => { const d = dur(), v = clamp(m.currentTime, st.start + 0.01, d || 1e9); commit({ end: d && v >= d - 0.005 ? 0 : r3(v) }); });
    const lenLab = el("span", "ndk-tv-len");
    const fSeg = checkField(tr("Play the segment only"), () => segOnly, (v) => { segOnly = v; if (v && (m.currentTime < st.start || m.currentTime >= endEff())) m.currentTime = st.start; });
    const segRow = el("div", "ndk-tv-seg");
    segRow.append(fStart.el, bIn, fEnd.el, bOut, lenLab, fSeg.el);
    // keep the player inside the segment
    let ticking = false;
    const guard = () => { ticking = false; if (!segOnly || dead || m.paused) return; if (m.currentTime >= endEff() - 0.02) { m.currentTime = st.start; if (!m.loop) m.pause(); } ticking = true; requestAnimationFrame(guard); };
    m.addEventListener("play", () => { if (segOnly && (m.currentTime < st.start || m.currentTime >= endEff() - 0.02)) m.currentTime = st.start; if (!ticking) { ticking = true; requestAnimationFrame(guard); } });
    for (const ev of ["timeupdate", "seeked", "loadedmetadata", "durationchange"]) m.addEventListener(ev, () => { paintStrip(); paintInfo(); });

    /* --- settings */
    const fields = [];
    const add = (f) => { fields.push(f); return f.el; };
    const setPanel = el("div", "ndk-tv-set");
    const sizeInput = (n, label, title) => { const w = intWidget(node, n); return numField(label, { get: () => +w?.value || 0, set: (v) => { if (!w) return; w.value = Math.round(v); try { w.callback?.(w.value, null, node); } catch {} touchWorkflow(); seenText = settingsText(node, kind); paint(); }, step: 1, min: 0, max: 16384, digits: 0, width: 56, title }); };
    let fPad = null;
    if (isV) {
        const fps = numField(tr("Frame rate"), { get: () => st.fps, set: (v) => commit({ fps: v }), step: 1, min: 0, max: 240, digits: 2, width: 56, title: tr("0 = every frame as it is. A number: frames are taken by time, the nearest one to each moment, nothing is blended") });
        const mf = numField(tr("Max frames"), { get: () => st.max_frames, set: (v) => commit({ max_frames: Math.round(v) }), step: 1, min: 0, digits: 0, width: 60, title: tr("0 = no limit") });
        const fit = selectField(tr("Fit"), FITS.map(([v, t]) => [v, tr(t)]), () => st.fit, (v) => commit({ fit: v }), tr("How the picture is fitted to the width and the height"));
        fPad = el("input"); fPad.type = "color"; fPad.className = "ndk-tv-color"; fPad.title = tr("Colour of the bars");
        fPad.addEventListener("input", () => commit({ pad_color: fPad.value }));
        const memf = numField(tr("Memory limit, GB"), { get: () => st.memory_gb, set: (v) => commit({ memory_gb: v }), step: 1, min: -1, max: 4096, digits: 1, width: 56, title: tr("The decoded frames live in the RAM of the computer (not in the video memory). 0 = automatic: 70% of the free RAM. A number = that many GB. -1 = no limit (the computer may freeze when the video does not fit)") });
        const au = checkField(tr("Sound"), () => st.audio, (v) => commit({ audio: v }), tr("Take the sound of the same segment"));
        const rot = checkField(tr("Turn as the file says"), () => st.rotate_auto, (v) => commit({ rotate_auto: v }), tr("Phones store a video turned and write the turn in the file. On: the picture is turned like in a player"));
        setPanel.append(add(fps), add(mf), add(fit), fPad);
        if (!compact) setPanel.append(add(sizeInput("width", tr("Width"), tr("0 = as the source"))), add(sizeInput("height", tr("Height"), tr("0 = as the source"))), add(sizeInput("multiple_of", tr("Multiple of"), tr("Round the size to a multiple of this number"))));
        setPanel.append(add(au), add(rot), add(memf));
        fields.push({ show: () => { fPad.value = /^#[0-9a-f]{6}$/i.test(st.pad_color) ? st.pad_color : "#000000"; fPad.style.display = st.fit === "pad color" ? "" : "none"; } });
    } else {
        const rate = selectField(tr("Sample rate"), [["0", tr("As the file")], ...[16000, 22050, 24000, 32000, 44100, 48000].map((n) => [String(n), `${n} Hz`])], () => String(st.sample_rate || 0), (v) => commit({ sample_rate: +v }));
        const mono = checkField(tr("Mono"), () => st.mono, (v) => commit({ mono: v }), tr("Mix the channels into one"));
        const gain = numField(tr("Gain, dB"), { get: () => st.gain_db, set: (v) => commit({ gain_db: v }), step: 0.5, min: -60, max: 60, digits: 1, width: 52 });
        setPanel.append(add(rate), add(mono), add(gain));
    }
    const infoLine = el("div", "ndk-tv-info");
    const paintInfo = () => {
        const d = dur();
        lenLab.textContent = d ? `${tr("Length")}: ${(endEff() - st.start).toFixed(2)} s / ${fmtTime(d)}` : "";
        let text = "", warn = false;
        const seconds = Math.max(0, endEff() - st.start);
        if (isV) {
            const [vw, vh] = picSize();
            if (vw && vh && d) {
                const [x0, y0, x1, y1] = cropPixels(vw, vh, st.crop);
                const [tw, th] = targetSize(x1 - x0, y1 - y0, +intWidget(node, "width")?.value, +intWidget(node, "height")?.value, +intWidget(node, "multiple_of")?.value, st.fit);
                const rate = st.fps || info?.fps || 0;
                let n = rate ? Math.ceil(seconds * rate - 1e-6) : info?.frames ? Math.round((info.frames * seconds) / d) : 0;
                if (st.max_frames) n = Math.min(n || st.max_frames, st.max_frames);
                const mem = n * tw * th * 12;
                const lim = memLimit(+st.memory_gb || 0, info);
                warn = mem > lim;
                text = `${tw}×${th}` + (n ? ` · ${n} ${tr("frames")}` : "") + (rate ? ` · ${+rate.toFixed(2)} ${tr("fps")}` : "") + (n ? ` · ≈ ${fmtBytes(mem)} ${tr("of RAM")}` : "") + (warn ? ` — ${tr("more than the limit ({n}): cut a shorter segment, lower the frame rate or raise the memory limit", { n: fmtBytes(lim) })}` : "");
                if (info && info.rotation) text += ` · ${tr("turned by {n}°", { n: info.rotation })}`;
            }
        } else if (d) {
            const rate = st.sample_rate || info?.audio_rate || 0;
            text = `${seconds.toFixed(2)} s` + (rate ? ` · ${rate} Hz` : "") + (st.mono ? ` · ${tr("mono")}` : info?.audio_channels ? ` · ${info.audio_channels} ${tr("ch")}` : "");
            if (info && !info.has_audio) { text = tr("This file has no sound"); warn = true; }
        }
        infoLine.textContent = text; infoLine.classList.toggle("warn", warn); paintSummary();
    };
    function note(text, warn) { msg.style.display = text ? "" : "none"; msg.textContent = text || ""; msg.classList.toggle("warn", !!warn); }

    function paint() {
        for (const f of fields) f.show?.();
        aspectSel?.show();
        paintCrop(); paintStrip(); paintInfo();
        if (document.activeElement !== fStart.input) fStart.show();
        if (document.activeElement !== fEnd.input) fEnd.show();
        fSeg.show();
    }
    async function load() {
        const n = name;
        stripKey = "";
        if (!n) { player.setRef(null); info = null; note(tr(isV ? "Choose a video: drop a file here or press Load" : "Choose a sound: drop a file here or press Load")); paint(); return; }
        note("");
        const ref = refFromName(n);
        info = infoCache.get(n) || null;
        player.setRef({ ...ref, frame_rate: info?.fps || 0 });
        info = await fetchInfo(n);
        if (dead || n !== name) return;
        if (info?.fps) player.setRef({ ...ref, frame_rate: info.fps });
        if (info && !info.duration && !dur()) info = null;
        layoutPic(); buildStrip(); paint();
        if (!info) note(tr("The ND UI server does not know this file. Restart ComfyUI after updating the pack."), false);
    }

    // the controls under the player can hide under a spoiler (the widgets of the panel do that by default)
    const body = el("div", "ndk-tv-body");
    const head2 = el("button", "ndk-tv-spoiler"); head2.type = "button";
    const titleEl = el("b", "");
    const paintTitle = (t) => { titleEl.textContent = String(t ?? "").trim() || tr("Trim, crop and settings"); };
    paintTitle(opts.title);
    const sumEl = el("span", "sum");
    head2.append(icon("chevD", 14), titleEl, sumEl);
    head2.addEventListener("click", () => { open = !open; opts.onOpen?.(open); applyOpen(); });
    function applyOpen() {
        head2.style.display = collapsible ? "" : "none";
        const show = !collapsible || open;
        body.style.display = show ? "" : "none";
        head2.classList.toggle("open", show);
        if (show) { stripKey = ""; buildStrip(); paintStrip(); }
        paintSummary();
    }
    function paintSummary() {
        const d = dur();
        const bits = [d ? `${st.start.toFixed(2)}–${endEff().toFixed(2)} s` : ""];
        if (st.crop) bits.push(tr("crop"));
        if (isV && st.fps) bits.push(`${+Number(st.fps).toFixed(2)} ${tr("fps")}`);
        if (infoLine.classList.contains("warn")) bits.push(`⚠ ${tr("too much memory")}`);
        sumEl.textContent = bits.filter(Boolean).join(" · ");
        head2.classList.toggle("warn", infoLine.classList.contains("warn"));
    }
    root.append(fileRow, player.el, msg, head2, body);
    if (isV) body.append(bar2);
    body.append(strip, segRow, setPanel, infoLine);
    const first = () => { name = String(fileWidget(node, kind)?.value ?? ""); seenText = settingsText(node, kind); st = readSettings(node, kind); fillSelect(false); load(); };
    first(); applyOpen();
    m.addEventListener("loadedmetadata", () => { buildStrip(); paint(); });

    return {
        el: root,
        // the node or the panel changed something: read it again
        update() {
            const t = settingsText(node, kind);
            if (t === seenText) return;
            seenText = t;
            const n = String(fileWidget(node, kind)?.value ?? "");
            st = readSettings(node, kind);
            if (n !== name) { name = n; fillSelect(false); load(); } else paint();
        },
        // the widget changes the options: collapsible, open
        setOptions(o) { if (o.title !== undefined) paintTitle(o.title); const c = !!o.collapsible; if (c !== collapsible || (o.open !== undefined && (o.open === true) !== open)) { collapsible = c; if (o.open !== undefined) open = o.open === true; applyOpen(); } },
        destroy() { dead = true; player.destroy(); },
        player,
    };
}
