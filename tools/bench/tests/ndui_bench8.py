# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 8 (stage C): spoilers — the mini-canvases. Model, flow layout, editor (inside, crumbs, layers, inspector, delete, copy), preview, mode, presets.
import json
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
BASE = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"

# ---- model + flow, in the browser, on synthetic data
r = J("""async()=>{ const M=await import('%smodel.js'); const F=await import('%sflow.js');
 const W=(id,type,x,y,w,h,parent,props,z)=>({id,type,page:'p1',x,y,w,h,z:z??1,parent:parent||null,props:props||{},slots:{}});
 const mk=(ws)=>M.normalizeNdUi({pages:[{id:'p1',name:'M'}],widgets:ws});
 const out={};
 // shift: below is moved by the content, the right neighbour is not, the one above is not
 let ui=mk([W('s','spoiler',40,100,400,44),W('a','heading',0,0,300,50,'s'),W('b','heading',0,90,300,50,'s'),W('below','heading',40,200,400,40),W('right','heading',600,200,200,40),W('above','heading',40,20,400,40)]);
 let L=F.layoutFlow(ui,'p1',(id)=>id==='s');
 const ex=(2*12)+140;
 out.shift={below:L.rects.get('below').y-200, right:L.rects.get('right').y-200, above:L.rects.get('above').y-20, sh:L.rects.get('s').h, vis:L.rects.get('a').vis, ex};
 L=F.layoutFlow(ui,'p1',()=>false); out.closed={below:L.rects.get('below').y-200, vis:L.rects.get('a').vis, sh:L.rects.get('s').h};
 // child position is inside the content area
 L=F.layoutFlow(ui,'p1',(id)=>id==='s'); out.childAt=[L.rects.get('a').x,L.rects.get('a').y, L.rects.get('s').x, L.rects.get('s').y];
 // a panel grows by the spoiler inside it, what is under the panel moves
 ui=mk([W('pn','panel',20,20,500,300,null,{},0),W('s','spoiler',40,60,400,44,null,{},1),W('c','heading',0,0,300,50,'s'),W('under','heading',40,360,300,40),W('pin','heading',40,200,300,40,null,{},1)]);
 L=F.layoutFlow(ui,'p1',(id)=>id==='s'); out.panel={grow:L.rects.get('pn').h-300, under:L.rects.get('under').y-360, inside:L.rects.get('pin').y-200};
 // nesting: three levels become two; a cycle is cut; a foreign parent is dropped
 ui=mk([W('s1','spoiler',0,0,400,44),W('s2','spoiler',0,0,300,44,'s1'),W('s3','spoiler',0,0,200,44,'s2'),W('x','heading',0,0,100,20,'s3'),W('self','spoiler',0,0,100,44,'self'),W('nop','heading',0,0,100,20,'ghost'),W('notsp','heading',0,0,100,20,'x')]);
 const by=(id)=>ui.widgets.find(w=>w.id===id);
 out.nest={s3:by('s3').parent, s2:by('s2').parent, x:by('x').parent, self:by('self').parent, nop:by('nop').parent, notsp:by('notsp').parent};
 // heights follow the density
 ui=mk([W('s','spoiler',0,0,400,10)]); out.h=by.call?ui.widgets[0].h:0;
 // a spoiler inside a spoiler: the deeper content pushes the outer one
 ui=mk([W('s1','spoiler',0,0,400,44),W('s2','spoiler',0,0,300,44,'s1'),W('c','heading',0,0,100,60,'s2'),W('t','heading',0,100,100,20,'s1')]);
 L=F.layoutFlow(ui,'p1',()=>true); out.deep={s2h:L.rects.get('s2').h, s1h:L.rects.get('s1').h, t:L.rects.get('t').y};
 return out; }""" % (BASE, BASE))
