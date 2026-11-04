# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 53: the progress of the run (the nodes of the sent prompt, minus the cached ones) and the progress bar of the mode.
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
EV = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/events.js"
# a graph of 6 nodes: the prompt that is sent has 6 of them
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  for (const [t,x,y] of [['KSampler',40,60],['EmptyLatentImage',40,400],['CheckpointLoaderSimple',400,60],['CLIPTextEncode',400,300],['VAEDecode',760,60],['SaveImage',760,300]]) { const n = LG.createNode(t); n.pos=[x,y]; a.graph.add(n); }
  const u = LG.createNode('NDUI'); u.pos=[1000,60]; u.size=[600,400]; a.graph.add(u);
  window.ndUi.host().save({sources:[],pages:[{id:'p1',name:'Main'}],widgets:[],view:{progressBar:{show:true,pos:'top',height:8,mode:'split',text:'full',idleHide:false}}}); }""")
pg.wait_for_timeout(600)
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
sent = J("""async () => { const m = await import('/scripts/app.js'); const r = await m.app.queuePrompt(0, 1); const j = await (await fetch('/bench/prompts')).json(); const last = j[j.length-1]; const out = last.prompt || last.output || last; return Object.keys(out).length }""")
pid = J("async()=>{const j = await (await fetch('/bench/prompts')).json(); return 'p'+(j.length-1)}")
print("sent nodes:", sent, pid)
ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 1}}}})
ws({"type": "execution_start", "data": {"prompt_id": pid}})
pg.wait_for_timeout(300)
ws({"type": "execution_cached", "data": {"prompt_id": pid, "nodes": ["1", "2", "3", "4"]}})
pg.wait_for_timeout(200)
# progress_state of what is known so far: the cached nodes are 'finished'
def pst(states):
    ws({"type": "progress_state", "data": {"prompt_id": pid, "nodes": {k: {"node_id": k, "display_node_id": k, "state": v[0], "value": v[1], "max": v[2], "prompt_id": pid} for k, v in states.items()}}})
pst({"1": ("finished", 1, 1), "2": ("finished", 1, 1), "3": ("finished", 1, 1), "4": ("finished", 1, 1), "5": ("running", 0, 20)})
pg.wait_for_timeout(300)
d = J("async()=>{const m=await import('%s'); return {pct:m.overall(), exp:m.events.run.expected, cached:m.events.run.cached.size, to:m.toRunCount()}}" % EV)
check("the prompt has the nodes the bar counts on", d["exp"] == sent and sent >= 4, str(d))
check("cached nodes do not count: 0% at the start, not 90%", d["pct"] < 0.05 and d["to"] == sent - 4, str(d))
pst({"1": ("finished", 1, 1), "2": ("finished", 1, 1), "3": ("finished", 1, 1), "4": ("finished", 1, 1), "5": ("running", 10, 20)})
pg.wait_for_timeout(300)
d = J("async()=>{const m=await import('%s'); return {pct:m.overall(), st:m.stepsPct()}}" % EV)
check("half of the steps of one of the nodes to run", abs(d["st"] - 0.5) < 0.01 and 0.2 < d["pct"] < 0.8, str(d))
# the bar of the mode
bar = J("""()=>{const b=document.querySelector('.ndk-uimode .ndk-pbar'); if(!b) return null; const r=b.getBoundingClientRect(); const f=[...b.querySelectorAll('.ndk-pb-fill')].map(x=>x.style.width); return {top:r.top, h:r.height, f, text:b.querySelector('.ndk-pb-text').textContent, vis:getComputedStyle(b).display!=='none'}}""")
check("the bar is on the top edge and visible", bar and bar["vis"] and bar["top"] < 1, str(bar))
check("two bars: nodes and steps (50%)", bar and bar["f"][1] == "50%" and bar["f"][0] != "100%", str(bar))
check("the text shows node counts and percent", bar and "%" in bar["text"] and "(" in bar["text"], str(bar))
pst({"1": ("finished", 1, 1), "2": ("finished", 1, 1), "3": ("finished", 1, 1), "4": ("finished", 1, 1), "5": ("finished", 20, 20), "6": ("running", 0, 0)})
ws({"type": "execution_success", "data": {"prompt_id": pid}})
pg.wait_for_timeout(400)
d = J("async()=>{const m=await import('%s'); return m.overall()}" % EV)
check("a finished run is 100%", d == 1, str(d))
# the model and the settings
v = J("()=>window.ndUi.host().ui.view.progressBar")
check("the model keeps the settings", v["show"] and v["pos"] == "top" and v["height"] == 8 and v["text"] == "full" and v["idleHide"] is False, str(v))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); Object.assign(u.view.progressBar,{pos:'bottom',mode:'single',fill:'custom',c1:'#ff0000',c2:'#0000ff',angle:45,glow:true,height:99,text:'zzz'}); window.ndUi.host().save(u)}"""); pg.wait_for_timeout(600)
v = J("()=>window.ndUi.host().ui.view.progressBar")
check("bad values are cleaned", v["height"] == 24 and v["text"] == "none", str(v))
bar = J("""()=>{const b=document.querySelector('.ndk-uimode .ndk-pbar'); const r=b.getBoundingClientRect(); return {bottom:innerHeight-r.bottom, single:b.dataset.mode, glow:b.classList.contains('glow'), fill:b.style.getPropertyValue('--pb-fill')}}""")
check("bottom, one bar, glow, a gradient", bar["bottom"] < 1 and bar["single"] == "single" and bar["glow"] and "linear-gradient(45deg" in bar["fill"], str(bar))
# an error
ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 1}}}})
ws({"type": "execution_start", "data": {"prompt_id": "pX"}}); pg.wait_for_timeout(200)
ws({"type": "execution_error", "data": {"prompt_id": "pX", "exception_message": "Boom", "node_id": "5"}}); pg.wait_for_timeout(400)
check("an error turns the bar red", J("()=>document.querySelector('.ndk-uimode .ndk-pbar').classList.contains('err')"))
# "Hide when idle": a finished run leaves the bar for a moment, then it goes; with the option off it stays; an error stays
VIS = "()=>getComputedStyle(document.querySelector('.ndk-uimode .ndk-pbar')).display!=='none'"
def run_ok(i):
    ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 1}}}})
    ws({"type": "execution_start", "data": {"prompt_id": "pI%d" % i}}); pg.wait_for_timeout(200)
    ws({"type": "execution_success", "data": {"prompt_id": "pI%d" % i}})
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); Object.assign(u.view.progressBar,{idleHide:true,pos:'top',mode:'split'}); window.ndUi.host().save(u)}"""); pg.wait_for_timeout(500)
run_ok(1); pg.wait_for_timeout(600)
check("idle hide on: the bar is still there right after the run", J(VIS))
pg.wait_for_timeout(3500)
check("idle hide on: the bar is gone a few seconds after the run", not J(VIS))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.progressBar.idleHide=false; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(500)
check("idle hide off: the finished bar stays", J(VIS))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.progressBar.idleHide=true; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(500)
check("idle hide on again: the bar goes", not J(VIS))
# default: off
d0 = J("""async()=>{const M=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js'); return M.normalizeNdUi({}).view.progressBar}""")
check("off by default", d0["show"] is False and d0["pos"] == "top" and d0["mode"] == "split", str(d0))
# the editor section
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
check("the page settings have the progress bar section with a preview", J("()=>document.body.textContent.includes('Progress bar') && !!document.querySelector('.nde-pbsample')"))
J("window.ndUi.host().editor?.close?.()")
finish(p, br, errs)
