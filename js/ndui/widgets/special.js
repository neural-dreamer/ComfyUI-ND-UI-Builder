// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI widgets — Resolution, Model Picker, Text Output.
import { el, icon, popup, clampN } from "./util.js";
import { forNode, latestAny } from "../events.js";
import { catalog, previewUrl, baseName, dirName , modelsVersion } from "../models.js";

/* ------------------------------------------------------------------ Resolution */

const FAMILIES = [["sd15", "SD 1.5 · 512", 512 * 512], ["sdxl", "SDXL · 1024", 1024 * 1024], ["flux", "Flux / SD3 · 1024", 1024 * 1024], ["keep", "Keep the area", 0]];
const RATIOS = [[1, 1], [4, 3], [3, 2], [16, 9], [21, 9]];
const MULTIPLES = [8, 16, 32, 64];
const roundTo = (v, m) => Math.max(m, Math.round(v / m) * m);

export const resolution = {
    type: "resolution", label: "Resolution", icon: "ratio", group: "Run", live: true,
    slots: [
        { id: "width", label: "Width", accepts: ["INT"], required: true },
        { id: "height", label: "Height", accepts: ["INT"], required: true },
    ],
    size: { w: 400, h: 176, minW: 240, minH: 120 },
    props: [
        { id: "family", kind: "select", label: "Size of the model", def: "sdxl", options: FAMILIES.map(([v, l]) => [v, l]), hint: "The area that the aspect-ratio buttons aim at." },
        { id: "multiple", kind: "select", label: "Multiple of", def: "64", options: MULTIPLES.map((m) => [String(m), String(m)]), hint: "Sizes are rounded to this number (never below what the node needs)." },
        { id: "showFam", kind: "bool", label: "Show the size of the model", def: true, hint: "Off: the button is hidden; the chosen size of the model is still used by the ratio buttons." },
        { id: "showMul", kind: "bool", label: "Show «Multiple of»", def: true, hint: "Off: the button is hidden; the chosen multiple is still used when sizes are rounded." },
        { id: "lock", kind: "bool", label: "Keep the ratio", def: false, hint: "Changing one side changes the other." },
        { id: "mp", kind: "bool", label: "Set the size in megapixels", def: false, hint: "Adds a field for the area in megapixels. The ratio buttons aim at that area instead of the size of the model." },
        { id: "mpValue", kind: "number", label: "Megapixels", def: 1, min: 0.01, max: 100, hint: "The area that the ratio buttons aim at while «Set the size in megapixels» is on. The field in the widget changes it too." },
    ],
    mount(ctx) {
        const root = el("div", "ndk-res");
        const main = el("div", "ndk-res-main");
        const ratios = el("div", "ndk-res-ratios");
        const size = el("div", "ndk-res-size");
        const fw = el("div", "ndk-field"), fh = el("div", "ndk-field");
        const iw = el("input", "ndk-input"), ih = el("input", "ndk-input");
        for (const i of [iw, ih]) { i.type = "text"; i.inputMode = "numeric"; i.spellcheck = false; }
        fw.append(iw); fh.append(ih);
        const swap = el("button", "ndk-iconbtn"); swap.type = "button"; swap.title = ctx.tr("Swap width and height"); swap.append(icon("swap", 16));
        const lock = el("button", "ndk-iconbtn"); lock.type = "button"; lock.title = ctx.tr("Keep the ratio"); lock.append(icon("lock", 15));
        size.append(fw, el("span", "x", "×"), fh, swap, lock);
        const opts = el("div", "ndk-res-opts");
        const fam = el("div", "ndk-chip"); fam.style.cursor = "pointer"; fam.title = ctx.tr("The size of the model: the buttons above aim at this area");
        const mul = el("div", "ndk-chip"); mul.style.cursor = "pointer"; mul.title = ctx.tr("Multiple of");
        // the area in megapixels (optional, the property «mp»): ◀ [ 1.00 ] ▶
        const mpBox = el("div", "ndk-res-mp"), mpIn = el("input", "ndk-input"), fmp = el("div", "ndk-field");
        mpIn.type = "text"; mpIn.inputMode = "decimal"; mpIn.spellcheck = false; mpIn.title = ctx.tr("Size in megapixels"); fmp.append(mpIn);
        const mpLess = el("button", "ndk-iconbtn"), mpMore = el("button", "ndk-iconbtn");
        mpLess.type = mpMore.type = "button";
        mpLess.title = ctx.tr("Smaller (Shift: bigger step)"); mpMore.title = ctx.tr("Bigger (Shift: bigger step)");
        mpLess.append(icon("chevL", 14)); mpMore.append(icon("chevR", 14));
        mpBox.append(el("span", "lab", "MP"), mpLess, fmp, mpMore);
        opts.append(mpBox, fam, mul);
        main.append(ratios, size, opts);
        const view = el("div", "ndk-res-view"), box = el("div", "ndk-res-box"), rect = el("div", "ndk-res-rect"), info = el("div");
        box.append(rect); view.append(box, info);
        root.append(main, view);
        ctx.body.append(root);

        const famId = () => ctx.prop("family") || "sdxl";
        const mult = () => {
            const own = Number(ctx.prop("multiple")) || 64;
            return Math.max(own, ctx.limits("width").step || 1, ctx.limits("height").step || 1);
        };
        const cur = () => ({ w: Number(ctx.get("width")) || 0, h: Number(ctx.get("height")) || 0 });
        let lockR = 0;
        const locked = () => !!ctx.prop("lock");
        const put = (w, h) => {
            const lw = ctx.limits("width"), lh = ctx.limits("height");
            ctx.set("width", clampN(Math.round(w), lw.min, lw.max));
            ctx.set("height", clampN(Math.round(h), lh.min, lh.max));
            show();
        };
        const mpOn = () => ctx.prop("mp") === true;
        const mpVal = () => { const v = Number(String(ctx.prop("mpValue") ?? "").replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : 1; };
        const area = () => { if (mpOn()) return mpVal() * 1e6; const f = FAMILIES.find((x) => x[0] === famId()); const c = cur(); return f && f[2] ? f[2] : (c.w * c.h || 1024 * 1024); };
        const applyRatio = (rw, rh) => {
            const c = cur(), m = mult();
            const portrait = c.h > c.w;
            const r = portrait ? rh / rw : rw / rh; // width / height
            const a = area();
            const w = Math.sqrt(a * r), h = w / r;
            put(roundTo(w, m), roundTo(h, m));
            if (locked()) lockR = r;
        };
        // a new area: the shape (the ratio of the sides) stays as it is now
        const setMp = (v) => {
            const mp = clampN(Math.round(v * 1000) / 1000, 0.01, 100);
            ctx.setProp?.("mpValue", mp);
            const c = cur(), m = mult();
            const r = locked() && lockR ? lockR : (c.w && c.h ? c.w / c.h : 1);
            const w = Math.sqrt(mp * 1e6 * r), h = w / r;
            put(roundTo(w, m), roundTo(h, m));
            if (locked()) lockR = r;
            show();
        };
        const mpStep = (dir, shift) => setMp(Math.round((mpVal() + dir * (shift ? 0.5 : 0.1)) * 100) / 100);
        mpIn.addEventListener("change", () => { const v = Number(mpIn.value.replace(",", ".")); if (Number.isFinite(v) && v > 0) setMp(v); else show(); });
        mpIn.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") mpIn.blur();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); mpStep(e.key === "ArrowUp" ? 1 : -1, e.shiftKey); }
        });
        mpIn.addEventListener("wheel", (e) => { if (!e.shiftKey) return; e.preventDefault(); e.stopPropagation(); mpStep(e.deltaY < 0 ? 1 : -1, false); }, { passive: false });
        mpLess.addEventListener("click", (e) => mpStep(-1, e.shiftKey));
        mpMore.addEventListener("click", (e) => mpStep(1, e.shiftKey));
        const commit = (which) => {
            const v = parseInt((which === "w" ? iw : ih).value, 10);
            const c = cur(), m = mult();
            if (!Number.isFinite(v) || v <= 0) { show(); return; }
            const val = roundTo(v, m);
            if (locked()) {
                const r = lockR || (c.h ? c.w / c.h : 1);
                lockR = r;
                if (which === "w") put(val, roundTo(val / r, m)); else put(roundTo(val * r, m), val);
            } else if (which === "w") put(val, c.h); else put(c.w, val);
        };
        for (const [i, k] of [[iw, "w"], [ih, "h"]]) {
            i.addEventListener("change", () => commit(k));
            i.addEventListener("keydown", (e) => {
                e.stopPropagation();
                if (e.key === "Enter") i.blur();
                if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); i.value = String((parseInt(i.value, 10) || 0) + (e.key === "ArrowUp" ? 1 : -1) * mult()); commit(k); }
            });
            i.addEventListener("wheel", (e) => { if (!e.shiftKey) return; e.preventDefault(); e.stopPropagation(); i.value = String((parseInt(i.value, 10) || 0) + (e.deltaY < 0 ? 1 : -1) * mult()); commit(k); }, { passive: false });
        }
        swap.addEventListener("click", () => { const c = cur(); put(c.h, c.w); if (lockR) lockR = 1 / lockR; });
        lock.addEventListener("click", () => {
            const on = !locked();
            if (ctx.setProp) ctx.setProp("lock", on);
            const c = cur(); lockR = on && c.h ? c.w / c.h : 0;
            show();
        });
        fam.addEventListener("click", () => { const i = FAMILIES.findIndex((x) => x[0] === famId()); const n = FAMILIES[(i + 1) % FAMILIES.length][0]; ctx.setProp?.("family", n); show(); });
        mul.addEventListener("click", () => { const i = MULTIPLES.indexOf(Number(ctx.prop("multiple")) || 64); const n = MULTIPLES[(i + 1) % MULTIPLES.length]; ctx.setProp?.("multiple", String(n)); show(); });

        let rkey = "";
        const show = () => {
            const { w, h } = cur();
            const active = document.activeElement;
            if (active !== iw) iw.value = w ? String(w) : "";
            if (active !== ih) ih.value = h ? String(h) : "";
            lock.classList.toggle("on", locked());
            const f = FAMILIES.find((x) => x[0] === famId());
            fam.textContent = ctx.tr(f ? f[1] : "SDXL · 1024");
            mul.textContent = `× ${Number(ctx.prop("multiple")) || 64}`;
            const sf = ctx.prop("showFam") !== false, sm = ctx.prop("showMul") !== false, mpo = mpOn();
            fam.style.display = sf && !mpo ? "" : "none"; mul.style.display = sm ? "" : "none"; mpBox.style.display = mpo ? "" : "none";
            opts.style.display = (sf && !mpo) || sm || mpo ? "" : "none";
            if (document.activeElement !== mpIn) mpIn.value = String(+mpVal().toFixed(2));
            const k = RATIOS.map((r) => r.join(":")).join(",");
            if (rkey !== k) {
                rkey = k; ratios.textContent = "";
                for (const [a, b] of RATIOS) {
                    const c = el("button", "ndk-chip", `${a}:${b}`); c.type = "button"; c.dataset.r = `${a}:${b}`;
                    c.addEventListener("click", () => applyRatio(a, b));
                    ratios.append(c);
                }
            }
            const r = w && h ? Math.max(w, h) / Math.min(w, h) : 0;
            for (const c of ratios.children) { const [a, b] = c.dataset.r.split(":").map(Number); c.classList.toggle("on", !!r && Math.abs(r - a / b) / (a / b) < 0.02); }
            if (w && h) {
                const s = 0.78, mx = Math.max(w, h);
                rect.style.width = `${(w / mx) * s * 100}%`; rect.style.height = `${(h / mx) * s * 100}%`;
                info.textContent = `${w} × ${h}  ·  ${((w * h) / 1e6).toFixed(2)} MP`;
            }
        };
        show();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Model Picker */

