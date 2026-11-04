# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 35 (LoRA task): the LoRA widget with Neural Dreamer Nodes 1.3.0 (video previews hover/always, NSFW blur + eye + shield, limits of the sliders, arrows)
# and without it (pictures only, no marks), the hint when the node has no `stack` widget, the LoRA Picker unchanged.
import json, urllib.request
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
def post(path, body):
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode(), method="POST"); return json.load(urllib.request.urlopen(r))
post("/bench/nd_loras", {"on": True, "reset": True})
J("async()=>{ window.__app = (await import('/scripts/app.js')).app; try { for (const k of ['nd-nsfw-show','ndui-fav:loras','ndui-recent:loras','ndui-gallery:loras']) localStorage.removeItem(k); } catch {} }")
J("""async () => { const a = window.__app, LG = window.LiteGraph; a.graph.clear();
  const n = LG.createNode('NDLoraStack'); n.pos = [80, 80]; n.title = 'Stack [loras]'; a.graph.add(n); n.properties.nd_ui_src = {uid:'ls', tag:'loras'};
  const l = LG.createNode('LoraLoader'); l.pos = [80, 500]; l.title = 'One [one]'; a.graph.add(l); l.properties.nd_ui_src = {uid:'ol', tag:'one'}; }""")
pg.wait_for_timeout(1000)
STK = "(()=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); return JSON.parse(n.widgets.find(w=>w.name==='stack').value)})()"
E = lambda name, sm=1, sc=None: {"name": name, "on": True, "sm": sm, "sc": sm if sc is None else sc, "link": sc is None, "words": []}
SET = lambda lst: J("(s)=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); n.widgets.find(w=>w.name==='stack').value=s; window.__app.graph.setDirtyCanvas(true,true)}", json.dumps(lst))
def W(id, t, x, y, w, h, slots=None, props=None): return {"id": id, "type": t, "page": "p1", "x": x, "y": y, "w": w, "h": h, "z": 1, "slots": slots or {}, "props": props or {}}
SRC = [{"uid": "ls", "tag": "loras", "class": "NDLoraStack", "title": "Stack"}, {"uid": "ol", "tag": "one", "class": "LoraLoader", "title": "One"}]
node_slot = {"node": {"src": "ls", "kind": "lorastack", "name": ""}}
def use(props=None, wait=1200):
    ws = [W("l", "lora", 20, 20, 520, 560, node_slot, dict({"label": "LoRAs"}, **(props or {}))),
          W("lp", "lorapicker", 600, 20, 380, 150, {"lora_name": {"src": "ol", "kind": "widget", "name": "lora_name"}, "strength_model": {"src": "ol", "kind": "widget", "name": "strength_model"}, "strength_clip": {"src": "ol", "kind": "widget", "name": "strength_clip"}})]
    J("(m) => window.ndUi.host().save(JSON.parse(m))", json.dumps({"sources": SRC, "pages": [{"id": "p1", "name": "Main"}], "theme": {"id": "midnight"}, "widgets": ws}))
    pg.wait_for_timeout(wait)
J("window.ndUi.enter()"); pg.wait_for_timeout(500)
SET([E("style_neon.safetensors"), E("style_anime.safetensors", 0.5)])
use()
M = ".ndk-uimode "
cards = lambda: J("document.querySelectorAll('%s.ndk-lora .ndk-lr-card').length" % M)
check("the widget shows two cards of the stack", cards() == 2, str(cards()))

# ---- video previews (with Nodes)
check("the video card has a muted looping video that has not started", J("(()=>{const v=document.querySelector('%s.ndk-lr-card video'); return !!v && v.muted && v.loop && v.paused})()" % M))
check("it has its source (the first frame)", (J("document.querySelector('%s.ndk-lr-card video').getAttribute('src')" % M) or "").endswith("#t=0.001"))
card = M + ".ndk-lr-card:nth-child(2)"
pg.hover(card); pg.wait_for_timeout(900)
check("hover: it plays", J("!document.querySelector('%s.ndk-lr-card video').paused" % M))
pg.mouse.move(5, 5); pg.wait_for_timeout(500)
check("the pointer leaves: it stops at the first frame", J("(()=>{const v=document.querySelector('%s.ndk-lr-card video'); return v.paused && v.currentTime===0})()" % M))
use({"play": "always"}, 1800)
check("«always»: it plays without the pointer", J("!document.querySelector('%s.ndk-lr-card video').paused" % M))
check("and it is muted still", J("document.querySelector('%s.ndk-lr-card video').muted" % M))
use({"play": "hover"})
check("«hover»: it does not play", J("document.querySelector('%s.ndk-lr-card video').paused" % M))

