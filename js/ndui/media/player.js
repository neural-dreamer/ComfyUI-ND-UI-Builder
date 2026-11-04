// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the player of sounds and videos (own controls in the style of the Kit over <audio> / <video>), shared by the Audio Player,
// the Video Player and (later) the loaders with a trim bar.
//   controls: play, a time line you can drag (with the time under the cursor), time, speed, loop, volume / mute, full screen (video), Save, a handle to pull the file out;
//   keys while the player has the focus: Space, left / right (one frame in a video, 5 s in a sound; Shift: 5 s), M (mute), L (loop), F (full screen);
//   an audio file shows its wave form (decoded in the browser, cached by address; files over 60 MB get a plain bar).
import { el, icon } from "../widgets/util.js";
import { fileUrl, makeDraggable, downloadRef } from "./io.js";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const WAVE_MAX = 60 * 1024 * 1024;
const fpsCache = new Map();       // url -> frames per second (measured)
const peaksCache = new Map();    // url -> Float32Array | null (null: no wave form)

export const fmtTime = (t) => {
    t = Number(t); if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
};

export async function loadPeaks(url, bins = 800) {
    if (peaksCache.has(url)) return peaksCache.get(url);
    peaksCache.set(url, null);
    try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const len = Number(r.headers.get("content-length") || 0);
        if (len > WAVE_MAX) return null;
        const buf = await r.arrayBuffer();
        if (buf.byteLength > WAVE_MAX) return null;
        const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const ab = await new Ctx(1, 1, 44100).decodeAudioData(buf);
        const out = new Float32Array(bins), chs = [];
        for (let c = 0; c < ab.numberOfChannels; c++) chs.push(ab.getChannelData(c));
        const per = Math.max(1, Math.floor(ab.length / bins));
        for (let b = 0; b < bins; b++) {
            let mx = 0;
            const a0 = b * per, a1 = Math.min(ab.length, a0 + per);
            for (const d of chs) for (let i = a0; i < a1; i += Math.max(1, Math.floor(per / 64))) { const v = Math.abs(d[i]); if (v > mx) mx = v; }
            out[b] = mx;
        }
        peaksCache.set(url, out);
        return out;
    } catch { return null; }
}

// frames per second of a video: the one the node reported, or measured with a short silent run (cached); 24 when the browser cannot tell
async function measureFps(m, url, hint) {
    const h = Number(hint);
    if (h > 0 && h < 1000) return h;
    if (fpsCache.has(url)) return fpsCache.get(url);
    if (typeof m.requestVideoFrameCallback !== "function") return 24;
    const t0 = m.currentTime, wasMuted = m.muted, wasRate = m.playbackRate, wasLoop = m.loop;
    const times = [];
    await new Promise((done) => {
        const stop = () => done();
        const cb = (_now, meta) => { times.push(meta.mediaTime); if (times.length >= 8) stop(); else m.requestVideoFrameCallback(cb); };
        m.muted = true; m.playbackRate = 1; m.loop = false;
        m.requestVideoFrameCallback(cb);
        m.play().catch(stop);
        setTimeout(stop, 1500);
    });
    m.pause(); m.muted = wasMuted; m.playbackRate = wasRate; m.loop = wasLoop; m.currentTime = t0;
    const d = [];
    for (let i = 1; i < times.length; i++) { const x = times[i] - times[i - 1]; if (x > 0.001) d.push(x); }
    d.sort((a, b) => a - b);
    const med = d.length ? d[Math.floor(d.length / 2)] : 0;
    const fps = med > 0 ? Math.round((1 / med) * 100) / 100 : 24;
    const snap = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60].find((f) => Math.abs(f - fps) < 0.6) || fps;
    fpsCache.set(url, snap);
    return snap;
}