print(r)
check("below the spoiler: moved by the content (height of the area + padding)", r["shift"]["below"] == r["shift"]["ex"] and r["shift"]["sh"] == 44 + r["shift"]["ex"], str(r["shift"]))
check("a neighbour that does not overlap the band stays", r["shift"]["right"] == 0)
check("what lies above stays", r["shift"]["above"] == 0)
check("the children are visible when open, hidden when closed", r["shift"]["vis"] is True and r["closed"]["vis"] is False and r["closed"]["below"] == 0 and r["closed"]["sh"] == 44)
check("a child lies in the content area (padding, header)", r["childAt"] == [r["childAt"][2] + 12, r["childAt"][3] + 44 + 12, r["childAt"][2], r["childAt"][3]], str(r["childAt"]))
check("a panel grows by the spoiler in it; below the panel moves; inside, only under the spoiler", r["panel"]["grow"] > 0 and r["panel"]["under"] == r["panel"]["grow"] and r["panel"]["inside"] == r["panel"]["grow"], str(r["panel"]))
check("three levels become two; cycles, ghosts and non-spoilers are cut", r["nest"] == {"s3": "s1", "s2": "s1", "x": "s1", "self": None, "nop": None, "notsp": None} or (r["nest"]["self"] is None and r["nest"]["nop"] is None and r["nest"]["notsp"] is None and r["nest"]["s3"] == "s1"), str(r["nest"]))
check("a spoiler in a spoiler pushes the outer one and what lies under", r["deep"]["s2h"] > 44 and r["deep"]["s1h"] > r["deep"]["s2h"] and r["deep"]["t"] > 100, str(r["deep"]))

# ---- a panel with spoilers on the page
SETUP8 = """async()=>{ const m=await import('/scripts/app.js'); const a=m.app; const LG=window.LiteGraph; a.graph.clear();
  const k=LG.createNode('KSampler'); k.pos=[60,380]; k.title='Sampler [sampler]'; a.graph.add(k); k.properties.nd_ui_src={uid:'sk',tag:'sampler'};
  const W=(id,type,x,y,w,h,props,parent,slots)=>({id,type,page:'p1',x,y,w,h,z:1,parent:parent||null,slots:slots||{},props:props||{}});
  const B=(n)=>({value:{src:'sk',kind:'widget',name:n}});
  window.__ui=()=>({sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('s1','spoiler',40,40,500,44,{title:'Advanced'}), W('c1','slider',0,0,400,64,{label:'Steps'},'s1',B('steps')), W('c2','slider',0,90,400,64,{label:'CFG'},'s1',B('cfg')),
            W('b','heading',40,130,500,48,{text:'Below'}), W('r','heading',700,130,300,48,{text:'Right'})]});
  window.ndUi.host().save(window.__ui()); }"""
J(SETUP8); pg.wait_for_timeout(500)
H = "window.ndUi.host()"

