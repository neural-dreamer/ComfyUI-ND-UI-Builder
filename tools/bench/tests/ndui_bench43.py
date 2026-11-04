# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 43: the bridge as the source of the live widgets, the waiting animation (a steady place), the live buttons that fade, the room between the buttons of the top panel.
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
# ---- 1. the picker of "Frames of" offers the ND UI Live Bridge nodes (also the ones that are not linked yet)
J("""async () => { const m = await import('/scripts/app.js'); const LG = window.LiteGraph; const a = m.app;
  const n = LG.createNode('NDUILiveBridge'); n.pos=[700,40]; n.title='My bridge'; a.graph.add(n); }""")
pg.wait_for_timeout(400)
J("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDUI').ndUiApi.openEdit();}"); pg.wait_for_timeout(900)
pg.click("text=Add all"); pg.wait_for_timeout(400)
pg.click(".nde-tabs button:has-text('Widgets')"); pg.wait_for_timeout(200)
pg.click(".nde-lib-i:has-text('Live Preview')"); pg.wait_for_timeout(400)
pg.click(".nde-slot-b"); pg.wait_for_timeout(400)
heads = J("[...document.querySelectorAll('.nde-bindpop .nde-pgrp')].map(e=>e.textContent)")
rows = J("[...document.querySelectorAll('.nde-bindpop .nde-pn')].map(e=>e.textContent)")
check("the picker lists the bridge nodes first, then the other nodes", heads[:1] == ["ND UI Live Bridge nodes"] and rows[0] == "My bridge" and "Sampler [sampler]" in rows, f"{heads} {rows}")
n_src = J("window.ndUi.host().editor.ui.sources.length")
pg.click(".nde-bindpop .nde-param:has-text('My bridge')"); pg.wait_for_timeout(500)
st = J("""(()=>{const u=window.ndUi.host().editor.ui; const w=u.widgets.find(w=>w.type==='viewer'); const b=w.slots.live; const s=u.sources.find(s=>s.uid===b?.src); return [u.sources.length, s?.class, b?.kind]})()""")
check("a click links the bridge (it was not linked) and binds the widget to it", st[0] == n_src + 1 and st[1] == "NDUILiveBridge" and st[2] == "live", f"{n_src} {st}")
J("window.__bridge = window.__app?.graph?._nodes?.find(n=>n.type==='NDUILiveBridge')?.id")
# the node limit
# ---- 2. a panel with a Viewer and a Video Player, two open workflows (the switcher shows), the mode
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a;
  window.ndUi.host().editor?.close?.(); try { window.ndUi.host().closeEditor?.() } catch {}
  a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const b = mk('NDUILiveBridge',60,700,'Bridge [bridge]'); const u = mk('NDUI',480,60); u.size=[900,500]; b.properties.nd_ui_src={uid:'sb',tag:'bridge'};
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  const ui={sources:[{uid:'sb',tag:'bridge',class:'NDUILiveBridge',title:'Bridge [bridge]'}],pages:[{id:'p1',name:'Main'},{id:'p2',name:'Two'}],
   widgets:[W('v1','viewer',10,60,520,300,{live:{src:'sb',kind:'live',name:''}},{live:true,results:false,compare:false,progress:'both',busy:'pulse',thumbs:'off'}),
            W('g','generate',550,60,300,64,{},{}),
            W('vp','videoplayer',10,380,520,300,{live:{src:'sb',kind:'live',name:''}},{live:true,progress:'both',busy:'pulse'})],
   view:{}};
  window.__ui1 = ui; window.__bid = b.id;
  u.properties.nd_ui = ui; window.ndUi.host().save(ui);
  window.__g1 = a.graph.serialize(); window.__g1.extra = window.__g1.extra || {}; window.__g1.extra.nd_ui = ui;
  await a.loadGraphData(window.__g1, true, true, 'Alpha'); await new Promise(r=>setTimeout(r,800));
  const g2 = {nodes:[], links:[], groups:[], config:{}, extra:{}, version:0.4}; await a.loadGraphData(g2, true, true, 'Beta'); await new Promise(r=>setTimeout(r,800));
  await a.loadGraphData(window.__g1, true, true, 'Alpha'); await new Promise(r=>setTimeout(r,800));
}""")
pg.wait_for_timeout(1200)
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
Bn = str(J("window.__bid"))
check("the switcher button is there (two workflows are open)", J("!!document.querySelector('.ndk-uimode .ndk-um-logobtn.sw') && getComputedStyle(document.querySelector('.ndk-uimode .ndk-um-logobtn.sw')).display!=='none'"))
R = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom,r.width,r.height]}", sel)
# ---- 3. the room between the buttons of the top panel
lb, sw = R(".ndk-uimode .ndk-um-logo:not(.ndk-um-save) .ndk-um-logobtn:not(.sw)"), R(".ndk-uimode .ndk-um-logobtn.sw")
check("by default the logo and the switcher are 18 px apart (they were 6)", lb and sw and abs((sw[0] - lb[2]) - 18) < 1.5, f"{lb} {sw}")
check("the setting has a default of 18", J("window.ndUi.host().ui.view.gap") == 18)
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.gap=32; window.ndUi.host().save(u)}"); pg.wait_for_timeout(700)
lb, sw = R(".ndk-uimode .ndk-um-logo:not(.ndk-um-save) .ndk-um-logobtn:not(.sw)"), R(".ndk-uimode .ndk-um-logobtn.sw")
check("a larger setting widens the room between the logo and the switcher", abs((sw[0] - lb[2]) - 32) < 1.5, f"{lb} {sw}")
# the project pill in the same corner, the tabs next to the pills
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.gap=32; u.view.logo.corner='tl'; u.view.save.corner='tl'; u.view.tabs.pos='top'; u.view.tabs.align='left'; window.ndUi.host().save(u)}"); pg.wait_for_timeout(700)
sw, sv, tb = R(".ndk-uimode .ndk-um-logobtn.sw"), R(".ndk-uimode .ndk-um-save"), R(".ndk-uimode .ndk-um-tabs")
check("the project pill keeps the same room after the switcher", abs((sv[0] - sw[2]) - 32) < 1.5, f"{sw} {sv}")
check("the tabs keep the same room after the pills", tb and abs((tb[0] - sv[2]) - 32) < 1.5, f"{sv} {tb}")
J("()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.gap=18; window.ndUi.host().save(u)}"); pg.wait_for_timeout(500)
# the editor setting
J("async()=>{window.ndUi.exit()}"); pg.wait_for_timeout(300)
# ---- 4. the waiting animation keeps its place
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
J("document.querySelector('.ndk-uimode .ndk-gen .run').click()"); pg.wait_for_timeout(600)
ws({"type": "execution_start", "data": {"prompt_id": "p1"}}); pg.wait_for_timeout(500)
stage = lambda w: R(f'.ndk-uimode .ndk-w[data-id="{w}"] .ndk-act-stage')
shown = lambda sel: J("(s)=>{const e=document.querySelector(s); return !!e && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0}", sel)
check("the Viewer shows the waiting animation while no frame comes", shown('.ndk-uimode .ndk-w[data-id="v1"] .ndk-act'))
check("the Video Player has the option too and shows the animation", shown('.ndk-uimode .ndk-w[data-id="vp"] .ndk-act'))
a0, b0 = stage("v1"), stage("vp")
ws({"type": "progress_state", "data": {"prompt_id": "p1", "nodes": {"3": {"value": 4, "max": 20, "state": "running", "node_id": "3", "display_node_id": "3", "prompt_id": "p1"}}}}); pg.wait_for_timeout(500)
a1, b1 = stage("v1"), stage("vp")
check("the animation does not move when the step counter appears (Viewer)", abs(a1[1] - a0[1]) < 0.6 and abs(a1[0] - a0[0]) < 0.6, f"{a0} {a1}")
check("the animation does not move when the step counter appears (Video Player)", abs(b1[1] - b0[1]) < 0.6, f"{b0} {b1}")
ws({"type": "progress_state", "data": {"prompt_id": "p1", "nodes": {"3": {"value": 5, "max": 20, "state": "running", "node_id": "3", "display_node_id": "3", "prompt_id": "p1"}, "4": {"value": 0, "max": 0, "state": "pending", "node_id": "4", "display_node_id": "4", "prompt_id": "p1"}}}}); pg.wait_for_timeout(400)
a2 = stage("v1")
check("and it stays when the text comes and goes", abs(a2[1] - a0[1]) < 0.6, f"{a0} {a2}")
# ---- 5. a live frame: the buttons fade unless the mouse is on the widget
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 3, "steps": 20, "kind": "image", "mime": "image/png", "url": PNG, "fps": 0, "audio": False}}); pg.wait_for_timeout(700)
op = lambda sel: J("(s)=>{const e=document.querySelector(s); return e ? getComputedStyle(e).opacity : null}", sel)
V, P = '.ndk-uimode .ndk-w[data-id="v1"]', '.ndk-uimode .ndk-w[data-id="vp"]'
pg.mouse.move(1400, 800); pg.wait_for_timeout(600)
check("Viewer: eye and speaker are hidden while the mouse is away", op(V + " .ndk-vw-tools .eye") == "0" and op(V + " .ndk-vw-tools .snd") == "0", f"{op(V + ' .ndk-vw-tools .eye')} {op(V + ' .ndk-vw-tools .snd')}")
check("Video Player: the eye is hidden while the mouse is away; no speaker without an audio VAE", op(P + " .ndk-pwl-tools .eye") == "0" and op(P + " .ndk-pwl-tools .snd") is None)
b = R(V + " .ndk-media-main"); pg.mouse.move(b[0] + b[4] / 2, b[1] + b[5] / 2); pg.wait_for_timeout(600)
check("Viewer: they show when the mouse is on the widget", op(V + " .ndk-vw-tools .eye") == "1" and op(V + " .ndk-vw-tools .snd") == "1")
b = R(P + " .ndk-pl"); pg.mouse.move(b[0] + b[4] / 2, b[1] + b[5] / 2); pg.wait_for_timeout(600)
check("Video Player: the eye shows when the mouse is on the widget", op(P + " .ndk-pwl-tools .eye") == "1")
J('document.querySelector(\'.ndk-uimode .ndk-w[data-id="v1"] .ndk-vw-tools .snd\').click()'); pg.wait_for_timeout(300)
b = R(V + " .ndk-media-main"); pg.mouse.move(b[0] + b[4] / 2, b[1] + b[5] / 2); pg.wait_for_timeout(500)
check("the volume slider shows with the mouse and hides without it", op(V + " .ndk-vw-vol") == "1")
pg.mouse.move(1400, 800); pg.wait_for_timeout(600)
check("the volume slider fades away", op(V + " .ndk-vw-vol") == "0" and op(V + " .ndk-vw-tools .snd") == "0")
J('document.querySelector(\'.ndk-uimode .ndk-w[data-id="v1"] .ndk-vw-tools .snd\').click()')
b = R(V + " .ndk-media-main"); pg.mouse.move(b[0] + b[4] / 2, b[1] + b[5] / 2); pg.wait_for_timeout(300)
J('document.querySelector(\'.ndk-uimode .ndk-w[data-id="v1"] .ndk-vw-tools .eye\').click()'); pg.wait_for_timeout(300)
pg.mouse.move(1400, 800); pg.wait_for_timeout(600)
check("with the live preview switched off by the eye, the eye stays seen (to bring it back)", op(V + " .ndk-vw-tools .eye") == "1")
pg.screenshot(path="/tmp/ndui_shots/s43.png")
finish(p, br, errs)
