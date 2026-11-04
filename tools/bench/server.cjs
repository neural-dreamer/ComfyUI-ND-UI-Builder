// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// Mock ComfyUI backend for the real frontend dist (v1.55.18): enough endpoints to boot, plus prompt capture.
// Data folder (BENCH_DATA, default: this folder): web/ (the unpacked frontend dist), ext/<pack>/ (copy of js/),
// object_info.json (see README.md). Nothing is executed: /api/prompt only records the prompt.
const http = require("http");
const fs = require("fs");
const path = require("path");
let WebSocketServer;
try { ({ WebSocketServer } = require("ws")); } catch { ({ WebSocketServer } = require("/opt/npm-tools/node_modules/ws")); }

const ROOT = process.env.BENCH_DATA || __dirname;
const WEB = path.join(ROOT, "web");
const EXT = path.join(ROOT, "ext"); // served as /extensions/<pack>/...
const PORT = Number(process.env.PORT || 8188);
const objectInfo = () => JSON.parse(fs.readFileSync(path.join(ROOT, "object_info.json"), "utf8"));
const settings = {};
const userdata = {};
const prompts = [], frees = [];
const unknown = new Set();

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ico": "image/x-icon", ".wasm": "application/wasm" };
const json = (res, data, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
const file = (res, p) => {
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
};
const body = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });

function extensionList() {
    const out = [];
    if (!fs.existsSync(EXT)) return out;
    for (const pack of fs.readdirSync(EXT)) {
        const walk = (dir, rel) => {
            for (const f of fs.readdirSync(dir)) {
                const p = path.join(dir, f), r = rel ? `${rel}/${f}` : f;
                if (fs.statSync(p).isDirectory()) walk(p, r);
                else if (f.endsWith(".js")) out.push(`/extensions/${pack}/${r}`);
            }
        };
        walk(path.join(EXT, pack), "");
    }
    return out;
}


// a small coloured picture for any file name (the bench has no real images): /view and the model previews
const zlib = require("zlib");
const PICS = process.env.BENCH_PICS ? fs.readdirSync(process.env.BENCH_PICS).filter((f) => /\.png$/i.test(f)).sort().map((f) => path.join(process.env.BENCH_PICS, f)) : [];
function crc32(buf) { let c, crc = -1; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function pngOf(seed, w = 256, h = 192) {
    let hsh = 0; for (const ch of String(seed)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hsh % 360, raw = Buffer.alloc((w * 3 + 1) * h);
    const hsl = (hh, s, l) => { const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + hh / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)); };
    for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const c = hsl((hue + (x / w) * 60) % 360, 0.7, 0.3 + 0.4 * (y / h)); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; } }
    const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const LORA_META = { "style_neon.safetensors": { title: "Neon Style", base: "SDXL 1.0", words: ["neon glow", "cyberpunk"], url: "https://civitai.com/models/1?modelVersionId=2", usage: "strength range: 0.6-1.0", version: "v1.0" }, "style_anime.safetensors": { title: "Anime Style", base: "SDXL 1.0", words: ["anime"] }, "characters/hero_v2.safetensors": { title: "Hero v2", base: "Flux.1 D", words: ["hero", "armor"] }, "characters/villain.safetensors": { title: "Villain", base: "Flux.1 D", words: [] } };