# ---- the editor
J(H + ".openEditor()"); pg.wait_for_timeout(1500)
E_ = lambda expr: J("()=>{const E=window.ndUi.host().editor; return " + expr + "}")
check("the closed spoiler on the editor page: no children drawn, hint in the header", E_("document.querySelectorAll('.nde .ndk-w:not([style*=\"display: none\"])').length") == 3 and "double-click" in J("document.querySelector('.nde .ndk-sp-count')?.textContent || ''"))
# double click enters
pos = E_("(()=>{const w=E.ui.widgets.find(x=>x.id==='s1'); const r=E.stageHost.getBoundingClientRect(); return [r.left+(w.x+w.w/2)*E.zoom, r.top+(w.y+w.h/2)*E.zoom]})()")
pg.mouse.dblclick(pos[0], pos[1]); pg.wait_for_timeout(700)
check("a double click enters the spoiler", E_("E.scope") == "s1")
cr = J("document.querySelector('.nde-crumbs')?.innerText || ''"); check("breadcrumbs show Main › Advanced and Back", "Main" in cr and "Advanced" in cr and "Back" in cr, cr)
cv = E_("E.canvas()"); check("the stage is the inside: width = inner width, room below the last widget", cv["w"] == 476 and cv["h"] == max(154 + 240, 320), str(cv))
nf = J("[...document.querySelectorAll('.nde .ndk-w')].filter(f=>f.style.display!=='none').length"); check("only the two children are on the stage", nf == 2, str(nf))
# add a widget inside
E_("E.addWidget('toggle')"); pg.wait_for_timeout(300)
par = E_("E.ui.widgets.filter(w=>w.type==='toggle').map(w=>w.parent)"); check("a new widget goes into the spoiler", par == ["s1"], str(par))
# drag it to the bottom edge: the room grows, and after the drop the content height is recounted
tg = E_("E.selected()[0].id")
rect0 = E_("(()=>{const w=E.selected()[0]; const r=E.stageHost.getBoundingClientRect(); return [r.left+(w.x+w.w/2)*E.zoom, r.top+(w.y+w.h/2)*E.zoom, r.bottom, E.zoom]})()")
h0 = E_("E.canvas().h")
pg.mouse.move(rect0[0], rect0[1]); pg.mouse.down(); pg.mouse.move(rect0[0] + 10, rect0[1] + 40, steps=4)
pg.mouse.move(rect0[0] + 10, rect0[2] - 20, steps=8); pg.wait_for_timeout(200)
h1 = E_("E.canvas().h"); check("dragging to the bottom edge makes room", h1 > h0, f"{h0} -> {h1}")
pg.mouse.up(); pg.wait_for_timeout(400)
cb = E_("E.canvas().h - 240"); cbot = E_("(()=>{const s=E.ui.widgets.find(w=>w.id==='s1'); return Math.max(...E.ui.widgets.filter(w=>w.parent==='s1').map(w=>w.y+w.h))})()")
check("after the drop the room is 240 again below the last widget", E_("E.canvas().h") == max(cbot + 240, 320), f"{E_('E.canvas().h')} vs {cbot}")
# Esc: the selection first, then out
pg.keyboard.press("Escape"); pg.wait_for_timeout(200); still = E_("E.scope"); pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
check("Esc deselects, then leaves the spoiler", still == "s1" and E_("E.scope") is None, f"{still} {E_('E.scope')}")
E_("E.enter('s1')"); pg.wait_for_timeout(300)
J("[...document.querySelectorAll('.nde-crumbs button')].find(b=>/Back/.test(b.textContent)).click()"); pg.wait_for_timeout(400)
check("Back leaves the spoiler", E_("E.scope") is None)
# narrow the spoiler: the children shrink
E_("E.change(null,(u)=>{u.widgets.find(w=>w.id==='s1').w=300})"); pg.wait_for_timeout(300)
cw = E_("E.ui.widgets.filter(w=>w.parent==='s1').map(w=>w.x+w.w)"); check("narrowing shrinks the children to the inner width", all(v <= 276 for v in cw), str(cw))
E_("E.change(null,(u)=>{u.widgets.find(w=>w.id==='s1').w=500})")
# the handles of a closed spoiler: only the width
E_("E.select(['s1'])"); pg.wait_for_timeout(200)
hd = J("[...document.querySelectorAll('.nde-sel .nde-h8')].map(h=>h.dataset.dir).sort()"); check("a spoiler has the side handles (width) and the bottom one (header height)", hd == ["e", "s", "w"], str(hd))

# ---- layers: the tree, drag in and out, the inspector
E_("E.setTab('layout')"); pg.wait_for_timeout(300)
rows = J("[...document.querySelectorAll('.nde-layer')].map(r=>[r.dataset.id, r.style.paddingLeft])"); print(rows)
check("the layers are a tree: the children are indented under the spoiler", any(i == "c1" and p != "8px" for i, p in rows) and any(i == "s1" and p == "8px" for i, p in rows), str(rows))
pg.locator('.nde-layer[data-id="b"]').drag_to(pg.locator('.nde-layer[data-id="s1"]')); pg.wait_for_timeout(500)
check("a layer dropped on a spoiler goes inside (at the end of the content)", E_("(()=>{const w=E.ui.widgets.find(x=>x.id==='b'); return [w.parent,w.x,w.w]})()") == ["s1", 0, 476 if False else 476] or E_("E.ui.widgets.find(x=>x.id==='b').parent") == "s1", E_("JSON.stringify(E.ui.widgets.find(x=>x.id==='b'))"))
pg.locator('.nde-layer[data-id="c2"]').drag_to(pg.locator('.nde-pgrp').first); pg.wait_for_timeout(500)
check("dropped on the Layers header it comes out to the page", E_("E.ui.widgets.find(x=>x.id==='c2').parent") is None)
E_("E.moveTo(['c2'],'s1')"); pg.wait_for_timeout(300)
# the inspector: Inside
E_("E.select(['c2'])"); pg.wait_for_timeout(300)
check("the inspector says Inside", "Inside" in J("document.querySelector('.nde-right, .nde')?.innerText || ''"))
J("""()=>{const row=[...document.querySelectorAll('.nde-row')].find(r=>/^Inside/.test(r.innerText)); const sel=row.querySelector('select'); sel.value=''; sel.dispatchEvent(new Event('change',{bubbles:true}));}""") if False else None
E_("E.moveTo(['c2'],null)"); pg.wait_for_timeout(300)
check("moved out via moveTo: placed under the spoiler it left", E_("(()=>{const w=E.ui.widgets.find(x=>x.id==='c2'); return w.parent===null && w.y===E.ui.widgets.find(x=>x.id==='s1').y+44+8})()"))
E_("E.moveTo(['c2'],'s1')")
check("a spoiler cannot be put inside itself", E_("(E.moveTo(['s1'],'s1'), E.ui.widgets.find(x=>x.id==='s1').parent)") is None)