const FOLDERS = [["auto", "Automatic"], ["loras", "LoRAs"], ["checkpoints", "Checkpoints"], ["diffusion_models", "Diffusion models"], ["vae", "VAE"], ["text_encoders", "Text encoders"], ["controlnet", "ControlNet"], ["upscale_models", "Upscale models"], ["embeddings", "Embeddings"]];
const FOLDER_BY_NAME = [[/lora/i, "loras"], [/ckpt|checkpoint/i, "checkpoints"], [/unet|diffusion/i, "diffusion_models"], [/vae/i, "vae"], [/clip|text_enc|t5/i, "text_encoders"], [/control_?net/i, "controlnet"], [/upscale/i, "upscale_models"], [/embedding/i, "embeddings"]];
export const modelpicker = {
    type: "modelpicker", label: "Model Picker", icon: "cube", group: "Run",
    slots: [{ id: "value", label: "Model", accepts: ["COMBO"], required: true }],
    size: { w: 360, h: 64, minW: 140, minH: 44, maxH: 100 },
    props: [{ id: "folder", kind: "select", label: "Folder of models", def: "auto", options: FOLDERS, hint: "Where to look for the pictures. Automatic: from the name of the parameter." }],
    mount(ctx) {
        const f = el("div", "ndk-field ndk-mp"); f.tabIndex = 0; f.setAttribute("role", "button");
        const thumb = el("div", "ndk-mp-thumb"), name = el("div", "ndk-mp-name");
        f.append(thumb, name, icon("chevD", 16));
        ctx.body.append(f);
        const folderOf = () => {
            const p = ctx.prop("folder");
            if (p && p !== "auto") return p;
            const n = ctx.info("value").p?.name || "";
            const hit = FOLDER_BY_NAME.find(([re]) => re.test(n));
            return hit ? hit[1] : "";
        };
        let info = new Map(), loadedFor = "", seen = "", mv = modelsVersion;
        const load = (fresh) => { const fo = folderOf(); loadedFor = fo; if (!fo) { info = new Map(); show(); return Promise.resolve(); } return catalog(fo, fresh).then((m) => { if (loadedFor === fo) { info = m; seen = ""; show(); } }); };
        const show = () => {
            const v = ctx.get("value");
            const fo = folderOf();
            if (mv !== modelsVersion) { mv = modelsVersion; load(); } else if (fo !== loadedFor) load();   // R was pressed: read the folder again
            const text = v == null ? "" : String(v);
            const d = dirName(text);
            const k = `${text}|${info.size}|${fo}`;
            if (k === seen) return;
            seen = k;
            name.textContent = "";
            if (d) name.append(el("small", "", d + "/"));
            name.append(document.createTextNode(baseName(text) || ctx.tr("Choose…")));
            name.title = text;
            const m = info.get(text);
            thumb.textContent = "";
            if (m?.preview) { thumb.style.backgroundImage = `url("${previewUrl(fo, text)}")`; } else { thumb.style.backgroundImage = ""; thumb.append(icon("cube", 16)); }
        };
        const open = () => {
            if (ctx.editing && !ctx.info("value").bound) return;
            const fo = folderOf();
            return popup(ctx, f, {
                width: 560, maxH: 520,
                build(box, close) {
                    box.classList.add("ndk-mp-pop");
                    const head = el("div", "ndk-mp-head");
                    const search = el("div", "ndk-pop-search"); search.append(icon("search", 15));
                    const input = el("input", "ndk-input"); input.placeholder = ctx.tr("Search"); input.spellcheck = false; input.style.padding = "0";
                    search.append(input);
                    const refresh = el("button", "ndk-iconbtn"); refresh.type = "button"; refresh.title = ctx.tr("Reload the pictures"); refresh.append(icon("refresh", 15));
                    head.append(search, refresh);
                    const grid = el("div", "ndk-mp-grid");
                    box.append(head, grid);
                    const cur = ctx.get("value");
                    const draw = () => {
                        const q = input.value.trim().toLowerCase();
                        const opts = (ctx.info("value").options || []).filter((o) => !q || String(o).toLowerCase().includes(q));
                        grid.textContent = "";
                        if (!opts.length) { grid.append(el("div", "ndk-pop-empty", ctx.tr("Nothing found"))); return; }
                        for (const o of opts.slice(0, 400)) {
                            const c = el("button", `ndk-mp-card${o === cur ? " on" : ""}`); c.type = "button"; c.title = String(o);
                            const pic = el("div", "pic"), m = info.get(o);
                            if (m?.preview && fo) { const im = el("img"); im.loading = "lazy"; im.decoding = "async"; im.alt = ""; im.src = previewUrl(fo, o); im.style.cssText = "width:100%;height:100%;object-fit:cover;display:block"; pic.append(im); } else pic.append(icon("cube", 26));
                            const nm = el("div", "nm", baseName(o)); const d = dirName(o); if (d) nm.append(el("small", "", d));
                            c.append(pic, nm);
                            c.addEventListener("click", () => { ctx.set("value", o); close(); show(); });
                            grid.append(c);
                        }
                    };
                    input.addEventListener("input", draw);
                    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { const first = grid.querySelector(".ndk-mp-card"); first?.click(); } });
                    refresh.addEventListener("click", () => load(true).then(draw));
                    draw();
                    setTimeout(() => input.focus(), 0);
                },
            });
        };
        f.addEventListener("click", open);
        f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); open(); } e.stopPropagation(); });
        load();
        return { update: show };
    },
};

