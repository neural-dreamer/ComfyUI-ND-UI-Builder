# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 41: the live preview with video and sound — a clip in the Viewer (two players), the sound button, the volume, the mark in the prompt.
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
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const k = mk('KSampler',60,380,'Sampler [sampler]'), b = mk('NDUILiveBridge',60,700,'Bridge [bridge]');
  const u = mk('NDUI',480,60); u.size=[900,500]; b.properties.nd_ui_src={uid:'sb',tag:'bridge'};
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'sb',tag:'bridge',class:'NDUILiveBridge',title:'Bridge [bridge]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('v1','viewer',10,10,420,320,{live:{src:'sb',kind:'live',name:''}},{live:true,results:false,compare:false,progress:'line',thumbs:'off'}),
            W('g','generate',450,10,300,64,{},{})]};
  u.ndUiApi.reload(); return {b:b.id}; }""")
pg.wait_for_timeout(1000)
Bn = str(ids["b"])
vis = lambda: J("[...document.querySelectorAll('.ndk-viewer video.ndk-vw-live')].map(v=>v.style.display!=='none')")
vsrc = lambda: J("[...document.querySelectorAll('.ndk-viewer video.ndk-vw-live')].map(v=>v.src.slice(0,30))")
img = lambda: J("(()=>{const e=document.querySelector('.ndk-viewer img.ndk-vw-live'); return e && e.style.display!=='none' ? e.src.slice(0,22) : ''})()")
ws({"type": "execution_start", "data": {"prompt_id": "p1"}})
check("two players and no clip at the start", J("document.querySelectorAll('.ndk-viewer video.ndk-vw-live').length") == 2 and vis() == [False, False])
# a picture frame still goes to the picture
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 1, "steps": 20, "kind": "image", "mime": "image/jpeg", "url": "data:image/png;base64," + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "fps": 0, "audio": False}})
pg.wait_for_timeout(500)
check("a picture frame shows in the picture, not in a player", img().startswith("data:image/png") and vis() == [False, False], f"{img()} {vis()}")
# an animated WebP goes to the picture too
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 2, "steps": 20, "kind": "video", "mime": "image/webp", "url": "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "fps": 12, "audio": False}})
pg.wait_for_timeout(500)
check("an animated WebP plays in the picture", img().startswith("data:image/webp") and vis() == [False, False], f"{img()} {vis()}")
# a clip goes to a player
c1, c2 = webm((30, 60, 200)), webm((200, 60, 30))
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 3, "steps": 20, "kind": "video", "mime": "video/webm", "url": c1, "fps": 10, "audio": True}})
pg.wait_for_timeout(1500)
check("a clip shows in a player and the picture steps aside", sum(vis()) == 1 and img() == "", f"{vis()} {img()}")
f1 = vis().index(True)
check("the player loops, starts muted", J("(i)=>{const v=document.querySelectorAll('.ndk-viewer video.ndk-vw-live')[i]; return v.loop && v.muted}", f1))
# a new clip takes over in the other player
ws({"type": "ndui_live_frame", "data": {"bridge": Bn, "sampler": "7", "prompt_id": "p1", "step": 5, "steps": 20, "kind": "video", "mime": "video/webm", "url": c2, "fps": 10, "audio": True}})
pg.wait_for_timeout(1500)
check("the next clip comes in the other player (no blink: one is always shown)", sum(vis()) == 1 and vis().index(True) != f1, str(vis()))
# the sound button and the volume
snd = lambda: J("(()=>{const w=window.__app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui.widgets.find(w=>w.id==='v1'); return [w.props.sound===true, w.props.volume]})()")
vstate = lambda: J("[...document.querySelectorAll('.ndk-viewer video.ndk-vw-live')].map(v=>[v.muted, Math.round(v.volume*100)])")
check("the sound is off by default", snd()[0] is False and all(m for m, _ in vstate()), f"{snd()} {vstate()}")
check("no volume slider while the sound is off", J("!document.querySelector('.ndk-vw-vol')"))
J("document.querySelector('.ndk-viewer .ndk-vw-tools .snd').click()"); pg.wait_for_timeout(500)
check("the speaker button turns the sound on (saved in the widget)", snd()[0] is True and all(not m for m, _ in vstate()), f"{snd()} {vstate()}")
check("the volume slider appears at 70", J("document.querySelector('.ndk-vw-vol')?.value") == "70" and all(v == 70 for _, v in vstate()), str(vstate()))
J("""()=>{ const s=document.querySelector('.ndk-vw-vol'); s.value='35'; s.dispatchEvent(new Event('input',{bubbles:true})) }"""); pg.wait_for_timeout(300)
check("the slider sets the volume of the players and the widget", all(v == 35 for _, v in vstate()) and snd()[1] == 35, f"{vstate()} {snd()}")
J("""()=>{ const s=document.querySelector('.ndk-vw-vol'); s.value='0'; s.dispatchEvent(new Event('input',{bubbles:true})) }"""); pg.wait_for_timeout(300)
check("volume 0 works", all(v == 0 for _, v in vstate()))
# the prompt mark: sound on -> the bridge asks for the sound
J("""()=>{ const s=document.querySelector('.ndk-vw-vol'); s.value='70'; s.dispatchEvent(new Event('input',{bubbles:true})) }""")
n0 = len(prompts())
J("document.querySelector('.ndk-w .ndk-gen .run, .ndk-gen .run').click()"); pg.wait_for_timeout(1200)
ps = prompts(); last = ps[-1] if len(ps) > n0 else {}
node = next((v for v in (last.get("prompt") or {}).values() if v.get("class_type") == "NDUILiveBridge"), {})
check("with the sound on the prompt says: live and live audio", node.get("_meta", {}).get("ndui_live") is True and node.get("_meta", {}).get("ndui_live_audio") is True, str(node.get("_meta")))
J("document.querySelector('.ndk-viewer .ndk-vw-tools .snd').click()"); pg.wait_for_timeout(400)
check("the speaker button turns it off again", snd()[0] is False and all(m for m, _ in vstate()))
n1 = len(prompts())
J("document.querySelector('.ndk-gen .run').click()"); pg.wait_for_timeout(1200)
ps = prompts(); last = ps[-1] if len(ps) > n1 else {}
node = next((v for v in (last.get("prompt") or {}).values() if v.get("class_type") == "NDUILiveBridge"), {})
check("with the sound off: live yes, the sound is still made (live audio yes)", node.get("_meta", {}).get("ndui_live") is True and node.get("_meta", {}).get("ndui_live_audio") is True, str(node.get("_meta")))
# the eye hides the clip
J("document.querySelector('.ndk-viewer .ndk-vw-tools .eye').click()"); pg.wait_for_timeout(500)
check("the eye hides the clip and stops the players", vis() == [False, False])
# the run ends
J("document.querySelector('.ndk-viewer .ndk-vw-tools .eye').click()"); pg.wait_for_timeout(300)
ws({"type": "execution_success", "data": {"prompt_id": "p1"}}); pg.wait_for_timeout(500)
check("after the run the last clip stays but stops (no sound after the work)", sum(vis()) == 1 and J("[...document.querySelectorAll('.ndk-viewer video.ndk-vw-live')].every(v=>v.paused)"), str(vis()))
finish(p, br, errs)