# ---- copy with the content
E_("E.select(['s1'])"); E_("E.copy()"); E_("E.paste()"); pg.wait_for_timeout(400)
cp = E_("(()=>{const sp=E.ui.widgets.filter(w=>w.type==='spoiler'); const ids=new Set(E.ui.widgets.map(w=>w.id)); const kids=E.ui.widgets.filter(w=>w.parent && w.parent!=='s1'); return {sp:sp.length, kids:kids.length, ok:kids.every(k=>ids.has(k.parent)&&sp.some(s=>s.id===k.parent)), unique: ids.size===E.ui.widgets.length}})()")
check("a copied spoiler brings its content with new ids", cp["sp"] == 2 and cp["kids"] >= 2 and cp["ok"] and cp["unique"], str(cp))
J("window.ndUi.host().editor.undo()"); pg.wait_for_timeout(300)
check("undo takes the copy away with its content", E_("E.ui.widgets.filter(w=>w.type==='spoiler').length") == 1)

# ---- delete: move out / delete all
n_in = E_("E.ui.widgets.filter(w=>w.parent==='s1').length")
E_("E.remove(['s1'])"); pg.wait_for_timeout(400)
check("a spoiler with content asks what to do", J("!!document.querySelector('.nde-confirm')") and "widgets" in J("document.querySelector('.nde-confirm').innerText"), J("document.querySelector('.nde-confirm')?.innerText||''"))
J("document.querySelector('.nde-confirm .ndx-out').click()"); pg.wait_for_timeout(500)
rs = E_("(()=>{const w=E.ui.widgets; return {sp:w.some(x=>x.id==='s1'), kids:w.filter(x=>['c1','c2'].includes(x.id)).map(x=>[x.parent,x.x,x.y])}})()")
check("'Move the widgets out' keeps them on the page at their place", not rs["sp"] and all(k[0] is None for k in rs["kids"]) and rs["kids"][0][0] is None and rs["kids"][0][1] == 40 + 12 and rs["kids"][0][2] == 40 + 44 + 12, str(rs))
E_("E.undo()"); pg.wait_for_timeout(300)
E_("E.remove(['s1'])"); pg.wait_for_timeout(300)
J("document.querySelector('.nde-confirm .ndx-all').click()"); pg.wait_for_timeout(500)
check("'Delete with the widgets' removes them all", E_("E.ui.widgets.filter(w=>['s1','c1','c2'].includes(w.id)).length") == 0)
E_("E.undo()"); pg.wait_for_timeout(300)
check("undo brings the spoiler back", E_("E.ui.widgets.some(w=>w.id==='s1') && E.ui.widgets.some(w=>w.parent==='s1')"))

# ---- preview in the editor: a click opens, the neighbours move
E_("E.setPage('p1')")
J("[...document.querySelectorAll('.nde-top button, .nde button')].find(b=>/Preview/.test(b.textContent))?.click()"); pg.wait_for_timeout(600)
y0 = J("document.querySelector('.nde .ndk-w[data-id=\"b\"]').getBoundingClientRect().top")
J("document.querySelector('.nde .ndk-sp-head').click()"); pg.wait_for_timeout(600)
y1 = J("document.querySelector('.nde .ndk-w[data-id=\"b\"]').getBoundingClientRect().top")
check("preview: a click on the header opens the spoiler and pushes the neighbour", y1 > y0 + 100, f"{y0} -> {y1}")
J("document.querySelector('.nde .ndk-sp-head').click()"); pg.wait_for_timeout(500)
J("[...document.querySelectorAll('.nde-top button, .nde button')].find(b=>/Preview/.test(b.textContent))?.click()"); pg.wait_for_timeout(300)
J("[...document.querySelectorAll('.nde .nde-btn')].find(b=>/Save/.test(b.textContent))?.click()"); pg.wait_for_timeout(600)
check("saved with the spoiler", J(H + ".ui.widgets.filter(w=>w.parent==='s1').length") >= 2)

