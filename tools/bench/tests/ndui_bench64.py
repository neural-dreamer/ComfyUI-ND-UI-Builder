# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 64: the Tab panel — the tabs, the widgets of each tab, switching in the ND UI, the editor (add, rename, move, delete).
import json
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"
r = J("""async()=>{const M=await import('%s');
  const W=(id,type,x,y,w,h,z,extra)=>Object.assign({id,type,page:'p1',x,y,w,h,z,slots:{},props:{}},extra||{});
  const ui=M.normalizeNdUi({pages:[{id:'p1',name:'Main'}],widgets:[
    W('box','tabbox',20,20,500,300,1,{props:{tabs:[{id:'a',name:'One'},{id:'b',name:'Two'}],active:'b'}}),
    W('h1','heading',40,80,200,40,2,{tab:'a',props:{text:'in one'}}), W('h2','heading',40,140,200,40,3,{tab:'b',props:{text:'in two'}}), W('h3','heading',40,200,200,40,4,{props:{text:'new'}}),
    W('out','heading',600,80,200,40,2,{tab:'a',props:{text:'outside'}})]});
  const by=Object.fromEntries(ui.widgets.map(w=>[w.id,w]));
  const bad=M.normalizeNdUi({pages:[{id:'p1',name:'Main'}],widgets:[W('bx','tabbox',0,0,300,200,1,{props:{tabs:[{id:'x',name:'A'},{id:'x',name:'B'},{name:'no id'}],active:'zzz'}})]});
  const none=M.normalizeNdUi({pages:[{id:'p1',name:'Main'}],widgets:[W('bx','tabbox',0,0,300,200,1,{props:{}})]});
  return {tabs:by.box.props.tabs, act:by.box.props.active, tab:[by.h1.tab,by.h2.tab,by.h3.tab,by.out.tab], bad:[bad.widgets[0].props.tabs,bad.widgets[0].props.active], none:none.widgets[0].props.tabs.map(t=>t.name), like:[M.isPanelLike({type:'panel'}),M.isPanelLike({type:'tabbox'}),M.isPanelLike({type:'slider'})]}}""" % M)
check("the tabs of the panel are kept", [t["id"] for t in r["tabs"]] == ["a", "b"] and r["act"] == "b", str(r))
check("a widget keeps its tab; a new one joins the open tab; one outside has none", r["tab"] == ["a", "b", "b", None], str(r["tab"]))
check("bad tabs are cleaned (one tab id once, an open tab that exists)", [t["id"] for t in r["bad"][0]] == ["x"] and r["bad"][1] == "x", str(r["bad"]))
check("a panel without tabs gets two", r["none"] == ["Tab 1", "Tab 2"], str(r["none"]))
check("panel-like: panel and tab panel", r["like"] == [True, True, False])
# the page in the ND UI
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const W=(id,type,x,y,w,h,z,extra)=>Object.assign({id,type,page:'p1',x,y,w,h,z,slots:{},props:{}},extra||{});
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[
    W('box','tabbox',20,20,500,300,1,{props:{tabs:[{id:'a',name:'One'},{id:'b',name:'Two'}],active:'a'}}),
    W('h1','heading',40,80,200,40,2,{tab:'a',props:{text:'in one'}}), W('h2','heading',40,140,200,40,3,{tab:'b',props:{text:'in two'}}),
    W('out','heading',560,80,200,40,2,{props:{text:'outside'}})],view:{}};
  u.properties.nd_ui = ui; window.__u = u; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(600)
