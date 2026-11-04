# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Both packs in one ComfyUI: ComfyUI ND UI Builder works with the contracts of Neural Dreamer Nodes (no imports between them).
# Needs the bench with both packs (see ../README.md): nd_final / nd_batch pictures, nd_text, the condition of ND Multi Switch as the mode switch.
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
p, br, pg, errs = start()
packs = pg.evaluate("async()=>{const r=await fetch('/extensions'); return (await r.json()).map(x=>x.split('/')[2]).filter((v,i,a)=>a.indexOf(v)===i)}")
check("both packs are served", "ComfyUI-NeuralDreamer-UI" in packs and "ComfyUI-NeuralDreamer-Nodes" in packs, str(packs))
types = pg.evaluate("['NDUI','NDMultiSwitch','NDVariantPreviewSelector','NDShowAnyAsText'].map(t=>!!window.LiteGraph.registered_node_types[t])")
check("the nodes of both packs are registered", types[0] and types[1], str(types))
setup(pg)
pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const LG=window.LiteGraph; const u=g._nodes.find(n=>n.type==='NDUI'); u.size=[1000,640];
 const sw=LG.createNode('NDMultiSwitch'); sw.title='Switch [branch]'; sw.pos=[60,700]; g.add(sw);
 const W=(id,type,page,x,y,w,h,slots)=>({id,type,page,x,y,w,h,z:1,slots:slots||{},props:{}});
 const C=(how,bind)=>({nodes:[],groups:[],how,bindIndex:bind||null});
 const sel=(sw.widgets||[]).find(w=>w.name==='select'); window.__selName=sel?'select':null;
 u.properties.nd_ui={view:{page:'m1'},sources:[{uid:'sw',tag:'branch',class:'NDMultiSwitch',title:'Switch [branch]'}],
  pages:[{id:'m1',name:'One',kind:'mode',control:C('mute',{src:'sw',name:'condition'})},{id:'m2',name:'Two',kind:'mode',control:C('mute')}],
  widgets:[W('r','result','m1',20,20,500,400),W('t','textout','m1',540,20,400,200)]};
 sw.properties.nd_ui_src={uid:'sw',tag:'branch'};
 u.ndUiApi.reload(); }""")
pg.wait_for_timeout(900)
ws({"type": "executed", "data": {"node": "20", "display_node": "20", "prompt_id": "a", "output": {"nd_final": [{"filename": "final.png", "subfolder": "", "type": "temp"}], "nd_batch": [{"filename": "b1.png", "subfolder": "", "type": "temp"}, {"filename": "b2.png", "subfolder": "", "type": "temp"}]}}})
ws({"type": "executed", "data": {"node": "21", "display_node": "21", "prompt_id": "a", "output": {"nd_text": ["compat text"]}}})
pg.wait_for_timeout(600)
imgs = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview img')].map(i=>i.src.split('filename=')[1]?.split('&')[0])")
check("nd_final / nd_batch pictures reach the Result widget", "final.png" in imgs or "b1.png" in imgs, str(imgs))
t = pg.evaluate("document.querySelector('.ndk-nodeview .ndk-tout-box')?.textContent")
check("nd_text reaches the Text Output widget", t == "compat text", str(t))
# the condition of ND Multi Switch follows the active mode (first mode = true, second = false)
cond = lambda: pg.evaluate("async()=>{const m=await import('/scripts/app.js'); return m.app.graph._nodes.find(n=>n.type==='NDMultiSwitch').widgets.find(x=>x.name==='condition').value}")
check("the first mode sets the condition to true", cond() is True, str(cond()))
pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-strip .tab')].find(b=>b.textContent==='Two').click()"); pg.wait_for_timeout(600)
check("the second mode sets it to false", cond() is False, str(cond()))
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDMultiSwitch').widgets.find(x=>x.name==='condition').value=true}"); pg.wait_for_timeout(1000)
on = pg.evaluate("document.querySelector('.ndk-nodeview .ndk-strip .tab.on')?.textContent")
check("turning the condition in the node switches the tab back", on == "One", str(on))
finish(p, br, errs)
