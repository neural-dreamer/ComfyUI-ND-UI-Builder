# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 69: the LoRA widget with ND LoRA Stack H3 Temporal: the time of every LoRA (the clock and the panel), fields of the entry that the widget does not know are kept,
# both classes bind, the H3 block in the info window, the note when Nodes are too old.
import json, urllib.request
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
def post(path, body):
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode(), method="POST"); return json.load(urllib.request.urlopen(r))
post("/bench/nd_loras", {"on": True, "reset": True})
J("async()=>{ window.__app = (await import('/scripts/app.js')).app; try { for (const k of ['ndui-fav:loras','ndui-recent:loras','ndui-gallery:loras']) localStorage.removeItem(k); } catch {} }")
J("""async () => { const a = window.__app, LG = window.LiteGraph; a.graph.clear();
  const n = LG.createNode('NDLoraStackH3Temporal'); n.pos = [80, 80]; n.title = 'Stack [loras]'; a.graph.add(n); n.properties.nd_ui_src = {uid:'ls', tag:'loras'};
  const m = LG.createNode('NDLoraStack'); m.pos = [80, 500]; m.title = 'Plain [plain]'; a.graph.add(m); m.properties.nd_ui_src = {uid:'pl', tag:'plain'}; }""")
pg.wait_for_timeout(800)
CLS = "NDLoraStackH3Temporal"
STK = "(c)=>{const n=window.__app.graph._nodes.find(n=>n.type===c); return JSON.parse(n.widgets.find(w=>w.name==='stack').value)}"
SET = lambda c, lst: J("([c,s])=>{const n=window.__app.graph._nodes.find(n=>n.type===c); n.widgets.find(w=>w.name==='stack').value=s; window.__app.graph.setDirtyCanvas(true,true)}", [c, json.dumps(lst)])
E = lambda name, **kw: dict({"name": name, "on": True, "sm": 1, "sc": 1, "link": True, "words": []}, **kw)
def W(id, t, x, y, w, h, slots=None, props=None): return {"id": id, "type": t, "page": "p1", "x": x, "y": y, "w": w, "h": h, "z": 1, "slots": slots or {}, "props": props or {}}
SRC = [{"uid": "ls", "tag": "loras", "class": CLS, "title": "Stack"}, {"uid": "pl", "tag": "plain", "class": "NDLoraStack", "title": "Plain"}]
def use(uid="ls", wait=1200):
    ws = [W("l", "lora", 20, 20, 520, 700, {"node": {"src": uid, "kind": "lorastack", "name": ""}}, {"label": "LoRAs"})]
    J("(m) => window.ndUi.host().save(JSON.parse(m))", json.dumps({"sources": SRC, "pages": [{"id": "p1", "name": "Main"}], "theme": {"id": "midnight"}, "widgets": ws}))
    pg.wait_for_timeout(wait)
