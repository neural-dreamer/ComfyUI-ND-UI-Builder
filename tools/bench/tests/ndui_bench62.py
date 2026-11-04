# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 62: Progress: the step counter in the middle of the bar; "While it works" is a switch with the options of Activity; the icon "Custom text".
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"; ACT = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/widgets/activity.js"
r = J("""async()=>{const M=await import('%s'), A=await import('%s');
  const u=M.normalizeNdUi({pages:[{id:'p1',name:'M'}],widgets:[
   {id:'a',type:'viewer',page:'p1',x:0,y:0,w:100,h:100,props:{busy:'orbit'}},{id:'b',type:'viewer',page:'p1',x:0,y:0,w:100,h:100,props:{busy:'off'}},
   {id:'c',type:'activity',page:'p1',x:0,y:0,w:100,h:100,props:{mark:'custom',markText:'ABCDEFGHIJKLMNOPQRSTUVWXYZ\\n1\\n2\\n3\\n4\\n5'}},
   {id:'d',type:'viewer',page:'p1',x:0,y:0,w:100,h:100,props:{busy:'rings',busyOn:false}}]});
  const w=(id)=>u.widgets.find(x=>x.id===id).props;
  return {a:w('a'),b:w('b'),c:w('c'),d:w('d'),marks:A.ACTIVITY_MARKS.map(m=>m[0]), clean:A.cleanMarkText('abc\\ndef\\r\\nxyz\\n1\\n2\\n3\\n4')}}""" % (M, ACT))
check("an old 'busy' animation becomes the switch on + the animation", r["a"].get("busyOn") is True and r["a"].get("busyStyle") == "orbit" and "busy" not in r["a"], str(r["a"]))
check("an old 'busy: off' leaves the switch off", "busyOn" not in r["b"] and "busy" not in r["b"], str(r["b"]))
check("an explicit switch is not overwritten", r["d"].get("busyOn") is False and "busy" not in r["d"], str(r["d"]))
check("the custom text is cut to 20 characters and 4 lines", len(r["c"]["markText"].replace("\n", "")) + r["c"]["markText"].count("\n") <= 20 and r["c"]["markText"].count("\n") <= 3, str(r["c"]))
check("'Custom text' is in the list of icons", r["marks"][-1] == "custom", str(r["marks"]))
check("cleanMarkText: 20 chars max, 4 lines max", r["clean"].count("\n") <= 3 and len(r["clean"]) <= 20, str(r["clean"]))
# a page: progress, activity with custom text, a viewer that waits with custom text, a viewer with the switch off
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const W=(id,type,x,y,w,h,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots:{},props});
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[
   W('pr','progress',20,20,420,64,{steps:true}),
   W('ac','activity',20,100,200,160,{mark:'custom',markText:'GO\\nGO',when:'always'}),
   W('v1','viewer',260,100,300,200,{live:false,results:true,busyOn:true,busyMark:'custom',busyText:'WAIT',busyStyle:'rings',busyBar:true,busySteps:true}),
   W('v2','viewer',580,100,300,200,{live:false,results:true,busyOn:false,busyMark:'custom',busyText:'NO'})],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(500)
J("window.ndUi.enter()"); pg.wait_for_timeout(900)
svgtext = lambda wid: J("(w)=>[...document.querySelectorAll(`.ndk-uimode .ndk-w[data-id=\"${w}\"] .ndk-act-mark text tspan`)].map(t=>t.textContent)", wid)
check("Activity with the icon Custom text: the lines are in the tile", svgtext("ac") == ["GO", "GO"], str(svgtext("ac")))
ws({"type": "execution_start", "data": {"prompt_id": "p1"}}); pg.wait_for_timeout(500)
ws({"type": "progress_state", "data": {"prompt_id": "p1", "nodes": {"3": {"value": 3, "max": 10, "state": "running", "node_id": "3", "display_node_id": "3", "prompt_id": "p1"}}}}); pg.wait_for_timeout(500)
shown = lambda w: J("(w)=>{const e=document.querySelector(`.ndk-uimode .ndk-w[data-id=\"${w}\"] .ndk-act`); return !!e && getComputedStyle(e).display!=='none' && e.getClientRects().length>0}", w)
check("the Viewer with the switch on shows the animation with its own text", shown("v1") and svgtext("v1") == ["WAIT"], str(svgtext("v1")))
check("the Viewer with the switch off does not", not shown("v2"))
st = J("()=>{const e=document.querySelector('.ndk-uimode .ndk-w[data-id=v1] .ndk-act'); return {txt:e.querySelector('.ndk-act-text').textContent, bar:getComputedStyle(e.querySelector('.ndk-act-bar')).visibility}}")
check("the step counter and the progress line of the animation", "3 / 10" in st["txt"] and st["bar"] == "visible", str(st))
# progress: the step counter in the middle
g = J("""()=>{const row=document.querySelector('.ndk-uimode .ndk-w[data-id=pr] .ndk-prog-row'); const mid=row.querySelector('.mid'), end=row.querySelector('.end'); const a=row.getBoundingClientRect(), m=mid.getBoundingClientRect(), e=end.getBoundingClientRect();
  return {txt:mid.textContent, cx:(m.left+m.right)/2, rowc:(a.left+a.right)/2, endTxt:end.textContent, endR:e.right, rowR:a.right}}""")
check("Progress: the steps are in the middle of the bar", g["txt"].replace(" ", "") == "3/10" and abs(g["cx"] - g["rowc"]) < 6, str(g))
check("Progress: the percents stay on the right, without the steps", "%" in g["endTxt"] and "/" not in g["endTxt"] and abs(g["endR"] - g["rowR"]) < 3, str(g))
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
# the editor
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
J("()=>window.ndUi.host().editor.select(['v2'])"); pg.wait_for_timeout(500)
labs = lambda: J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
l1 = labs()
check("the switch is there; the options are hidden while it is off", "While it works (no live frame)" in l1 and "Animation" not in l1, str(l1))
J("()=>window.ndUi.host().editor.change(null,()=>{window.ndUi.host().editor.ui.widgets.find(w=>w.id==='v2').props.busyOn=true})"); pg.wait_for_timeout(500)
J("()=>window.ndUi.host().editor.select(['v2'])"); pg.wait_for_timeout(400)
l2 = labs()
check("switched on: Icon, Text in the icon (custom), Animation, Progress, Step counter", all(x in l2 for x in ["Icon", "Text in the icon", "Animation", "Progress", "Step counter"]), str(l2))
J("()=>window.ndUi.host().editor.select(['ac'])"); pg.wait_for_timeout(500)
l3 = labs()
check("Activity: the text field appears for the icon Custom text", "Text in the icon" in l3, str(l3))
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
