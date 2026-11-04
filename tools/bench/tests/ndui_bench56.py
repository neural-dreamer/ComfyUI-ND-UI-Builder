# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 56: layers: reorder by dragging (above / below), into a group and a spoiler, out again, a group as a block.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const W=(id,type,x,y,w,h,z,props)=>({id,type,page:'p1',x,y,w,h,z,slots:{},props:props||{}});
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[W('a','generate',40,60,200,64,1),W('b','queue',40,140,200,48,2),W('c','progress',300,60,200,48,3),W('d','generate',300,140,200,64,4),W('e','queue',300,240,200,48,5),W('sp','spoiler',40,260,240,44,6,{title:'Box'})],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(600)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
E_ = "window.ndUi.host().editor"
J("()=>%s.setTab('layout')" % E_); pg.wait_for_timeout(400)
ui = lambda: J("()=>JSON.parse(JSON.stringify(%s.ui))" % E_)
order = lambda: [r for r in J("()=>[...document.querySelectorAll('.nde-left .nde-layer')].map(r=>r.dataset.id||('g:'+r.dataset.gid))")]
zs = lambda: {w["id"]: w["z"] for w in ui()["widgets"] if not w.get("parent")}
def drag(src, dst, frac):
    s = pg.locator(f".nde-left .nde-layer[data-id='{src}'], .nde-left .nde-layer[data-gid='{src}']").first
    d = pg.locator(f".nde-left .nde-layer[data-id='{dst}'], .nde-left .nde-layer[data-gid='{dst}']").first
    box = d.bounding_box()
    s.drag_to(d, target_position={"x": 40, "y": max(1, min(box["height"] - 1, box["height"] * frac))})
    pg.wait_for_timeout(500)
o = order()
check("the layers list is in front-to-back order", o[:3] == ["sp", "e", "d"], str(o))
drag("a", "e", 0.1)   # to the top third of e: above it
o = order()
check("a layer dropped on the upper part goes above the row", o.index("a") == o.index("e") - 1, str(o))
z = zs(); check("and its z is higher than e's", z["a"] > z["e"] and z["a"] < z["sp"], str(z))
drag("sp", "b", 0.9)  # the spoiler below b
o = order()
check("a layer dropped on the lower part goes below the row", o.index("sp") == o.index("b") + 1, str(o))
# group c and d, then drop e into the group
J("()=>%s.group(['c','d'])" % E_); pg.wait_for_timeout(500)
o = order()
check("a group shows as a folder row with its members under it", any(x.startswith("g:") for x in o) and abs(o.index("c") - o.index("d")) == 1, str(o))
gid = [x for x in o if x.startswith("g:")][0][2:]
drag("e", gid, 0.5)  # into the group (the middle of the group row)
w = {x["id"]: x for x in ui()["widgets"]}
check("a layer dropped on the middle of a group row joins the group", w["e"].get("group") == gid, str(w["e"]))
# take d out: drop it below b (a row outside the group)
drag("d", "b", 0.1)
w = {x["id"]: x for x in ui()["widgets"]}
check("a layer dropped beside a row outside the group leaves the group", "group" not in w["d"] and w["c"].get("group") == gid and w["e"].get("group") == gid, str({k: w[k].get("group") for k in "cde"}))
# between members: joins the group
drag("b", "e", 0.1)
w = {x["id"]: x for x in ui()["widgets"]}
check("dropped between members: it joins the group", w["b"].get("group") == gid, str(w["b"]))
# the block
drag(gid, "a", 0.1)
o = order(); u = ui(); zz = zs()
members = [x["id"] for x in u["widgets"] if x.get("group") == gid]
check("a group dragged by its row moves as a block and stays a group", len(members) == 3 and min(zz[m] for m in members) > zz["a"], str((members, zz)))
# into a spoiler
drag("a", "sp", 0.5)
w = {x["id"]: x for x in ui()["widgets"]}
check("a layer dropped on the middle of a spoiler goes inside it", w["a"]["parent"] == "sp", str(w["a"]))
# out to the page again (the header)
hd = pg.locator(".nde-left .nde-pgrp").first
pg.locator(".nde-left .nde-layer[data-id='a']").first.drag_to(hd); pg.wait_for_timeout(500)
w = {x["id"]: x for x in ui()["widgets"]}
check("dropping on the Layers header takes it out of the spoiler", not w["a"].get("parent"), str(w["a"]))
# a spoiler cannot go into itself
before = ui()["widgets"]
drag("sp", "sp", 0.5)
check("a spoiler dropped on itself changes nothing", [x["parent"] for x in ui()["widgets"]] == [x["parent"] for x in before])
# rename a group in the list by a double click
J("""()=>{const r=document.querySelector('.nde-left .nde-layer.grp'); r.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))}"""); pg.wait_for_timeout(200)
J("""()=>{const i=document.querySelector('.nde-left .nde-layer.grp input'); i.value='Prompts'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))}"""); pg.wait_for_timeout(300)
check("a group is renamed in the list", ui()["groups"][0]["name"] == "Prompts", str(ui()["groups"]))
# the group buttons of the layout tab and the inspector
J("()=>%s.select(['a','sp'])" % E_); pg.wait_for_timeout(300)
check("the inspector offers Group for two selected widgets", J("()=>[...document.querySelectorAll('.nde-right .nde-btn')].some(b=>b.textContent==='Group')"))
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