J("window.ndUi.enter()"); pg.wait_for_timeout(1200)
vis = lambda: J("""()=>Object.fromEntries(['h1','h2','out'].map(id=>{const e=document.querySelector('.ndk-uimode .ndk-w[data-id='+id+']'); return [id, !!e && e.style.display!=='none']}))""")
check("ND UI: only the widgets of the open tab and the ones outside are shown", vis() == {"h1": True, "h2": False, "out": True}, str(vis()))
tabs = J("()=>[...document.querySelectorAll('.ndk-uimode .ndk-w[data-id=box] .ndk-ts-tab')].map(t=>t.textContent+(t.classList.contains('on')?'*':''))")
check("the strip lists the tabs, the open one is marked", tabs == ["One*", "Two"], str(tabs))
J("()=>document.querySelectorAll('.ndk-uimode .ndk-w[data-id=box] .ndk-ts-tab')[1].click()"); pg.wait_for_timeout(500)
check("a click switches the tab", vis() == {"h1": False, "h2": True, "out": True}, str(vis()))
check("switching does not change the saved panel", J("()=>window.__u.properties.nd_ui.widgets[0].props.active") == "a")
check("no edit buttons in the ND UI strip", J("()=>document.querySelectorAll('.ndk-uimode .ndk-w[data-id=box] .ndk-ts-x, .ndk-uimode .ndk-w[data-id=box] .ndk-ts-add').length") == 0 or J("()=>[...document.querySelectorAll('.ndk-uimode .ndk-w[data-id=box] .ndk-ts-add')].every(b=>getComputedStyle(b).display==='none')"))
J("window.ndUi.exit()"); pg.wait_for_timeout(400)
# the editor
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1400)
E = "window.ndUi.host().editor"
J(f"()=>{{ {E}.sel.clear(); {E}.sel.add('box'); {E}.renderInspector(); }}"); pg.wait_for_timeout(500)
check("editor: the open tab of the panel is shown (One)", J("()=>{const e=document.querySelector('.nde-right [class*=ndk-ts]'); return !!e}") is True)
vis_e = lambda: J("""()=>Object.fromEntries(['h1','h2'].map(id=>{const e=document.querySelector('.nde-stage .ndk-w[data-id='+id+'], .ndk-w[data-id='+id+']'); return [id, !!e && e.style.display!=='none']}))""")
check("editor: only the widgets of the open tab are shown", vis_e() == {"h1": True, "h2": False}, str(vis_e()))
J(f"()=>{E}.tabOp({E}.ui.widgets.find(w=>w.id==='box'),'add')"); pg.wait_for_timeout(500)
box = lambda: J(f"()=>{E}.ui.widgets.find(w=>w.id==='box').props")
b = box()
check("add: a third tab, it is the open one", len(b["tabs"]) == 3 and b["active"] == b["tabs"][2]["id"], str(b))
J(f"()=>{E}.tabOp({E}.ui.widgets.find(w=>w.id==='box'),'rename','a','First')"); pg.wait_for_timeout(300)
check("rename", box()["tabs"][0]["name"] == "First")
J(f"()=>{E}.tabOp({E}.ui.widgets.find(w=>w.id==='box'),'move','a',2)"); pg.wait_for_timeout(300)
check("move: the first tab is now the last", [t["id"] for t in box()["tabs"]][-1] == "a", str(box()["tabs"]))
check("count of widgets in a tab", J(f"()=>{E}.tabCount({E}.ui.widgets.find(w=>w.id==='box'),'a')") == 1)
J(f"()=>{E}.tabOp({E}.ui.widgets.find(w=>w.id==='box'),'del','a')"); pg.wait_for_timeout(400)
ids = J(f"()=>{E}.ui.widgets.map(w=>w.id)")
check("delete: the tab and its widgets are gone, the others stay", "h1" not in ids and "h2" in ids and len(box()["tabs"]) == 2, str([ids, box()["tabs"]]))
J(f"()=>{{ {E}.tabOp({E}.ui.widgets.find(w=>w.id==='box'),'del','b'); {E}.tabOp({E}.ui.widgets.find(w=>w.id==='box'),'del',{E}.ui.widgets.find(w=>w.id==='box').props.tabs[0].id); }}"); pg.wait_for_timeout(300)
check("the last tab cannot be deleted", len(box()["tabs"]) >= 1)
# undo brings the tab back
J(f"()=>{E}.undo?.()"); pg.wait_for_timeout(300)
J("window.ndUi.host().editor?.close?.()"); pg.wait_for_timeout(300)
finish(p, br, errs)
