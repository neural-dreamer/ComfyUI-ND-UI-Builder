# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 20 (E7a): Node Embed — a DOM panel of a third-party node shown in the ND UI mode, the preview, the NDUI node.
# Needs the real packs (tools/bench/stage_thirdparty.sh into the bench data folder); without them the test is skipped.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
has = J("!!window.LiteGraph.registered_node_types['H3Timeline'] && !!window.LiteGraph.registered_node_types['MiniMaxH3MediaLoader']")
if not has:
    print("SKIP: the third-party packs are not staged (tp-*)"); br.close(); p.stop(); sys.exit(0)

MODEL = """(function(){ const W=(id,t,x,y,w,h,src,pr)=>({id,type:'nodeembed',page:'p1',x,y,w,h,z:1,slots:{node:{src,kind:'anynode',name:''}},props:Object.assign({label:'E'},pr||{})});
 return {sources:[{uid:'sl',tag:'',class:'MiniMaxH3MediaLoader',title:'Loader'},{uid:'st',tag:'',class:'H3Timeline',title:'Timeline'},{uid:'sk',tag:'',class:'KSampler',title:'KS'}],
 pages:[{id:'p1',name:'Main'}], widgets:[W('a','x',20,20,480,360,'sl'),W('b','x',520,20,420,360,'st')]}; })()"""
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const mk=(t,x,y)=>{const n=LG.createNode(t); n.pos=[x,y]; a.graph.add(n); return n;};
  const l=mk('MiniMaxH3MediaLoader',40,60), t=mk('H3Timeline',760,60), k=mk('KSampler',40,700);
  l.properties.nd_ui_src={uid:'sl',tag:''}; t.properties.nd_ui_src={uid:'st',tag:''}; k.properties.nd_ui_src={uid:'sk',tag:''};
  window.__ids={l:l.id,t:t.id,k:k.id}; window.__app=a;
  await new Promise(r=>setTimeout(r,1500)); }""")
J(f"() => window.ndUi.host().save({MODEL})"); pg.wait_for_timeout(600)
where = lambda nm: J("(nm)=>{const n=window.__app.graph._nodes.find(q=>q.type===nm); const w=(n.widgets||[]).find(q=>q.element&&q.name!=='sequence'); const e=w.element; const p=e.parentElement; return p? (p.className+'|'+(p.closest('.ndk-uimode')?'mode':'')+(p.closest('.nde')?'editor':'')+(p.closest('.ndk-emb-box')?'box':'')):'none'}", nm)
L, T = "MiniMaxH3MediaLoader", "H3Timeline"
wl, wt = where(L), where(T)
check("before any view the panels sit in their ComfyUI wrappers", "dom-widget" in wl and "dom-widget" in wt, f"{wl} / {wt}")

# ---- ND UI mode (prio 3)
J("window.ndUi.enter()"); pg.wait_for_timeout(1500)
wl, wt = where(L), where(T)
check("ND UI mode: both panels moved into the frames", "mode" in wl and "box" in wl and "mode" in wt and "box" in wt, f"{wl} / {wt}")
check("the empty place in the node is marked", J("document.querySelectorAll('.dom-widget .ndk-emb-away').length") == 2)
zl = J("parseFloat(document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box').style.zoom||'1')")
check("Media Loader is scaled to the frame (scale profile)", 0.6 < zl < 0.85, str(zl))
ratio = J("""()=>{const f=document.querySelector('.ndk-uimode .ndk-w[data-id=b]'); const e=document.querySelector('.ndk-uimode .ndk-w[data-id=b] .ndk-emb-box').firstElementChild; const rf=f.getBoundingClientRect(), re=e.getBoundingClientRect(); return [re.width/rf.width, re.height/rf.height]}""")
check("Timeline fills its frame (fill profile)", 0.9 < ratio[0] < 1.05 and ratio[1] > 0.5, str(ratio))
# a click reaches the panel
J("""()=>{window.__clicks=0; const e=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box').firstElementChild; e.addEventListener('click',()=>window.__clicks++)}""")
r = J("()=>{const r=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box').firstElementChild.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]}")
pg.mouse.click(r[0], r[1]); pg.wait_for_timeout(200)
check("a click on the panel reaches the pack's element", J("window.__clicks") == 1)
# the wheel forwarded to the canvas is swallowed
J("""()=>{window.__wh=0; const cv=window.__app.canvas.canvas; cv.addEventListener('wheel',()=>window.__wh++); const e=document.querySelector('.ndk-uimode .ndk-w[data-id=b] .ndk-emb-box').firstElementChild; e.addEventListener('wheel',(ev)=>cv.dispatchEvent(new WheelEvent('wheel',{deltaY:ev.deltaY,clientX:ev.clientX,clientY:ev.clientY,bubbles:true,cancelable:true})))}""")
r = J("()=>{const r=document.querySelector('.ndk-uimode .ndk-w[data-id=b]').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]}")
pg.mouse.move(r[0], r[1]); pg.mouse.wheel(0, -300); pg.wait_for_timeout(300)
check("wheel forwarded to the graph canvas is swallowed", J("window.__wh") == 0, str(J("window.__wh")))
J("()=>{window.__app.canvas.canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:5}))}")
check("a wheel from outside a panel still reaches the canvas", J("window.__wh") == 1)
# keys typed in a panel do not climb
J("""()=>{window.__kd=0; document.addEventListener('keydown',()=>window.__kd++); const e=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box').firstElementChild; e.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}))}""")
check("keys typed in a panel stay inside it", J("window.__kd") == 0)
# collapse / expand: the frontend takes the panel back, the guard takes it again
J("""async()=>{const n=window.__app.graph._nodes.find(q=>q.type==='H3Timeline'); n.collapse(); await new Promise(r=>setTimeout(r,300)); n.collapse(); await new Promise(r=>setTimeout(r,900));}""")
check("after collapse and expand the panel is back in the frame", "mode" in where(T) and "box" in where(T), where(T))

# ---- leaving the mode gives the panels back
J("window.ndUi.exit()"); pg.wait_for_timeout(900)
wl, wt = where(L), where(T)
check("leaving the mode: the panels are back in ComfyUI's wrappers", "dom-widget" in wl and "dom-widget" in wt, f"{wl} / {wt}")
check("the marks are gone and the style is given back", J("document.querySelectorAll('.ndk-emb-away').length") == 0 and J("window.__app.graph._nodes.find(q=>q.type==='MiniMaxH3MediaLoader').widgets.find(w=>w.name==='mml_panel').element.style.zoom||''") == "")

# ---- the editor: a card in the layout, the live panel in the preview
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
check("editor layout: cards, the panels stay in the graph", "dom-widget" in where(L) and J("document.querySelectorAll('.nde .ndk-emb-card:not([style*=none])').length") >= 2, where(L))
J("[...document.querySelectorAll('.nde button')].find(b=>/Preview/.test(b.textContent)).click()"); pg.wait_for_timeout(1500)
wl = where(L)
check("editor preview: the live panel in the frame", "editor" in wl and "box" in wl, wl)
# windows of the panel are lifted above the editor
J("""()=>{const e=document.querySelector('.nde .ndk-emb-box').firstElementChild; e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); const d=document.createElement('div'); d.id='fakemodal'; d.style.cssText='position:fixed;left:10px;top:10px;width:50px;height:50px;z-index:10050;background:red'; document.body.append(d)}""")
pg.wait_for_timeout(200)
check("a modal opened from the panel is lifted above the editor", J("document.getElementById('fakemodal').style.zIndex") == "100020")
J("document.getElementById('fakemodal').remove()")
J("[...document.querySelectorAll('.nde button')].find(b=>/Preview/.test(b.textContent)).click()"); pg.wait_for_timeout(800)
check("preview off: the panel goes back to the graph", "dom-widget" in where(L), where(L))
J("window.ndUi.host().editor?.close?.()"); pg.wait_for_timeout(600)

# ---- the NDUI node (prio 1) and the priorities
J(f"""async()=>{{const a=window.__app; const u=window.LiteGraph.createNode('NDUI'); u.pos=[40,300]; a.graph.add(u); u.size=[900,520]; u.properties.nd_ui={MODEL}; u.ndUiApi.reload(); window.__u=u.id; await new Promise(r=>setTimeout(r,1200));}}""")
wl = where(L)
check("NDUI node panel holds the panel", "box" in wl and "mode" not in wl and "editor" not in wl, wl)
J("window.ndUi.enter()"); pg.wait_for_timeout(1200)
check("the mode takes it from the node (priority)", "mode" in where(L), where(L))
check("the node's frame says «Shown in another view»", J("[...document.querySelectorAll('.ndk-emb-other')].some(e=>e.style.display!=='none' && /another view/.test(e.textContent))"))
J("window.ndUi.exit()"); pg.wait_for_timeout(1000)
check("the mode closed: the panel goes back to the node", "box" in where(L) and "mode" not in where(L), where(L))

# ---- the workflow is loaded again: a new element, the old one is dropped
J("""async()=>{const a=window.__app; window.__oldEl=a.graph._nodes.find(q=>q.type==='H3Timeline').widgets.find(w=>w.name==='mctx_timeline').element; const g=a.graph.serialize(); await a.loadGraphData(g,true,true,null); await new Promise(r=>setTimeout(r,2500));}""")
now = where(T)
check("after loading the workflow the new panel is in the NDUI node", "box" in now, now)
check("the old element is gone from the DOM", J("!window.__oldEl.isConnected"))

# ---- a node without a panel, a removed node
J("""()=>{const u=window.__app.graph._nodes.find(q=>q.type==='NDUI'); const m=JSON.parse(JSON.stringify(u.properties.nd_ui)); m.widgets=[{id:'k',type:'nodeembed',page:'p1',x:20,y:20,w:400,h:300,z:1,slots:{node:{src:'sk',kind:'anynode',name:''}},props:{label:'K',part:'nope'}}]; u.properties.nd_ui=m; u.ndUiApi.reload()}""")
pg.wait_for_timeout(900)
txt = J("document.querySelector('.ndk-emb-card')?.innerText||''")
check("a part that does not exist shows a note", "no panel" in txt, txt)
# ---- ndUi.embedCheck(): the diagnostic for the console
J("()=>{const a=window.__app; const n=a.graph._nodes.find(q=>q.type==='MiniMaxH3MediaLoader'); a.canvas.selectNode(n)}"); pg.wait_for_timeout(300)
wb = J("(nm)=>{const n=window.__app.graph._nodes.find(q=>q.type===nm); const w=n.widgets.find(q=>q.element&&q.name==='mml_panel'); return w.element.parentElement?.className||''}", L)
rep = J("async()=>{const r=await window.ndUi.embedCheck(); return {fe:r.frontend, n2:r.nodes2, node:r.node, panels:r.panels.map(p=>({w:p.widget, v:p.verdict, panel:p.panel})), text:r.text}}")
check("embedCheck names the frontend and the Nodes 2.0 mode", bool(rep["fe"]) and rep["n2"] in ("on", "off", "unknown"), str(rep["fe"]) + " / " + str(rep["n2"]))
check("it works with the selected node and reports its panels", "Loader" in rep["node"] or "MiniMax" in rep["node"] or bool(rep["panels"]), rep["node"])
check("the trial of the panel says OK", any(x["w"] == "mml_panel" and x["v"] == "OK" for x in rep["panels"]), str(rep["panels"]))
wa = J("(nm)=>{const n=window.__app.graph._nodes.find(q=>q.type===nm); const w=n.widgets.find(q=>q.element&&q.name==='mml_panel'); return w.element.parentElement?.className||''}", L)
check("the panel is where it was after the trial", wa == wb, f"{wb} / {wa}")
J("""()=>{const a=window.__app; const t=a.graph._nodes.find(q=>q.type==='H3Timeline'); a.graph.remove(t)}"""); pg.wait_for_timeout(700)
check("the Timeline panels are back in a wrapper or gone, wrappers consistent", J("document.querySelectorAll('.ndk-emb-away').length") == 0)
finish(p, br, errs)
