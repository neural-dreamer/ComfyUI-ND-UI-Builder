# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 34 (LoRA task, Neural Dreamer Nodes 1.3.0): the ND LoRA Stack node with its own list — video previews on hover, the NSFW blur and marks, the arrows of the strength.
import json, urllib.request
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
def post(path, body):
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode(), method="POST"); return json.load(urllib.request.urlopen(r))
def get(path): return json.load(urllib.request.urlopen(URL + path))
post("/bench/nd_loras", {"on": True, "reset": True})
J("async()=>{ window.__app = (await import('/scripts/app.js')).app; try { localStorage.removeItem('nd-nsfw-show'); localStorage.removeItem('ndui-fav:loras'); localStorage.removeItem('ndui-recent:loras'); localStorage.removeItem('ndui-gallery:loras'); } catch {} }")
J("""async () => { const a = window.__app; const LG = window.LiteGraph; a.graph.clear();
  const n = LG.createNode('NDLoraStack'); n.pos = [80, 80]; n.title = 'Stack'; a.graph.add(n); a.graph.setDirtyCanvas(true, true); }""")
pg.wait_for_timeout(1200)
STK = "(()=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); return JSON.parse(n.widgets.find(w=>w.name==='stack').value)})()"
SET = lambda lst: J("""(s)=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); n.widgets.find(w=>w.name==='stack').value=s; window.__app.graph.setDirtyCanvas(true,true)}""", json.dumps(lst))
E = lambda name, sm=1, on=True, link=True, words=None: {"name": name, "on": on, "sm": sm, "sc": sm, "link": link, "words": words or []}

# ---- the node
check("the node is created", J("window.__app.graph._nodes.some(n=>n.type==='NDLoraStack')"))
check("the technical text widget `stack` is hidden", J("""(()=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); const w=n.widgets.find(w=>w.name==='stack'); return !!w.nd_hidden && w.computeSize()[1] < 0})()"""))
check("the list of the pack is drawn inside the node (one)", J("document.querySelectorAll('.nd-lr-node .nd-lr-root').length") == 1)
check("no list of another pack on the node", J("document.querySelectorAll('.ndk-lr-node').length") == 0)
check("empty at the start, the stack is []", J(STK) == [] and "No LoRAs" in J("document.querySelector('.nd-lr-node').innerText"))
check("the bar: + LoRA and the eye", J("!!document.querySelector('.nd-lr-node .nd-lr-add') && !!document.querySelector('.nd-lr-node .nd-lr-eye')"))

# ---- the gallery
J("document.querySelector('.nd-lr-node .nd-lr-add').click()"); pg.wait_for_timeout(900)
check("+ LoRA opens the gallery", J("!!document.querySelector('.nd-lr-modal')"))
check("all five LoRAs are in it", J("document.querySelectorAll('.nd-lr-modal .nd-lr-card').length") == 5, str(J("document.querySelectorAll('.nd-lr-modal .nd-lr-card').length")))
txt = J("document.querySelector('.nd-lr-modal').innerText")
check("titles and base models come from the catalog", "Neon Style" in txt and "Flux.1 D" in txt)
check("pictures for three, a video for one, nothing for the one without", J("document.querySelectorAll('.nd-lr-card img.nd-lr-mi').length") == 3 and J("document.querySelectorAll('.nd-lr-card video.nd-lr-mv').length") == 1 and J("document.querySelectorAll('.nd-lr-card .nd-lr-media.empty').length") == 1)
check("the video is muted, loops, and has not started", J("(()=>{const v=document.querySelector('.nd-lr-card video'); return v.muted && v.loop && v.paused})()"))
check("it got its source when it came into view (the first frame, not played)", "/nd/loras/video?name=style_anime.safetensors" in (J("document.querySelector('.nd-lr-card video').getAttribute('src')") or "") and J("document.querySelector('.nd-lr-card video').getAttribute('src')").endswith("#t=0.001"))

# many LoRAs in a short window: the rows keep their size (the pictures do not shrink to nothing)
J("document.querySelector('.nd-lr-modal').style.height='230px'"); pg.wait_for_timeout(300)
hs = J("[...document.querySelectorAll('.nd-lr-card .nd-lr-cpic')].map(c=>Math.round(c.getBoundingClientRect().height))")
check("all tiles keep the same portrait picture in a short window", len(hs) == 5 and min(hs) > 100 and max(hs) - min(hs) <= 1, str(hs))
J("document.querySelector('.nd-lr-modal').style.height=''"); pg.wait_for_timeout(200)

