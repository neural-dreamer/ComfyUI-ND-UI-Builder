# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 6 (stage B): the panel of the workflow without any node: action bar buttons, editor, store, undo, load/save, workflow tabs, migration.
import json
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)

# ---- buttons in the action bar
n = J("document.querySelectorAll('[data-testid=action-bar-buttons] .ndui-ab').length"); npj = J("document.querySelectorAll('[data-testid=action-bar-buttons] .ndui-ab-p').length")
check("three buttons in the action bar (ND UI, Edit, Project)", n == 2 and npj == 1, f"{n} {npj}")
txt = J("document.querySelector('[data-testid=action-bar-buttons]').innerText")
check("their labels are ND UI, Edit and Project", "ND UI" in txt and "Edit" in txt and "Project" in txt, txt)
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set('NeuralDreamerUI.ActionBarButtons', false)}"); pg.wait_for_timeout(300)
vis = J("[...document.querySelectorAll('.ndui-ab')].some(b=>b.offsetParent!==null)")
check("the setting hides the buttons", not vis)
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set('NeuralDreamerUI.ActionBarButtons', true)}"); pg.wait_for_timeout(300)
vis = J("[...document.querySelectorAll('.ndui-ab')].every(b=>b.offsetParent!==null)")
check("and shows them again", vis)
# the Project button has a setting of its own
SET = "async(v)=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set('NeuralDreamerUI.ActionBarProject', v)}"
pj = "[...document.querySelectorAll('.ndui-ab-p')].some(b=>b.offsetParent!==null)"
check("the Project button is shown by default", J(pj))
pg.evaluate(SET, False); pg.wait_for_timeout(300)
check("its setting hides only it: ND UI and Edit stay", not J(pj) and J("[...document.querySelectorAll('.ndui-ab')].every(b=>b.offsetParent!==null)"))
pg.evaluate(SET, True); pg.wait_for_timeout(300)
check("and it comes back", J(pj))
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set('NeuralDreamerUI.ActionBarButtons', false)}"); pg.wait_for_timeout(300)
check("the master switch of ND UI and Edit leaves the Project button alone", J(pj))
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set('NeuralDreamerUI.ActionBarButtons', true)}"); pg.wait_for_timeout(300)

