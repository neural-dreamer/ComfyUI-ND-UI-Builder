# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 59: the window modes: "Adapt to the window" grows the layout in height too, "Background fills the window", the strip under the logo (three positions).
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
A = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/adapt.js"; M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"
r = J("""async()=>{const A=await import('%s');
  const ui={page:{w:1280,h:720},view:{},pages:[{id:'p1'}],widgets:[
   {id:'pan',type:'panel',page:'p1',x:20,y:20,w:1240,h:580,z:1,props:{}},
   {id:'in',type:'viewer',page:'p1',x:40,y:60,w:600,h:500,z:2,parent:null,props:{}},
   {id:'bar',type:'generate',page:'p1',x:20,y:620,w:1240,h:60,z:3,props:{}}]};
  const g=A.adaptGeo(ui,1500,950), g2=A.adaptGeo(ui,1500,500), g3=A.adaptGeo(ui,1000,950), g4=A.adaptGeo(ui,1500,950,{len:2000});
  const h=A.adaptHeight(ui,'p1',g.H), au=A.adaptedUi(ui,'p1',g.W,g.H);
  const by=(id)=>au.widgets.find(w=>w.id===id);
  return {g,g2,g3,g4,h:[...h.entries()],pan:by('pan'),bar:by('bar'),inn:by('in')}}""" % A)
check("a window taller than the page: the page height grows (H = 950)", abs(r["g"]["H"] - 950) < 0.5 and abs(r["g"]["s"] - 1) < 1e-9, str(r["g"]))
check("a window lower than the page: H stays the page height", r["g2"]["H"] == 720, str(r["g2"]))
check("a narrow window shrinks the page (scale < 1) and H follows the window", r["g3"]["s"] < 1 and r["g3"]["H"] > 720, str(r["g3"]))
check("a page set longer than the window does not grow", r["g4"]["H"] == 720, str(r["g4"]))
check("the panel grows in height, the bar keeps its height", r["pan"]["h"] > 580 and r["bar"]["h"] == 60, str((r["pan"], r["bar"])))
check("the bar is pushed down and stays on the page", r["bar"]["y"] > 620 and r["bar"]["y"] + r["bar"]["h"] <= 950.5, str(r["bar"]))
check("the panel and the bar do not overlap", r["pan"]["y"] + r["pan"]["h"] <= r["bar"]["y"] + 0.01, str((r["pan"], r["bar"])))
# in the mode
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[
   {id:'pan',type:'panel',page:'p1',x:20,y:20,w:1240,h:580,z:1,slots:{},props:{label:'P'}},
   {id:'bar',type:'generate',page:'p1',x:20,y:620,w:1240,h:60,z:3,slots:{},props:{}}],view:{fit:'adaptive'}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(500)
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
m = J("""()=>{const root=document.querySelector('.ndk-uimode'), pg=root.querySelector('.ndk-page').getBoundingClientRect(), st=root.querySelector('.ndk-stage').getBoundingClientRect();
  const fr=[...root.querySelectorAll('.ndk-w')].map(f=>f.getBoundingClientRect()).map(r=>[Math.round(r.top),Math.round(r.height)]);
  return {page:[Math.round(pg.top),Math.round(pg.height),Math.round(pg.width)],stage:[Math.round(st.height),Math.round(st.width)],fr}}""")
check("adaptive in the mode: the page is as high as the window", abs(m["page"][1] - m["stage"][0]) <= 2, str(m))
check("adaptive in the mode: the panel is much higher than designed", max(f[1] for f in m["fr"]) > 640, str(m))
# bgFill: proportions
def setview(**kw):
    J("""(kw)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); Object.assign(u.view, kw); u.theme.id='frost'; window.ndUi.host().save(u)}""", kw); pg.wait_for_timeout(700)
fill = lambda: J("()=>{const f=document.querySelector('.ndk-uimode .ndk-fillbg'); const pgb=document.querySelector('.ndk-uimode .ndk-page-bg'); return {fill:f?getComputedStyle(f).display:'none', bgimg:f?getComputedStyle(f).backgroundImage.slice(0,20):'', pagebg:pgb?getComputedStyle(pgb).visibility:''}}")
setview(fit="proportions", bgFill=False)
f0 = fill(); check("proportions without the switch: no background layer", f0["fill"] == "none" and f0["pagebg"] != "hidden", str(f0))
setview(fit="proportions", bgFill=True)
f1 = fill(); check("proportions + background fills the window: the layer is there and the page background is hidden", f1["fill"] != "none" and "gradient" in f1["bgimg"] and f1["pagebg"] == "hidden", str(f1))
fr = J("()=>{const f=document.querySelector('.ndk-uimode .ndk-fillbg').getBoundingClientRect(), s=document.querySelector('.ndk-uimode .ndk-stage').getBoundingClientRect(); return [Math.round(f.width)-Math.round(s.width), Math.round(f.height)-Math.round(s.height)]}")
check("the background layer covers the whole host", fr == [0, 0], str(fr))
setview(fit="fill", bgFill=True)
f2 = fill(); check("fill the window is not touched", f2["fill"] == "none" and f2["pagebg"] != "hidden", str(f2))
# the strip: three positions
M2 = J("""async()=>{const M=await import('%s'); return [M.normalizeNdUi({view:{strip:false}}).view.strip, M.normalizeNdUi({view:{strip:true}}).view.strip, M.normalizeNdUi({view:{}}).view.strip, M.normalizeNdUi({view:{strip:'always'}}).view.strip, M.normalizeNdUi({view:{strip:'x'}}).view.strip]}""" % M)
check("strip: old false -> off, old true / unset -> scroll, always stays", M2 == ["off", "scroll", "scroll", "always", "scroll"], str(M2))
setview(fit="proportions", bgFill=False, strip="always")
on = lambda: J("()=>[...document.querySelectorAll('.ndk-uimode .ndk-um-strip')].map(s=>s.classList.contains('on'))")
pg.wait_for_timeout(500)
check("strip always: it is there without a scrollbar", on()[0] is True, str(on()))
setview(strip="scroll"); pg.wait_for_timeout(400)
check("strip while scrolls: no strip while the page does not scroll", on() == [False, False], str(on()))
setview(strip="off"); pg.wait_for_timeout(400)
check("strip off: none", on() == [False, False], str(on()))
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
# the editor
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
labs = J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
check("the editor: Background fills the window", "Background fills the window" in labs, str(labs))
check("the editor: Strip is a three-way switch", J("()=>{const l=[...document.querySelectorAll('.nde-right .nde-row')].find(r=>r.textContent.startsWith('Strip under')); return l? [...l.querySelectorAll('button')].map(b=>b.textContent):null}") == ["Disable", "While scrolls", "Always"])
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
