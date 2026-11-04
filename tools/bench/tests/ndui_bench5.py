# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 5 (stage 2, part A): events -> Generate / Progress / Queue / Result / Live / Compare / Resolution / Model Picker / Text Output.
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
p, br, pg, errs = start()
setup(pg)
pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const u=g._nodes.find(n=>n.type==='NDUI'), k=g._nodes.find(n=>n.type==='KSampler'), l=g._nodes.find(n=>n.type==='EmptyLatentImage');
 k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; l.properties.nd_ui_src={uid:'sl',tag:'size'}; u.size=[1100,700];
 const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots:slots||{},props:props||{}});
 const B=(s,n)=>({src:s,kind:'widget',name:n});
 u.properties.nd_ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'sl',tag:'size',class:'EmptyLatentImage',title:'Latent [size]'}],pages:[{id:'p1',name:'Main'}],
 widgets:[W('g','generate',20,20,320,64),W('pr','progress',20,100,320,64),W('q','queue',20,180,240,48),W('r','result',360,20,380,300),W('lv','live',760,20,300,220),W('cm','compare',360,340,380,260,{a:{src:'',kind:'images'},b:{src:'',kind:'images'}}),
  W('rs','resolution',20,250,320,200,{width:B('sl','width'),height:B('sl','height')}),W('mp','modelpicker',20,470,320,64,{value:B('sk','sampler_name')}),W('tx','textout',760,260,300,160)]};
 u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1200)
cnt = pg.evaluate("document.querySelectorAll('.ndk-nodeview .ndk-w').length")
check("all 9 widgets mounted", cnt == 9, str(cnt))
# Generate -> a prompt is recorded
pg.evaluate("document.querySelector('.ndk-nodeview .ndk-gen .run').click()"); pg.wait_for_timeout(900)
check("Generate queues the workflow", len(prompts()) >= 1, str(len(prompts())))
# events
ws({"type": "execution_start", "data": {"prompt_id": "p1"}})
ws({"type": "progress_state", "data": {"prompt_id": "p1", "nodes": {"3": {"value": 10, "max": 20, "state": "running", "node_id": "3", "display_node_id": "3", "prompt_id": "p1"}}}})
ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 3}}}})
pg.wait_for_timeout(500)
t = pg.evaluate("document.querySelector('.ndk-prog').innerText"); check("Progress counts the nodes of the sent prompt (half of the steps of one of two nodes = 25%)", "10/20" in t and "25%" in t, t)
q = pg.evaluate("document.querySelector('.ndk-queue').innerText"); check("Queue shows the numbers", "3" in q, q)
g = pg.evaluate("document.querySelector('.ndk-gen .run').innerText"); check("Generate shows the busy state", "Running" in g, g)
ws({"type": "executed", "data": {"node": "9", "display_node": "9", "prompt_id": "p1", "output": {"images": [{"filename": "one.png", "subfolder": "", "type": "output"}]}}})
ws({"type": "executed", "data": {"node": "10", "display_node": "10", "prompt_id": "p1", "output": {"nd_text": ["hello world"]}}})
ws({"type": "executed", "data": {"node": "9", "display_node": "9", "prompt_id": "p1", "output": {"images": [{"filename": "two.png", "subfolder": "", "type": "output"}, {"filename": "three.png", "subfolder": "", "type": "output"}]}}})
pg.wait_for_timeout(700)
imgs = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].map(w=>[w.dataset.type||'', w.querySelectorAll('img').length])")
print(imgs)
r = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview img')].map(i=>i.src.split('filename=')[1]?.split('&')[0])")
check("Result shows the newest images", "two.png" in r and "three.png" in r, str(r))
tx = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview')].map(n=>n.innerText).join('|')")
check("Text Output shows the text", "hello world" in tx, tx[:300])
pg.screenshot(path="/tmp/ndui_shots/s2a.png")
ws({"type": "execution_success", "data": {"prompt_id": "p1"}}); ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 0}}}}); pg.wait_for_timeout(400)
g = pg.evaluate("document.querySelector('.ndk-gen .run').innerText"); check("Generate back to idle", "Generate" in g, g)
# lightbox
pg.evaluate("document.querySelector('.ndk-nodeview img').click()"); pg.wait_for_timeout(500)
lb = pg.evaluate("!!document.querySelector('.ndk-lightbox')"); check("lightbox opens", lb)
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("Esc closes the lightbox only", not pg.evaluate("!!document.querySelector('.ndk-lightbox')"))
# model picker popup
pg.evaluate("document.querySelectorAll('.ndk-nodeview .ndk-w')[7].querySelector('button, .ndk-field')?.click()"); pg.wait_for_timeout(500)
pg.screenshot(path="/tmp/ndui_shots/s2b.png")
finish(p, br, errs)
