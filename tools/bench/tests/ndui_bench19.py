# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 19 (stage E6): the Russian and the Chinese interface has no English left (a leak scan of the editor and of every widget).
import json, re
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
# names and the sample content that stay as they are
OK = {"INT", "FLOAT", "STRING", "BOOLEAN", "COMBO", "ComfyUI", "ControlNet", "English", "Flux / SD3", "1024", "SDXL", "Inter", "LIVE", "LoRA", "VAE", "Seed", "Option A", "Option B", "Option C", "One", "Two", "Tab 1", "Tab 2", "Heading", "Generate", "Run to node", "ndui", "A few words about this panel."}
JS_TEXTS = """() => { const out = new Set(); const root = document.querySelector('.nde') || document.body;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const t = w.currentNode.nodeValue.trim(); if (t) out.add(t); }
  for (const e of root.querySelectorAll('[title],[placeholder],[aria-label]')) for (const a of ['title','placeholder','aria-label']) { const v = e.getAttribute(a); if (v) out.add(v.trim()); }
  return [...out]; }"""
for lang, script in (("ru", r"[А-Яа-яЁё]"), ("zh", r"[一-鿿]")):
    J("""async (lang) => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
      const W = await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/widgets/index.js');
      const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[1000,700]; a.graph.add(u); window.__u = u;
      const ws = []; let x = 10, y = 10;
      for (const d of W.WIDGET_LIST) { if (['panel','spoiler','tabs'].includes(d.type)) continue; const s = d.size || {w:200,h:80};
        const props = {}; for (const p of d.props || []) if (p.def !== undefined) props[p.id] = p.def;
        ws.push({id:'w_'+d.type, type:d.type, page:'p1', x, y, w:s.w, h:s.h, z:1, slots:{}, props}); y += s.h + 10; if (y > 600) { y = 10; x += 340; } }
      u.properties.nd_ui = {sources:[], pages:[{id:'p1',name:'One'},{id:'p2',name:'Two'}], widgets: ws, view:{lang}};
      u.ndUiApi.reload(); window.__types = ws.map(w=>w.type); }""", lang)
    pg.wait_for_timeout(1500)
    J("() => window.__u.ndUiApi.openEdit()"); pg.wait_for_timeout(1200)
    found = set()
    def scan():
        for t in J(JS_TEXTS):
            if re.search(r"[A-Za-z]{3,}", t) and not re.search(script, t) and not all(x.strip() in OK or re.fullmatch(r"[\d×]+", x.strip()) for x in t.split("·")): found.add(t)
    import re
    scan()
    for ty in J("window.__types"):
        J("(ty)=>{const f=document.querySelector(`.nde .ndk-w[data-id=\"w_${ty}\"]`); if(f) f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:f.getBoundingClientRect().x+8,clientY:f.getBoundingClientRect().y+8,button:0}));}", ty)
        r = J("(ty)=>{const r=document.querySelector(`.nde .ndk-w[data-id=\"w_${ty}\"]`)?.getBoundingClientRect(); return r?[r.x+r.width/2, r.y+r.height/2]:null}", ty)
        if r: pg.mouse.click(r[0], r[1]); pg.wait_for_timeout(150); scan()
    # the widgets themselves (the run view)
    J("() => window.__u.ndUiApi.closeEdit?.()")
    leaks = sorted(found)
    print(lang, len(leaks), "english strings:"); [print("   ", t[:120]) for t in leaks[:80]]
    check(f"no English left in the {lang} interface (except names)", len(leaks) == 0, "; ".join(leaks[:10]))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
check("no console errors", not errs, str(errs[:2]))
finish(p, br, errs)
