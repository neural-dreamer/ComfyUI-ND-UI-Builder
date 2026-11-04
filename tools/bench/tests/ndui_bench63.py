# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 63: the node ND UI Live Preview: one input (the `live` pin of an ND UI Live Bridge), the live frames in the node, the speaker, the eye.
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const b = LG.createNode('NDUILiveBridge'); b.pos=[60,60]; a.graph.add(b);
  const v = LG.createNode('NDUILivePreview'); v.pos=[500,60]; a.graph.add(v);
  window.__b = b; window.__v = v; a.graph.setDirtyCanvas(true,true); }""")
pg.wait_for_timeout(900)
info = J("()=>({outs:window.__b.outputs.map(o=>[o.name,o.type]), ins:window.__v.inputs.map(i=>[i.name,i.type]), widgets:(window.__v.widgets||[]).map(w=>w.name), outsV:(window.__v.outputs||[]).length})")
check("the bridge has the second output `live` (NDUI_LIVE)", info["outs"] == [["model", "MODEL"], ["live", "NDUI_LIVE"]], str(info))
check("the preview node has one input `live` and no outputs", info["ins"] == [["live", "NDUI_LIVE"]] and info["outsV"] == 0, str(info))
check("its only widget is the picture (no parameters)", info["widgets"] == ["nd_live_preview"], str(info))
hint = lambda: J("()=>{const h=document.querySelector('.ndk-lpn-hint'); return h? [h.textContent, getComputedStyle(h).display]:null}")
check("not wired: the hint asks for the live pin", hint() and hint()[0] == "Connect the live pin of an ND UI Live Bridge" and hint()[1] != "none", str(hint()))
J("()=>{window.__b.connect(1, window.__v, 0); window.LiteGraph.__x=1}"); pg.wait_for_timeout(700)
check("wired: the link is made and the hint says it waits", J("()=>window.__v.inputs[0].link!=null") and hint()[0] == "Waiting for the live preview", str(hint()))
# the bridge is wanted while the preview node is on the screen
w = J("""async()=>{const L=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/live_mark.js'), E=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/events.js'); const w=L.wanted(); return {has:[...w.bridges], id:E.execIdOf(window.__b)}}""")
check("the bridge is wanted (its frames are made) while the node is shown", w["id"] in w["has"], str(w))
bid = str(J("window.__b.id"))
ws({"type": "execution_start", "data": {"prompt_id": "pp1"}}); pg.wait_for_timeout(300)
ws({"type": "ndui_live_frame", "data": {"bridge": bid, "sampler": "7", "prompt_id": "pp1", "step": 3, "steps": 20, "kind": "image", "mime": "image/png", "url": PNG, "fps": 0, "audio": False}}); pg.wait_for_timeout(700)
sh = J("()=>{const i=document.querySelector('.ndk-lpn img.ndk-vw-live'); const l=document.querySelector('.ndk-lpn .ndk-pwl'); const h=document.querySelector('.ndk-lpn-hint'); return {img:!!i&&getComputedStyle(i).display!=='none'&&i.dataset.src.startsWith('data:image/png'), layer:getComputedStyle(l).display, hint:getComputedStyle(h).display, badge:getComputedStyle(document.querySelector('.ndk-lpn .ndk-live-badge')).display}}")
check("a live frame of the bridge is shown in the node, with the LIVE badge", sh["img"] and sh["layer"] != "none" and sh["hint"] == "none" and sh["badge"] != "none", str(sh))
# the speaker and the volume exist only with an audio VAE on the bridge
nosnd = J("()=>[...document.querySelectorAll('.ndk-lpn .ndk-vw-tools button')].map(b=>b.className)")
check("no audio VAE on the bridge: no speaker, no volume, only the eye", not any("snd" in b for b in nosnd) and any("eye" in b for b in nosnd) and not J("()=>!!document.querySelector('.ndk-lpn .ndk-vw-vol')"), str(nosnd))
J("""async()=>{const LG=window.LiteGraph, a=(await import('/scripts/app.js')).app; const v=LG.createNode('VAELoader'); v.pos=[60,420]; a.graph.add(v); const b=window.__b; const i=b.inputs.findIndex(x=>x.name==='audio_vae'); v.connect(0,b,i); }"""); pg.wait_for_timeout(900)
# the speaker and the eye
btns = J("()=>[...document.querySelectorAll('.ndk-lpn .ndk-vw-tools button')].map(b=>b.className+':'+b.title)")
check("the buttons: the speaker and the eye", any("snd" in b for b in btns) and any("eye" in b for b in btns), str(btns))
J("()=>document.querySelector('.ndk-lpn .ndk-vw-tools button.snd').click()"); pg.wait_for_timeout(400)
props = J("()=>window.__v.properties")
check("the speaker turns the sound on (kept in the node)", props.get("sound") is True, str(props))
check("the volume slider appears with the sound", J("()=>!!document.querySelector('.ndk-lpn .ndk-vw-vol')"))
J("()=>{const v=document.querySelector('.ndk-lpn .ndk-vw-vol'); v.value='35'; v.dispatchEvent(new Event('input'))}"); pg.wait_for_timeout(300)
check("the volume is kept in the node", J("()=>window.__v.properties.volume") == 35)
ser = J("()=>window.__v.serialize().properties")
check("the settings are saved with the workflow", ser.get("sound") is True and ser.get("volume") == 35, str(ser))
J("()=>document.querySelector('.ndk-lpn .ndk-vw-tools button.eye').click()"); pg.wait_for_timeout(500)
w2 = J("""async()=>{const L=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/live_mark.js'); return [...L.wanted().bridges]}""")
check("the eye closed: the bridge is not asked for frames any more", w2 == [], str(w2))
# the prompt carries the mark
J("()=>document.querySelector('.ndk-lpn .ndk-vw-tools button.eye').click()"); pg.wait_for_timeout(300)
J("async()=>{const m=await import('/scripts/app.js'); await m.app.queuePrompt(0,1)}"); pg.wait_for_timeout(600)
pr = prompts()[-1]; out = pr.get("prompt") or pr.get("output") or pr
cls = {k: v.get("class_type") for k, v in out.items()} if isinstance(out, dict) else {}
mk = [v.get("_meta", {}).get("ndui_live") for v in out.values() if v.get("class_type") == "NDUILiveBridge"] if isinstance(out, dict) else []
check("the prompt has the preview node and the bridge is marked live", "NDUILivePreview" in cls.values() and mk == [True], str((cls, mk)))
# removing the node frees the viewer record
J("()=>{window.__app = null; const a=window.__v.graph; a.remove(window.__v)}"); pg.wait_for_timeout(500)
w3 = J("""async()=>{const L=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/live_mark.js'); return [...L.wanted().bridges]}""")
check("a removed node asks for nothing", w3 == [], str(w3))
pg.wait_for_timeout(300)
finish(p, br, errs)