# ---- NSFW (with Nodes): the shield menu, the eye, the blur of tiles
check("the eye is on the bar", J("!!document.querySelector('%s.ndk-lr-eye')" % M))
neon = M + ".ndk-lr-card:nth-child(1)"
J("document.querySelector(\"%s .ndk-lr-shield\").click()" % neon); pg.wait_for_timeout(300)
check("the shield opens a menu of three", J("document.querySelectorAll('.ndk-nsfw-menu .ndk-nsfw-it').length") == 3)
J("document.querySelectorAll('.ndk-nsfw-menu .ndk-nsfw-it')[0].click()"); pg.wait_for_timeout(500)
posts = json.load(urllib.request.urlopen(URL + "/bench/nd_loras/posts"))
check("the mark goes to the server", posts and posts[-1].get("name") == "style_neon.safetensors" and posts[-1].get("nsfw") is True, str(posts))
check("the tile is marked NSFW and its shield is lit", J("document.querySelector('%s .ndk-lmedia').classList.contains('nsfw') && document.querySelector('%s .ndk-lr-shield').classList.contains('on')" % (neon, neon)))
J("document.querySelector('%s.ndk-lr-eye').click()" % M); pg.wait_for_timeout(300)
check("the eye: previews are shown (the common switch)", J("document.documentElement.dataset.ndNsfw") == "show" and J("localStorage.getItem('nd-nsfw-show')") == "1")
J("document.querySelector('%s.ndk-lr-eye').click()" % M); pg.wait_for_timeout(300)
check("the eye again: blurred", J("document.documentElement.dataset.ndNsfw") == "hide" and "blur" in J("(()=>{ const box=document.createElement('div'); box.className='ndk-lmedia nsfw'; const im=document.createElement('img'); im.className='ndk-mi'; box.append(im); document.body.append(box); const f=getComputedStyle(im).filter; box.remove(); return f })()"))   # a probe tile: the real tile may have lost its picture (the mock preview fails to load at times)
J("document.querySelector(\"%s .ndk-lr-shield\").click()" % neon); pg.wait_for_timeout(300)
J("document.querySelectorAll('.ndk-nsfw-menu .ndk-nsfw-it')[2].click()"); pg.wait_for_timeout(500)
check("«back to automatic» sends null", json.load(urllib.request.urlopen(URL + "/bench/nd_loras/posts"))[-1].get("nsfw") is None)

# ---- the gallery of the widget: the shield menu lies whole inside the window of the gallery
J("document.querySelector('%s.ndk-lr-add').click()" % M); pg.wait_for_selector(".ndk-lg .ndk-lg-card .ndk-nsfw-shield", state="attached", timeout=10000); pg.wait_for_timeout(500)
J("()=>{const c=document.querySelectorAll('.ndk-lg .ndk-lg-card')[0]; c.querySelector('.ndk-nsfw-shield').click()}"); pg.wait_for_timeout(300)
sz = J("(()=>{const b=document.querySelector('.ndk-pop.ndk-lg').getBoundingClientRect(), c=document.querySelector('.ndk-lg .ndk-lg-card').getBoundingClientRect(); return [b.width, b.height, c.width, c.height, b.left+b.width/2, innerWidth/2]})()")
check("gallery: the window is big (as in the node) and centred", sz[0] >= 1000 and sz[1] >= 800 and abs(sz[4] - sz[5]) < 3, str(sz))
check("gallery: the tiles are not small and portrait", sz[2] >= 160 and sz[3] > sz[2] * 1.1, str(sz))
ok = J("(()=>{const m=document.querySelector('.ndk-pop .ndk-nsfw-menu'); if(!m) return null; const r=m.getBoundingClientRect(), b=document.querySelector('.ndk-pop').getBoundingClientRect(); return [r.left>=b.left, r.right<=b.right, r.top>=b.top, r.bottom<=b.bottom, r.width>100]})()")
check("gallery: the NSFW menu is whole inside the window of the gallery", ok is not None and all(ok), str(ok))
pg.keyboard.press("Escape"); pg.wait_for_timeout(400)