// kind: "audio" | "video"; o: {props(): {autoplay, loop, muted, volume, save, fit, wave}, setProp(k, v), tr(s)}
export function createPlayer(kind, o) {
    const tr = o.tr || ((s) => s);
    const root = el("div", `ndk-pl ${kind}`); root.tabIndex = 0;
    const stage = el("div", "stage");
    const m = document.createElement(kind === "video" ? "video" : "audio");
    m.preload = "metadata"; m.playsInline = true;
    let canvas = null;
    if (kind === "video") stage.append(m); else { canvas = el("canvas", "wave"); stage.append(canvas); m.style.display = "none"; root.append(m); }
    const big = el("button", "big"); big.type = "button"; big.append(icon("play", 30));
    const msg = el("div", "msg"); msg.style.display = "none";
    stage.append(big, msg);

    const bar = el("div", "bar");
    const mk = (ic, title, fn, cls = "") => { const b = el("button", cls); b.type = "button"; b.title = title; b.append(icon(ic, 16)); b.addEventListener("click", (e) => { e.stopPropagation(); fn(b); }); return b; };
    const swap = (b, ic) => { b.textContent = ""; b.append(icon(ic, 16)); };
    const bPlay = mk("play", tr("Play / pause (Space)"), () => toggle(), "play");
    const time = el("span", "time", "0:00 / 0:00");
    const track = el("div", "track"), fill = el("i", "fill"), knob = el("i", "knob"), tip = el("span", "tip");
    track.append(fill, knob, tip);
    const bSpeed = el("button", "speed", "1×"); bSpeed.type = "button"; bSpeed.title = tr("Speed");
    const bLoop = mk("repeat", tr("Loop (L)"), () => { const v = !m.loop; m.loop = v; o.setProp("loop", v); paintBtns(); }, "loop");
    const bMute = mk("volume", tr("Mute (M)"), () => { m.muted = !m.muted; o.setProp("muted", m.muted); paintBtns(); }, "mute");
    const vol = el("input", "vol"); vol.type = "range"; vol.min = 0; vol.max = 1; vol.step = 0.01; vol.title = tr("Volume");
    const bFull = kind === "video" ? mk("expand", tr("Full screen (F)"), () => fullscreen(), "full") : null;
    const bSave = mk("download", tr("Save"), () => { if (ref) downloadRef(ref); }, "save");
    const grip = el("button", "grip"); grip.type = "button"; grip.title = tr("Drag the file out of the page"); grip.append(icon("grip", 16));
    bar.append(bPlay, time, track, bSpeed, bLoop, bMute, vol);
    if (bFull) bar.append(bFull);
    bar.append(bSave, grip);
    root.append(stage, bar);

    let ref = null, key = "", peaks = null, raf = 0, dead = false;
    makeDraggable(grip, () => ref, { nd: false });

    const toggle = () => { if (!m.src) return; if (m.paused) m.play().catch(() => {}); else m.pause(); };
    const fullscreen = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else (root.requestFullscreen?.() || m.requestFullscreen?.()); } catch {} };
    const jump = (dt) => { m.currentTime = Math.max(0, Math.min(dur() || 1e9, m.currentTime + dt)); };
    // one frame back / forward (a playing video is paused first); the frame rate is measured once per file
    let stepping = false;
    const step = async (dir) => {
        if (!ref || stepping) return;
        stepping = true;
        try {
            if (!m.paused) m.pause();
            const fps = await measureFps(m, m.currentSrc || m.src, ref.frame_rate);
            const dt = 1 / fps;
            // half a frame in, so that the time lands inside the wanted frame
            const cur = Math.floor(m.currentTime / dt + 0.02);
            m.currentTime = Math.max(0, Math.min(Math.max(0, dur() - dt / 2), (cur + dir + 0.5) * dt));
        } finally { stepping = false; }
    };
    const dur = () => (Number.isFinite(m.duration) ? m.duration : 0);
    const seekTo = (frac) => { const d = dur(); if (d) { m.currentTime = Math.max(0, Math.min(1, frac)) * d; paint(); } };

    function paintBtns() {
        swap(bPlay, m.paused ? "play" : "pause");
        big.style.display = m.paused && ref && !m.error ? "" : "none";
        swap(bMute, m.muted || m.volume === 0 ? "volumeOff" : "volume");
        bLoop.classList.toggle("on", !!m.loop);
        bSpeed.textContent = `${m.playbackRate}×`.replace("0.5×", "0.5×");
        vol.value = m.muted ? 0 : m.volume;
    }
    function paint() {
        const d = dur(), t = m.currentTime || 0, f = d ? t / d : 0;
        time.textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
        fill.style.width = `${f * 100}%`; knob.style.left = `${f * 100}%`;
        if (canvas) drawWave(f);
    }
    function drawWave(f) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
        const g = canvas.getContext("2d");
        g.clearRect(0, 0, canvas.width, canvas.height);
        const cs = getComputedStyle(root);
        const on = cs.getPropertyValue("--ndk-accent").trim() || "#7757fa", off = cs.getPropertyValue("--ndk-faint").trim() || "#6b7280";
        const bw = 3 * dpr, gap = 2 * dpr, n = Math.max(1, Math.floor(canvas.width / (bw + gap)));
        canvas.dataset.bars = peaks ? String(n) : "0";
        for (let i = 0; i < n; i++) {
            let v = 0.08;
            if (peaks) { const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length)); v = 0; for (let k = a; k < b; k++) v = Math.max(v, peaks[k]); v = Math.max(0.04, Math.min(1, v * 1.15)); }
            const bh = Math.max(2 * dpr, v * canvas.height * 0.86);
            g.fillStyle = i / n <= f ? on : off;
            g.globalAlpha = i / n <= f ? 1 : 0.55;
            g.fillRect(i * (bw + gap), (canvas.height - bh) / 2, bw, bh);
        }
        g.globalAlpha = 1;
    }
    const tick = () => { raf = 0; paint(); if (!m.paused && !dead) raf = requestAnimationFrame(tick); };

    for (const ev of ["play", "pause", "volumechange", "ratechange", "ended", "emptied"]) m.addEventListener(ev, () => { paintBtns(); if (ev === "play" && !raf) raf = requestAnimationFrame(tick); });
    for (const ev of ["timeupdate", "loadedmetadata", "durationchange", "seeked"]) m.addEventListener(ev, paint);
    m.addEventListener("error", () => {
        msg.style.display = ""; msg.textContent = tr("The browser cannot play this file.");
        paintBtns();
    });
    m.addEventListener("loadeddata", () => { msg.style.display = "none"; paintBtns(); });

    big.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    if (kind === "video") { m.addEventListener("click", toggle); m.addEventListener("dblclick", fullscreen); }
    if (canvas) canvas.addEventListener("pointerdown", (e) => { const r = canvas.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width); });

    // the time line: drag to seek, the time under the cursor
    const frac = (e) => { const r = track.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    track.addEventListener("pointermove", (e) => { const f = Math.max(0, Math.min(1, frac(e))); tip.textContent = fmtTime(f * dur()); tip.style.left = `${f * 100}%`; });
    track.addEventListener("pointerdown", (e) => {
        track.setPointerCapture(e.pointerId); seekTo(frac(e));
        const mv = (ev) => seekTo(frac(ev));
        const up = (ev) => { track.removeEventListener("pointermove", mv); track.removeEventListener("pointerup", up); try { track.releasePointerCapture(ev.pointerId); } catch {} };
        track.addEventListener("pointermove", mv); track.addEventListener("pointerup", up);
    });
    bSpeed.addEventListener("click", (e) => { e.stopPropagation(); m.playbackRate = SPEEDS[(SPEEDS.indexOf(m.playbackRate) + 1) % SPEEDS.length] || 1; });
    vol.addEventListener("input", () => { m.volume = Number(vol.value); m.muted = m.volume === 0; });
    vol.addEventListener("change", () => { o.setProp("volume", m.volume); o.setProp("muted", m.muted); });
    root.addEventListener("keydown", (e) => {
        if (e.target?.tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === " ") toggle();
        else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const dir = e.key === "ArrowLeft" ? -1 : 1;
            if (kind === "video" && !e.shiftKey) step(dir); else jump(dir * 5);
        }
        else if (k === "m") bMute.click();
        else if (k === "l") bLoop.click();
        else if (k === "f" && kind === "video") fullscreen();
        else return;
        e.preventDefault(); e.stopPropagation();
    });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { if (canvas) paint(); }) : null;
    ro?.observe(root);

    return {
        el: root, media: m,
        // the file to play (null: nothing); the props are read again every time
        setRef(r) {
            const p = o.props();
            const nk = r ? `${r.type}|${r.subfolder}|${r.filename}|${r.rand ?? ""}` : "";
            if (nk === key && r) ref = r;
            if (nk !== key) {
                key = nk; ref = r || null; peaks = null; msg.style.display = "none";
                if (!r) { m.removeAttribute("src"); m.load(); }
                else {
                    const url = fileUrl(r);
                    m.src = url;
                    if (canvas && p.wave !== false) { loadPeaks(url).then((pk) => { if (!dead && key === nk) { peaks = pk; paint(); } }); }
                    if (p.autoplay) m.play().catch(() => {});
                }
            }
            this.applyProps();
            grip.style.display = bSave.style.display = ref ? "" : "none";
            bSave.style.display = ref && p.save !== false ? "" : "none";
            paintBtns(); paint();
        },
        applyProps() {
            const p = o.props();
            if (m.loop !== !!p.loop) m.loop = !!p.loop;
            if (m.muted !== !!p.muted) m.muted = !!p.muted;
            const v = Number.isFinite(Number(p.volume)) ? Math.max(0, Math.min(1, Number(p.volume))) : 1;
            if (Math.abs(m.volume - v) > 0.001) m.volume = v;
            if (kind === "video") m.style.objectFit = p.fit === "cover" ? "cover" : "contain";
        },
        destroy() { dead = true; if (raf) cancelAnimationFrame(raf); ro?.disconnect(); try { m.pause(); m.removeAttribute("src"); m.load(); } catch {} },
    };
}
