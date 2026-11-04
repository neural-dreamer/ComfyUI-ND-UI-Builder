# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 30 (pre-release, step 7b): the length of the page. The page is as long as its lowest widget needs (+24), or as set (pages[i].len);
# the editor shows the line where the window ends, a handle under the page, Fit for the window / for the whole length; the preview and the modes scroll.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
BASE = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"

# ---- the model, on synthetic data
r = J("""async()=>{ const M=await import('%smodel.js');
 const W=(id,y,h,parent)=>({id,type:'heading',page:'p1',x:0,y,w:100,h,z:1,parent:parent||null,props:{},slots:{}});
 const mk=(ws,pages,page)=>M.normalizeNdUi({page:page||{w:1000,h:600},pages:pages||[{id:'p1',name:'M'}],widgets:ws});
 const out={};
 let ui=mk([W('a',20,50)]); out.short=M.pageLength(ui,'p1');
 ui=mk([W('a',20,50),W('b',700,64)]); out.low=M.pageLength(ui,'p1'); out.bottom=M.pageBottom(ui,'p1');
 ui=mk([W('a',20,50)],[{id:'p1',name:'M',len:1500}]); out.len=M.pageLength(ui,'p1'); out.lenKept=ui.pages[0].len;
 ui=mk([W('a',20,50),W('b',700,64)],[{id:'p1',name:'M',len:700}]); out.lenLess=M.pageLength(ui,'p1');
 ui=mk([W('a',3000,50)]); out.yKept=ui.widgets[0].y; out.far=M.pageLength(ui,'p1');
 ui=mk([W('a',20,50),W('s',0,10)]); ui.widgets[1].type='spoiler'; ui.widgets.push(W('in',900,40,'s')); out.inSpoiler=M.pageLength(M.normalizeNdUi(ui),'p1');
 ui=mk([W('a',20,50)],[{id:'p1',name:'M',len:'x'}]); out.badLen=ui.pages[0].len;
 ui=mk([W('a',20,50)],[{id:'p1',name:'M',len:99999999}]); out.hugeLen=ui.pages[0].len;
 return out; }""" % BASE)
print(r)
check("a short page is as long as the window", r["short"] == 600, str(r))
check("a low widget makes the page longer, with 24 under it", r["low"] == 764 + 24 and r["bottom"] == 764, str(r))
check("len sets a longer page and is kept", r["len"] == 1500 and r["lenKept"] == 1500, str(r))
check("len shorter than the content does not cut it", r["lenLess"] == 788, str(r))
check("y is no longer clamped to twice the height", r["yKept"] == 3000 and r["far"] == 3074, str(r))
check("what lies in a spoiler does not make the page longer by itself", r["inSpoiler"] == 600, str(r))
check("a bad len is 0, a huge one is cut", r["badLen"] == 0 and r["hugeLen"] == 16000, str(r))

# ---- the editor
J("""async()=>{ const m=await import('/scripts/app.js'); const a=m.app; const LG=window.LiteGraph; a.graph.clear();
  const k=LG.createNode('KSampler'); k.pos=[60,380]; k.title='Sampler [sampler]'; a.graph.add(k); k.properties.nd_ui_src={uid:'sk',tag:'sampler'};
  const W=(id,type,x,y,w,h,props,slots)=>({id,type,page:'p1',x,y,w,h,z:1,slots:slots||{},props:props||{}});
  const B=(n)=>({value:{src:'sk',kind:'widget',name:n}});
  window.ndUi.host().save({sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('a','slider',20,20,360,64,{label:'Steps'},B('steps')),W('b','slider',20,110,360,64,{label:'CFG'},B('cfg')),W('c','dropdown',20,200,360,64,{label:'Sampler'},B('sampler_name'))]}); }""")