# ---- limits and arrows
SET([E("style_neon.safetensors", 1.0, 0.5)]); use({"rmin": -0.5, "rmax": 2.5}, 1400)
rg = J("[...document.querySelectorAll('%s.ndk-lr-card input[type=range]')].map(r=>[+r.min,+r.max])" % M)
check("the sliders take the limits of the widget (model and CLIP)", rg == [[-0.5, 2.5], [-0.5, 2.5]], str(rg))
num = M + ".ndk-lr-card .ndk-lr-str:nth-child(1) .ndk-lr-num"
pg.fill(M + ".ndk-lr-card .ndk-lr-body .ndk-lr-str:first-child .ndk-lr-num", "4.2"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
e = J(STK)[0]
check("a typed number is never limited (4.2 stays 4.2)", abs(e["sm"] - 4.2) < 1e-6, str(e))
check("the slider is pegged at its maximum", J("+document.querySelector('%s.ndk-lr-card input[type=range]').value" % M) <= 2.5 + 1e-6)
SET([E("style_neon.safetensors", 1.0, 0.5)]); use({"rmin": -0.5, "rmax": 2.5}, 1200)
arr = M + ".ndk-lr-card .ndk-lr-body .ndk-lr-str:first-child .ndk-lr-arr"
check("arrows are there (two per slider)", J("document.querySelectorAll('%s.ndk-lr-card .ndk-lr-arr').length" % M) == 4)
box = pg.locator(arr).nth(1).bounding_box()
pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(300)
check("▶ adds 0.05", abs(J(STK)[0]["sm"] - 1.05) < 1e-6, str(J(STK)))
pg.keyboard.down("Shift"); pg.mouse.down(); pg.mouse.up(); pg.keyboard.up("Shift"); pg.wait_for_timeout(300)
check("Shift+▶ adds 0.25", abs(J(STK)[0]["sm"] - 1.30) < 1e-6, str(J(STK)))
box = pg.locator(arr).nth(0).bounding_box()
pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(300)
check("◀ takes 0.05 away", abs(J(STK)[0]["sm"] - 1.25) < 1e-6, str(J(STK)))
pg.mouse.down(); pg.wait_for_timeout(1100); pg.mouse.up(); pg.wait_for_timeout(300)
check("holding the arrow repeats", J(STK)[0]["sm"] < 1.0, str(J(STK)))
use({"arrows": False}, 1200)
check("«arrows» off: no arrows", J("document.querySelectorAll('%s.ndk-lr-card .ndk-lr-arr').length" % M) == 0)

# ---- the LoRA Picker is unchanged: no arrows
check("the LoRA Picker has no arrows", J("document.querySelectorAll('%s.ndk-lp .ndk-lr-arr').length" % M) == 0)

# ---- no Nodes catalog: pictures only, no marks, no eye
post("/bench/nd_loras", {"on": False}); SET([E("style_neon.safetensors"), E("style_anime.safetensors")])
J("window.ndUi.exit()"); pg.reload(); pg.wait_for_timeout(2500)
J("async()=>{ window.__app = (await import('/scripts/app.js')).app }")
J("window.ndUi.enter()"); pg.wait_for_timeout(1200)
check("without the pack's catalog: no shield, no eye, no video", J("document.querySelectorAll('%s.ndk-lr-shield, %s.ndk-lr-eye, %s.ndk-lr-card video').length" % (M, M, M)) == 0)
post("/bench/nd_loras", {"on": True})

# ---- the node has no `stack` widget (an old pack): a hint, no crash
J("""()=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); n.widgets=n.widgets.filter(w=>w.name!=='stack'); window.__app.graph.setDirtyCanvas(true,true)}"""); pg.wait_for_timeout(1000)
J("(m)=>window.ndUi.host().save(JSON.parse(m))", json.dumps({"sources": SRC, "pages": [{"id": "p1", "name": "Main"}], "theme": {"id": "midnight"}, "widgets": [W("l", "lora", 20, 20, 520, 300, node_slot)]})); pg.wait_for_timeout(1000)
check("a hint to install Neural Dreamer Nodes 1.3.0", "Neural Dreamer Nodes" in J("document.querySelector('%s.ndk-lora').innerText" % M))
finish(p, br, errs)