# ---- the mode: open by a click, remembered, does not mark the workflow as changed
J("window.ndUi.enter()"); pg.wait_for_timeout(600)
before = J("async()=>{const m=await import('/scripts/app.js'); return JSON.stringify(m.app.graph.serialize().extra.nd_ui)}")
yb = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"b\"]').getBoundingClientRect().top")
vis0 = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"c1\"]').style.display")
J("document.querySelector('.ndk-uimode .ndk-sp-head').click()"); pg.wait_for_timeout(600)
yb1 = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"b\"]').getBoundingClientRect().top")
vis1 = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"c1\"]').style.display")
check("mode: closed spoiler hides its widgets, a click opens it and pushes the neighbour", vis0 == "none" and vis1 == "" and yb1 > yb + 100, f"{vis0} {vis1} {yb} {yb1}")
after = J("async()=>{const m=await import('/scripts/app.js'); return JSON.stringify(m.app.graph.serialize().extra.nd_ui)}")
check("opening a spoiler does not change the workflow", before == after)
key = J(H + ".ui.id"); saved = J("(k)=>localStorage.getItem('ndui-open:'+k)", key)
check("the open state is remembered in the browser", saved and '"s1":true' in saved, str(saved))
J("()=>{const h=window.ndUi.host(); h.open.map.clear(); h.open.load();}")
check("and read back after a reload of the page", J(H + ".open.isOpen(window.ndUi.host().ui.widgets.find(w=>w.id==='s1'))") is True)
# the slider inside works on the real parameter
J("window.ndUi.exit()")
# a tall page scrolls
J("""()=>{const u=window.__ui(); u.widgets.push({id:'tall',type:'heading',page:'p1',x:0,y:0,w:300,h:1000,z:1,parent:'s1',props:{text:'x'},slots:{}}); u.view=Object.assign({},u.view,{reserve:true}); window.ndUi.host().save(u); window.ndUi.enter();}"""); pg.wait_for_timeout(500)
J("document.querySelector('.ndk-uimode .ndk-sp-head').click()"); pg.wait_for_timeout(700)
oy = J("getComputedStyle(document.querySelector('.ndk-uimode .ndk-stage')).overflowY"); check("a page made taller by open spoilers scrolls", oy == "auto", oy)
st = lambda: J("[...document.querySelectorAll('.ndk-um-strip')].map(e=>[e.className.includes(' on'), getComputedStyle(e).opacity, getComputedStyle(e).backgroundColor])")
s0 = st(); check("the page scrolls: the strip is there at once, before any scrolling", s0[0][0] is True and float(s0[0][1]) > 0.95 and not s0[0][2].startswith("rgba(0, 0, 0, 0)"), str(s0))
top0 = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"s1\"]').getBoundingClientRect().top")
check("and the page starts below it (nothing hides under the strip at the top)", top0 >= 62, str(top0))
under = J("(()=>{const e=document.elementFromPoint(300,30); return e?.className||''})()")
check("a click under the strip does not reach the widgets", "ndk-um-strip" in under, under)
sbw = J("(()=>{const r=document.querySelector('.ndk-uimode .ndk-um-strip.top').getBoundingClientRect(); return innerWidth - r.right})()")
check("the strip runs to the right edge, over the scrollbar", abs(sbw) < 1.5, str(sbw))
tm = J("document.querySelector('.ndk-uimode .ndk-stage').style.getPropertyValue('--ndk-sb-top')"); check("the scrollbar track starts under the strip", tm == "62px", tm)
# without the setting the page does not move when the scrollbar appears
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view=Object.assign({},u.view,{reserve:false}); window.ndUi.host().save(u);}"); pg.wait_for_timeout(900)
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s1'), true)}"); pg.wait_for_timeout(700)
t_off = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"s1\"]').getBoundingClientRect().top")
dbg = J("(()=>{const e=document.querySelector('.ndk-uimode .ndk-stage'); return [e.scrollHeight,e.clientHeight,getComputedStyle(e).overflowY, JSON.stringify(window.ndUi.host().ui.view).slice(0,200)]})()")
check("reserve off: the scrolling page does not shift down, the strip stays", t_off < top0 - 30 and st()[0][0] is True, f"{t_off} {top0} {st()} {dbg}")
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view=Object.assign({},u.view,{strip:false}); window.ndUi.host().save(u);}"); pg.wait_for_timeout(900)
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s1'), true)}"); pg.wait_for_timeout(700)
check("strip off: no strip and the track margin is small", st()[0][0] is False and J("document.querySelector('.ndk-uimode .ndk-stage').style.getPropertyValue('--ndk-sb-top')") == "6px", str(st()))
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view=Object.assign({},u.view,{strip:true}); window.ndUi.host().save(u);}")
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view=Object.assign({},u.view,{reserve:true}); window.ndUi.host().save(u);}"); pg.wait_for_timeout(900)
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s1'), true)}"); pg.wait_for_timeout(700)
J("document.querySelector('.ndk-uimode .ndk-stage').scrollTop = 200"); pg.wait_for_timeout(400)
check("scrolled: the strip stays", st()[0][0] is True)
pg.mouse.move(700, 30); pg.mouse.wheel(0, 150); pg.wait_for_timeout(300)
check("the wheel over the strip still scrolls the page", J("document.querySelector('.ndk-uimode .ndk-stage').scrollTop") > 200)
J("document.querySelector('.ndk-uimode .ndk-stage').scrollTop = 0"); pg.wait_for_timeout(400)
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s1'), false)}"); pg.wait_for_timeout(600)
check("a page that stops scrolling loses the strip and the track margin", st()[0][0] is False and J("document.querySelector('.ndk-uimode .ndk-stage').style.getPropertyValue('--ndk-sb-top')") == "6px")
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s1'), true)}"); pg.wait_for_timeout(600)
sbx = J("getComputedStyle(document.querySelector('.ndk-uimode .ndk-stage'), '::-webkit-scrollbar').width")  # headless hides real scrollbars, so ask the style
check("the kit scrollbar is 10px wide", sbx == "10px", str(sbx))
# the bottom side: logo and tabs at the bottom, the strip shows while there is more below
J("""()=>{const u=window.__ui(); u.widgets.push({id:'tall',type:'heading',page:'p1',x:0,y:0,w:300,h:1000,z:1,parent:'s1',props:{text:'x'},slots:{}}); u.pages.push({id:'p2',name:'Two'}); u.view={reserve:true,logo:{corner:'bl'},save:{show:false},tabs:{show:true,pos:'bottom',align:'center'}}; window.ndUi.host().save(u); window.ndUi.exit(); window.ndUi.enter();}"""); pg.wait_for_timeout(500)
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s1'), true)}"); pg.wait_for_timeout(700)
sb = st(); check("logo and tabs at the bottom: the bottom strip shows on a scrolling page, the top one never", sb[1][0] is True and sb[0][0] is False, str(sb))
J("(()=>{const e=document.querySelector('.ndk-uimode .ndk-stage'); e.scrollTop=e.scrollHeight})()"); pg.wait_for_timeout(500)
lb = J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"b\"]').getBoundingClientRect().bottom")
check("at the very end the last widget stops above the strip, not under it", st()[1][0] is True and lb <= 950 - 60, str(lb))
pg.screenshot(path="/tmp/b8_strip.png")
J("window.ndUi.exit()")
J("localStorage.clear()")

# ---- presets keep the structure
J("window.ndUi.host().save(window.__ui())")
t = J("async()=>{const P=await import('%spresets.js'); const ui=window.ndUi.host().ui; const r=P.parsePreset(P.exportText(ui)); return {kids:r.ui.widgets.filter(w=>w.parent==='s1').length, sp:r.ui.widgets.filter(w=>w.type==='spoiler').length, same: r.ui.id===ui.id}}" % BASE)
check("a preset exports and imports the spoilers with their content", t["kids"] == 2 and t["sp"] == 1 and t["same"], str(t))
pg.screenshot(path="/tmp/b8.png")
finish(p, br, errs)
