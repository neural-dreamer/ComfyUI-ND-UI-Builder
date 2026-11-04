# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 5b (stage 2, part B): mode tabs, full view, presets and templates.
import json
from lib import *
p, br, pg, errs = start()
setup(pg)
INIT = """async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const u=g._nodes.find(n=>n.type==='NDUI'), k=g._nodes.find(n=>n.type==='KSampler'), l=g._nodes.find(n=>n.type==='EmptyLatentImage');
 k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; l.properties.nd_ui_src={uid:'sl',tag:'size'}; u.size=[1100,700];
 const W=(id,type,page,x,y,w,h,slots,props)=>({id,type,page,x,y,w,h,z:1,slots:slots||{},props:props||{}});
 const B=(s,n)=>({src:s,kind:'widget',name:n});
 const C=(how,bind)=>({nodes:[],groups:[],how,bindIndex:bind||null});
 u.properties.nd_ui={view:{page:'m1'},sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'sl',tag:'size',class:'EmptyLatentImage',title:'Latent [size]'}],
  pages:[{id:'m1',name:'Mode A',kind:'mode',control:C('mute',{src:'sk',name:'steps'})},{id:'m2',name:'Mode B',kind:'mode',control:C('mute')},{id:'p1',name:'Main',kind:'page',control:C('mute')}],
  widgets:[W('a','number','m1',20,20,300,64,{value:B('sk','cfg')},{label:'CFG'}),W('b','number','m2',20,20,300,64,{value:B('sl','width')},{label:'Width'}),W('g','generate','p1',20,20,300,64),W('g2','generate','m1',20,100,300,64)]};
 u.ndUiApi.reload(); }"""
