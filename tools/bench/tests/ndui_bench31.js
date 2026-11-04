// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// the cases of bench 31 (pure functions of adapt.js): called as (M, A) => results
(M, A) => {
  const out = { fails: [] };
  const ok = (name, cond, extra) => { if (!cond) out.fails.push(name + (extra ? " [" + extra + "]" : "")); };
  const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
  const W = (id, type, x, y, w, h, o = {}) => ({ id, type, page: "p1", x, y, w, h, z: o.z ?? 1, parent: o.parent || null, hidden: !!o.hidden, props: o.props || {}, slots: {}, adapt: o.adapt });
  const mk = (ws, page) => M.normalizeNdUi({ page: page || { w: 1000, h: 600 }, pages: [{ id: "p1", name: "M" }], widgets: ws });
  // normalizeNdUi does not know `adapt` yet in 6a: put it back
  const mkA = (ws, page) => { const ui = mk(ws, page); for (const w of ui.widgets) { const s = ws.find((x) => x.id === w.id); if (s?.adapt) w.adapt = s.adapt; } return ui; };

  // ---- geometry
  let g = A.adaptGeo({ page: { w: 1280, h: 720 }, view: {} }, 1920, 1080);
  ok("B: wide window: 1:1 and all the width", g.s === 1 && g.W === 1920, JSON.stringify(g));
  g = A.adaptGeo({ page: { w: 1280, h: 720 }, view: {} }, 1000, 1080);
  ok("B: narrow window: the page shrinks, the width stays", near(g.s, 1000 / 1280) && near(g.W, 1280), JSON.stringify(g));
  g = A.adaptGeo({ page: { w: 1280, h: 720 }, view: { maxW: 1600 } }, 2560, 1080);
  ok("B: maxW", g.s === 1 && g.W === 1600, JSON.stringify(g));
  g = A.adaptGeo({ page: { w: 1280, h: 720 }, view: { maxW: 900 } }, 2560, 1080);
  ok("maxW below the page width does not cut the page", g.W === 1280, JSON.stringify(g));
  g = A.adaptGeo({ page: { w: 1280, h: 720 }, view: {} }, 1920, 1080, { model: "scaled" });
  ok("A: 1920x1080 is just a bigger page", near(g.s, 1.5) && near(g.W, 1280), JSON.stringify(g));
  g = A.adaptGeo({ page: { w: 1280, h: 720 }, view: {} }, 2560, 1080, { model: "scaled" });
  ok("A: 2560x1080 has extra width", near(g.s, 1.5) && near(g.W, 2560 / 1.5), JSON.stringify(g));

  // ---- the identity
  let ui = mkA([W("a", "slider", 100, 10, 300, 60), W("b", "slider", 500, 10, 300, 60)]);
  ok("W = page width changes nothing", A.adaptWidth(ui, "p1", 1000).size === 0);
  ok("W < page width changes nothing", A.adaptWidth(ui, "p1", 800).size === 0);
  ok("adaptedUi returns the same model", A.adaptedUi(ui, "p1", 1000) === ui);

  // ---- equal gaps; fixed widgets
  ui = mkA([W("a", "toggle", 100, 10, 200, 40), W("b", "toggle", 500, 10, 200, 40)]);   // fixed by type
  let m = A.adaptWidth(ui, "p1", 1400);
  const sh = 400 / 3;
  ok("fixed widgets keep their width", near(m.get("a").w, 200) && near(m.get("b").w, 200), JSON.stringify([...m]));
  ok("the three gaps get the same share (400 / 3)", near(m.get("a").x, 100 + sh) && near(m.get("b").x, 500 + 2 * sh), JSON.stringify([...m]));

  // ---- proportional / stretch / px / align
  ui = mkA([W("h", "heading", 0, 0, 1000, 50), W("s", "slider", 300, 100, 400, 60)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("a heading over the whole width is proportional", near(m.get("h").w, 2000) && near(m.get("h").x, 0), JSON.stringify([...m]));
  ok("a slider (stretch +50 %) under it is 1.5 wide and sits in its place", near(m.get("s").w, 600), JSON.stringify([...m]));
  ok("the place of the slider is the middle part of the heading (left aligned there)", m.get("s").x >= 300 * 2 - 0.01 - 0 && m.get("s").x + m.get("s").w <= 2000 + 0.01, JSON.stringify(m.get("s")));
  ui = mkA([W("s", "slider", 100, 0, 400, 60, { adapt: { mode: "stretch", max: 100, unit: "px" } })]);
  m = A.adaptWidth(ui, "p1", 3000);
  ok("stretch up to +100 px", near(m.get("s").w, 500), JSON.stringify([...m]));
  ui = mkA([W("s", "slider", 100, 0, 400, 60, { adapt: { mode: "stretch", max: 20, unit: "%", align: "right" } }), W("t", "heading", 0, 100, 1000, 40)]);
  m = A.adaptWidth(ui, "p1", 2000);
  const s1 = m.get("s");
  ok("stretch up to +20 %", near(s1.w, 480), JSON.stringify(s1));
  ui = mkA([W("s", "slider", 100, 0, 400, 60, { adapt: { mode: "scale" } })]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("proportional: as much as the page (no cap)", near(m.get("s").w, 800), JSON.stringify(m.get("s")));
  ui = mkA([W("s", "heading", 100, 0, 400, 60, { adapt: { mode: "fixed" } }), W("t", "heading", 0, 100, 1000, 40)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("fixed over a proportional one: keeps the width, stays in its place", near(m.get("s").w, 400) && near(m.get("s").x, 200), JSON.stringify(m.get("s")));
  ui = mkA([W("s", "heading", 100, 0, 400, 60, { adapt: { mode: "fixed", align: "right" } }), W("t", "heading", 0, 100, 1000, 40)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("align right", near(m.get("s").w, 400) && near(m.get("s").x, 1000 - 400), JSON.stringify(m.get("s")));
  ui = mkA([W("s", "heading", 100, 0, 400, 60, { adapt: { mode: "fixed", align: "center" } }), W("t", "heading", 0, 100, 1000, 40)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("align center", near(m.get("s").x, 200 + (800 - 400) / 2), JSON.stringify(m.get("s")));
  ui = mkA([W("s", "slider", 20, 0, 960, 60)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("a stretch widget with margins: +50 %, in the middle", near(m.get("s").w, 1440) && near(m.get("s").x, 280), JSON.stringify(m.get("s")));
  ui = mkA([W("s", "slider", 0, 0, 1000, 60)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("a stretch widget over the whole width and nothing else: +50 %, in the middle", near(m.get("s").w, 1500) && near(m.get("s").x, 250), JSON.stringify(m.get("s")));
  ui = mkA([W("s", "slider", 100, 0, 400, 60, { hidden: true }), W("t", "heading", 600, 0, 300, 40)]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("a hidden widget holds no room", near(m.get("t").w, 600) && m.get("s") != null, JSON.stringify([...m]));

  // ---- a panel holds its widgets
  ui = mkA([W("p", "panel", 100, 0, 400, 300, { z: 0 }), W("s", "slider", 150, 50, 300, 60, { z: 1 })]);
  m = A.adaptWidth(ui, "p1", 1600);
  const P = m.get("p"), S = m.get("s");
  ok("a panel grows by the page", near(P.w, 640) && near(P.x, 280), JSON.stringify(P));
  ok("and its slider lies inside it, +50 %", near(S.w, 450) && near(S.x, 280 + 95), JSON.stringify(S));
  ok("the slider is within the panel", S.x >= P.x - 0.01 && S.x + S.w <= P.x + P.w + 0.01);

  // ---- a spoiler: its inside is laid out again
  ui = mkA([W("sp", "spoiler", 0, 0, 400, 44, { props: { pad: 12 } }), W("c", "slider", 0, 0, 376, 60, { parent: "sp" })]);
  m = A.adaptWidth(ui, "p1", 2000);
  ok("a spoiler grows by the page", near(m.get("sp").w, 800), JSON.stringify([...m]));
  ok("what is in it gets the inner width: +50 %, in the middle", near(m.get("c").w, 564) && near(m.get("c").x, (776 - 564) / 2), JSON.stringify(m.get("c")));

  // ---- the model of a page reads the result
  ui = mkA([W("a", "slider", 100, 10, 300, 60), W("b", "slider", 500, 10, 300, 60)]);
  const au = A.adaptedUi(ui, "p1", 2000);
  ok("adaptedUi carries the new x / w and leaves the original alone", au !== ui && au.widgets[0].w !== 300 && ui.widgets[0].w === 300 && au.page.w === ui.page.w);

  // ---- random layouts
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const TYPES = ["slider", "dropdown", "heading", "toggle", "text", "viewer", "number", "generate", "activity", "textblock", "seed"];
  const MODES = [undefined, undefined, "fixed", "stretch", "scale"];
  const hit = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
  let bad = 0, checked = 0, worst = "";
  for (let n = 0; n < 300; n++) {
    const pw = ri(400, 1400), ws = [];
    // rows of cells; each cell is a widget or a panel with widgets or a spoiler with children
    let y = ri(0, 30);
    const rows = ri(1, 6);
    for (let r = 0; r < rows; r++) {
      const cols = ri(1, 4);
      const rh = ri(30, 80);
      let x = ri(0, 40);
      for (let c = 0; c < cols && x < pw - 60; c++) {
        const cw = Math.min(pw - x - ri(0, 30), ri(60, Math.max(80, Math.floor(pw / cols))));
        if (cw < 24) break;
        const id = `w${n}_${r}_${c}`, kind = rnd();
        const ad = (t) => { const m = MODES[ri(0, MODES.length - 1)]; return m ? { mode: m, max: ri(0, 120), unit: rnd() < 0.5 ? "%" : "px", align: ["left", "center", "right"][ri(0, 2)] } : undefined; };
        if (kind < 0.12 && cw >= 140) {
          ws.push(W(id, "panel", x, y, cw, rh * 2 + 20, { z: 0 }));
          let ix = x + 8, k = 0;
          while (ix + 40 < x + cw - 8 && k < 3) { const iw = Math.min(x + cw - 8 - ix, ri(40, 120)); ws.push(W(id + "i" + k, TYPES[ri(0, TYPES.length - 1)], ix, y + 10, iw, rh, { z: 1, adapt: ad() })); ix += iw + ri(4, 20); k++; }
        } else if (kind < 0.22 && cw >= 140) {
          ws.push(W(id, "spoiler", x, y, cw, 44, { props: { pad: 12 }, adapt: ad() }));
          const inner = cw - 24; let ix = 0, k = 0;
          while (ix + 30 < inner && k < 3) { const iw = Math.min(inner - ix, ri(30, 120)); ws.push(W(id + "s" + k, TYPES[ri(0, TYPES.length - 1)], ix, 0, iw, ri(30, 60), { parent: id, adapt: ad() })); ix += iw + ri(0, 20); k++; }
        } else ws.push(W(id, TYPES[ri(0, TYPES.length - 1)], x, y, cw, rh, { adapt: ad(), hidden: rnd() < 0.05 }));
        x += cw + ri(0, 40);
      }
      y += rh + ri(0, 30) + (ws.some((q) => q.id.startsWith(`w${n}_${r}_`) && q.type === "panel") ? rh + 20 : 0);
    }
    const ui2 = mkA(ws, { w: pw, h: 600 });
    // the normaliser may have moved things (parents); take the model as it is
    const Wn = pw + ri(1, 2 * pw);
    const mm = A.adaptWidth(ui2, "p1", Wn);
    const after = (w) => { const r = mm.get(w.id); return r ? { ...w, x: r.x, w: r.w } : w; };
    // 1. nothing shrinks beyond reason, nothing is NaN
    for (const w of ui2.widgets) { const a = after(w); if (!Number.isFinite(a.x) || !Number.isFinite(a.w) || a.w < Math.min(w.w, 8) - 0.01) { bad++; worst = `NaN/shrunk ${w.id}`; } }
    // 2. widgets of the same level (same parent) that did not touch before do not touch after, panels and their members being aligned by their box
    const groups = new Map();
    for (const w of ui2.widgets) { const key = w.parent || ""; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(w); }
    for (const [, list] of groups) {
      for (let i = 0; i < list.length; i++) for (let j = 0; j < i; j++) {
        const a = list[i], b = list[j];
        if (a.hidden || b.hidden || hit(a, b)) continue;
        // a panel and a widget that lies in it are meant to touch; the others are not
        const pa = M.panelOf(ui2, a), pb = M.panelOf(ui2, b);
        if ((a.type === "panel" && pb === a) || (b.type === "panel" && pa === b)) continue;
        if (pa !== pb && (pa || pb)) continue;
        checked++;
        if (hit(after(a), after(b))) { bad++; worst = `overlap ${a.id} ${b.id} in case ${n}`; }
      }
    }
    // 3. a panel keeps its widgets inside
    for (const w of ui2.widgets) { const p = M.panelOf(ui2, w); if (!p || w.hidden) continue; const pa = after(p), wa = after(w); if (wa.x < pa.x - 0.01 || wa.x + wa.w > pa.x + pa.w + 0.01) { bad++; worst = `outside panel ${w.id}`; } }
    // 4. the rule of the factor: a widget is never wider than it asks for (or than its place)
    for (const w of ui2.widgets) {
      if (w.parent) continue;
      const a = after(w), want = w.w * A.wantedFactor(w, Wn / pw);
      if (a.w > want + 0.01 && a.w > w.w + 0.01) { bad++; worst = `too wide ${w.id} ${a.w} > ${want}`; }
    }
    // 5. the identity at W = page width
    if (A.adaptWidth(ui2, "p1", pw).size !== 0) { bad++; worst = "not the identity"; }
  }
  out.random = { bad, checked, worst };
  ok("300 random layouts: no new overlaps, panels keep their widgets, widths within their wishes", bad === 0 && checked > 500, JSON.stringify(out.random));
  return out;
}
