# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 48: the toolbar of the top panel — model, migration of the old memory buttons, sizes, separator, corner, scale.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const W=(id,type,x,y,w,h)=>({id,type,page:'p1',x,y,w,h,z:1,slots:{},props:{}});
  // an old panel: the memory buttons were settings of the view
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[W('g','generate',20,60,300,64)],view:{unload:{models:true,cache:true,corner:'br'}}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(800)
tb = lambda: J("JSON.parse(JSON.stringify(window.ndUi.host().ui.view.toolbar))")
t = tb()
check("an old panel with the memory buttons becomes a toolbar with two items in the old corner", t["corner"] == "br" and [i["kind"] for i in t["items"]] == ["unload", "unloadCache"], str(t))
check("the old setting is gone from the view", J("window.ndUi.host().ui.view.unload === undefined"))
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
R = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom,r.width,r.height]}", sel)
SAVE = "(f)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); (new Function('u',f))(u); window.ndUi.host().save(u)}"
def S(code): pg.evaluate(SAVE, code); pg.wait_for_timeout(600)
b1, b2 = R(".ndk-uimode .mem-models"), R(".ndk-uimode .mem-cache")
check("both memory buttons show, 34 px wide", b1 and b2 and abs(b1[4] - 34) < 1 and abs(b2[4] - 34) < 1, f"{b1} {b2}")
# a separator between the buttons
S("u.view.toolbar.items.splice(1,0,{id:'s1',kind:'sep',w:30,line:true,scale:100,style:'flat',bg:'',fg:'',border:''})")
b1, b2, sp = R(".ndk-uimode .mem-models"), R(".ndk-uimode .mem-cache"), R(".ndk-uimode .ndk-tb-item.sep")
check("a separator stands between the buttons with its own width (30 px)", sp and abs(sp[4] - 30) < 1 and b1[2] <= sp[0] and sp[2] <= b2[0], f"{b1} {sp} {b2}")
check("the room between the neighbours is gap + 30 + gap", abs((b2[0] - b1[2]) - (30 + 2 * 18)) < 1.5, str(b2[0] - b1[2]))
# the width of the separator changes
S("u.view.toolbar.items[1].w=60")
sp = R(".ndk-uimode .ndk-tb-item.sep")
check("the width of the separator is a setting", abs(sp[4] - 60) < 1, str(sp))
# the scale of an item and of the whole toolbar
S("u.view.toolbar.items[0].scale=150")
b1 = R(".ndk-uimode .mem-models")
check("an item has its own scale (150%)", abs(b1[4] - 51) < 1.5, str(b1))
S("u.view.toolbar.scale=50; u.view.toolbar.items[0].scale=100")
b2 = R(".ndk-uimode .mem-cache")
check("the scale of the toolbar changes every item (50%)", abs(b2[4] - 17) < 1.5, str(b2))
S("u.view.toolbar.scale=100")
# colours and style of an item
S("u.view.toolbar.items[2].bg='#ff0000'; u.view.toolbar.items[2].border='#00ff00'")
cs = J("(()=>{const w=document.querySelector('.ndk-uimode .ndk-tb-item.unloadCache'); const b=w.querySelector('button'); const s=getComputedStyle(b); return [s.backgroundColor, s.borderTopColor]})()")
check("the colours of the item reach the button", cs[0] == "rgb(255, 0, 0)" and cs[1] == "rgb(0, 255, 0)", str(cs))
S("u.view.toolbar.items[2].bg=''; u.view.toolbar.items[2].border=''; u.view.toolbar.items[2].style='flat'")
cs = J("getComputedStyle(document.querySelector('.ndk-uimode .mem-cache')).borderTopColor")
check("the flat style has no border", cs in ("rgba(0, 0, 0, 0)", "transparent"), cs)
S("u.view.toolbar.items[2].style='pill'")
# corner and the plate
S("u.view.toolbar.corner='tr'")
sv, mm = R(".ndk-uimode .ndk-um-save"), R(".ndk-uimode .ndk-um-tools")
check("in the corner of the project button the toolbar stands before it", mm[2] <= sv[0] - 17 and abs(mm[1] - sv[1]) < 2, f"{sv} {mm}")
S("u.view.toolbar.bg='pill'")
check("the plate is drawn when asked", J("document.querySelector('.ndk-uimode .ndk-um-tools').classList.contains('plated')"))
S("u.view.toolbar.bg='none'")
# the tabs keep clear of the toolbar
S("u.pages.push({id:'p2',name:'Second'}); u.view.tabs.align='right'; u.view.toolbar.corner='tr'")
tabs, mm = R(".ndk-uimode .ndk-um-tabs"), R(".ndk-uimode .ndk-um-tools")
check("the tabs keep clear of the toolbar", tabs and (tabs[2] <= mm[0] - 1 or tabs[1] > mm[3]), f"{tabs} {mm}")
# empty toolbar: nothing is drawn
S("u.view.toolbar.items=[]")
check("with no items the toolbar is not drawn", not J("(()=>{const e=document.querySelector('.ndk-uimode .ndk-um-tools'); return !!e && getComputedStyle(e).display!=='none'})()"))
check("and a saved panel with no items is not migrated again", len(tb()["items"]) == 0)
# the ghost in the editor
S("u.view.toolbar.items=[{id:'a',kind:'unload',scale:100,style:'pill',bg:'',fg:'',border:''},{id:'s',kind:'sep',w:20,line:true,scale:100,style:'flat',bg:'',fg:'',border:''}]")
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
check("the ghost of the top panel shows the toolbar", J("document.querySelectorAll('.ndk-um-tools.ghost .ndk-tb-item').length") == 2)
J("window.ndUi.host().editor?.close?.()")
finish(p, br, errs)
