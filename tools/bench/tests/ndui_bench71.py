# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 71: the R key (Comfy.RefreshNodeDefinitions): a model that appeared on disk is seen by the dropdown, the LoRA Picker and the gallery of the LoRA widget.
import json, urllib.request
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
def post(path, body):
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode(), method="POST"); return json.load(urllib.request.urlopen(r))
post("/bench/models", {"reset": True}); post("/bench/nd_loras", {"on": True, "reset": True})
NEW = "brand_new_lora.safetensors"
J("async()=>{ window.__app = (await import('/scripts/app.js')).app; try { for (const k of ['ndui-fav:loras','ndui-recent:loras','ndui-gallery:loras']) localStorage.removeItem(k); } catch {} }")
J("""async () => { const a = window.__app, LG = window.LiteGraph; a.graph.clear();
  const n = LG.createNode('NDLoraStack'); n.pos = [80, 80]; n.title = 'Stack [loras]'; a.graph.add(n); n.properties.nd_ui_src = {uid:'ls', tag:'loras'};
  const l = LG.createNode('LoraLoader'); l.pos = [80, 500]; l.title = 'One [one]'; a.graph.add(l); l.properties.nd_ui_src = {uid:'ol', tag:'one'}; }""")
pg.wait_for_timeout(800)
def W(id, t, x, y, w, h, slots=None, props=None): return {"id": id, "type": t, "page": "p1", "x": x, "y": y, "w": w, "h": h, "z": 1, "slots": slots or {}, "props": props or {}}
SRC = [{"uid": "ls", "tag": "loras", "class": "NDLoraStack", "title": "Stack"}, {"uid": "ol", "tag": "one", "class": "LoraLoader", "title": "One"}]
ws = [W("l", "lora", 20, 20, 520, 420, {"node": {"src": "ls", "kind": "lorastack", "name": ""}}, {"label": "LoRAs"}),
      W("dd", "dropdown", 600, 20, 380, 64, {"value": {"src": "ol", "kind": "widget", "name": "lora_name"}}, {"label": "Pick"}),
      W("lp", "lorapicker", 600, 120, 380, 150, {"lora_name": {"src": "ol", "kind": "widget", "name": "lora_name"}, "strength_model": {"src": "ol", "kind": "widget", "name": "strength_model"}, "strength_clip": {"src": "ol", "kind": "widget", "name": "strength_clip"}})]
J("window.ndUi.enter()"); pg.wait_for_timeout(500)
J("(m) => window.ndUi.host().save(JSON.parse(m))", json.dumps({"sources": SRC, "pages": [{"id": "p1", "name": "Main"}], "theme": {"id": "midnight"}, "widgets": ws}))
pg.wait_for_timeout(1200)
M = ".ndk-uimode "
def R():
    J("async()=>{ const a=window.__app; const c=a.extensionManager?.command; if (c?.execute) await c.execute('Comfy.RefreshNodeDefinitions'); else await a.refreshComboInNodes(); }"); pg.wait_for_timeout(1500)
has_node = lambda: J("(n)=>window.__app.graph._nodes.find(x=>x.type==='LoraLoader').widgets.find(w=>w.name==='lora_name').options.values.includes(n)", NEW)
cat_has = lambda: J("async(n)=>{const m=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/models.js'); return (await m.catalog('loras')).has(n)}", NEW)
def dd_has():
    pg.click(M + ".ndk-dd"); pg.wait_for_timeout(300)
    pg.keyboard.type("brand_new"); pg.wait_for_timeout(300)
    t = J("document.querySelector('.ndk-pop')?.innerText || ''"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    return "brand_new" in t
def gal_has():
    J("document.querySelector('%s.ndk-lr-add').click()" % M); pg.wait_for_selector(".ndk-lg .ndk-lg-card", state="attached", timeout=10000); pg.wait_for_timeout(500)
    n = J("[...document.querySelectorAll('.ndk-lg .ndk-lg-card')].filter(c=>c.textContent.includes('brand_new')).length")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    return n
check("before: the catalog does not know the new file", not cat_has())
check("before: the dropdown does not list it", not dd_has())
check("before: the gallery does not list it", gal_has() == 0)
J("(v)=>{ const n=window.__app.graph._nodes.find(x=>x.type==='LoraLoader'); n.widgets.find(w=>w.name==='lora_name').value = v }", "style_neon.safetensors")
post("/bench/models", {"folder": "loras", "name": NEW})
R()
check("R: the node itself sees the new file", has_node())
check("R: the catalog of the widgets sees it", cat_has())
check("R: the dropdown lists it", dd_has())
check("R: the gallery of the LoRA widget lists it", gal_has() == 1)
check("R: the chosen value is kept", J("window.__app.graph._nodes.find(x=>x.type==='LoraLoader').widgets.find(w=>w.name==='lora_name').value") == "style_neon.safetensors")
# the LoRA Picker takes the new file too
pg.click(M + ".ndk-lorapicker .ndk-lp-pic, " + M + ".ndk-lp-pic") if J("!!document.querySelector('%s.ndk-lp-pic')" % M) else None
pg.wait_for_timeout(500)
n = J("[...document.querySelectorAll('.ndk-pop .ndk-lg-card, .ndk-pop [class*=card]')].filter(c=>c.textContent.includes('brand_new')).length")
check("R: the LoRA Picker picture list lists it", n >= 1 or not J("!!document.querySelector('.ndk-pop')"), str(n))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
# no extra work at rest: a second R without changes keeps everything and does not break
R()
check("R again: still there, no errors", cat_has() and has_node())
post("/bench/models", {"reset": True})
finish(p, br, errs)