/* ------------------------------------------------------------------ Text Output */

export const textout = {
    type: "textout", label: "Text Output", icon: "terminal", group: "Results", live: true, fill: true,
    slots: [{ id: "text", label: "Text of", data: "text", required: false }],
    size: { w: 420, h: 200, minW: 120, minH: 60 },
    props: [
        { id: "mono", kind: "bool", label: "Monospace", def: false },
        { id: "copy", kind: "bool", label: "Copy button", def: true },
    ],
    mount(ctx) {
        const wrap = el("div", "ndk-tout");
        const box = el("div", "ndk-tout-box empty");
        const copy = el("button", "ndk-btn"); copy.type = "button"; copy.classList.add("copy"); copy.style.height = "28px"; copy.style.padding = "0 10px";
        copy.append(icon("copy", 14), el("span", "", ctx.tr("Copy")));
        wrap.append(box, copy);
        ctx.body.append(wrap);
        let text = "";
        copy.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
            copy.lastChild.textContent = ctx.tr("Copied"); setTimeout(() => { copy.lastChild.textContent = ctx.tr("Copy"); }, 1200);
        });
        const render = () => {
            const s = ctx.info("text");
            text = s.bound && s.node ? forNode(s.node).text : s.bound ? "" : latestAny("text").text;
            box.textContent = text || (s.lost ? ctx.tr("The node is gone. Bind it again.") : ctx.tr("The text appears here after a run"));
            box.classList.toggle("empty", !text);
            box.classList.toggle("mono", !!ctx.prop("mono"));
            copy.style.display = ctx.prop("copy") === false || !text ? "none" : "";
        };
        render();
        return { update: render };
    },
};