# NSFW: blurred until the eye is pressed
blur = lambda: J("[...document.querySelectorAll('.nd-lr-card .nd-lr-media.nsfw')].map(m=>[getComputedStyle(m.querySelector('img,video')).filter, m.closest('.nd-lr-card').title])")
b = blur()
check("two LoRAs are NSFW by their data (levels 8 and 4) and are blurred", len(b) == 2 and all("blur" in f for f, _ in b), str(b))
check("the safe ones are not blurred", J("[...document.querySelectorAll('.nd-lr-card .nd-lr-media:not(.nsfw) img, .nd-lr-card .nd-lr-media:not(.nsfw) video')].every(x=>getComputedStyle(x).filter==='none')"))
check("the NSFW tag stands on a blurred tile", J("[...document.querySelectorAll('.nd-lr-card .nd-lr-media.nsfw .nd-lr-nsfwtag')].every(t=>getComputedStyle(t).display!=='none')"))
J("document.querySelector('.nd-lr-modal .nd-lr-eye').click()"); pg.wait_for_timeout(300)
b = blur()
check("the eye shows them", all(f == "none" for f, _ in b) and J("document.documentElement.dataset.ndNsfw") == "show" and J("localStorage.getItem('nd-nsfw-show')") == "1", str(b))
check("the tag is gone and the eye is lit", J("[...document.querySelectorAll('.nd-lr-card .nd-lr-nsfwtag')].every(t=>getComputedStyle(t).display==='none')") and J("document.querySelector('.nd-lr-modal .nd-lr-eye').classList.contains('on')"))
check("the eye of the node follows the same switch", J("document.querySelector('.nd-lr-node .nd-lr-eye').classList.contains('on')"))
J("document.querySelector('.nd-lr-modal .nd-lr-eye').click()"); pg.wait_for_timeout(300)
check("the eye blurs them again", all("blur" in f for f, _ in blur()) and J("localStorage.getItem('nd-nsfw-show')") is None)

# the video plays only while the pointer is over its tile
card = ".nd-lr-card[title='style_anime.safetensors']"
pg.hover(card); pg.wait_for_timeout(900)
check("the video plays while the pointer is over the tile", J("!document.querySelector('.nd-lr-card video').paused"))
pg.mouse.move(5, 5); pg.wait_for_timeout(500)
check("it stops and returns to the first frame when the pointer leaves", J("(()=>{const v=document.querySelector('.nd-lr-card video'); return v.paused && v.currentTime===0})()"))

