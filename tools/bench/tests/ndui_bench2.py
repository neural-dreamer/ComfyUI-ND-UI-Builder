# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 2: tags and sources, writing values both ways, control_after_generate, wire / muted / bypassed / lost states.
from lib import *
p, br, pg, errs = start()
setup(pg)
# tags: nodes with [tag] in the title are found, the link survives renaming, the tag finds the node again
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const S=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/sources.js');
  const ui={sources:[]}; const tagged=S.taggedNodes(ui).map(n=>n.type).sort(); const k=g._nodes.find(n=>n.type==='KSampler');
  const e=S.addSource(ui,k); k.title='Renamed sampler'; S.invalidateSources(); const byUid=S.findSource(e)===k;
  delete k.properties.nd_ui_src; k.title='Again [sampler]'; S.invalidateSources(); const byTag=S.findSource(e)===k; const readopt=k.properties.nd_ui_src?.uid===e.uid;
  return {tagged, byUid, byTag, readopt, tag:e.tag}}""")
check("tagged nodes are listed", r["tagged"] == ["EmptyLatentImage", "KSampler"], str(r))
check("a source is found by uid after renaming", r["byUid"] and r["tag"] == "sampler", str(r))
check("a source is found again by its tag and takes the uid back", r["byTag"] and r["readopt"], str(r))
setup(pg); build(pg)
# panel -> node (the real widgets of the page)
pg.evaluate("""()=>{const b=[...document.querySelectorAll('.ndk-nodeview .ndk-iconbtn')]; const up=b.find(x=>x.closest('.ndk-w')?.textContent.includes('Width') && x.textContent==='' && x.querySelector('svg') && x===b[b.length-1]); }""")
before = val(pg, "EmptyLatentImage.width")
pg.evaluate("""()=>{const w=[...document.querySelectorAll('.ndk-nodeview .ndk-w')].find(f=>f.textContent.includes('Width')); const bs=w.querySelectorAll('button'); bs[bs.length-1].click();}""")
pg.wait_for_timeout(300)
check("the + of a Number widget writes the parameter", val(pg, "EmptyLatentImage.width") == before + 8, str(val(pg, "EmptyLatentImage.width")))
# node -> panel
setval(pg, "KSampler.steps", 37); setval(pg, "KSampler.sampler_name", "dpmpp_2m"); pg.wait_for_timeout(500)
txt = pg.evaluate("document.querySelector('.ndk-nodeview').innerText + ' ' + [...document.querySelectorAll('.ndk-nodeview input')].map(i=>i.value).join(' ')")
check("a value changed in the node shows in the panel", "37" in txt and "dpmpp_2m" in txt, txt[:200])
# control_after_generate: a real queue changes the seed, the panel follows
setval(pg, "KSampler.seed", 5); setval(pg, "KSampler.control_after_generate", "increment"); pg.wait_for_timeout(300)
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); await m.app.queuePrompt(0,1)}"); pg.wait_for_timeout(1200)
s = val(pg, "KSampler.seed")
check("control_after_generate moved the seed after the run", s == 6, str(s))
shown = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].find(f=>f.textContent.includes('Seed')).querySelector('input')?.value")
check("the Seed widget follows the change", shown == "6", str(shown))
# a wire into the parameter
pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const LG=window.LiteGraph; const k=g._nodes.find(n=>n.type==='KSampler'); const pr=LG.createNode('PrimitiveInt'); pr.pos=[-300,400]; g.add(pr);
  const i=k.inputs.findIndex(x=>x.widget?.name==='steps'); pr.connect(0,k,i); }""")
pg.wait_for_timeout(700)
badge = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].filter(f=>f.textContent.includes('Steps')).map(f=>f.querySelector('.ndk-badge')?.className+'|'+f.classList.contains('is-off'))")
check("a parameter driven by a wire is marked", badge and "wire" in badge[0] and "true" in badge[0], str(badge))
# muted / bypassed node
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const k=m.app.graph._nodes.find(n=>n.type==='EmptyLatentImage'); k.mode=2;}"); pg.wait_for_timeout(600)
b = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].filter(f=>f.textContent.includes('Width')).map(f=>f.querySelector('.ndk-badge')?.className)")
check("a muted node is marked", b and "muted" in b[0], str(b))
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const k=m.app.graph._nodes.find(n=>n.type==='EmptyLatentImage'); k.mode=4;}"); pg.wait_for_timeout(600)
b = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].filter(f=>f.textContent.includes('Width')).map(f=>f.querySelector('.ndk-badge')?.className)")
check("a bypassed node is marked", b and "bypassed" in b[0], str(b))
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const k=m.app.graph._nodes.find(n=>n.type==='EmptyLatentImage'); k.mode=0;}"); pg.wait_for_timeout(600)
b = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].filter(f=>f.textContent.includes('Width')).map(f=>f.querySelector('.ndk-badge')?.style.display)")
check("the mark goes away", b and b[0] == "none", str(b))
# lost source
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; g.remove(g._nodes.find(n=>n.type==='EmptyLatentImage'));}"); pg.wait_for_timeout(900)
b = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].filter(f=>f.textContent.includes('Width')).map(f=>f.classList.contains('is-lost')+'|'+f.querySelector('.ndk-badge')?.className)")
check("a widget of a deleted node is marked lost", b and "true" in b[0] and "lost" in b[0], str(b))
finish(p, br, errs)