const FAKE_MODELS = { loras: ["style_neon.safetensors", "style_anime.safetensors", "characters/hero_v2.safetensors", "characters/villain.safetensors", "detail_tweaker.safetensors"], checkpoints: ["sdxl_base.safetensors", "realistic_v5.safetensors"], diffusion_models: ["flux1-dev.safetensors", "wan2.2_t2v.safetensors"] };
// what the pack's catalog says about every LoRA: kind of preview, the automatic NSFW level and the mark the person made
const LORA_MEDIA = { "style_neon.safetensors": { kind: "image" }, "style_anime.safetensors": { kind: "video" }, "characters/hero_v2.safetensors": { kind: "image", level: 8 }, "characters/villain.safetensors": { kind: "" }, "detail_tweaker.safetensors": { kind: "image", level: 4 } };
const ND_LORAS = { on: true, marks: {}, posts: [] };
function ndLoraRecord(n, i) {
    const md = LORA_MEDIA[n] || { kind: "" }, auto = (md.level || 0) >= 4, user = n in ND_LORAS.marks;
    return { name: n, folder: "loras", size: 1e8 + i, mtime: 1700000000 + i, preview: md.kind ? { kind: md.kind, v: 1700000000 + i } : null, ...(LORA_META[n] || {}), nsfw: user ? ND_LORAS.marks[n] : auto, nsfw_src: user ? "user" : "auto", nsfw_level: md.level || 0 };
}
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    let p = decodeURIComponent(u.pathname);
    if (p.startsWith("/api/")) p = p.slice(4);
    if (p === "/" || p === "/index.html") return file(res, path.join(WEB, "index.html"));
    if (p.startsWith("/extensions/")) {
        const rest = p.slice("/extensions/".length);
        const ours = path.join(EXT, rest);
        if (fs.existsSync(ours)) return file(res, ours);
        return file(res, path.join(WEB, "extensions", rest));
    }
    if (p === "/object_info") return json(res, objectInfo());
    if (p.startsWith("/object_info/")) return json(res, { [p.split("/")[2]]: objectInfo()[p.split("/")[2]] });
    if (p === "/extensions") return json(res, extensionList());
    if (p === "/embeddings") return json(res, []);
    if (p === "/users") return json(res, { storage: "server", migrated: true });
    if (p === "/settings" && req.method === "GET") return json(res, settings);
    if (p === "/settings" && req.method === "POST") { Object.assign(settings, JSON.parse((await body(req)) || "{}")); return json(res, {}); }
    if (p.startsWith("/settings/")) {
        const id = p.slice(10);
        if (req.method === "POST") { settings[id] = JSON.parse((await body(req)) || "null"); return json(res, {}); }
        return json(res, settings[id] ?? null);
    }
    if (p === "/system_stats") return json(res, { system: { os: "posix", ram_total: 8e9, ram_free: 7e9, comfyui_version: "0.42.5", required_frontend_version: "1.55.18", installed_templates_version: "0.11.96", required_templates_version: "0.11.96", python_version: "3.13", pytorch_version: "2.14", embedded_python: false, argv: ["main.py"] }, devices: [] });
    if (p === "/global_subgraphs") return json(res, {});
    if (p.startsWith("/global_subgraphs/")) return json(res, null);
    if (p === "/prompt" && req.method === "POST") {
        const data = JSON.parse(await body(req));
        prompts.push(data);
        fs.writeFileSync(path.join(ROOT, "last_prompt.json"), JSON.stringify(data, null, 1));
        return json(res, { prompt_id: `p${prompts.length}`, number: prompts.length, node_errors: {} });
    }
    if (p === "/free" && req.method === "POST") { frees.push(JSON.parse(await body(req) || "{}")); return json(res, {}); }
    if (p === "/bench/frees") return json(res, frees);
    if (p === "/prompt") return json(res, { exec_info: { queue_remaining: 0 } });
    if (p === "/queue") return json(res, { queue_running: [], queue_pending: [] });
    if (p.startsWith("/history") || p.startsWith("/jobs")) return json(res, p.startsWith("/jobs") ? { jobs: [], pagination: { offset: 0, limit: 100, total: 0, has_more: false } } : {});
    if (p === "/workflow_templates") return json(res, {});
    if (p.startsWith("/templates/")) return json(res, []);
    if (p === "/features") return json(res, { supports_preview_metadata: true });
    if (p.startsWith("/i18n")) return json(res, {});
    if (p.startsWith("/userdata")) {
        const q = p.slice("/userdata".length).replace(/^\//, "");
        if (!q) {
            const sp = new URL(req.url, "http://x").searchParams, dir = (sp.get("dir") || "").replace(/\/$/, ""), full = sp.get("full_info") === "true";
            const names = Object.keys(userdata).filter((k) => !dir || k.startsWith(dir + "/")).map((k) => (dir ? k.slice(dir.length + 1) : k));
            return json(res, full ? names.map((n) => ({ path: n, size: userdata[dir ? dir + "/" + n : n].length, modified: Date.now() / 1000 })) : names);
        }
        if (req.method === "DELETE") { if (!(q in userdata)) { res.writeHead(404); return res.end(); } delete userdata[q]; res.writeHead(204); return res.end(); }
        if (req.method === "POST") { userdata[q] = await body(req); return json(res, { path: q }); }
        if (q in userdata) { res.writeHead(200); return res.end(userdata[q]); }
        res.writeHead(404); return res.end();
    }
    if (p.startsWith("/v2/userdata")) return json(res, []);
    if (p.startsWith("/experiment/models")) return json(res, []);
    if (p === "/ndui/models/preview") { const q = new URL(req.url, "http://x").searchParams; if (!(FAKE_MODELS[q.get("folder")] || []).includes(q.get("name"))) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": "image/png" }); return res.end(pngOf(q.get("name"), 128, 128)); }
    if (p.startsWith("/ndui/models/")) { const f = decodeURIComponent(p.slice(13)); if (!FAKE_MODELS[f]) return json(res, []); return json(res, FAKE_MODELS[f].map((n, i) => ({ name: n, folder: f, size: 1e8 + i, mtime: 1700000000 + i, preview: !n.includes("villain"), ...(f === "loras" ? LORA_META[n] || {} : {}) }))); }
    // Neural Dreamer Nodes 1.3.0: the catalog of LoRAs with video previews and the NSFW marks (switch it off with POST /bench/nd_loras {"on":false}: the pack is "not installed")
    if (p === "/bench/nd_loras" && req.method === "POST") { const d = JSON.parse((await body(req)) || "{}"); ND_LORAS.on = d.on !== false; if (d.reset) { for (const k of Object.keys(ND_LORAS.marks)) delete ND_LORAS.marks[k]; ND_LORAS.posts.length = 0; } return json(res, { on: ND_LORAS.on }); }
    if (p === "/bench/nd_loras/posts") return json(res, ND_LORAS.posts);
    if (p.startsWith("/nd/loras")) {
        if (!ND_LORAS.on) { res.writeHead(404); return res.end(); }
        const q = u.searchParams, nm = q.get("name") || "";
        if (p === "/nd/loras/nsfw" && req.method === "POST") {
            const d = JSON.parse((await body(req)) || "{}");
            if (!FAKE_MODELS.loras.includes(d.name)) return json(res, { error: "unknown" }, 404);
            ND_LORAS.posts.push(d);
            if (d.nsfw === null || d.nsfw === undefined) delete ND_LORAS.marks[d.name]; else ND_LORAS.marks[d.name] = !!d.nsfw;
            return json(res, ndLoraRecord(d.name, FAKE_MODELS.loras.indexOf(d.name)));
        }
        if (p === "/nd/loras/preview") { if (!FAKE_MODELS.loras.includes(nm) || !(LORA_MEDIA[nm] || {}).kind) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": "image/png" }); return res.end(pngOf(nm, q.get("big") ? 256 : 128, q.get("big") ? 256 : 128)); }
        if (p === "/nd/loras/video") {
            if (!FAKE_MODELS.loras.includes(nm) || (LORA_MEDIA[nm] || {}).kind !== "video") { res.writeHead(404); return res.end(); }
            const buf = fs.readFileSync(path.join(__dirname, "media", "clip.webm"));
            const rg = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
            if (rg) { const a = rg[1] === "" ? 0 : Number(rg[1]), b = rg[2] === "" ? buf.length - 1 : Math.min(Number(rg[2]), buf.length - 1); res.writeHead(206, { "Content-Type": "video/webm", "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Accept-Ranges": "bytes", "Content-Length": b - a + 1 }); return res.end(buf.subarray(a, b + 1)); }
            res.writeHead(200, { "Content-Type": "video/webm", "Accept-Ranges": "bytes", "Content-Length": buf.length }); return res.end(buf);
        }
        if (p === "/nd/loras") return json(res, FAKE_MODELS.loras.map((n, i) => ndLoraRecord(n, i)));
    }
    if (p === "/ndui/media/list") { const k = new URL(req.url, "http://x").searchParams.get("kind"); return json(res, k === "audio" ? ["tone.wav", "sub/tone2.wav", "clip.mp4"] : ["clip.mp4", "other.mp4"]); }
    if (p === "/ndui/media/info") {
        const n = new URL(req.url, "http://x").searchParams.get("name") || "";
        if (/missing/.test(n)) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end("{\"error\":\"not found\"}"); }
        if (/\.(wav|mp3|flac|ogg|m4a)$/i.test(n)) return json(res, { duration: /2/.test(n) ? 2 : 3, width: 0, height: 0, display_w: 0, display_h: 0, rotation: 0, fps: 0, frames: 0, has_audio: true, ram_free: 20 * 2 ** 30, ram_total: 32 * 2 ** 30, audio_rate: 48000, audio_channels: 2, codec: "pcm_s16le" });
        const rot = /rot/.test(n);
        return json(res, { duration: 3, width: rot ? 120 : 160, height: rot ? 160 : 120, display_w: 160, display_h: 120, rotation: rot ? 90 : 0, fps: 10, frames: 30, has_audio: !/silent/.test(n), ram_free: 20 * 2 ** 30, ram_total: 32 * 2 ** 30, audio_rate: 32000, audio_channels: 2, codec: "vp8" });
    }
    if (p === "/upload/image" && req.method === "POST") { const b = await body(req); const m = /filename="([^"]+)"/.exec(b); return json(res, { name: m ? m[1] : "upload.png", subfolder: "", type: "input" }); }
    if (p.startsWith("/view")) {
        const q = new URL(req.url, "http://x").searchParams, fn = q.get("filename") || "x";
        // real small media files for the players (made with ffmpeg, see media/): any video / sound name gets one; Range is served for seeking
        const mf = /\.(mp4|webm|mov|mkv)$/i.test(fn) ? (process.env.BENCH_VIDEO ? [process.env.BENCH_VIDEO, "video/mp4"] : ["clip.webm", "video/webm"]) : /\.(wav|mp3|flac|ogg|m4a)$/i.test(fn) ? [/2/.test(fn) ? "tone2.wav" : "tone.wav", "audio/wav"] : null;
        if (mf) {
            const buf = fs.readFileSync(path.isAbsolute(mf[0]) ? mf[0] : path.join(__dirname, "media", mf[0]));
            const rg = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
            if (rg) { const a = rg[1] ? +rg[1] : 0, b = rg[2] ? Math.min(+rg[2], buf.length - 1) : buf.length - 1; res.writeHead(206, { "Content-Type": mf[1], "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Content-Length": b - a + 1 }); return res.end(buf.subarray(a, b + 1)); }
            res.writeHead(200, { "Content-Type": mf[1], "Accept-Ranges": "bytes", "Content-Length": buf.length }); return res.end(buf);
        }
        // docs screenshots: BENCH_PICS=<folder with real pictures> gives every image name one of them (stable by the name)
        if (PICS.length) { let h = 0; for (const ch of String(fn)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const f = PICS[h % PICS.length]; res.writeHead(200, { "Content-Type": "image/png" }); return res.end(fs.readFileSync(f)); }
        res.writeHead(200, { "Content-Type": "image/png" }); return res.end(pngOf(q.get("filename") || "x"));
    }
    if (p === "/bench/prompts") return json(res, prompts);
    if (p === "/bench/unknown") return json(res, [...unknown]);
    const f = path.join(WEB, p);
    if (fs.existsSync(f) && !fs.statSync(f).isDirectory()) return file(res, f);
    unknown.add(`${req.method} ${p}`);
    if (p.endsWith(".css")) { res.writeHead(200, { "Content-Type": "text/css" }); return res.end(""); }
    if (p.endsWith(".json") || req.headers.accept?.includes("json")) return json(res, {});
    res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ noServer: true });