pg.evaluate(INIT); pg.wait_for_timeout(1000)
modes = lambda: pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; return {k:g._nodes.find(n=>n.type==='KSampler').mode, l:g._nodes.find(n=>n.type==='EmptyLatentImage').mode, steps:g._nodes.find(n=>n.type==='KSampler').widgets.find(w=>w.name==='steps').value}}")
m = modes(); check("mode A active: its node on, the other muted", m["k"] == 0 and m["l"] == 2, str(m))
check("the index of the mode is written to the INT parameter", m["steps"] == 1, str(m))
tab = lambda name: pg.evaluate("(n)=>{const b=[...document.querySelectorAll('.ndk-nodeview .ndk-strip .tab')].find(x=>x.textContent===n); b.click();}", name)
tab("Mode B"); pg.wait_for_timeout(500)
m = modes(); check("switching to mode B swaps them", m["k"] == 2 and m["l"] == 0 and m["steps"] == 2, str(m))
n0 = len(prompts())
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); await m.app.queuePrompt(0,1)}"); pg.wait_for_timeout(900)
pr = prompts()[-1]; cls = sorted(v["class_type"] for v in (pr.get("prompt") or pr.get("output") or pr).values() if isinstance(v, dict) and "class_type" in v)
check("a disabled node is not in the request", len(prompts()) == n0 + 1 and "KSampler" not in cls and "EmptyLatentImage" in cls, str(cls))
# the user's own state
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='EmptyLatentImage').mode=4}"); pg.wait_for_timeout(300)
tab("Mode A"); pg.wait_for_timeout(500)
m = modes(); check("the other mode is muted, the first is back on", m["l"] == 2 and m["k"] == 0, str(m))
tab("Mode B"); pg.wait_for_timeout(500)
m = modes(); check("the user's own bypass is restored", m["l"] == 4 and m["k"] == 2, str(m))
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='EmptyLatentImage').mode=0}")
# the parameter changes the mode
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const k=m.app.graph._nodes.find(n=>n.type==='KSampler'); k.widgets.find(w=>w.name==='steps').value=1}"); pg.wait_for_timeout(1200)
m = modes(); check("changing the INT parameter switches the mode", m["k"] == 0 and m["l"] == 2, str(m))
on = pg.evaluate("document.querySelector('.ndk-nodeview .ndk-strip .tab.on')?.textContent"); check("the tab follows", on == "Mode A", str(on))
# saved with the workflow
st = pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); return u.properties.nd_ui.view.modePage}")
check("the active mode is stored", st == "m1", str(st))
# full view
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDUI').ndUiApi.openMode()}"); pg.wait_for_timeout(800)
fs = pg.evaluate("(()=>{const f=document.querySelector('.ndk-uimode'); if(!f) return null; const pgel=f.querySelector('.ndk-page').getBoundingClientRect(); return {w:Math.round(pgel.width), h:Math.round(pgel.height), ratio:+(pgel.width/pgel.height).toFixed(2), widgets:f.querySelectorAll('.ndk-w').length, dialog:f.getAttribute('aria-modal')}})()")
check("full view opens and keeps the proportions", fs and abs(fs["ratio"] - 1280 / 720) < 0.05 and fs["widgets"] >= 1, str(fs))
pg.screenshot(path="/tmp/ndui_shots/s2c.png")
n0 = len(prompts()); pg.keyboard.press("Control+Enter"); pg.wait_for_timeout(900)
check("Ctrl+Enter in the full view starts a run", len(prompts()) == n0 + 1, str(len(prompts()) - n0))
pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
check("Esc closes the full view", not pg.evaluate("!!document.querySelector('.ndk-uimode')"))
# fill + screen
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); u.properties.nd_ui.view.fit='fill'; u.properties.nd_ui.view.fullscreen='screen'; u.ndUiApi.openMode()}"); pg.wait_for_timeout(900)
fs = pg.evaluate("(()=>{const f=document.querySelector('.ndk-uimode'); if(!f) return null; const r=f.querySelector('.ndk-page').getBoundingClientRect(); return {w:Math.round(r.width), h:Math.round(r.height), vw:innerWidth, vh:innerHeight}})()")
check("fill mode covers the window", fs and abs(fs["w"] - fs["vw"]) <= 2 and abs(fs["h"] - fs["vh"]) <= 2, str(fs))
pg.evaluate("document.querySelector('.ndk-um-logobtn').click()"); pg.wait_for_timeout(400)
check("the exit button closes it", not pg.evaluate("!!document.querySelector('.ndk-uimode')"))
# presets: export, new workflow with the same tags, import
txt = pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const P=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/presets.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); return P.exportText(u.properties.nd_ui)}")
check("a preset is a JSON with the format mark", json.loads(txt)["format"] == "neuraldreamer-ndui")
r = pg.evaluate("""async(t)=>{const m=await import('/scripts/app.js'); const P=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/presets.js'); const LG=window.LiteGraph; const g=m.app.graph;
  g.clear(); const k=LG.createNode('KSampler'); k.title='My sampler [sampler]'; g.add(k); const u=LG.createNode('NDUI'); g.add(u);
  const r=P.parsePreset(t); return {linked:r.linked, missing:r.missing.map(s=>s.tag), uid:k.properties.nd_ui_src?.uid, pages:r.ui.pages.length, widgets:r.ui.widgets.length}}""", txt)
check("the sampler is found again by its tag, the latent is reported missing", r["linked"] == 1 and r["missing"] == ["size"] and r["uid"] == "sk", str(r))
bad = pg.evaluate("async()=>{const P=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/presets.js'); try{P.parsePreset('{\"a\":1}'); return 'no error'}catch(e){return e.message}}")
check("a foreign file is refused", "not an ND UI preset" in bad, bad)
# templates
t = pg.evaluate("""async()=>{const P=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/presets.js'); const M=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js'); const W=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/widgets/index.js');
  const out=[]; for (const t of P.TEMPLATES){ const ui=M.normalizeNdUi({}); const id=P.addTemplatePage(ui,t.id); const n=M.normalizeNdUi(ui); const ws=n.widgets.filter(w=>w.page===id);
   out.push({id:t.id, n:ws.length, unknown:ws.filter(w=>!W.defOf(w.type)).map(w=>w.type), outside:ws.filter(w=>w.x<0||w.y<0||w.x+w.w>n.page.w||w.y+w.h>n.page.h).length}); } return out}""")
for x in t:
    check(f"template {x['id']} is valid", x["n"] >= 4 and not x["unknown"] and x["outside"] == 0, str(x))
finish(p, br, errs)