# the menu of the mark stands above its tile, whole
inside = "(()=>{const m=document.querySelector('.nd-lr-menu').getBoundingClientRect(), b=document.querySelector('.nd-lr-modal').getBoundingClientRect(); return m.left>=b.left && m.right<=b.right && m.top>=b.top && m.bottom<=b.bottom && m.width>100})()"
J("()=>{const c=[...document.querySelectorAll('.nd-lr-card')][4]; c.querySelector('.nd-lr-shield').click()}"); pg.wait_for_timeout(300)
geo = J("(()=>{const c=[...document.querySelectorAll('.nd-lr-card')][4].getBoundingClientRect(), m=document.querySelector('.nd-lr-menu').getBoundingClientRect(); return [m.bottom, c.top]})()")
check("a tile with room above gets the menu above it, and whole", geo[0] <= geo[1] + 1 and J(inside), str(geo))
pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
# the person's mark
pg.hover(".nd-lr-card[title='style_neon.safetensors']"); pg.wait_for_timeout(200)
J("document.querySelector(\".nd-lr-card[title='style_neon.safetensors'] .nd-lr-shield\").click()"); pg.wait_for_timeout(300)
check("the shield opens the menu of three", J("document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it').length") == 3 and J("document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it')[2].disabled"))
check("the menu lies whole inside the window (not cut by the tile)", J(inside))
J("document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it')[0].click()"); pg.wait_for_timeout(500)
check("«Mark as NSFW» is sent to the server", get("/bench/nd_loras/posts") == [{"name": "style_neon.safetensors", "nsfw": True}], str(get("/bench/nd_loras/posts")))
check("the tile is blurred at once, the menu is closed", J("document.querySelector(\".nd-lr-card[title='style_neon.safetensors'] .nd-lr-media\").classList.contains('nsfw')") and J("!document.querySelector('.nd-lr-menu')"))
J("document.querySelector(\".nd-lr-card[title='style_neon.safetensors'] .nd-lr-shield\").click()"); pg.wait_for_timeout(300)
check("now «Back to automatic» is open", J("!document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it')[2].disabled"))
J("document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it')[2].click()"); pg.wait_for_timeout(500)
check("back to automatic: null is sent and the blur is gone", get("/bench/nd_loras/posts")[-1] == {"name": "style_neon.safetensors", "nsfw": None} and not J("document.querySelector(\".nd-lr-card[title='style_neon.safetensors'] .nd-lr-media\").classList.contains('nsfw')"))
J("document.querySelector(\".nd-lr-card[title='characters/hero_v2.safetensors'] .nd-lr-shield\").click()"); pg.wait_for_timeout(300)
J("document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it')[1].click()"); pg.wait_for_timeout(500)
check("a LoRA that is NSFW by its data can be marked safe", not J("document.querySelector(\".nd-lr-card[title='characters/hero_v2.safetensors'] .nd-lr-media\").classList.contains('nsfw')") and get("/bench/nd_loras/posts")[-1] == {"name": "characters/hero_v2.safetensors", "nsfw": False})
# the gallery is big: the window and the tiles
sz = J("(()=>{const m=document.querySelector('.nd-lr-modal').getBoundingClientRect(), c=document.querySelector('.nd-lr-card').getBoundingClientRect(); return [m.width, m.height, c.width]})()")
check("the gallery window is big and the tiles are not small", sz[0] >= 1000 and sz[1] >= 800 and sz[2] >= 160, str(sz))
# a mark made in the gallery reaches the row of the node (one catalog for both)
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
SET([E("characters/hero_v2.safetensors")]); pg.wait_for_timeout(600)
rowmedia = "document.querySelector('.nd-lr-node .nd-lr-row .nd-lr-media')"
check("the row of the node shows the LoRA as safe after the mark", not J(rowmedia + ".classList.contains('nsfw')"))
J("document.querySelector('.nd-lr-node .nd-lr-add').click()"); pg.wait_for_timeout(900)
J("document.querySelector(\".nd-lr-card[title='characters/hero_v2.safetensors'] .nd-lr-shield\").click()"); pg.wait_for_timeout(300)
J("document.querySelectorAll('.nd-lr-menu .nd-lr-menu-it')[0].click()"); pg.wait_for_timeout(600)
pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
check("marked as NSFW in the gallery: the row follows at once", J(rowmedia + ".classList.contains('nsfw')"))
SET([]); pg.wait_for_timeout(500)
J("document.querySelector('.nd-lr-node .nd-lr-add').click()"); pg.wait_for_timeout(900)
post("/bench/nd_loras", {"on": True, "reset": True})

# search, favourites, info
J("""()=>{const i=document.querySelector('.nd-lr-modal .nd-lr-search input'); i.value='neon'; i.dispatchEvent(new Event('input',{bubbles:true}))}"""); pg.wait_for_timeout(300)
check("search by a trigger word", J("document.querySelectorAll('.nd-lr-modal .nd-lr-card').length") == 1)
J("""()=>{const i=document.querySelector('.nd-lr-modal .nd-lr-search input'); i.value=''; i.dispatchEvent(new Event('input',{bubbles:true}))}"""); pg.wait_for_timeout(300)
J("document.querySelector(\".nd-lr-card[title='style_anime.safetensors'] .nd-lr-fav\").click()"); pg.wait_for_timeout(200)
check("a favourite is kept under the shared key", "style_anime.safetensors" in J("localStorage.getItem('ndui-fav:loras')"))
J("document.querySelector(\".nd-lr-card[title='style_neon.safetensors'] .nd-lr-inf\").click()"); pg.wait_for_timeout(500)
check("the info shows trigger words and the usage tips", "neon glow" in J("document.querySelector('.nd-lr-info').innerText") and "0.6-1.0" in J("document.querySelector('.nd-lr-info').innerText"))
J("document.querySelector('.nd-lr-li-pic').click()"); pg.wait_for_timeout(400)
check("the picture can be opened large", J("!!document.querySelector('.nd-lr-big img')"))
pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
check("Esc closes only the large picture", J("!document.querySelector('.nd-lr-big')") and J("!!document.querySelector('.nd-lr-info')") and J("!!document.querySelector('.nd-lr-modal')"))
J("document.querySelector('.nd-lr-info-bar button').click()"); pg.wait_for_timeout(250)
check("«Back» returns to the tiles", J("!document.querySelector('.nd-lr-info')"))

