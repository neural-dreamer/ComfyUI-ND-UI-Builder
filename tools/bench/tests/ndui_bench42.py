# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 42: the Viewer and the Video Player in the ND UI mode — the stage keeps its size (a name clash with the LoRA preview broke it), the progress, the speaker, the live layer of the Video Player.
import json, base64, io, urllib.request
from fractions import Fraction
import av, numpy as np
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
def webm(color):
    buf = io.BytesIO(); out = av.open(buf, mode="w", format="webm"); vs = out.add_stream("libvpx", rate=Fraction(10, 1)); vs.width = 64; vs.height = 48; vs.pix_fmt = "yuv420p"
    for i in range(10):
        arr = np.full((48, 64, 3), color, dtype=np.uint8); arr[:, : i * 6] = 255
        for pk in vs.encode(av.VideoFrame.from_ndarray(arr, format="rgb24")): out.mux(pk)
    for pk in vs.encode(): out.mux(pk)
    out.close(); return "data:video/webm;base64," + base64.b64encode(buf.getvalue()).decode()
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const k = mk('KSampler',60,380,'Sampler [sampler]'), b = mk('NDUILiveBridge',60,700,'Bridge [bridge]');
  const u = mk('NDUI',480,60); u.size=[900,500]; b.properties.nd_ui_src={uid:'sb',tag:'bridge'};
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'sb',tag:'bridge',class:'NDUILiveBridge',title:'Bridge [bridge]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('v1','viewer',10,10,520,300,{live:{src:'sb',kind:'live',name:''}},{live:true,results:true,compare:true,progress:'both'}),
            W('g','generate',550,10,300,64,{},{}),
            W('vp','videoplayer',10,330,520,330,{live:{src:'sb',kind:'live',name:''}},{live:true,progress:'both'}),
            W('vq','videoplayer',550,100,300,200,{},{})],
   view:{}};
  window.ndUi.host().save(u.properties.nd_ui); return {b:b.id}; }""")
pg.wait_for_timeout(800)
J("""(id)=>{const LG=window.LiteGraph, a=window.app||window.__app; const g=a.graph; const b=g._nodes.find(n=>String(n.id)===String(id)); const v=LG.createNode('VAELoader'); v.pos=[60,420]; g.add(v); const i=b.inputs.findIndex(x=>x.name==='audio_vae'); v.connect(0,b,i); }""", str(ids["b"])); pg.wait_for_timeout(900)
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
Bn = str(ids["b"])
rect = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [Math.round(r.width),Math.round(r.height)]}", sel)
V = ".ndk-uimode .ndk-viewer"
# 1. the Viewer keeps its stage (a class of the LoRA preview once collapsed it to a line of no width)
r = rect(V + " .ndk-media-main")
check("the Viewer stage is as wide as the widget (not a line)", r and r[0] > 400 and r[1] > 200, str(r))
check("the widget body is not tinted by the LoRA preview style", J("getComputedStyle(document.querySelector('.ndk-uimode .ndk-viewer')).flexDirection") == "column")
# 2. Generate and a live frame
J("document.querySelector('.ndk-uimode .ndk-gen .run').click()"); pg.wait_for_timeout(700)
ws({"type": "execution_start", "data": {"prompt_id": "p1"}})
ws({"type": "progress_state", "data": {"prompt_id": "p1", "nodes": {"3": {"value": 10, "max": 20, "state": "running", "node_id": "3", "display_node_id": "3", "prompt_id": "p1"}}}})
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 3, "steps": 20, "kind": "image", "mime": "image/png", "url": PNG, "fps": 0, "audio": False}})
pg.wait_for_timeout(800)
shown = lambda sel: J("(s)=>{const e=document.querySelector(s); return !!e && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0}", sel)
check("the Viewer shows the live picture over its whole stage", (rect(V + " img.ndk-vw-live") or [0])[0] > 400, str(rect(V + " img.ndk-vw-live")))
check("the Viewer shows LIVE, the progress line and the steps", shown(V + " .ndk-live-badge") and shown(V + " .ndk-live-bar") and J("document.querySelector('.ndk-uimode .ndk-viewer .ndk-vw-step').textContent") == "3 / 20")
check("the speaker button (the Mute of the UI mode) is on the widget and shows when the mouse is on it", J("(()=>{const b=document.querySelector('.ndk-uimode .ndk-viewer .ndk-vw-tools .snd'); return !!b})()") and (pg.mouse.move(300, 300) or True) and (pg.wait_for_timeout(500) or True) and J("(()=>{const b=document.querySelector('.ndk-uimode .ndk-viewer .ndk-vw-tools .snd'); return getComputedStyle(b).opacity==='1'})()"))
# 3. the Video Player: its live layer
P = ".ndk-uimode .ndk-pw:has(.ndk-pwl)"
vp = lambda sel: ".ndk-uimode .ndk-w[data-id=\"vp\"] " + sel
check("the Video Player has a live layer over the player", (rect(vp(".ndk-pwl")) or [0])[0] > 300, str(rect(vp(".ndk-pwl"))))
check("the Video Player shows the live picture, LIVE, the progress and the steps", (rect(vp("img.ndk-vw-live")) or [0])[0] > 300 and shown(vp(".ndk-live-badge")) and shown(vp(".ndk-live-bar")) and J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"vp\"] .ndk-vw-step').textContent") == "3 / 20")
check("the Video Player has the speaker and the eye", shown(vp(".ndk-pwl-tools .snd")) and shown(vp(".ndk-pwl-tools .eye")))
check("the Video Player without the live preview shows no layer and no buttons", not shown(".ndk-uimode .ndk-w[data-id=\"vq\"] .ndk-pwl") and not shown(".ndk-uimode .ndk-w[data-id=\"vq\"] .ndk-pwl-tools .snd"))
# a clip goes to a player, the sound and the volume work as in the Viewer
c1 = webm((30, 60, 200))
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 5, "steps": 20, "kind": "video", "mime": "video/webm", "url": c1, "fps": 10, "audio": True}})
pg.wait_for_timeout(1500)
clips = lambda: J("[...document.querySelectorAll('.ndk-uimode .ndk-w[data-id=\"vp\"] video.ndk-vw-live')].map(v=>v.style.display!=='none')")
check("a clip plays in a player of the Video Player", sum(clips()) == 1, str(clips()))
vst = lambda: J("[...document.querySelectorAll('.ndk-uimode .ndk-w[data-id=\"vp\"] video.ndk-vw-live')].map(v=>[v.muted, Math.round(v.volume*100)])")
prop = lambda k: J("(k)=>{const w=window.ndUi.host().ui.widgets.find(w=>w.id==='vp'); return w.props[k]}", k)
check("the sound is off at the start", all(m for m, _ in vst()) and prop("sound") in (None, False))
J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"vp\"] .ndk-pwl-tools .snd').click()"); pg.wait_for_timeout(500)
check("the speaker turns the sound on and the volume slider appears (70)", all(not m for m, _ in vst()) and prop("sound") is True and J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"vp\"] .ndk-vw-vol')?.value") == "70", f"{vst()} {prop('sound')}")
J("""()=>{ const s=document.querySelector('.ndk-uimode .ndk-w[data-id=\"vp\"] .ndk-vw-vol'); s.value='40'; s.dispatchEvent(new Event('input',{bubbles:true})) }"""); pg.wait_for_timeout(300)
check("the slider sets the volume", all(v == 40 for _, v in vst()) and prop("volume") == 40, str(vst()))
pg.screenshot(path="/tmp/ndui_shots/s42a.png")
# the prompt asks the bridge for the frames and the sound
n0 = len(prompts())
J("document.querySelector('.ndk-uimode .ndk-gen .run').click()"); pg.wait_for_timeout(1200)
ps = prompts(); last = ps[-1] if len(ps) > n0 else {}
node = next((v for v in (last.get("prompt") or {}).values() if v.get("class_type") == "NDUILiveBridge"), {})
check("the prompt marks the bridge: live and live audio (asked by the Video Player too)", node.get("_meta", {}).get("ndui_live") is True and node.get("_meta", {}).get("ndui_live_audio") is True, str(node.get("_meta")))
# the eye hides the layer
J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"vp\"] .ndk-pwl-tools .eye').click()"); pg.wait_for_timeout(500)
check("the eye hides the live layer of the Video Player", not shown(vp(".ndk-pwl")) and sum(clips()) == 0)
J("document.querySelector('.ndk-uimode .ndk-w[data-id=\"vp\"] .ndk-pwl-tools .eye').click()"); pg.wait_for_timeout(500)
# the run ends: the layer goes (there is no result), the player waits for a video
ws({"type": "execution_success", "data": {"prompt_id": "p1"}}); ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 0}}}}); pg.wait_for_timeout(600)
check("after the run the last frame stays while there is no video", shown(vp(".ndk-pwl")))
# the video of a node comes: the layer steps aside for the result
ws({"type": "executed", "data": {"node": "20", "display_node": "20", "prompt_id": "p1", "output": {"gifs": [{"filename": "a.mp4", "subfolder": "", "type": "output"}]}}}); pg.wait_for_timeout(700)
check("when the video is there the live layer is gone", not shown(vp(".ndk-pwl")), str(rect(vp(".ndk-pwl"))))
pg.screenshot(path="/tmp/ndui_shots/s42.png")
finish(p, br, errs)