pg.wait_for_timeout(600)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
E_ = lambda expr: J("()=>{const E=window.ndUi.host().editor; return " + expr + "}")
stage = lambda: J("(()=>{const r=document.querySelector('.nde-stage').getBoundingClientRect(); return {y:r.top,h:r.height,w:r.width}})()")
H = E_("E.ui.page.h")
check("a short page: the canvas is the window", E_("E.canvas().h") == H and E_("E.pageLen()") == H)
check("no line of the window while the page is as long as the window", J("!document.querySelector('.nde-fold')") is True)
check("the handle of the length is under the page", J("!!document.querySelector('.nde-lenh')") is True)

# a widget below the window: the page grows after it, 24 under it, and it is not 'outside'
E_("E.addWidget('toggle',{at:{x:40,y:%d}})" % (H + 80)); pg.wait_for_timeout(400)
low = E_("E.selected()[0].y + E.selected()[0].h")
check("the page grows to the lowest widget + 24", E_("E.canvas().h") == low + 24 and E_("E.pageLen()") == low + 24, f"{E_('E.canvas().h')} {low}")
s = stage(); z = E_("E.zoom")
check("the stage on the screen is as tall as the page", abs(s["h"] - (low + 24) * z) < 1.5, f"{s} {z}")
check("the line of the window is drawn", J("!!document.querySelector('.nde-fold')") is True and "Window height" in J("document.querySelector('.nde-fold').innerText"))
check("the widget below the window is not marked as outside", J("!document.querySelector('.nde .ndk-w[data-id=\"%s\"]').classList.contains('ndk-outside')" % E_("E.selected()[0].id")) is True)
check("the model keeps no len (it is automatic)", E_("E.curPage().len") == 0)

# the handle: drag it down by 120 page units -> len
E_("E.fit(true)"); pg.wait_for_timeout(300)
z = E_("E.zoom"); hb = pg.query_selector(".nde-lenh").bounding_box()
x, y = hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2
L0 = E_("E.pageLen()")
pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y + 60 * z, steps=4); pg.mouse.move(x, y + 120 * z, steps=4)
tag = J("document.querySelector('.nde-lenh .tag')?.innerText || ''")
pg.mouse.up(); pg.wait_for_timeout(400)
ln = E_("E.curPage().len")
check("dragging the handle sets the length (to the grid)", abs(ln - (L0 + 120)) <= 8 + 1, f"{L0} -> {ln}")
check("the tag showed the length while dragging", "Length" in tag and str(ln) in tag, tag)
check("the canvas follows", E_("E.canvas().h") == ln)
# the handle cannot cut the content: dragged up it goes back to automatic
hb = pg.query_selector(".nde-lenh").bounding_box(); x, y = hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2
pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 100 * z, steps=4); pg.mouse.move(x, y - 400 * z, steps=6); pg.mouse.up(); pg.wait_for_timeout(400)
check("dragged up it stops at the content (len 0 = automatic)", E_("E.curPage().len") == 0 and E_("E.canvas().h") == low + 24, f"{E_('E.curPage().len')} {E_('E.canvas().h')}")
# undo returns the handle drag
E_("E.undo()"); pg.wait_for_timeout(300)
check("Ctrl+Z returns the length", E_("E.curPage().len") == ln, str(E_("E.curPage().len")))
# a double click on the handle: automatic
hb = pg.query_selector(".nde-lenh").bounding_box()
pg.mouse.dblclick(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); pg.wait_for_timeout(400)
check("a double click on the handle makes the length automatic", E_("E.curPage().len") == 0)

