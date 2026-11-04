# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 55: groups of widgets in the editor: Ctrl+G, a click takes the group, the group moves / copies / deletes as one, normalization.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const W=(id,type,x,y,w,h,z)=>({id,type,page:'p1',x,y,w,h,z,slots:{},props:{}});
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[W('a','generate',40,60,200,64,1),W('b','queue',40,140,200,48,2),W('c','progress',300,60,200,48,3),W('d','generate',300,140,200,64,4)],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(600)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
E_ = "window.ndUi.host().editor"
pos = lambda wid: J("(id)=>{const E=%s; const w=E.ui.widgets.find(x=>x.id===id); const r=document.querySelector('.nde-stage').getBoundingClientRect(); return [r.left+(w.x+w.w/2)*E.zoom, r.top+(w.y+w.h/2)*E.zoom]}" % E_, wid)
sel = lambda: sorted(J("()=>[...%s.sel]" % E_))
ui = lambda: J("()=>JSON.parse(JSON.stringify(%s.ui))" % E_)
J("()=>%s.select(['a','b'])" % E_)
pg.keyboard.press("Control+g"); pg.wait_for_timeout(400)
u = ui(); wa = {w["id"]: w for w in u["widgets"]}
check("Ctrl+G makes a group of the two", len(u["groups"]) == 1 and wa["a"]["group"] == wa["b"]["group"] and "group" not in wa["c"], str(u["groups"]))
check("the group has a name and the members are selected", u["groups"][0]["name"].startswith("Group") and sel() == ["a", "b"])
check("a frame of the group is drawn", J("()=>!!document.querySelector('.nde-wgrp')"))
J("()=>%s.select([])" % E_)
x, y = pos("a"); pg.mouse.click(x, y); pg.wait_for_timeout(300)
check("a click on a member takes the whole group", sel() == ["a", "b"], str(sel()))
x, y = pos("c"); pg.mouse.click(x, y); pg.wait_for_timeout(300)
check("a click on a lone widget takes only it", sel() == ["c"], str(sel()))
# drag the group
x, y = pos("a"); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 60, y + 40, steps=6); pg.mouse.up(); pg.wait_for_timeout(400)
u = ui(); wa = {w["id"]: w for w in u["widgets"]}
check("dragging a member moves the whole group", wa["a"]["x"] > 40 and wa["a"]["x"] - 40 == wa["b"]["x"] - 40 and wa["a"]["y"] - 60 == wa["b"]["y"] - 140 and wa["c"]["x"] == 300, str((wa["a"]["x"], wa["b"]["x"], wa["c"]["x"])))
# inside the group: a double click takes one
x, y = pos("a"); pg.mouse.dblclick(x, y); pg.wait_for_timeout(300)
check("a double click takes one widget of the group", sel() == ["a"] and J("()=>%s.inGroup" % E_), str(sel()))
x0 = ui()["widgets"][0]["x"]
x, y = pos("a"); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 50, y, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
wa = {w["id"]: w for w in ui()["widgets"]}
check("and moves only it", wa["a"]["x"] != wa["b"]["x"] and wa["a"]["x"] - x0 > 20, str((wa["a"]["x"], wa["b"]["x"])))
# click on a layer takes one; Alt+click on the canvas too
J("()=>%s.select([])" % E_); J("()=>{%s.inGroup=null}" % E_)
x, y = pos("b"); pg.keyboard.down("Alt"); pg.mouse.click(x, y); pg.keyboard.up("Alt"); pg.wait_for_timeout(300)
check("Alt+click takes one widget", sel() == ["b"], str(sel()))
# the marquee takes a group whole
J("()=>{const E=%s; E.inGroup=null; E.select([])}" % E_)
r = J("()=>{const r=document.querySelector('.nde-stage').getBoundingClientRect(); return [r.left, r.top]}")
bx, by = pos("b"); pg.mouse.move(r[0] + 10, by + 40); pg.mouse.down(); pg.mouse.move(bx + 10, by - 5, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
check("a marquee that touches one member takes the whole group", "a" in sel() and "b" in sel() and "c" not in sel(), str(sel()))
# copy
J("()=>{const E=%s; E.inGroup=null; E.select(['a','b'])}" % E_)
pg.keyboard.press("Control+d"); pg.wait_for_timeout(500)
u = ui(); gs = {}
for w in u["widgets"]: gs.setdefault(w.get("group"), []).append(w["id"])
check("Ctrl+D copies the group as a group with new ids", len(u["groups"]) == 2 and sorted(len(v) for k, v in gs.items() if k) == [2, 2], str(gs))
J("()=>{%s.hist}" % E_)
# hide / lock the group
gid = u["groups"][0]["id"]
J("(g)=>%s.groupFlag(g,'hidden')" % E_, gid); pg.wait_for_timeout(200)
hid = [w["hidden"] for w in ui()["widgets"] if w.get("group") == gid]
check("hide works on the whole group", hid and all(hid), str(hid))
J("(g)=>%s.groupFlag(g,'hidden')" % E_, gid)
# delete the copy with Del, undo brings it back
J("()=>{const E=%s; E.inGroup=null; const g=E.ui.groups[1].id; E.select(E.ui.widgets.filter(w=>w.group===g).map(w=>w.id))}" % E_)
n0 = len(ui()["widgets"])
pg.keyboard.press("Delete"); pg.wait_for_timeout(400)
u = ui()
check("Delete removes the group with its widgets (the empty group goes)", len(u["widgets"]) == n0 - 2 and len(u["groups"]) == 1, str((len(u["widgets"]), len(u["groups"]))))
pg.keyboard.press("Control+z"); pg.wait_for_timeout(400)
check("undo brings the group back", len(ui()["groups"]) == 2)
# ungroup
J("()=>{const E=%s; E.select(['a','b'])}" % E_)
pg.keyboard.press("Control+Shift+g"); pg.wait_for_timeout(400)
u = ui(); wa = {w["id"]: w for w in u["widgets"]}
check("Ctrl+Shift+G ungroups", "group" not in wa["a"] and "group" not in wa["b"] and len(u["groups"]) == 1, str(u["groups"]))
# one level only; a group of different levels is refused
J("""()=>{const E=%s; E.change(null,(u)=>{ u.widgets.push({id:'s1',type:'spoiler',page:'p1',x:600,y:40,w:260,h:44,z:9,slots:{},props:{title:'S'},look:{}}); }); E.moveTo(['d'],'s1'); E.select(['c','d']); }""" % E_)
pg.keyboard.press("Control+g"); pg.wait_for_timeout(400)
check("widgets of two levels are not grouped", len(ui()["groups"]) == 1)
# the model
r = J("""async()=>{const M=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js');
 const W=(id,page,z,group,parent)=>({id,type:'queue',page,x:0,y:0,w:100,h:40,z,group,parent,slots:{},props:{}});
 const u=M.normalizeNdUi({pages:[{id:'p1'},{id:'p2'}],groups:[{id:'g1',page:'p1',name:'One'},{id:'g2',page:'p2',name:'Wrong page'},{id:'g3',page:'p1',name:'Empty'},{id:'g1',page:'p1',name:'dup'}],
  widgets:[W('a','p1',1,'g1'),W('c','p1',2),W('b','p1',3,'g1'),W('x','p1',4,'g2'),W('y','p1',5,'nope')]});
 const by=Object.fromEntries(u.widgets.map(w=>[w.id,w]));
 return {groups:u.groups.map(g=>g.id), ga:by.a.group, gx:by.x.group, gy:by.y.group, z:['a','b','c'].map(k=>by[k].z)}}""")
check("normalization: bad references and empty groups go", r["groups"] == ["g1"] and r["ga"] == "g1" and r["gx"] is None and r["gy"] is None, str(r))
check("members of a group lie side by side in z (a, b next to each other, c outside)", abs(r["z"][0] - r["z"][1]) == 1, str(r))
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