# ---- a graph without an NDUI node, a panel in extra.nd_ui
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; n.title=title; a.graph.add(n); return n;};
  const k=mk('KSampler',60,380,'Sampler [sampler]'); const l=mk('EmptyLatentImage',60,80,'Latent [size]');
  k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; l.properties.nd_ui_src={uid:'sl',tag:'size'}; a.graph.setDirtyCanvas(true,true); }""")
PANEL = """(n)=>{ const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}}); const B=(s,n)=>({src:s,kind:'widget',name:n});
 const ws=[W('a','seed',20,20,360,64,{value:B('sk','seed'),control:B('sk','control_after_generate')},{label:'Seed'}),W('b','slider',20,110,360,64,{value:B('sk','steps')},{label:'Steps'}),W('d','number',420,20,240,64,{value:B('sl','width')},{label:'Width'})].slice(0,n);
 return {sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'sl',tag:'size',class:'EmptyLatentImage',title:'Latent [size]'}],pages:[{id:'p1',name:'Main'}],widgets:ws}; }"""
J("async()=>{ window.__panel = " + PANEL + "; window.ndUi.host().save(window.__panel(2)); }"); pg.wait_for_timeout(500)
ex = J("async()=>{const m=await import('/scripts/app.js'); const s=m.app.graph.serialize(); return s.extra?.nd_ui?.widgets?.length}")
check("the panel is in graph.extra.nd_ui", ex == 2, str(ex))
check("host knows the panel", J("window.ndUi.host().has === true && window.ndUi.host().ui.widgets.length === 2"))

# ---- the editor opens from the Edit button, without a node
J("[...document.querySelectorAll('.ndui-ab')].find(b=>b.textContent.includes('Edit')).click()"); pg.wait_for_timeout(1200)
check("Edit opens the editor", J("!!document.querySelector('.nde')"))
nw = J("document.querySelectorAll('.nde .ndk-w').length"); check("with the 2 widgets of the workflow panel", nw == 2, str(nw))
# add a widget in the editor and save
J("[...document.querySelectorAll('.nde .nde-btn')].find(b=>/Save/.test(b.textContent))?.click()"); pg.wait_for_timeout(600)
check("the editor closes on Save", J("!document.querySelector('.nde')"))

# ---- undo: one step back
J("async()=>{ window.ndUi.host().save(window.__panel(3)); }"); pg.wait_for_timeout(500)
check("3 widgets after the change", J("window.ndUi.host().ui.widgets.length") == 3)
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.command.execute('Comfy.Undo')}"); pg.wait_for_timeout(1500)
nu = J("window.ndUi.host().ui.widgets.length"); check("Undo brings the panel back by one step", nu == 2, str(nu))
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.command.execute('Comfy.Redo')}"); pg.wait_for_timeout(1500)
nu = J("window.ndUi.host().ui.widgets.length"); check("and Redo forward", nu == 3, str(nu))

# ---- save and load
sj = J("async()=>{const m=await import('/scripts/app.js'); return JSON.stringify(m.app.graph.serialize())}")
J("async()=>{const m=await import('/scripts/app.js'); m.app.graph.clear(); window.ndUi.host().reload()}"); pg.wait_for_timeout(300)
check("cleared graph has no panel", J("window.ndUi.host().has === false"))
J("async(s)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(JSON.parse(s), true, true, 'x')}", sj) if False else pg.evaluate("async(s)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(JSON.parse(s))}", sj)
pg.wait_for_timeout(1000)
check("loading brings the panel back", J("window.ndUi.host().has === true && window.ndUi.host().ui.widgets.length === 3"))

# ---- a NDUI node without its own panel is a window to the panel of the workflow
J("""async () => { const m = await import('/scripts/app.js'); const a=m.app; const u=window.LiteGraph.createNode('NDUI'); u.pos=[480,60]; u.size=[900,520]; a.graph.add(u); }""")
pg.wait_for_timeout(900)
nn = J("document.querySelectorAll('.ndk-nodeview .ndk-w').length"); check("the node window shows the widgets of the workflow panel", nn == 3, str(nn))
own = J("async()=>{const m=await import('/scripts/app.js'); return !!m.app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui}")
check("the new node keeps no panel of its own", not own)
# the window follows a change from the host
J("async()=>{ window.ndUi.host().save(window.__panel(2)); }"); pg.wait_for_timeout(600)
nn = J("document.querySelectorAll('.ndk-nodeview .ndk-w').length"); check("the window follows the saved change", nn == 2, str(nn))
# the page switch is shared (add a second page)
J("""async()=>{ const u=window.__panel(2); u.pages.push({id:'p2',name:'Second'}); window.ndUi.host().save(u); }"""); pg.wait_for_timeout(600)
tabs = J("[...document.querySelectorAll('.ndk-nodeview .ndk-strip .tab')].map(b=>b.textContent)")
check("tabs in the node strip", tabs == ["Main", "Second"], str(tabs))
J("[...document.querySelectorAll('.ndk-nodeview .ndk-strip .tab')][1].click()"); pg.wait_for_timeout(400)
check("host follows the page of the node", J("window.ndUi.host().cur") == "p2")

# ---- two workflow tabs
first = J("async()=>{const m=await import('/scripts/app.js'); return m.app.extensionManager.workflow.activeWorkflow.filename}")
J("async()=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.command.execute('Comfy.NewBlankWorkflow')}"); pg.wait_for_timeout(2500)
check("a new workflow tab has no panel", J("window.ndUi.host().has === false"))
pg.evaluate("(f)=>[...document.querySelectorAll('.workflow-tab')].find(b=>b.textContent.trim().startsWith(f))?.click()", first); pg.wait_for_timeout(2500)
check("back on the first tab the panel is there", J("window.ndUi.host().has === true && window.ndUi.host().ui.pages.length === 2"))

# ---- migration of an older workflow (the panel lived in a node)
mig = {"last_node_id": 3, "last_link_id": 0, "nodes": [
  {"id": 1, "type": "KSampler", "pos": [60, 380], "size": [300, 260], "flags": {}, "order": 0, "mode": 0, "inputs": [], "outputs": [], "title": "Sampler [sampler]", "properties": {"nd_ui_src": {"uid": "sk", "tag": "sampler"}}, "widgets_values": [1, "fixed", 20, 8, "euler", "normal", 1]},
  {"id": 2, "type": "NDUI", "pos": [480, 60], "size": [900, 520], "flags": {}, "order": 1, "mode": 0, "inputs": [], "outputs": [], "properties": {"nd_ui": {"sources": [{"uid": "sk", "tag": "sampler", "class": "KSampler", "title": "Sampler [sampler]"}], "pages": [{"id": "p1", "name": "Old"}], "widgets": [{"id": "a", "type": "slider", "page": "p1", "x": 20, "y": 20, "w": 300, "h": 64, "z": 1, "slots": {"value": {"src": "sk", "kind": "widget", "name": "steps"}}, "props": {"label": "Steps"}}]}}, "widgets_values": []}],
  "links": [], "groups": [], "config": {}, "extra": {}, "version": 0.4}
pg.evaluate("async(s)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(s)}", mig); pg.wait_for_timeout(1500)
ex = J("async()=>{const m=await import('/scripts/app.js'); return m.app.graph.serialize().extra?.nd_ui?.pages?.[0]?.name}")
check("the panel of the old node moved to the workflow", ex == "Old", str(ex))
own = J("async()=>{const m=await import('/scripts/app.js'); return !!m.app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui}")
check("the node became a window", not own)
nn = J("document.querySelectorAll('.ndk-nodeview .ndk-w').length"); check("and still shows the widget", nn == 1, str(nn))

# ---- a node that keeps its own panel while the workflow has one: stays "own panel"; the strip makes it the workflow panel
two = json.loads(json.dumps(mig)); two["extra"] = {"nd_ui": {"pages": [{"id": "pw", "name": "Wf"}], "widgets": []}}
pg.evaluate("async(s)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(s)}", two); pg.wait_for_timeout(1500)
own = J("async()=>{const m=await import('/scripts/app.js'); return !!m.app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui}")
check("with a workflow panel present the node keeps its own", own)
btn = J("[...document.querySelectorAll('.ndk-nodeview .ndk-strip .act')].some(b=>/To workflow/.test(b.textContent))")
check("the strip offers 'To workflow'", btn)
J("[...document.querySelectorAll('.ndk-nodeview .ndk-strip .act')].find(b=>/To workflow/.test(b.textContent)).click()"); pg.wait_for_timeout(800)
ex = J("async()=>{const m=await import('/scripts/app.js'); return m.app.graph.serialize().extra?.nd_ui?.pages?.[0]?.name}")
check("it became the panel of the workflow", ex == "Old", str(ex))
finish(p, br, errs)
