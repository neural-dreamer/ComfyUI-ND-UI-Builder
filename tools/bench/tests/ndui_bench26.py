# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 26 (pre-release polish): the Activity widget has marks other than the ND logo (video, music, speech, picture, ...).
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s: pg.evaluate(s)
MARKS = ["nd", "video", "music", "speech", "image", "spark", "bolt", "bars", "cube"]
J("""async (marks) => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[300,40]; u.size=[1100,700]; a.graph.add(u); window.__u = u;
  const W=(id,x,y,props)=>({id,type:'activity',page:'p1',x,y,w:200,h:170,z:1,slots:{},props});
  const ws = marks.map((k,i)=>W('a'+i, 10+(i%5)*210, 10+Math.floor(i/5)*180, {mark:k, style:'breathe', when:'always'}));
  ws.push(W('old', 10+4*210, 10+180, {style:'pulse', when:'always'}));      // saved before the marks existed: no "mark"
  ws.push(W('bad', 10, 10+2*180, {mark:'nope', style:'pulse', when:'always'}));   // an unknown mark: the ND logo
  u.properties.nd_ui={sources:[],pages:[{id:'p1',name:'One'}],widgets:ws}; u.ndUiApi.reload(); }""".replace("(marks)", "()").replace("marks.map", str(MARKS) + ".map"))
pg.wait_for_timeout(1200)
glyphs = J("[...document.querySelectorAll('.ndk-act.solo .ndk-act-mark')].map(s=>[...s.children].slice(2).map(c=>c.outerHTML.replace(/ndka\\d+/g,'')).join(''))")
check("eleven Activity widgets", len(glyphs) == 11, str(len(glyphs)))
check("the nine marks are all different", len(set(glyphs[:9])) == 9, str(len(set(glyphs[:9]))))
check("a widget saved without a mark shows the ND logo", glyphs[9] == glyphs[0])
check("an unknown mark falls back to the ND logo", glyphs[10] == glyphs[0])
check("the ND logo is still the letters (path with evenodd)", "evenodd" in glyphs[0])
check("every mark keeps the theme paint (gradient from variables)", J("[...document.querySelectorAll('.ndk-act.solo .ndk-act-mark')].every(s=>s.querySelector('stop').getAttribute('style').includes('var(--ndk-accent)'))") is True)
check("each mark uses the gradient for its glyph", J("[...document.querySelectorAll('.ndk-act.solo .ndk-act-mark')].every(s=>[...s.children].slice(2).every(c=>(c.getAttribute('fill')||'').startsWith('url(#ndka')||(c.getAttribute('stroke')||'').startsWith('url(#ndka')))") is True)
pg.screenshot(path="/tmp/ndui_shots/bench26_marks.png")
# the mark changes with the property, without remounting the page
J("()=>{const u=window.__u; u.properties.nd_ui.widgets.find(w=>w.id==='a0').props.mark='video'; u.ndUiApi.reload();}"); pg.wait_for_timeout(900)
g2 = J("[...document.querySelectorAll('.ndk-act.solo .ndk-act-mark')].map(s=>[...s.children].slice(2).map(c=>c.outerHTML.replace(/ndka\\d+/g,'')).join(''))")
check("changing the property changes the mark", g2[0] == g2[1] and g2[0] != glyphs[0])
# the inspector has the Icon selector with all marks
J("()=>window.__u.ndUiApi.openEdit()"); pg.wait_for_timeout(1200)
pg.click(".nde-tabs button:has-text('Layout')"); pg.wait_for_timeout(300)
J("document.querySelector('.nde-layer[data-id=\"a2\"]')?.click()"); pg.wait_for_timeout(500)
opts = J("(()=>{const rows=[...document.querySelectorAll('.nde-row')]; const r=rows.find(x=>x.querySelector('.nde-lab')?.textContent==='Icon'); const s=r&&r.querySelector('select'); return s?[...s.options].map(o=>o.value):null})()")
check("the inspector offers the Icon selector with every mark (and Custom text)", opts == MARKS + ["custom"], str(opts))
finish(p, br, errs)
