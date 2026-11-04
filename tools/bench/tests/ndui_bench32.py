# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 32 (pre-release, step 6b): a page that adapts to the width — in the NDUI node, in the ND UI mode, the settings of the page and of a widget.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)

MODEL = """(function(fit,maxW){ const W=(id,type,x,y,w,h,props,adapt)=>({id,type,page:'p1',x,y,w,h,z:1,slots:{},props:props||{},adapt});
 return {page:{w:1000,h:600},view:{fit,maxW:maxW||0},pages:[{id:'p1',name:'Main'}],
  widgets:[W('hd','heading',0,0,1000,50,{text:'Title'}),W('t1','toggle',100,100,200,48,{text:'A'}),W('t2','toggle',500,100,200,48,{text:'B'}),W('sl','slider',300,200,400,64,{label:'S'}),
           W('fx','heading',100,300,300,40,{text:'fixed'},{mode:'fixed',align:'right'})]}; })"""
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[100,40]; u.size=[1100,520]; a.graph.add(u); window.__u=u; window.__app=a; }""")
pg.wait_for_timeout(500)
J(f"() => window.ndUi.host().save({MODEL}('adaptive',0))"); pg.wait_for_timeout(1200)
V = "window.__u.ndUiApi.state.view"
info = lambda: J("()=>{const v=" + V + "; const rc=(id)=>{const r=v.rects.get(id); return r?{x:r.x,w:r.w,y:r.y}:null}; return {fit:v.fit, s:v.geo.s, laidW:v.laidW, cw:v.host.clientWidth, pageW:parseFloat(v.pageEl.style.width), tf:v.pageEl.style.transform, hd:rc('hd'), t1:rc('t1'), t2:rc('t2'), sl:rc('sl'), fx:rc('fx')}}")

# ---- the node: the stage is as wide as the node
J("()=>{window.__u.size=[700,520]; window.__app.graph.setDirtyCanvas(true,true)}"); pg.wait_for_timeout(800)
i = info(); print(i)
check("the node view is adaptive", i["fit"] == "adaptive")
check("a narrow node: the page shrinks, the layout is as it was drawn", abs(i["s"] - i["cw"] / 1000) < 0.01 and i["s"] < 1 and i["laidW"] == 1000 and i["pageW"] == 1000 and i["t1"]["x"] == 100 and i["sl"]["w"] == 400, str(i))
J("()=>{window.__u.size=[1100,520]; window.__app.graph.setDirtyCanvas(true,true)}"); pg.wait_for_timeout(800)
i = info(); print(i)
check("a wide node: the page is 1:1 and its width is the width of the node", i["s"] == 1 and abs(i["pageW"] - i["cw"]) < 1 and i["laidW"] > 1000, str(i))
W = i["laidW"]
check("the heading over the whole width follows", abs(i["hd"]["w"] - W) < 0.5 and i["hd"]["x"] == 0, str(i["hd"]))
check("the toggles keep their width", abs(i["t1"]["w"] - 200) < 0.5 and abs(i["t2"]["w"] - 200) < 0.5, str(i))
check("the columns moved apart", i["t1"]["x"] > 100 and i["t2"]["x"] > 500 + (i["t1"]["x"] - 100), str(i))
check("the slider (stretch) is +50 % at most and in its place", abs(i["sl"]["w"] - 600) < 0.5 or i["sl"]["w"] <= 600.01, str(i["sl"]))
check("the fixed heading keeps its width and stands at the right of its place", abs(i["fx"]["w"] - 300) < 0.5, str(i["fx"]))
fr = J("()=>{const v=" + V + "; const f=v.frameOf('t1').frame; return [parseFloat(f.style.left), parseFloat(f.style.width)]}")
check("the frames are placed at the new places", abs(fr[0] - i["t1"]["x"]) < 0.5 and abs(fr[1] - 200) < 0.5, str(fr))
# the node is resized: the layout follows
J("()=>{window.__u.size=[1500,520]; window.__app.graph.setDirtyCanvas(true,true)}"); pg.wait_for_timeout(800)
i2 = info()
check("a wider node: the layout is counted again", i2["laidW"] > i["laidW"] + 100 and abs(i2["pageW"] - i2["cw"]) < 1, str((i["laidW"], i2["laidW"])))

# ---- the old fit modes are not touched
J(f"() => window.ndUi.host().save({MODEL}('proportions',0))"); pg.wait_for_timeout(1000)
i3 = info()
check("proportions: as before (the page is scaled to the node, nothing is spread)", i3["fit"] == "proportions" and i3["laidW"] == 0 and i3["t1"]["x"] == 100 and i3["pageW"] == 1000, str(i3))
J(f"() => window.ndUi.host().save({MODEL}('adaptive',0))"); pg.wait_for_timeout(1000)

# ---- the ND UI mode: the window of the browser is the window of the mode
J("window.ndUi.enter()"); pg.wait_for_timeout(1500)
um = lambda: J("()=>{const v=document.querySelector('.ndk-uimode .ndk-stage'); const pe=document.querySelector('.ndk-uimode .ndk-page'); const f=(id)=>{const e=document.querySelector('.ndk-uimode .ndk-w[data-id='+id+']'); return e?[parseFloat(e.style.left),parseFloat(e.style.width)]:null}; return {vw:window.innerWidth, pw:parseFloat(pe.style.width), left:parseFloat(pe.style.left), tf:pe.style.transform, hd:f('hd'), t1:f('t1'), t2:f('t2'), top:parseFloat(pe.style.top)}}")
u = um(); print(u)
check("mode: the page is 1:1 and as wide as the window", u["tf"] == "scale(1)" and abs(u["pw"] - u["vw"]) < 1 and u["left"] == 0, str(u))
check("mode: the heading is as wide as the page", u["hd"] and abs(u["hd"][1] - u["pw"]) < 0.5, str(u["hd"]))
check("mode: the page stands at the top", u["top"] == 0)
pg.set_viewport_size({"width": 2200, "height": 900}); pg.wait_for_timeout(900)
u2 = um()
check("mode: a wider window gives the layout more room", abs(u2["pw"] - 2200) < 1 and u2["t2"][0] > u["t2"][0] + 200, str((u["t2"], u2["t2"])))
pg.set_viewport_size({"width": 800, "height": 900}); pg.wait_for_timeout(900)
u3 = um()
check("mode: a narrow window shrinks the page", u3["tf"].startswith("scale(0.") and abs(u3["pw"] - 1000) < 1 and u3["t1"][0] == 100, str(u3))
pg.set_viewport_size({"width": 1500, "height": 950}); pg.wait_for_timeout(700)
# maxW: the layout stops growing and the page stands in the middle
J("window.ndUi.exit()"); pg.wait_for_timeout(600)
J(f"() => window.ndUi.host().save({MODEL}('adaptive',1300))"); pg.wait_for_timeout(800)
J("window.ndUi.enter()"); pg.wait_for_timeout(1200)
u4 = um()
check("maxW: the page is not wider than that and stands in the middle", abs(u4["pw"] - 1300) < 1 and abs(u4["left"] - (u4["vw"] - 1300) / 2) < 1.5, str(u4))
J("window.ndUi.exit()"); pg.wait_for_timeout(600)
J(f"() => window.ndUi.host().save({MODEL}('adaptive',0))"); pg.wait_for_timeout(800)

# ---- the editor: the settings of the page and of the widget
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
E_ = lambda expr: J("()=>{const E=window.ndUi.host().editor; return " + expr + "}")
lab = lambda t: J("(t)=>{const r=[...document.querySelectorAll('.nde-row')].find(x=>x.querySelector('.nde-lab')?.textContent===t); return !!r}", t)
check("the page settings: the window fit is chosen", lab("In the window"))
check("adaptive: Minimum width, Window height, Maximum width", lab("Minimum width") and lab("Window height") and lab("Maximum width (0: none)"))
check("the editor draws the design width (not the adapted)", E_("E.canvas().w") == 1000)
E_("E.select(['sl'])"); pg.wait_for_timeout(500)
check("a widget has the section 'When the window is wider'", J("[...document.querySelectorAll('.nde-sec-h')].some(h=>h.textContent.includes('When the window is wider'))") is True)
J("[...document.querySelectorAll('.nde-sec-h')].find(h=>h.textContent.includes('When the window is wider')).click()"); pg.wait_for_timeout(300)
check("a stretching widget has the 'Up to' row", lab("Up to"))
E_("E.select(['t1'])"); pg.wait_for_timeout(400)
check("a fixed-by-kind widget has no 'Up to' row", not lab("Up to"))
# change the mode to Stretches
sel = J("(()=>{const r=[...document.querySelectorAll('.nde-row')].find(x=>x.querySelector('.nde-lab')?.textContent==='Width'); return !!r})()")
check("and has the Width row", sel is True)
pg.evaluate("""()=>{const r=[...document.querySelectorAll('.nde-row')].find(x=>x.querySelector('.nde-lab')?.textContent==='Width'); r.querySelector('.nde-sel, select, button')?.click()}""")
E_("E.change(null,()=>{E.ui.widgets.find(w=>w.id==='t1').adapt={mode:'stretch'}})"); pg.wait_for_timeout(400)
check("after Stretch the 'Up to' row appears", lab("Up to"))
# two widgets: Mixed
E_("E.select(['t1','sl'])"); pg.wait_for_timeout(400)
check("several widgets: the section is there", J("[...document.querySelectorAll('.nde-sec-h')].some(h=>h.textContent.includes('When the window is wider'))") is True)
# proportions: no section
E_("E.change(null,(u)=>{u.view.fit='proportions'})"); pg.wait_for_timeout(300)
check("without 'adapt to the width' there is no such section", J("[...document.querySelectorAll('.nde-sec-h')].every(h=>!h.textContent.includes('When the window is wider'))") is True)
# model: the settings survive and defaults are not stored
r = J("""async()=>{ const M=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js');
  const ui=M.normalizeNdUi({page:{w:800,h:600},view:{fit:'adaptive',maxW:'1200'},pages:[{id:'p1',name:'A'}],widgets:[{id:'a',type:'slider',page:'p1',x:0,y:0,w:100,h:50,adapt:{mode:'stretch',max:30,unit:'px',align:'center'}},{id:'b',type:'slider',page:'p1',x:0,y:60,w:100,h:50,adapt:{mode:'auto',max:50,unit:'%',align:'left'}},{id:'c',type:'slider',page:'p1',x:0,y:120,w:100,h:50,adapt:{mode:'bogus',max:-5,unit:'x',align:'up'}},{id:'d',type:'slider',page:'p1',x:0,y:180,w:100,h:50}]});
  return {fit:ui.view.fit,maxW:ui.view.maxW,a:ui.widgets[0].adapt,b:ui.widgets[1].adapt,c:ui.widgets[2].adapt,d:ui.widgets[3].adapt,hasB:'adapt' in ui.widgets[1]}; }""")
check("adapt is kept, defaults are dropped, rubbish is cleaned", r["fit"] == "adaptive" and r["maxW"] == 1200 and r["a"] == {"mode": "stretch", "max": 30, "unit": "px", "align": "center"} and r["b"] is None and r["hasB"] is False and r["d"] is None and (r["c"] is None or r["c"]["mode"] == "auto"), str(r))
# the ghost of the top panel follows the model
g = J("""async()=>{ const T=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/topghost.js');
  return [T.modeScale({page:{w:1000,h:600},view:{fit:'adaptive'}},1500,900), T.modeScale({page:{w:1000,h:600},view:{fit:'adaptive'}},700,900), T.modeScale({page:{w:1000,h:600},view:{fit:'proportions'}},1500,900)] }""")
check("the ghost knows the scale of an adaptive page (1:1 or smaller)", g[0] == 1 and abs(g[1] - 0.7) < 1e-9 and abs(g[2] - 1.5) < 1e-9, str(g))
finish(p, br, errs)
