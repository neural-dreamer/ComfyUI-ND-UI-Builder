# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 46: the node ND UI Active (the browser writes the state into the prompt), the margins of Layout kept between sessions, a narrower Panel.
import json, urllib.request
from lib import *
prompts_ = lambda: json.loads(urllib.request.urlopen(URL + "/bench/prompts").read())
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const n = LG.createNode('NDUIActive'); n.pos=[60,60]; a.graph.add(n); window.__nid = n.id;
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[{id:'g',type:'generate',page:'p1',x:20,y:60,w:300,h:64,z:1,slots:{},props:{}}],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(800)
check("the node exists with a hidden-from-edit boolean widget", J("(()=>{const n=window.__app.graph.getNodeById(window.__nid); const w=n.widgets.find(w=>w.name==='active'); return !!w && w.disabled===true && w.value===false})()"))
def last_active():
    ps = prompts_(); node = next((v for v in (ps[-1]["prompt"] if ps else {}).values() if v.get("class_type") == "NDUIActive"), {})
    return node.get("inputs", {}).get("active")
J("window.__app.queuePrompt(0, 1)"); pg.wait_for_timeout(900)
check("a prompt sent with the mode off says active = false", last_active() is False, str(last_active()))
J("window.ndUi.enter()"); pg.wait_for_timeout(700)
check("the widget of the node shows the mode on", J("window.__app.graph.getNodeById(window.__nid).widgets.find(w=>w.name==='active').value") is True)
J("window.__app.queuePrompt(0, 1)"); pg.wait_for_timeout(900)
check("a prompt sent in the ND UI mode says active = true", last_active() is True, str(last_active()))
J("window.ndUi.exit()"); pg.wait_for_timeout(500)
check("the widget goes back to off", J("window.__app.graph.getNodeById(window.__nid).widgets.find(w=>w.name==='active').value") is False)
J("window.__app.queuePrompt(0, 1)"); pg.wait_for_timeout(900)
check("and the next prompt says false again", last_active() is False, str(last_active()))
# ---- the margins of the Layout tab
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
check("the margins start at 16", J("window.ndUi.host().editor.spread.mL") == 16)
J("()=>{const s=window.ndUi.host().editor.spread; s.mL=37; s.mT=5; s.gapH=9; s.mode='gap'}")
J("window.ndUi.host().editor.close()"); pg.wait_for_timeout(500)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
sp = J("({...window.ndUi.host().editor.spread})")
check("the last margins and gaps come back when the editor is opened again", sp["mL"] == 37 and sp["mT"] == 5 and sp["gapH"] == 9 and sp["mode"] == "gap", str(sp))
pg.reload(); pg.wait_for_function("window.ndUi && window.ndUi.host", timeout=30000); pg.wait_for_timeout(1500)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
sp = J("({...window.ndUi.host().editor.spread})")
check("they also stay after the page is reloaded", sp["mL"] == 37 and sp["gapH"] == 9, str(sp))
J("()=>{const s=window.ndUi.host().editor.spread; s.mL=16; s.mT=16; s.gapH=16; s.mode='margins'}")
J("window.ndUi.host().editor.close()")
# ---- the Panel can be narrower and lower
src = json.loads(urllib.request.urlopen(URL + "/extensions").read())
ext = next(e for e in src if e.endswith("/ndui.js")); base = URL + ext[:-len("/ndui.js")]
sz = J("async(b)=>{const m=await import(b+'/ndui/widgets/deco.js'); return m.panel.size}", base)
check("the Panel's minimum is 8 x 8 (it was 80 x 60)", sz["minW"] == 8 and sz["minH"] == 8, str(sz))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.widgets.push({id:'pn',type:'panel',page:'p1',x:400,y:60,w:10,h:12,z:0,slots:{},props:{title:''}}); window.ndUi.host().save(u)}""")
pg.wait_for_timeout(500)
w = J("window.ndUi.host().ui.widgets.find(w=>w.id==='pn')")
check("a 10 x 12 panel is kept as it is", w and w["w"] == 10 and w["h"] == 12, str(w))
finish(p, br, errs)