const sockets = new Set();
server.on("upgrade", (req, sock, head) => {
    if (!req.url.startsWith("/ws")) return sock.destroy();
    wss.handleUpgrade(req, sock, head, (ws) => {
        sockets.add(ws);
        ws.on("close", () => sockets.delete(ws));
        ws.send(JSON.stringify({ type: "status", data: { status: { exec_info: { queue_remaining: 0 } }, sid: "bench" } }));
    });
});
// let a test push websocket messages: POST /bench/ws with {type, data}
server.on("request", () => {});
const origEmit = server.emit.bind(server);
server.emit = function (ev, ...args) {
    const [req, res] = args;
    if (ev === "request" && req.url === "/bench/ws" && req.method === "POST") {
        body(req).then((b) => { for (const s of sockets) s.send(b); json(res, { sent: sockets.size }); });
        return true;
    }
    // POST /bench/wsbin {meta:{node_id,display_node_id,prompt_id,image_type}, b64} -> binary preview message (type 4)
    if (ev === "request" && req.url === "/bench/wsbin" && req.method === "POST") {
        body(req).then((b) => {
            const { meta, b64, kind } = JSON.parse(b);
            let msg;
            if (kind === 1) {   // PREVIEW_IMAGE without a node: [1][image type 1 = jpeg][data]
                const head = Buffer.alloc(8); head.writeUInt32BE(1, 0); head.writeUInt32BE(1, 4);
                msg = Buffer.concat([head, Buffer.from(b64, "base64")]);
            } else {
                const m = Buffer.from(JSON.stringify(meta));
                const head = Buffer.alloc(8);
                head.writeUInt32BE(4, 0);
                head.writeUInt32BE(m.length, 4);
                msg = Buffer.concat([head, m, Buffer.from(b64, "base64")]);
            }
            for (const s of sockets) s.send(msg, { binary: true });
            json(res, { sent: sockets.size });
        });
        return true;
    }
    return origEmit(ev, ...args);
};
server.listen(PORT, "127.0.0.1", () => console.log(`bench on ${PORT}`));
