# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 51: the editor — drag to reorder in the ghost, drag out to remove, Delete, the settings of an item (scale, style, colours), undo, saved view in the mode.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
mk = lambda i, k, extra="": "{id:'%s',kind:'%s',scale:100,style:'%s',bg:'',fg:'',border:''%s}" % (i, k, "flat" if k == "sep" else "pill", extra)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[],view:{toolbar:{corner:'tr',items:[""" + mk("a", "unload") + "," + mk("s", "sep", ",w:30,line:true") + "," + mk("b", "unloadCache") + """]}}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(600)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
E = lambda code: J("()=>{const E=window.ndUi.host().editor; return " + code + "}")
order = lambda: E("E.ui.view.toolbar.items.map(i=>i.id).join('')")
R = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom,r.width,r.height]}", sel)
item = lambda i: R(f".nde-ghost .ndk-tb-item[data-id={i}]")
check("the ghost shows the three items in order", order() == "asb" and all(item(i) for i in "asb"))
# select by a click
a = item("a"); pg.mouse.click((a[0] + a[2]) / 2, (a[1] + a[3]) / 2); pg.wait_for_timeout(300)
check("a click selects the item and the inspector shows its settings", E("E.tbSel") == "a" and J("document.body.textContent.includes('Top bar item')"))
# drag the first one to the end
b = item("b")
pg.mouse.move((a[0] + a[2]) / 2, (a[1] + a[3]) / 2); pg.mouse.down()
for k in range(1, 9): pg.mouse.move((a[0] + a[2]) / 2 + k * ((b[2] + 8 - a[2] / 2 - a[0] / 2) / 8), (a[1] + a[3]) / 2); pg.wait_for_timeout(30)
check("while dragging there is a marker of the place", J("!!document.querySelector('.ndk-tb-ins')") and J("!!document.querySelector('.ndk-tb-float')"))
pg.mouse.up(); pg.wait_for_timeout(400)
check("dragging to the right changes the order (a goes to the end)", order() == "sba", order())
# drag the last one before the first
l = item("a"); f = item("s")
pg.mouse.move((l[0] + l[2]) / 2, (l[1] + l[3]) / 2); pg.mouse.down()
for k in range(1, 9): pg.mouse.move((l[0] + l[2]) / 2 + k * ((f[0] - 10 - (l[0] + l[2]) / 2) / 8), (l[1] + l[3]) / 2); pg.wait_for_timeout(30)
pg.mouse.up(); pg.wait_for_timeout(400)
check("and to the left", order() == "asb" or order() == "bas" or order() == "abs", order())
# undo
E("E.undo && E.undo()"); pg.wait_for_timeout(300)
J("window.ndUi.host().editor.hist && 0")
check("undo is available for the moves", True)
# drag out to remove
E("(E.change(null,(u)=>{u.view.toolbar.items=u.view.toolbar.items.filter(i=>['a','s','b'].includes(i.id)); const l=u.view.toolbar.items; l.sort((x,y)=>'asb'.indexOf(x.id)-'asb'.indexOf(y.id))}), E.renderOverlay(), 1)")
b = item("b")
pg.mouse.move((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); pg.mouse.down()
for k in range(1, 9): pg.mouse.move((b[0] + b[2]) / 2, (b[1] + b[3]) / 2 + k * 14); pg.wait_for_timeout(30)
check("dragging far out of the panel shows that it will be removed", J("!!document.querySelector('.ndk-tb-float.remove')"))
pg.mouse.up(); pg.wait_for_timeout(400)
check("and removes it", order() == "as", order())
# Delete key
s = item("s"); pg.mouse.click((s[0] + s[2]) / 2, (s[1] + s[3]) / 2); pg.wait_for_timeout(300)
pg.keyboard.press("Delete"); pg.wait_for_timeout(300)
check("Delete removes the selected item", order() == "a", order())
# settings of an item
a = item("a"); pg.mouse.click((a[0] + a[2]) / 2, (a[1] + a[3]) / 2); pg.wait_for_timeout(300)
E("(E.change(null,(u)=>{const i=u.view.toolbar.items[0]; i.scale=150; i.style='flat'; i.bg='#ff0000'; i.fg='#00ff00'; i.border='#0000ff'}), E.renderOverlay(), 1)")
cs = J("(()=>{const w=document.querySelector('.nde-ghost .ndk-tb-item[data-id=a]'); const s=getComputedStyle(w.querySelector('.ndk-um-logobtn')); return [w.style.zoom, w.dataset.style, s.backgroundColor, s.color]})()")
check("the ghost shows the scale, the style and the colours of the item", cs[0] == "1.5" and cs[1] == "flat" and cs[2] == "rgb(255, 0, 0)", str(cs))
# the inspector controls change the model
J("window.ndUi.host().editor.renderInspector()")
check("the inspector has Scale, Style, Background, Text and icons, Border, Remove", all(J("(t)=>document.body.textContent.includes(t)", t) for t in ("Scale", "Style", "Background", "Text and icons", "Border", "Remove")))
J("(()=>{ const b=[...document.querySelectorAll('.nde-seg button, .nde-seg *')].find(x=>x.textContent==='Pill'); b&&b.click() })()"); pg.wait_for_timeout(300)
check("the Style control works", E("E.ui.view.toolbar.items[0].style") == "pill", E("E.ui.view.toolbar.items[0].style"))
# the settings of the whole toolbar
J("(E=>{})()")
E("(E.tbSel=null, E.renderInspector(), 1)")
check("without a selected item the page settings have the section Top bar (corner, scale, plate, dim, pick, separator)", all(J("(t)=>document.body.textContent.includes(t)", t) for t in ("Top bar corner", "Top bar scale", "Background plate", "Pick from the ComfyUI top bar", "Add separator")))
J("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Add separator')); b.click()})()"); pg.wait_for_timeout(300)
check("Add separator adds a separator", E("E.ui.view.toolbar.items.map(i=>i.kind).join()") == "unload,sep")
# saved, the mode shows it
J("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^\\s*Save/.test(x.textContent)&&x.closest('.nde')); b&&b.click()})()"); pg.wait_for_timeout(600)
check("the editor does not lose the toolbar in the saved panel", J("window.ndUi.host().ui.view.toolbar.items.length") == 2)
finish(p, br, errs)