# the inspector
E_("E.select([])"); pg.wait_for_timeout(300)
inp = lambda: J("(()=>{const r=[...document.querySelectorAll('.nde-row')].find(x=>x.querySelector('.nde-lab')?.textContent==='Length (0: auto)'); const i=r&&r.querySelector('input'); return i?Number(i.value):null})()")
check("the inspector has Length of the page", inp() == 0, str(inp()))
pg.fill(".nde-row:has(.nde-lab:text-is('Length (0: auto)')) input", "1500"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
check("typing a length sets it", E_("E.curPage().len") == 1500 and E_("E.canvas().h") == 1500, str(E_("E.curPage().len")))

# fit: the window from the top, or the whole length
E_("E.fit(false)"); pg.wait_for_timeout(300)
cb = J("(()=>{const c=document.querySelector('.nde-center').getBoundingClientRect(), r=document.querySelector('.nde-stage').getBoundingClientRect(); return {top:r.top-c.top, bottom:r.bottom-c.top, ch:c.height}})()")
check("Ctrl+0 fits the window (the height of the page) from the top", abs(cb["top"] - 48) < 2 and cb["bottom"] > cb["ch"], str(cb))
wz = E_("E.zoom"); wh = E_("E.ui.page.h")
check("the zoom fits the window height", abs(wh * wz - (cb["ch"] - 96)) < 3 or E_("E.zoom") * E_("E.ui.page.w") <= 1500, f"{wz}")
pg.keyboard.press("Control+0"); pg.wait_for_timeout(300)
check("the key fits the same way", abs(E_("E.zoom") - wz) < 1e-6)
E_("E.fit(true)"); pg.wait_for_timeout(300)
cb2 = J("(()=>{const c=document.querySelector('.nde-center').getBoundingClientRect(), r=document.querySelector('.nde-stage').getBoundingClientRect(); return {top:r.top-c.top, bottom:r.bottom-c.top, ch:c.height}})()")
check("the whole-page button fits all of the length", cb2["top"] >= 0 and cb2["bottom"] <= cb2["ch"] + 1 and E_("E.zoom") < wz, f"{cb2} {E_('E.zoom')} {wz}")
# dragging a widget lower than the page makes the page longer after the drop
E_("E.curPage().len=0; E.afterChange({})"); pg.wait_for_timeout(300)
E_("E.fit(true)"); pg.wait_for_timeout(300)
g = J("(()=>{const w=window.ndUi.host().editor.ui.widgets.find(w=>w.id==='a'); const r=document.querySelector('.nde-stage').getBoundingClientRect(); const z=window.ndUi.host().editor.zoom; return {x:r.left+(w.x+w.w/2)*z, y:r.top+(w.y+w.h/2)*z, z}})()")
Lb = E_("E.pageLen()")
pg.mouse.move(g["x"], g["y"]); pg.mouse.down(); pg.mouse.move(g["x"] + 5, g["y"] + 40, steps=4); pg.mouse.move(g["x"] + 5, g["y"] + (Lb + 300 - 50) * g["z"], steps=10); pg.mouse.up(); pg.wait_for_timeout(500)
check("a widget dragged lower than the page gets the page extended", E_("E.pageLen()") > Lb + 200, f"{Lb} -> {E_('E.pageLen()')}")
E_("E.undo()"); pg.wait_for_timeout(300)

# ---- new widgets find a place on a long page, and below when the page is full
n0 = E_("E.ui.widgets.length")
for _ in range(10): E_("E.addWidget('slider')")
pg.wait_for_timeout(500)
ws = E_("E.ui.widgets.map(w=>[w.x,w.y,w.w,w.h])")
ov = sum(1 for i in range(len(ws)) for j in range(i) if not (ws[i][0] + ws[i][2] <= ws[j][0] or ws[j][0] + ws[j][2] <= ws[i][0] or ws[i][1] + ws[i][3] <= ws[j][1] or ws[j][1] + ws[j][3] <= ws[i][1]))
check("ten new widgets do not lie on each other", ov == 0, f"{ov}")

# ---- the preview shows the window and scrolls (as the modes do)
E_("E.curPage().len=0; E.afterChange({})"); pg.wait_for_timeout(300)
pg.click(".nde button:has-text('Preview')"); pg.wait_for_timeout(700)
pv = J("(()=>{const r=document.querySelector('.nde .ndk-stage'); return {sh:r.scrollHeight, ch:r.clientHeight, oy:getComputedStyle(r).overflowY}})()")
check("the preview scrolls a long page", pv["oy"] == "auto" and pv["sh"] > pv["ch"] + 20, str(pv))
check("and the canvas of the preview is the window", E_("E.canvas().h") == E_("E.ui.page.h"))
pg.click(".nde button:has-text('Preview')"); pg.wait_for_timeout(500)
finish(p, br, errs)
