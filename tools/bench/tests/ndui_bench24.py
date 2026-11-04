# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 24: popups stay inside the window (they open up when there is no room below), a LoRA list starts at the top of its widget,
# the header of a spoiler keeps its size under any UI scale.
import json
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const n = LG.createNode('NDLoraStack'); n.pos = [80, 80]; n.title = 'Stack [loras]'; a.graph.add(n);
  n.properties.nd_ui_src = {uid:'ls', tag:'loras'}; window.__app = a;
  await new Promise(r=>setTimeout(r,800)); }""")
STK = json.dumps([{"name": "style_neon.safetensors", "on": True, "sm": 1, "sc": 1, "words": []}])
def W(id, t, x, y, w, h, parent=None, props=None, slots=None):
    d = {"id": id, "type": t, "page": "p1", "x": x, "y": y, "w": w, "h": h, "z": 1, "slots": slots or {}, "props": props or {}}
    if parent: d["parent"] = parent
    return d
def model(widgets, scale=100):
    return json.dumps({"sources": [{"uid": "ls", "tag": "loras", "class": "NDLoraStack", "title": "Stack"}], "pages": [{"id": "p1", "name": "Main"}], "theme": {"id": "midnight"},
                       "kit": {"scale": scale}, "widgets": widgets})
use = lambda ws, scale=100, wait=1200: (J("(m) => window.ndUi.host().save(JSON.parse(m))", model(ws, scale)), pg.wait_for_timeout(wait))
node_slot = {"node": {"src": "ls", "kind": "lorastack", "name": ""}}
J("window.ndUi.enter()")
J("(s)=>{const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); n.widgets.find(w=>w.name==='stack').value=s; window.__app.graph.setDirtyCanvas(true,true)}", STK)

# ---- a LoRA widget: the first card is at the top of a tall widget
use([W("l", "lora", 20, 20, 500, 520, slots=node_slot, props={"label": "LoRA Stack"})])
pg.wait_for_timeout(600)
r = J("""()=>{const l=document.querySelector('.ndk-uimode .ndk-lr-list'); const c=l.querySelector('.ndk-lr-card'); if(!c) return null; return [c.getBoundingClientRect().top-l.getBoundingClientRect().top, l.getBoundingClientRect().height]}""")
check("widget: the first LoRA lies at the top of the list", r is not None and r[0] < 12 and r[1] > 200, str(r))
# ---- the gallery opened near the bottom of the window stays inside it
use([W("l", "lora", 20, 600, 500, 110, slots=node_slot, props={"label": "LoRA Stack"})])
J("document.querySelector('.ndk-uimode .ndk-lr-add').click()"); pg.wait_for_timeout(900)
g = J("""()=>{const b=document.querySelector('.ndk-lg'); const r=b.getBoundingClientRect(); return [r.top, r.bottom, innerHeight]}""")
check("the gallery near the bottom opens upwards, whole in the window", g[0] >= 0 and g[1] <= g[2] and g[1] - g[0] > 200, str(g))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
# ---- a dropdown near the bottom
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.widgets.push({id:'d',type:'dropdown',page:'p1',x:700,y:600,w:400,h:64,z:1,slots:{},props:{label:'Pick',options:'a\\nb\\nc\\nd\\ne\\nf\\ng\\nh\\ni\\nj\\nk\\nl\\nm\\nn'}}); window.ndUi.host().save(u)}"""); pg.wait_for_timeout(800)
# (the list on the node itself moved to Neural Dreamer Nodes: its tests cover the top of the list and the wheel)

# ---- spoilers under a UI scale
for sc in (50, 100, 175, 200):
    use([W("s", "spoiler", 20, 40, 600, 44, props={"title": "Settings"}), W("h", "heading", 0, 0, 300, 50, "s", props={"text": "inside"})], sc, wait=1000)
    m = J("""()=>{const f=document.querySelector('.ndk-uimode .ndk-w'); const h=f.querySelector('.ndk-sp-head'); const fr=f.getBoundingClientRect(), hr=h.getBoundingClientRect(); const t=f.querySelector('.ndk-sp-title').getBoundingClientRect(); return [fr.height, hr.height, hr.top-fr.top, t.height]}""")
    check(f"scale {sc}%: the header is as tall as the frame of the spoiler", abs(m[0] - m[1]) < 2 and abs(m[2]) < 4 and m[3] <= m[1] + 1, str(m))
use([W("s", "spoiler", 20, 40, 600, 44, props={"title": "Settings", "open": True}), W("h", "heading", 0, 0, 300, 50, "s", props={"text": "inside"})], 175, wait=1000)
J("()=>{const h=window.ndUi.host(); h.open.set(h.ui.widgets.find(w=>w.id==='s'), true)}"); pg.wait_for_timeout(700)
o = J("""()=>{const hd=document.querySelector('.ndk-uimode .ndk-sp-head').getBoundingClientRect(); const c=document.querySelector('.ndk-uimode .ndk-w[data-id=h]').getBoundingClientRect(); return [hd.bottom, c.top]}""")
check("175%, open: the content does not lie over the header", o[1] >= o[0] - 1, str(o))
finish(p, br, errs)
