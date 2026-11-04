# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 27 (pre-release polish): the header of a spoiler has a height of its own (props.head_h, 24..72 px; 0 = by the density of the kit).
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s: pg.evaluate(s)
BASE = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"

# ---- model + flow on synthetic data
r = J("""async()=>{ const M=await import('%smodel.js'); const F=await import('%sflow.js');
 const W=(id,type,x,y,w,h,parent,props)=>({id,type,page:'p1',x,y,w,h,z:1,parent:parent||null,props:props||{},slots:{}});
 const mk=(ws)=>M.normalizeNdUi({pages:[{id:'p1',name:'M'}],widgets:ws});
 const out={};
 let ui=mk([W('s','spoiler',0,0,400,10),W('t','spoiler',0,0,400,10,null,{head_h:28}),W('u','spoiler',0,0,400,10,null,{head_h:10}),W('v','spoiler',0,0,400,10,null,{head_h:500}),W('z','spoiler',0,0,400,10,null,{head_h:'x'})]);
 M.syncSpoilerHeights(ui);
 const by=(id)=>ui.widgets.find(w=>w.id===id);
 out.def=M.headH(ui); out.h={s:by('s').h,t:by('t').h,u:by('u').h,v:by('v').h,z:by('z').h};
 // open spoiler with its own header: the content starts under the header; what lies below the header (but above the default header) is "below"
 ui=mk([W('t','spoiler',40,100,400,10,null,{head_h:28,pad:12}),W('a','heading',0,0,300,50,'t'),W('near','heading',40,100+30,400,20),W('s','spoiler',500,100,300,10,null,{pad:12}),W('b','heading',0,0,300,50,'s'),W('near2','heading',500,100+30,300,20)]);
 M.syncSpoilerHeights(ui);
 let L=F.layoutFlow(ui,'p1',(id)=>true);
 const hd=M.headH(ui);
 out.t={h:L.rects.get('t').h, aY:L.rects.get('a').y, nearShift:L.rects.get('near').y-130};
 out.s={h:L.rects.get('s').h, bY:L.rects.get('b').y, near2Shift:L.rects.get('near2').y-130, hd};
 L=F.layoutFlow(ui,'p1',()=>false); out.closed={t:L.rects.get('t').h, s:L.rects.get('s').h};
 return out; }""" % (BASE, BASE))
print(r)
d = r["def"]
check("the default header follows the density of the kit", d in (36, 44, 52) and r["h"]["s"] == d and r["h"]["z"] == d, str(r))
check("head_h sets the header height; below 24 comes up to 24, above 72 comes down to 72", r["h"]["t"] == 28 and r["h"]["u"] == 24 and r["h"]["v"] == 72, str(r["h"]))
ex = 2 * 12 + 50
check("an open spoiler is as tall as its own header plus the content", r["t"]["h"] == 28 + ex and r["s"]["h"] == r["s"]["hd"] + ex, str(r))
check("the content starts under its own header", r["t"]["aY"] == 100 + 28 + 12 and r["s"]["bY"] == 100 + r["s"]["hd"] + 12, str(r))
check("what lies right under the shorter header is below the spoiler and moves down", r["t"]["nearShift"] == ex, str(r["t"]))
check("closed spoilers are as tall as their headers", r["closed"]["t"] == 28 and r["closed"]["s"] == r["s"]["hd"], str(r["closed"]))

# ---- the page in the node: the header is as tall as set
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[300,40]; u.size=[1000,640]; a.graph.add(u); window.__u = u;
  const W=(id,x,y,w,h,props)=>({id,type:'spoiler',page:'p1',x,y,w,h,z:1,slots:{},props:Object.assign({title:id,open:false,pad:12},props)});
  u.properties.nd_ui={sources:[],pages:[{id:'p1',name:'One'}],widgets:[W('s1',20,20,300,40,{}),W('s2',20,100,300,40,{head_h:28}),W('s3',20,180,300,40,{head_h:60})]}; u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1200)
hs = J("[...document.querySelectorAll('.ndk-w')].map(e=>[e.dataset.id, parseFloat(e.style.height), Math.round(e.querySelector('.ndk-sp-head').getBoundingClientRect().height / (e.getBoundingClientRect().height / parseFloat(e.style.height)))])")
hs = {k: (h, hh) for k, h, hh in hs}
check("frames of the spoilers have their own heights", hs["s1"][0] == d and hs["s2"][0] == 28 and hs["s3"][0] == 60, str(hs))
check("and the header buttons are as tall as the frames", all(abs(hh - h) <= 1 for h, hh in hs.values()), str(hs))

# ---- the editor: the property in the inspector, the bottom handle
J("()=>window.__u.ndUiApi.openEdit()"); pg.wait_for_timeout(1200)
pg.click(".nde-tabs button:has-text('Layout')"); pg.wait_for_timeout(300)
J("document.querySelector('.nde-layer[data-id=\"s2\"]')?.click()"); pg.wait_for_timeout(500)
val = lambda: J("(()=>{const r=[...document.querySelectorAll('.nde-row')].find(x=>x.querySelector('.nde-lab')?.textContent==='Header height'); const i=r&&r.querySelector('input'); return i?Number(i.value):null})()")
check("the inspector has Header height", val() == 28, str(val()))
check("the bottom handle is there, the corner ones are not", J("!!document.querySelector('.nde-sel .nde-h8[data-dir=\"s\"]')") is True and J("!!document.querySelector('.nde-sel .nde-h8[data-dir=\"se\"]')") is False)
zoom = J("document.querySelector('.nde-stage').getBoundingClientRect().width / window.__u.properties.nd_ui.page.w") if False else None
hb = pg.query_selector(".nde-sel .nde-h8[data-dir='s']").bounding_box()
sb = pg.query_selector(".nde-sel").bounding_box()
zoom = sb["height"] / 28
x, y = hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2
pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y + 6 * zoom, steps=5); pg.mouse.move(x, y + 10 * zoom, steps=5); pg.mouse.up(); pg.wait_for_timeout(400)
check("dragging the bottom edge makes the header taller by the same amount", val() == 38, str(val()))
sb2 = pg.query_selector(".nde-sel").bounding_box()
check("the frame of the spoiler in the editor follows", abs(sb2["height"] - 38 * zoom) < 1.5, f"{sb2['height']} vs {38 * zoom}")
pg.mouse.move(x, sb2["y"] + sb2["height"]); 
hb = pg.query_selector(".nde-sel .nde-h8[data-dir='s']").bounding_box(); x, y = hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2
pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 100 * zoom, steps=6); pg.mouse.up(); pg.wait_for_timeout(400)
check("it does not go below 24", val() == 24, str(val()))
pg.keyboard.press("Control+z"); pg.wait_for_timeout(300)
check("Ctrl+Z undoes the drag", val() == 38, str(val()))
# the number in the inspector
pg.fill(".nde-row:has(.nde-lab:text-is('Header height')) input", "52"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
sb3 = pg.query_selector(".nde-sel").bounding_box()
check("a number typed in the inspector sets the header", abs(sb3["height"] - 52 * zoom) < 1.5, f"{sb3['height']} vs {52 * zoom}")
finish(p, br, errs)