# pick
J("document.querySelector(\".nd-lr-card[title='style_neon.safetensors']\").click()"); pg.wait_for_timeout(600)
st = J(STK)
check("a pick closes the gallery and adds the LoRA with its trigger words", J("!document.querySelector('.nd-lr-modal')") and len(st) == 1 and st[0]["name"] == "style_neon.safetensors" and st[0]["sm"] == 1 and st[0]["words"] == ["neon glow", "cyberpunk"], str(st))
check("the row shows the title and the strength", "Neon Style" in J("document.querySelector('.nd-lr-row').innerText") and J("document.querySelector('.nd-lr-row .nd-lr-num').value") == "1")
check("the pick is in «recent»", "style_neon.safetensors" in J("localStorage.getItem('ndui-recent:loras')"))

# ---- the arrows
sm = lambda: J(STK)[0]["sm"]
more, less, num = ".nd-lr-row .nd-lr-str .nd-lr-arr:last-of-type", ".nd-lr-row .nd-lr-str .nd-lr-arr:first-of-type", ".nd-lr-row .nd-lr-num"
pg.click(more); pg.wait_for_timeout(200)
check("► adds 0.05", abs(sm() - 1.05) < 1e-9 and J(f"document.querySelector('{num}').value") == "1.05", str(sm()))
pg.click(less); pg.wait_for_timeout(100); pg.click(less); pg.wait_for_timeout(200)
check("◄ takes 0.05", abs(sm() - 0.95) < 1e-9, str(sm()))
pg.click(more, modifiers=["Shift"]); pg.wait_for_timeout(200)
check("with Shift the step is 0.25", abs(sm() - 1.2) < 1e-9, str(sm()))
check("the CLIP strength follows the model one while they are linked", J(STK)[0]["sc"] == sm())
pg.hover(more); pg.mouse.down(); pg.wait_for_timeout(1500); pg.mouse.up(); pg.wait_for_timeout(200)
after = sm()
check("holding an arrow repeats the step", after > 1.2 + 0.3, str(after))
for v, want in (("3.7", 3.7), ("15", 15.0), ("-4,5", -4.5), ("0.33", 0.33)):
    J(f"""()=>{{const i=document.querySelector('{num}'); i.value='{v}'; i.dispatchEvent(new Event('change',{{bubbles:true}}))}}"""); pg.wait_for_timeout(150)
    check(f"a typed {v} is taken as it is (never limited)", abs(sm() - want) < 1e-9, str(sm()))
pg.click(more); pg.wait_for_timeout(150)
check("an arrow after a typed number goes to the grid of 0.05", abs(sm() - 0.4) < 1e-9, str(sm()))
J(f"""()=>{{const i=document.querySelector('{num}'); i.value='abc'; i.dispatchEvent(new Event('change',{{bubbles:true}}))}}"""); pg.wait_for_timeout(150)
check("a wrong text is rejected and the number is restored", abs(sm() - 0.4) < 1e-9 and J(f"document.querySelector('{num}').value") == "0.4")

# ---- rows: switch, order, delete, outside changes, missing file
SET([E("style_neon.safetensors", 0.8, words=["neon glow"]), E("style_anime.safetensors", 0.5), E("zzz_missing.safetensors", 1)]); pg.wait_for_timeout(900)
check("a change made elsewhere (the widget of Builder) is shown within a moment", J("document.querySelectorAll('.nd-lr-row').length") == 3)
check("a missing file is marked", J("document.querySelectorAll('.nd-lr-row.miss').length") == 1 and "File not found" in J("document.querySelector('.nd-lr-row.miss').innerText"))
check("the video of the row is there", J("document.querySelectorAll('.nd-lr-row video').length") == 1)
pg.hover(".nd-lr-row:nth-child(2)"); pg.wait_for_timeout(900)
check("it plays while the pointer is over the row", J("!document.querySelector('.nd-lr-row video').paused"))
pg.mouse.move(5, 5); pg.wait_for_timeout(400)
check("it stops after the pointer leaves", J("document.querySelector('.nd-lr-row video').paused"))
J("document.querySelectorAll('.nd-lr-row .nd-lr-sw')[0].click()"); pg.wait_for_timeout(300)
check("the switch turns a LoRA off and its strength is dimmed", J(STK)[0]["on"] is False and J("document.querySelector('.nd-lr-row .nd-lr-str').classList.contains('off')"))
J("document.querySelectorAll('.nd-lr-row .nd-lr-del')[2].click()"); pg.wait_for_timeout(300)
check("the cross removes the LoRA", [e["name"] for e in J(STK)] == ["style_neon.safetensors", "style_anime.safetensors"])
# order by dragging the grip
J("""()=>{const rows=document.querySelectorAll('.nd-lr-row'); const dt=new DataTransfer(); const g=rows[0].querySelector('.nd-lr-grip');
  g.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt})); const r=rows[1].getBoundingClientRect();
  rows[1].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:r.bottom-2})); rows[1].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:r.bottom-2}));}"""); pg.wait_for_timeout(300)
