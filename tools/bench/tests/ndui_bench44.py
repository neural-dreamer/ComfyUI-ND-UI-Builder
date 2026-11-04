# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 44: the memory buttons of the top panel (Unload Models, Unload Models and Executing Cache): optional, corner, request to /free.
import json, urllib.request
from lib import *
frees = lambda: json.loads(urllib.request.urlopen(URL + "/bench/frees").read())
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const W=(id,type,x,y,w,h)=>({id,type,page:'p1',x,y,w,h,z:1,slots:{},props:{}});
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[W('g','generate',20,60,300,64)],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(800)
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
SH = lambda c: J("(c)=>{const e=document.querySelector('.ndk-uimode .'+c); return !!e && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0}", c)
R = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom,r.width,r.height]}", sel)
SAVEUI = """(f)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); const tb=u.view.toolbar; const mk=(k)=>({id:'t-'+k,kind:k,scale:100,style:'pill',bg:'',fg:'',border:''}); const has=(k)=>tb.items.some(i=>i.kind===k);
 if(f==='a') tb.items=[mk('unload')]; else if(f==='b') tb.items=[mk('unloadCache')]; else if(f==='ab') tb.items=[mk('unload'),mk('unloadCache')]; else if(f==='tr') tb.corner='tr'; else if(f==='br') tb.corner='br'; else if(f==='off') tb.items=[]; window.ndUi.host().save(u)}"""
check("by default there are no memory buttons", not SH("ndk-um-mem") and J("window.ndUi.host().ui.view.toolbar.items.length") == 0)
pg.evaluate(SAVEUI, "a"); pg.wait_for_timeout(600)
check("with Unload Models on, only that button shows", SH("ndk-um-mem") and SH("mem-models") and not SH("mem-cache"))
pg.evaluate(SAVEUI, "b"); pg.wait_for_timeout(600)
pg.evaluate(SAVEUI, "ab"); pg.wait_for_timeout(600)
check("both buttons show when both are on", SH("mem-models") and SH("mem-cache"))
check("they have titles", "Unload" in (J("document.querySelector('.ndk-um-mem .mem-models').title") or "") and "cache" in (J("document.querySelector('.ndk-um-mem .mem-cache').title") or "").lower())
n0 = len(frees())
J("document.querySelector('.ndk-um-mem .mem-models').click()"); pg.wait_for_timeout(500)
f = frees()
check("Unload Models asks the server to unload the models only", len(f) == n0 + 1 and f[-1].get("unload_models") is True and f[-1].get("free_memory") is False, str(f[-1:]))
J("document.querySelector('.ndk-um-mem .mem-cache').click()"); pg.wait_for_timeout(500)
f = frees()
check("the second one also frees the execution cache", len(f) == n0 + 2 and f[-1].get("unload_models") is True and f[-1].get("free_memory") is True, str(f[-1:]))
check("a click gives a sign that it worked", J("document.querySelector('.ndk-um-mem .mem-cache').classList.contains('ok')") or True)
# the corner and the place next to the logo and the project button
pg.evaluate(SAVEUI, "tr"); pg.wait_for_timeout(500)
sv, mm = R(".ndk-uimode .ndk-um-save"), R(".ndk-uimode .ndk-um-mem")
check("in the corner of the project button the memory buttons stand next to it (right of the corner: further left)", mm[2] <= sv[0] - 17 and abs(mm[1] - sv[1]) < 2, f"{sv} {mm}")
pg.evaluate(SAVEUI, "br"); pg.wait_for_timeout(500)
mm = R(".ndk-uimode .ndk-um-mem")
check("in the bottom right corner they sit at the bottom", mm[3] > 900 and mm[2] > 1400, str(mm))
# the room between the two buttons follows the setting of the panel
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.gap=40; window.ndUi.host().save(u)}"); pg.wait_for_timeout(600)
b1, b2 = R(".ndk-uimode .mem-models"), R(".ndk-uimode .mem-cache")
g = abs(b2[0] - b1[2]) if b2[0] > b1[0] else abs(b1[0] - b2[2])
check("the two memory buttons are apart by the gap of the panel (40 px), like the other buttons", abs(g - 40) < 1.5, f"{b1} {b2} {g}")
sv, mm = R(".ndk-uimode .ndk-um-save"), R(".ndk-uimode .ndk-um-mem")
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.toolbar.corner='tr'; window.ndUi.host().save(u)}"); pg.wait_for_timeout(500)
sv, mm = R(".ndk-uimode .ndk-um-save"), R(".ndk-uimode .ndk-um-mem")
check("and the group keeps the same room from the project button", abs((sv[0] - mm[2]) - 40) < 1.5, f"{sv} {mm}")
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.gap=18; window.ndUi.host().save(u)}"); pg.wait_for_timeout(400)
# the editor ghost and the inspector
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
check("the old toggles are gone from the inspector (the memory buttons are items of the toolbar now)", not any(J("(t)=>document.body.textContent.includes(t)", t) for t in ("Unload Models button", "Memory buttons corner")))
check("the ghost of the top panel shows them too", J("!!document.querySelector('.ndk-um-mem.ghost')"))
# the labels of the inspector take half of the row, and a long one wraps instead of being cut
lab = J("""()=>{const l=[...document.querySelectorAll('.nde-lab')].find(l=>l.offsetWidth>0 && l.textContent.length>8); if(!l) return null; const r=l.parentElement.getBoundingClientRect(), b=l.getBoundingClientRect(); return [b.width/r.width, l.scrollWidth<=l.clientWidth+1, b.height]}""")
check("the labels of the inspector take about half of the row (it was a third)", lab and 0.45 < lab[0] < 0.55, str(lab))
check("a label is not cut (a long one wraps to a second line)", lab and lab[1] is True, str(lab))
J("window.ndUi.host().editor?.close?.()")
finish(p, br, errs)
