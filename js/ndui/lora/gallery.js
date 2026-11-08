// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the gallery of models: a window with pictures, a search, a folder and a base model filter, favourites and the recently used.
// openGallery(ctx, anchor, {folder, names, current, title, onPick}); ctx = {tr, vars(), popupHost()} (the same as the popups of the widgets).
import { el, icon, popup } from "../widgets/util.js";
import { infoButtons, fillInfo, hasInfo } from "./info_view.js";
import { catalog, previewOf, previewUrlOf, isNd, dirName, stemName, favorites, recents, galleryFilter , onModelsChanged } from "../models.js";
import { videoEl, nsfwButton, shieldButton } from "./media.js";

export function openGallery(ctx, anchor, { folder = "loras", names = null, current = null, title = "", onPick }) {
    const tr = (s, v) => (ctx.tr ? ctx.tr(s, v) : s);
    return popup(ctx, anchor, {
        width: 640, maxH: 860, center: { w: 1180, h: 860 },
        build(box, close) {
            box.classList.add("ndk-mp-pop", "ndk-lg");
            const head = el("div", "ndk-mp-head");
            const search = el("div", "ndk-pop-search"); search.append(icon("search", 15));
            const input = el("input", "ndk-input"); input.placeholder = tr("Search by name, trigger word or base model"); input.spellcheck = false; input.style.padding = "0";
            search.append(input);
            const star = el("button", "ndk-iconbtn ndk-lg-favbtn"); star.type = "button"; star.title = tr("Only the favourites"); star.append(icon("star", 15));
            const refresh = el("button", "ndk-iconbtn"); refresh.type = "button"; refresh.title = tr("Reload the list and the pictures"); refresh.append(icon("refresh", 15));
            const eye = nsfwButton(tr); eye.style.display = "none";   // only when the catalog comes from Neural Dreamer Nodes (it knows the NSFW flag)
            head.append(search, star, eye, refresh);
            const filters = el("div", "ndk-lg-filters");
            const selDir = el("select", "ndk-lg-sel"), selBase = el("select", "ndk-lg-sel");
            const clear = el("button", "ndk-lg-clear"); clear.type = "button"; clear.title = tr("Reset the filters"); clear.append(icon("x", 13), el("span", "", tr("Clear")));
            filters.append(selDir, selBase, clear);
            if (title) box.append(el("div", "ndk-lg-title", title));
            const grid = el("div", "ndk-mp-grid");
            box.append(head, filters, grid);

            const saved = galleryFilter.get(folder);
            let info = new Map(), onlyFav = saved.fav, favs = favorites.all(folder);
            const list = () => (names ? names.map(String) : [...info.keys()]);
            let first = true;
            const fillFilters = () => {
                const dirs = [...new Set(list().map(dirName))].sort();
                const bases = [...new Set(list().map((n) => info.get(n)?.base).filter(Boolean))].sort();
                const keep = first ? [saved.dir, saved.base] : [selDir.value, selBase.value]; first = false;
                selDir.textContent = ""; selBase.textContent = "";
                selDir.append(new Option(tr("All folders"), ""), ...dirs.map((d) => new Option(d || tr("(no folder)"), d || "\u0000")));
                selBase.append(new Option(tr("All base models"), ""), ...bases.map((b) => new Option(b, b)));
                selDir.value = [...selDir.options].some((o) => o.value === keep[0]) ? keep[0] : "";
                selBase.value = [...selBase.options].some((o) => o.value === keep[1]) ? keep[1] : "";
                selDir.style.display = dirs.length > 1 ? "" : "none";
                selBase.style.display = bases.length > 1 ? "" : "none";
                filters.style.display = dirs.length > 1 || bases.length > 1 ? "" : "none";
            };
            const remember = () => { galleryFilter.set(folder, { dir: selDir.value, base: selBase.value, fav: onlyFav }); };
            const dirty = () => !!(selDir.value || selBase.value || onlyFav || input.value.trim());
            const match = (n) => {
                const m = info.get(n) || {}, q = input.value.trim().toLowerCase();
                if (onlyFav && !favs.has(n)) return false;
                if (selDir.value && (selDir.value === "\u0000" ? dirName(n) : dirName(n) !== selDir.value)) return false;
                if (selBase.value && m.base !== selBase.value) return false;
                if (!q) return true;
                return [n, m.title, m.base, ...(m.words || [])].some((x) => x && String(x).toLowerCase().includes(q));
            };
            // the info of a LoRA lies over the gallery; «back» returns to the tiles
            const showInfo = (n, m) => {
                const ov = el("div", "ndk-lg-info"), bar = el("div", "ndk-lg-info-bar");
                const back = el("button", "ndk-btn"); back.type = "button"; back.append(icon("chevL", 14), el("span", "", tr("Back")));
                back.addEventListener("click", () => ov.remove());
                bar.append(back); ov.append(bar);
                const content = el("div"); content.style.cssText = "display:flex;flex-direction:column;min-height:0;flex:1 1 auto"; ov.append(content);
                fillInfo(content, m, { tr, title: m?.title || stemName(n), picture: { folder } });
                box.append(ov);
            };
            const card = (n) => {
                const m = info.get(n), c = el("div", `ndk-mp-card ndk-lg-card${n === current ? " on" : ""}`); c.tabIndex = 0; c.setAttribute("role", "button"); c.title = n;
                const pic = el("div", "pic");
                const pv = m ? previewOf(m) : null;
                if (pv?.kind === "video") {
                    // a video: muted, the first frame stands, it plays while the pointer is over the tile
                    pic.classList.add("vid"); pic.append(el("span", "ndk-nsfwtag", "NSFW"));
                    const v = videoEl(m, folder, { play: "hover", hover: c, box: pic, onError: () => { pic.classList.add("empty"); pic.replaceChildren(icon("cube", 26)); } }); v.classList.add("main"); pic.prepend(v);
                } else if (pv) {
                    // the picture keeps its own proportions and sits in the middle of the field; what is left of the field is filled with the same picture, blurred
                    const u = previewUrlOf(m, folder); const bg = el("img", "bgblur"); bg.loading = "lazy"; bg.decoding = "async"; bg.alt = ""; bg.src = u; const im = el("img", "main"); im.loading = "lazy"; im.decoding = "async"; im.alt = ""; im.src = u; pic.append(el("span", "ndk-nsfwtag", "NSFW"), bg, im);
                } else { pic.classList.add("empty"); pic.append(icon("cube", 26)); }
                const paintNsfw = () => pic.classList.toggle("nsfw", !!pv && isNd(m) && !!m.nsfw);
                paintNsfw();
                if (m?.base) pic.append(el("span", "ndk-lg-base", m.base));
                const fav = el("button", `ndk-lg-fav${favs.has(n) ? " on" : ""}`); fav.type = "button"; fav.title = tr("Favourite"); fav.append(icon("star", 14));
                fav.addEventListener("click", (e) => { e.stopPropagation(); favorites.toggle(folder, n); favs = favorites.all(folder); fav.classList.toggle("on", favs.has(n)); if (onlyFav) draw(); });
                pic.append(fav);
                if (isNd(m)) pic.append(shieldButton(ctx, m, "ndk-lg-fav ndk-lg-shield", paintNsfw));
                pic.append(infoButtons(m, tr, () => showInfo(n, m)));
                const nm = el("div", "nm"); nm.append(el("span", "t", m?.title || stemName(n))); const d = dirName(n); if (d) nm.append(el("small", "", d)); else if (m?.title) nm.append(el("small", "", stemName(n)));
                c.append(pic, nm);
                const choose = () => { recents.add(folder, n); close(); onPick?.(n, m || null); };
                c.addEventListener("click", choose);
                c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } e.stopPropagation(); });
                return c;
            };
            const draw = () => {
                star.classList.toggle("on", onlyFav); clear.disabled = !dirty();
                grid.textContent = "";
                const all = list().filter(match);
                if (!all.length) { grid.append(el("div", "ndk-pop-empty", info.size || names ? tr("Nothing found") : tr("There are no models in this folder"))); return; }
                const plain = !input.value.trim() && !onlyFav && !selDir.value && !selBase.value;
                const head2 = (t) => { const h = el("div", "ndk-lg-sec", t); grid.append(h); };
                const recent = plain ? recents.all(folder).filter((n) => list().includes(n)).slice(0, 6) : [];
                if (recent.length) { head2(tr("Recent")); for (const n of recent) grid.append(card(n)); head2(tr("All")); }
                else if (plain && all.some((n) => favs.has(n))) { head2(tr("Favourites")); for (const n of all.filter((x) => favs.has(x))) grid.append(card(n)); head2(tr("All")); }
                for (const n of all.slice(0, 600)) grid.append(card(n));
                if (all.length > 600) grid.append(el("div", "ndk-pop-empty", tr("Showing the first 600. Narrow the search.")));
            };
            const load = (fresh) => catalog(folder, fresh).then((m) => { info = m; eye.style.display = [...m.values()].some(isNd) ? "" : "none"; fillFilters(); draw(); });
            input.addEventListener("input", draw);
            const changed = () => { remember(); draw(); };
            selDir.addEventListener("change", changed); selBase.addEventListener("change", changed);
            star.addEventListener("click", () => { onlyFav = !onlyFav; changed(); });
            clear.addEventListener("click", () => { selDir.value = ""; selBase.value = ""; onlyFav = false; input.value = ""; changed(); input.focus(); });
            refresh.addEventListener("click", () => load(true));
            input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") grid.querySelector(".ndk-lg-card")?.click(); });
            draw();
            load(false);
            // R pressed while the gallery is open: the files may have changed
            const off = onModelsChanged(() => { if (!box.isConnected) off(); else load(true); });
            setTimeout(() => input.focus(), 0);
        },
    });
}
