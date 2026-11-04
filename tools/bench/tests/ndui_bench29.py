# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 29 (pre-release, step 7a): the canvas of the editor. Widgets outside the page are drawn and can be grabbed;
# the left button on an empty place of the canvas draws a frame (not a pan); the canvas moves by the middle button or Space + the left button.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async()=>{ const m=await import('/scripts/app.js'); const a=m.app; const LG=window.LiteGraph; a.graph.clear();
  const k=LG.createNode('KSampler'); k.pos=[60,380]; k.title='Sampler [sampler]'; a.graph.add(k); k.properties.nd_ui_src={uid:'sk',tag:'sampler'};
  const W=(id,type,x,y,w,h,props,slots)=>({id,type,page:'p1',x,y,w,h,z:1,slots:slots||{},props:props||{}});
  const B=(n)=>({value:{src:'sk',kind:'widget',name:n}});
  window.ndUi.host().save({sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('a','slider',20,20,360,64,{label:'Steps'},B('steps')),W('b','slider',20,110,360,64,{label:'CFG'},B('cfg')),W('c','dropdown',20,200,360,64,{label:'Sampler'},B('sampler_name')),W('d','number',420,20,240,64,{label:'Seed'},B('seed'))]}); }""")
pg.wait_for_timeout(600)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
E_ = lambda expr: J("()=>{const E=window.ndUi.host().editor; return " + expr + "}")
geo = lambda: E_("(()=>{const r=E.stageHost.getBoundingClientRect(), c=E.center.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height,z:E.zoom,cx:c.left,cy:c.top,cw:c.width,ch:c.height,ox:E.ox,oy:E.oy}})()")
g = geo()
pw = E_("E.ui.page.w"); ph = E_("E.ui.page.h")
check("the page is on the stage in full at the start", g["w"] > 100 and g["z"] > 0.1, str(g))

# ---- a widget wholly outside the page (to the right) is drawn and marked
E_("(()=>{const w=E.addWidget('toggle',{at:{x:%d,y:60}}); w.id='out1'; E.sel.clear(); E.refreshAll(); return 1})()" % (pw + 40)); pg.wait_for_timeout(500)
fr = J("(()=>{const f=document.querySelector('.nde .ndk-w[data-id=\"out1\"]'); if(!f) return null; const r=f.getBoundingClientRect(), s=document.querySelector('.nde-stage').getBoundingClientRect(); return {cls:f.className, disp:getComputedStyle(f).display, op:getComputedStyle(f).opacity, left:r.left, right:r.right, stageRight:s.right, w:r.width}})()")
check("a widget outside the page has a frame that is shown", fr and fr["disp"] != "none" and fr["w"] > 10, str(fr))
check("it lies beyond the right edge of the page on the screen", fr and fr["left"] >= fr["stageRight"] - 1, str(fr))
check("and is marked as outside (half transparent)", fr and "ndk-outside" in fr["cls"] and float(fr["op"]) < 0.9, str(fr))
check("a widget on the page is not marked", J("!document.querySelector('.nde .ndk-w[data-id=\"a\"]').classList.contains('ndk-outside')") is True)
check("the root of the stage does not clip in the editor", J("getComputedStyle(document.querySelector('.nde .ndk-stage')).overflowX") == "visible")

# ---- grab it with the mouse (it lies outside the stage box) and move
E_("E.zoomAt(0.6)"); pg.wait_for_timeout(250)
g = geo(); z = g["z"]
cx, cy = g["x"] + (pw + 140) * z, g["y"] + 84 * z
inside = cx < g["cx"] + g["cw"] - 5
check("the widget is within the visible canvas", inside, f"{cx} {g}")
pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx - 30, cy + 20, steps=4); pg.mouse.move(cx - 60 * 1.0, cy + 40, steps=4); pg.mouse.up(); pg.wait_for_timeout(400)
nx = E_("E.ui.widgets.find(w=>w.id==='out1').x")
check("dragging it moves it", abs(nx - (pw + 40 - 60 / z)) < 12, f"{nx} z={z}")
check("it is selected", E_("[...E.sel]") == ["out1"])
# bring it back onto the page: the mark goes
E_("E.change(null,(u)=>{const w=u.widgets.find(w=>w.id==='out1'); w.x=500; w.y=300})"); pg.wait_for_timeout(300)
check("on the page it is not marked", J("!document.querySelector('.nde .ndk-w[data-id=\"out1\"]').classList.contains('ndk-outside')") is True)

# ---- the left button on an empty place draws a frame (no pan)
E_("E.select([])"); g = geo(); ox0, oy0 = g["ox"], g["oy"]
sx, sy = g["x"] - 40, g["y"] - 20     # empty canvas around the page, left of the page
if sx < g["cx"] + 6: sx = g["cx"] + 6
if sy < g["cy"] + 6: sy = g["cy"] + 6
ex, ey = g["x"] + 400 * g["z"], g["y"] + 250 * g["z"]
pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move((sx + ex) / 2, (sy + ey) / 2, steps=5)
check("while dragging a frame is drawn", J("!!document.querySelector('.nde-marq')") is True)
pg.mouse.move(ex, ey, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
sel = set(E_("[...E.sel]"))
check("the frame started outside the page selects the widgets it touches", {"a", "b", "c"} <= sel and "d" not in sel, str(sel))
g2 = geo()
check("the canvas did not move (the left button does not pan)", abs(g2["ox"] - ox0) < 0.5 and abs(g2["oy"] - oy0) < 0.5, f"{ox0},{oy0} -> {g2['ox']},{g2['oy']}")
# a click on an empty place clears the selection
pg.mouse.click(g["cx"] + 10, g["cy"] + 10); pg.wait_for_timeout(250)
check("a click on an empty place clears the selection", E_("E.sel.size") == 0)

# ---- the middle button pans
g = geo()
pg.mouse.move(g["cx"] + 30, g["cy"] + 30); pg.mouse.down(button="middle"); pg.mouse.move(g["cx"] + 90, g["cy"] + 70, steps=5); pg.mouse.up(button="middle"); pg.wait_for_timeout(250)
g3 = geo()
check("the middle button moves the canvas", abs((g3["ox"] - g["ox"]) - 60) < 2 and abs((g3["oy"] - g["oy"]) - 40) < 2, f"{g['ox']},{g['oy']} -> {g3['ox']},{g3['oy']}")
check("and nothing got selected by it", E_("E.sel.size") == 0)
# Space + the left button pans (also over a widget)
wx, wy = g3["x"] + 100 * g3["z"], g3["y"] + 40 * g3["z"]
pg.keyboard.down(" "); pg.mouse.move(wx, wy); pg.mouse.down(); pg.mouse.move(wx - 50, wy - 30, steps=5); pg.mouse.up(); pg.keyboard.up(" "); pg.wait_for_timeout(250)
g4 = geo()
check("Space + the left button moves the canvas", abs((g4["ox"] - g3["ox"]) + 50) < 2 and abs((g4["oy"] - g3["oy"]) + 30) < 2, f"{g3['ox']},{g3['oy']} -> {g4['ox']},{g4['oy']}")
check("and moves no widget", E_("E.ui.widgets.find(w=>w.id==='a').x") == 20)
# the wheel zooms
z0 = E_("E.zoom"); pg.mouse.move(g4["cx"] + g4["cw"] / 2, g4["cy"] + g4["ch"] / 2); pg.mouse.wheel(0, -300); pg.wait_for_timeout(250)
check("the wheel zooms", E_("E.zoom") > z0 * 1.1, f"{z0} -> {E_('E.zoom')}")

# ---- a widget that lies under the page and not on it: shift+marquee adds; a double click still enters a spoiler outside
E_("E.fit()"); pg.wait_for_timeout(200)
# ---- the preview clips like the real thing
pg.click(".nde button:has-text('Preview')"); pg.wait_for_timeout(600)
check("in the preview the stage clips again", J("getComputedStyle(document.querySelector('.nde .ndk-stage')).overflowX") != "visible")
pg.click(".nde button:has-text('Preview')"); pg.wait_for_timeout(400)
check("and the editor shows it again", J("getComputedStyle(document.querySelector('.nde .ndk-stage')).overflowX") == "visible")
finish(p, br, errs)