check("dragging the grip changes the order", [e["name"] for e in J(STK)] == ["style_anime.safetensors", "style_neon.safetensors"], str(J(STK)))

# ---- the workflow
pr = J("async()=>{const p=await window.__app.graphToPrompt(); const n=Object.values(p.output).find(o=>o.class_type==='NDLoraStack'); return n?n.inputs.stack:null}")
check("the list goes into the prompt as the text of `stack`", isinstance(pr, str) and len(json.loads(pr)) == 2)
J("""async()=>{const a=window.__app; window.__saved=JSON.stringify(a.graph.serialize()); a.graph.clear(); await a.loadGraphData(JSON.parse(window.__saved));}"""); pg.wait_for_timeout(1500)
check("after loading the workflow the list is back, one view, the widget still hidden", len(J(STK)) == 2 and J("document.querySelectorAll('.nd-lr-node .nd-lr-root').length") == 1 and J("window.__app.graph._nodes.find(n=>n.type==='NDLoraStack').widgets.find(w=>w.name==='stack').nd_hidden") is True and J("document.querySelectorAll('.nd-lr-row').length") == 2)
check("no input socket is left for the hidden widget", J("(window.__app.graph._nodes.find(n=>n.type==='NDLoraStack').inputs||[]).every(i=>i.name!=='stack')"))

# ---- Nodes not up to date / no catalog: the node still works
post("/bench/nd_loras", {"on": False})
J("window.__app.graph._nodes.find(n=>n.type==='NDLoraStack').ndLoraApi.view.refresh()"); pg.wait_for_timeout(700)
check("without the catalog the rows are still there and nothing breaks", J("document.querySelectorAll('.nd-lr-row').length") == 2)
# ---- language (the common one of the builders)
J("()=>{localStorage.setItem('nd-builder-lang','ru'); window.dispatchEvent(new CustomEvent('nd-lang-change',{detail:{lang:'ru'}}))}"); pg.wait_for_timeout(900)
check("the list speaks Russian", "Включено" in J("document.querySelector('.nd-lr-node .nd-lr-count').innerText") and "размыты" in J("document.querySelector('.nd-lr-node .nd-lr-eye').title"))
J("document.querySelector('.nd-lr-node .nd-lr-add').click()"); pg.wait_for_timeout(900)
check("the gallery speaks Russian", "Добавить LoRA" in J("document.querySelector('.nd-lr-modal').innerText") and "Все папки" in J("document.querySelector('.nd-lr-modal .nd-lr-sel').options[0].text"))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("Esc closes the gallery", J("!document.querySelector('.nd-lr-modal')"))
J("()=>{localStorage.removeItem('nd-builder-lang'); window.dispatchEvent(new CustomEvent('nd-lang-change',{detail:{lang:'en'}}))}"); pg.wait_for_timeout(500)
post("/bench/nd_loras", {"on": True})
# the language: English by itself; the language of the interface pack (here: Russian) when that pack is installed
SET([E("style_neon.safetensors")]); pg.wait_for_timeout(600)
cnt = lambda: J("document.querySelector('.nd-lr-node .nd-lr-count').innerText")
J("()=>{ try { localStorage.setItem('nd-builder-lang','ru') } catch {} window.dispatchEvent(new CustomEvent('nd-lang-change',{detail:{lang:'ru'}})) }"); pg.wait_for_timeout(900)
check("with the interface pack installed the node follows its language (Russian)", "Включено" in cnt(), cnt())
J("()=>{ window.__saveUi = window.ndUi; delete window.ndUi }"); pg.wait_for_timeout(1200)
check("without it the node is English whatever the language of ComfyUI or the saved choice", "1 of 1 on" in cnt(), cnt())
J("()=>{ window.ndUi = window.__saveUi; try { localStorage.removeItem('nd-builder-lang') } catch {} }"); pg.wait_for_timeout(1200)
SET([]); pg.wait_for_timeout(300)
finish(p, br, errs)