M = ".ndk-uimode "
J("window.ndUi.enter()"); pg.wait_for_timeout(500)
check("the Nodes expose the time editor API", J("!!window.ndLoraTemporal && window.ndLoraTemporal.version >= 1 && !!window.ndLoraTemporal.temporalEditor"))
SET(CLS, [E("style_neon.safetensors", zz="keep-me", t={"v": 1, "on": True, "audio": False, "shared": True, "base": 1, "ranges": [{"s": 10, "e": 40, "fi": 4, "fo": 4, "w": 1}], "future": 5}), E("style_anime.safetensors", sm=0.5)])
use()
cards = lambda: J("document.querySelectorAll('%s.ndk-lora .ndk-lr-card').length" % M)
check("the widget binds the H3 Temporal node: two cards", cards() == 2, str(cards()))
check("a clock on every card of the temporal node", J("document.querySelectorAll('%s.ndk-lr-clock').length" % M) == 2)
check("the clock of the timed LoRA shows its count", J("document.querySelector('%s.ndk-lr-card .ndk-lr-nb')?.textContent" % M) == "1")
J("document.querySelector('%s.ndk-lr-clock').click()" % M); pg.wait_for_timeout(500)
check("the clock opens the time panel", J("!!document.querySelector('%s.ndk-lr-time')" % M))
check("the panel is the editor of Nodes", J("!!document.querySelector('%s.ndk-lr-time [class*=ndlt], %s.ndk-lr-time button')" % (M, M)))
# a touch of the strength keeps unknown fields
J("""()=>{ const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStackH3Temporal'); const w=n.widgets.find(w=>w.name==='stack'); const s=JSON.parse(w.value); s[1].sm=0.7; w.value=JSON.stringify(s); window.__app.graph.setDirtyCanvas(true,true) }""")
pg.wait_for_timeout(600)
s = J(STK, CLS)
check("the unknown field and the time stay in the stack", s[0].get("zz") == "keep-me" and s[0]["t"]["ranges"][0]["s"] == 10 and s[0]["t"].get("future") == 5, json.dumps(s[0])[:200])
# editing from the panel writes t
btn = J("[...document.querySelectorAll('%s.ndk-lr-time button')].map(b=>b.textContent.trim() || b.title)" % M)
add = next((i for i, t in enumerate(btn) if "Add" in t or "+" in t), None)
check("the panel has a button to add a range", add is not None, str(btn))
if add is not None:
    J("(i)=>[...document.querySelectorAll('%s.ndk-lr-time button')][i].click()" % M, add); pg.wait_for_timeout(700)
    s = J(STK, CLS)
    check("adding a range writes t.ranges", len(s[0]["t"]["ranges"]) == 2, json.dumps(s[0]["t"])[:200])
    check("unknown fields still survive the edit", s[0].get("zz") == "keep-me" and s[0]["t"].get("future") == 5)
# the panel survives the redraw and the length change
J("""()=>{ const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStackH3Temporal'); const w=n.widgets.find(w=>w.name==='length'); w.value=60; w.callback?.(60); window.__app.graph.setDirtyCanvas(true,true) }""")
pg.wait_for_timeout(900)
check("a new length redraws without errors and the panel is still open", J("!!document.querySelector('%s.ndk-lr-time')" % M))
# the info window has the H3 block
ib = J("[...document.querySelectorAll('%s.ndk-lr-card')][0].querySelectorAll('.ndk-lr-info, .ndk-lr-ib, [data-act=info]').length" % M)
info = J("(()=>{const b=document.querySelector('%s.ndk-lr-card .ndk-lr-inf'); if(!b) return false; b.click(); return true})()" % M)
pg.wait_for_timeout(900)
check("the info window has the H3 block", info and J("!!document.querySelector('.ndk-h3-kv')"), str(info))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
# the plain stack: no clock, no H3 block requirement
SET("NDLoraStack", [E("style_neon.safetensors", zz="plain-keep")])
use("pl")
check("the plain stack binds too: one card, no clock", cards() == 1 and J("document.querySelectorAll('%s.ndk-lr-clock').length" % M) == 0, str((cards(), J("document.querySelectorAll('%s.ndk-lr-clock').length" % M))))
J("""()=>{ const n=window.__app.graph._nodes.find(n=>n.type==='NDLoraStack'); const w=n.widgets.find(w=>w.name==='stack'); const s=JSON.parse(w.value); s[0].sm=0.9; w.value=JSON.stringify(s); window.__app.graph.setDirtyCanvas(true,true) }""")
pg.wait_for_timeout(500)
check("the plain stack keeps the fields it does not know", J(STK, "NDLoraStack")[0].get("zz") == "plain-keep")
# Nodes too old: no API
use("ls")
J("()=>{ window.__api = window.ndLoraTemporal; delete window.ndLoraTemporal }"); J("()=>window.dispatchEvent(new Event('resize'))")
use("ls", 1500)
check("without the API: no clock, a note, the cards still work", J("document.querySelectorAll('%s.ndk-lr-clock').length" % M) == 0 and cards() == 2 and J("!!document.querySelector('%s.ndk-lr-empty.warn')" % M))
finish(p, br, errs)
