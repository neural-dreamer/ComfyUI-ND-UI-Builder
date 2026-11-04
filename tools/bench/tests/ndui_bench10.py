# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 10 (stage D2): the Viewer widget (live / results / compare), the Live Bridge mark, Save, drag-out, presets and migration.
import json, base64, io, urllib.request
from lib import *
from PIL import Image

def png(color, size=(64, 48)):
    b = io.BytesIO(); Image.new("RGB", size, color).save(b, "PNG"); return b.getvalue()
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
def wsbin(meta, data, kind=4):
    r = urllib.request.Request(URL + "/bench/wsbin", data=json.dumps({"meta": meta, "b64": base64.b64encode(data).decode(), "kind": kind}).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)

# ---- the graph: a sampler, a bridge, a panel with two viewers
ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const k = mk('KSampler',60,380,'Sampler [sampler]'), b = mk('NDUILiveBridge',60,700,'Bridge [bridge]'), pv = mk('PreviewImage',60,900,'Out [out]');
  const u = mk('NDUI',480,60); u.size=[1000,640]; a.graph.setDirtyCanvas(true,true);
  k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; b.properties.nd_ui_src={uid:'sb',tag:'bridge'}; pv.properties.nd_ui_src={uid:'so',tag:'out'};
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'sb',tag:'bridge',class:'NDUILiveBridge',title:'Bridge [bridge]'},{uid:'so',tag:'out',class:'PreviewImage',title:'Out [out]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[
    W('v1','viewer',10,10,420,360,{live:{src:'sk',kind:'live',name:''},images:{src:'so',kind:'images',name:''}},{live:true,results:true,compare:false,progress:'both',thumbs:'bottom'}),
    W('v2','viewer',450,10,420,360,{live:{src:'sb',kind:'live',name:''}},{live:true,results:false,compare:false,progress:'line',thumbs:'off',muteComfy:true}),
    W('v3','viewer',10,380,420,240,{images:{src:'so',kind:'images',name:''}},{live:false,results:false,compare:true,srcA:'previous',srcB:'result',progress:'off'})]};
  u.ndUiApi.reload(); return {u:u.id, k:k.id, b:b.id, o:pv.id}; }""")
pg.wait_for_timeout(1000)
K, Bn, O = str(ids["k"]), str(ids["b"]), str(ids["o"])
check("three viewers are mounted", J("document.querySelectorAll('.ndk-viewer').length") == 3)
check("nothing live at the start", J("[...document.querySelectorAll('.ndk-vw-live')].every(i=>i.style.display==='none')"))

# ---- 1. the live frame of a sampler: with its node (type 4) and without (type 1)
ws({"type": "execution_start", "data": {"prompt_id": "p1"}})
wsbin({"node_id": K, "display_node_id": K, "prompt_id": "p1", "image_type": "image/png"}, png((200, 30, 30)))
pg.wait_for_timeout(500)
live = lambda i: J("(i)=>{const e=document.querySelectorAll('.ndk-viewer')[i].querySelector('.ndk-vw-live'); return e.style.display!=='none' ? e.src : ''}", i)
s1 = live(0)
check("a frame with its node shows in the viewer bound to the sampler", s1.startswith("blob:"), s1)
check("the LIVE badge shows while the run is on", J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-live-badge').style.display") == "")
check("a viewer bound to the bridge shows nothing of it", live(1) == "")
ws({"type": "executing", "data": {"node": K, "display_node": K, "prompt_id": "p1"}})
wsbin({}, png((30, 200, 30)), kind=1)
pg.wait_for_timeout(500)
s2 = live(0)
check("a frame without a node (type 1) goes to the node that runs", s2.startswith("blob:") and s2 != s1, s2)
ws({"type": "progress_state", "data": {"prompt_id": "p1", "nodes": {K: {"value": 10, "max": 20, "state": "running", "node_id": K, "display_node_id": K, "prompt_id": "p1"}}}})
pg.wait_for_timeout(400)
check("steps are shown as 10 / 20", J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-step').innerText") == "10 / 20")
check("and the line is filled to a half", abs(float(J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-live-bar i').style.width").rstrip("%")) - 50) < 1)

# ---- 2. the eye
J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-tools .eye').click()"); pg.wait_for_timeout(300)
check("the eye turns the live preview off", live(0) == "")
check("and it is remembered in the widget", J("window.__app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui.widgets.find(w=>w.id==='v1').props.liveOn") is False)
J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-tools .eye').click()"); pg.wait_for_timeout(300)
check("and on again", live(0).startswith("blob:"))

# ---- 3. the frame of the bridge
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": K, "prompt_id": "p1", "step": 5, "steps": 20, "images": ["data:image/png;base64," + base64.b64encode(png((30, 30, 220))).decode()]}})
pg.wait_for_timeout(400)
check("a frame of the bridge shows in the viewer bound to it", live(1).startswith("data:image/png"))
check("with the step of the bridge (25 %)", abs(float(J("document.querySelectorAll('.ndk-viewer')[1].querySelector('.ndk-live-bar i').style.width").rstrip("%")) - 25) < 1)

# ---- 4. the result comes: the frames give way
ws({"type": "executed", "data": {"node": O, "display_node": O, "prompt_id": "p1", "output": {"images": [{"filename": "one.png", "subfolder": "", "type": "temp"}]}}})
ws({"type": "execution_success", "data": {"prompt_id": "p1"}}); pg.wait_for_timeout(500)
check("the finished picture replaces the frame", live(0) == "" and "one.png" in J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-layer img')?.src || ''"))

# ---- 5. the mark in the prompt
def last_prompt(): return prompts()[-1]
n0 = len(prompts())
J("async()=>{ await window.__app.queuePrompt(0,1) }"); pg.wait_for_timeout(700)
lp = last_prompt()
bridge = lp["prompt"].get(Bn) or {}
check("the bridge bound to a visible viewer is marked", bridge.get("_meta", {}).get("ndui_live") is True, json.dumps(bridge)[:200])
check("and the preview of ComfyUI is silenced for that run", (lp.get("extra_data") or {}).get("preview_method") == "none", json.dumps(lp.get("extra_data"))[:200])
J("document.querySelectorAll('.ndk-viewer')[1].querySelector('.ndk-vw-tools .eye').click()"); pg.wait_for_timeout(300)
J("async()=>{ await window.__app.queuePrompt(0,1) }"); pg.wait_for_timeout(700)
lp = last_prompt(); bridge = lp["prompt"].get(Bn) or {}
check("with the eye closed the bridge is not wanted", bridge.get("_meta", {}).get("ndui_live") is False)
check("and ComfyUI keeps its preview", (lp.get("extra_data") or {}).get("preview_method") != "none")
J("document.querySelectorAll('.ndk-viewer')[1].querySelector('.ndk-vw-tools .eye').click()"); pg.wait_for_timeout(200)

# ---- 6. Save and drag-out
J("window.__clicks=[]; const o=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ window.__clicks.push([this.href,this.download]); }")
J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-tools .save').click()"); pg.wait_for_timeout(200)
cl = [c for c in J("window.__clicks") if c[0] and "filename=" in c[0]]
check("Save downloads the original file", len(cl) == 1 and "filename=one.png" in cl[0][0] and "type=temp" in cl[0][0] and cl[0][1] == "one.png", str(cl))
drag = J("""()=>{ const im=document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-layer img'); const dt=new DataTransfer();
  const ev=new DragEvent('dragstart',{dataTransfer:dt,bubbles:true,cancelable:true}); im.dispatchEvent(ev);
  return {nd: dt.getData('application/x-nd-image'), url: dt.getData('DownloadURL'), draggable: im.draggable, prevented: ev.defaultPrevented}; }""")
check("the picture can be pulled out: the format of ND Variant Selector", json.loads(drag["nd"] or "{}") == {"filename": "one.png", "subfolder": "", "type": "temp"} and drag["draggable"] and not drag["prevented"], str(drag))
check("and onto the desktop (DownloadURL)", drag["url"].startswith("image/png:one.png:http") and "filename=one.png" in drag["url"], drag["url"])
J("""()=>{ const u=window.__app.graph._nodes.find(n=>n.type==='NDUI'); const w=u.properties.nd_ui.widgets.find(w=>w.id==='v1'); w.props.save=false; u.ndUiApi.reload() }"""); pg.wait_for_timeout(700)
check("the Save button can be hidden", J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-tools .save')") is None)

def setprops(wid, **kw):
    J("([id,kw])=>{ const u=window.__app.graph._nodes.find(n=>n.type==='NDUI'); const w=u.properties.nd_ui.widgets.find(w=>w.id===id); Object.assign(w.props,kw); u.ndUiApi.reload() }", [wid, kw]); pg.wait_for_timeout(700)

# ---- 6b. a viewer bound to the SAMPLER uses the bridge that sits on the model wire in front of it
J("()=>{const g=window.__app.graph; const b=g._nodes.find(n=>n.type==='NDUILiveBridge'), k=g._nodes.find(n=>n.type==='KSampler'); b.connect(0,k,0); g.setDirtyCanvas(true,true)}"); pg.wait_for_timeout(300)
setprops("v2", liveOn=False, save=True)
J("async()=>{ await window.__app.queuePrompt(0,1) }"); pg.wait_for_timeout(700)
lp = last_prompt(); bridge = lp["prompt"].get(Bn) or {}
check("the bridge in front of the sampler is wanted by the viewer bound to the sampler", bridge.get("_meta", {}).get("ndui_live") is True, json.dumps(bridge)[:200])
ws({"type": "execution_start", "data": {"prompt_id": "p9"}})
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": K, "prompt_id": "p9", "step": 3, "steps": 30, "images": ["data:image/png;base64," + base64.b64encode(png((220, 30, 220))).decode()]}})
pg.wait_for_timeout(500)
check("its frames show in the viewer bound to the sampler", live(0).startswith("data:image/png"), live(0)[:30])
check("the step comes from the bridge", J("document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-vw-step').innerText") == "3 / 30")
ws({"type": "execution_success", "data": {"prompt_id": "p9"}}); pg.wait_for_timeout(300)
setprops("v2", liveOn=True)

# ---- 7. thumbnails and the comparison
ws({"type": "execution_start", "data": {"prompt_id": "p2"}})
ws({"type": "executed", "data": {"node": O, "display_node": O, "prompt_id": "p2", "output": {"images": [{"filename": "two.png", "subfolder": "", "type": "temp"}]}}})
ws({"type": "execution_success", "data": {"prompt_id": "p2"}}); pg.wait_for_timeout(500)
check("a thumbnail per run", J("document.querySelectorAll('.ndk-viewer')[0].querySelectorAll('.ndk-media-strip .cell').length") == 2)
cmp = J("(()=>{const v=document.querySelectorAll('.ndk-viewer')[2]; return [...v.querySelectorAll('.ndk-cmp img')].map(i=>i.src)})()")
check("Compare: A (on top) is the run before, B (under) the newest", len(cmp) == 2 and "two.png" in cmp[0] and "one.png" in cmp[1], str(cmp))
check("the tags carry the names", J("document.querySelectorAll('.ndk-viewer')[2].querySelector('.ndk-cmp .tag.a').innerText") == "A")
# the widget in the model: other sources and the side mode
setprops("v3", cmpMode="side", labelA="Before", labelB="After")
check("side by side", J("document.querySelectorAll('.ndk-viewer')[2].querySelectorAll('.ndk-vw-side .cell').length") == 2 and "Before" in J("document.querySelectorAll('.ndk-viewer')[2].innerText"))
setprops("v3", cmpMode="wipe", srcA="pick", srcB="pick")
check("a viewer that compares the thumbnails: A and B buttons on them", J("document.querySelectorAll('.ndk-viewer')[2].querySelectorAll('.ndk-media-strip .ab i').length") == 4)
J("document.querySelectorAll('.ndk-viewer')[2].querySelectorAll('.ndk-media-strip .cell')[1].querySelector('.ab i').click()"); pg.wait_for_timeout(300)
J("document.querySelectorAll('.ndk-viewer')[2].querySelectorAll('.ndk-media-strip .cell')[0].querySelectorAll('.ab i')[1].click()"); pg.wait_for_timeout(300)
cmp = J("(()=>{const v=document.querySelectorAll('.ndk-viewer')[2]; return [...v.querySelectorAll('.ndk-cmp img')].map(i=>i.src)})()")
check("A and B are what was chosen (A = the older, B = the newer)", len(cmp) == 2 and "two.png" in cmp[0] and "one.png" in cmp[1], str(cmp))
setprops("v3", srcA="file", srcB="result")
check("a file as a source needs a slot with a name: nothing yet", J("document.querySelectorAll('.ndk-viewer')[2].querySelector('.ndk-cmp') !== null"))

# ---- 8. both tabs in one viewer
setprops("v1", compare=True, save=True, srcA="previous", srcB="result")
check("a viewer with results and compare has the tabs", J("document.querySelectorAll('.ndk-viewer')[0].querySelectorAll('.ndk-vw-tabs button').length") == 2)
J("document.querySelectorAll('.ndk-viewer')[0].querySelectorAll('.ndk-vw-tabs button')[1].click()"); pg.wait_for_timeout(300)
check("the Compare tab shows the comparison", J("!!document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-cmp') && document.querySelectorAll('.ndk-viewer')[0].querySelector('.ndk-cmp').offsetParent !== null"))

# ---- 9. old widgets become the Viewer
mig = J("""async()=>{ const M=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js').catch(()=>null); if(!M) return null;
  const ui=M.normalizeNdUi({pages:[{id:'p1'}],widgets:[
   {id:'r',type:'result',page:'p1',x:0,y:0,w:300,h:300,props:{history:false,label:'Result'},slots:{images:{src:'x',kind:'images',name:''}}},
   {id:'l',type:'live',page:'p1',x:0,y:0,w:300,h:300,props:{bar:false},slots:{live:{src:'x',kind:'live',name:''}}},
   {id:'c',type:'compare',page:'p1',x:0,y:0,w:300,h:300,props:{nameA:'Old',nameB:'New'},slots:{a:{src:'x',kind:'images',name:''},b:{src:'y',kind:'images',name:''}}}]});
  return ui.widgets.map(w=>({type:w.type,props:w.props,slots:Object.keys(w.slots)})) }""")
if mig is None:
    mig = J("""async()=>{ const u=window.__app.graph._nodes.find(n=>n.type==='NDUI'); return null }""")
check("module reachable", mig is not None)
if mig:
    r, l, c = mig
    check("Result -> Viewer: results only, no thumbnails when the history was off", r["type"] == "viewer" and r["props"]["results"] is True and r["props"]["live"] is False and r["props"]["thumbs"] == "off" and "history" not in r["props"])
    check("Live Preview -> Viewer: live + results, the line off", l["type"] == "viewer" and l["props"]["live"] is True and l["props"]["progress"] == "off" and l["slots"] == ["live"])
    check("Compare -> Viewer: compare only, nodes as sources, the names kept", c["type"] == "viewer" and c["props"]["compare"] is True and c["props"]["results"] is False and c["props"]["srcA"] == "node" and c["props"]["labelA"] == "Old" and c["props"]["labelB"] == "New" and c["slots"] == ["a", "b"])

# ---- 10. the library: presets, and the settings show only what is needed
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(900)
J("window.ndUi.host().editor.setTab('widgets')"); pg.wait_for_timeout(300)
tiles = J("[...document.querySelectorAll('.nde-lib-i')].map(i=>i.innerText.trim())")
check("the library has the presets of the Viewer and no old tiles", all(t in tiles for t in ["Viewer", "Result", "Live Preview", "Compare"]) and tiles.count("Result") == 1, str(tiles))
J("[...document.querySelectorAll('.nde-lib-i')].find(i=>i.innerText.trim()==='Live Preview').click()"); pg.wait_for_timeout(500)
t = J("document.querySelector('.nde-right, .nde-insp, .nde-scroll')?.closest('div')?.innerText || document.body.innerText")
body = J("document.body.innerText")
check("the preset makes a viewer with live preview: its slot 'Frames of' is offered", "Frames of" in body and "Picture A" not in body)
check("the compare-only settings are hidden", "Picture A comes from" not in body)
check("the muting setting is there for a live viewer", "Silence the preview of ComfyUI" in body)
J("window.ndUi.host().editor.close && 0"); 
finish(p, br, errs)
