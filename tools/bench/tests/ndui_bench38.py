# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 38: the "Run to node" widget — runs up to the chosen node: an ordinary node through the helper NDUIRunTarget, an output node directly.
from lib import *
p, br, pg, errs = start()
setup(pg)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async()=>{const m=await import('/scripts/app.js'); const a=m.app, g=a.graph, LG=window.LiteGraph; window.__app=a;
 const u=g._nodes.find(n=>n.type==='NDUI'), k=g._nodes.find(n=>n.type==='KSampler');
 const pv=LG.createNode('PreviewImage'); pv.pos=[60,700]; g.add(pv);
 k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; pv.properties.nd_ui_src={uid:'pv',tag:'preview'}; u.size=[900,400];
 const R=(id,src,y,pr)=>({id,type:'runto',page:'p1',x:20,y,w:300,h:64,z:1,slots:{node:{src,kind:'anynode',name:''}},props:pr||{}});
 u.properties.nd_ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'pv',tag:'preview',class:'PreviewImage',title:'Preview Image'}],pages:[{id:'p1',name:'Main'}],
 widgets:[R('r1','sk',20),R('r2','pv',110,{text:'Preview only'}),R('r3','',200),{id:'g',type:'generate',page:'p1',x:340,y:20,w:300,h:64,z:1,slots:{},props:{}}]};
 u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1200)
btns = lambda: J("[...document.querySelectorAll('.ndk-nodeview .ndk-runto .run')].map(b=>({t:b.innerText.trim(),d:b.disabled}))")
b = btns()
check("three Run to node buttons", len(b) == 3, str(b))
check("the label carries the name of the target", "Sampler" in b[0]["t"] and "Preview only" in b[1]["t"], str(b))
check("a button without a target is disabled", b[2]["d"] is True and b[0]["d"] is False and b[1]["d"] is False, str(b))
KID = J("window.__app.graph._nodes.find(n=>n.type==='KSampler').id")
PID = J("window.__app.graph._nodes.find(n=>n.type==='PreviewImage').id")
n0 = len(prompts())
# 1) an ordinary node: the helper is added and only it is the target
J("document.querySelectorAll('.ndk-nodeview .ndk-runto .run')[0].click()"); pg.wait_for_timeout(1200)
ps = prompts(); check("one prompt is sent", len(ps) == n0 + 1, str(len(ps)))
last = ps[-1]
check("the target is the helper", last.get("partial_execution_targets") == ["ndui_run_target"], str(last.get("partial_execution_targets")))
h = last["prompt"].get("ndui_run_target") or {}
check("the helper is wired to the sampler", h.get("class_type") == "NDUIRunTarget" and h.get("inputs", {}).get("source") == [str(KID), 0], str(h))
check("the helper is not in the graph", J("!window.__app.graph._nodes.some(n=>n.type==='NDUIRunTarget')"))
# 2) an output node: it is the target itself, no helper
J("document.querySelectorAll('.ndk-nodeview .ndk-runto .run')[1].click()"); pg.wait_for_timeout(1200)
ps = prompts(); last = ps[-1]
check("a second prompt is sent", len(ps) == n0 + 2, str(len(ps)))
check("the output node is the target", last.get("partial_execution_targets") == [str(PID)], str(last.get("partial_execution_targets")))
check("no helper for an output node", "ndui_run_target" not in last["prompt"])
# 3) the ordinary Generate runs everything: no leftovers of the target
J("document.querySelector('.ndk-nodeview .ndk-gen:not(.ndk-runto) .run').click()"); pg.wait_for_timeout(1200)
ps = prompts(); last = ps[-1]
check("Generate sends a whole run", len(ps) == n0 + 3 and not last.get("partial_execution_targets") and "ndui_run_target" not in last["prompt"], str(last.get("partial_execution_targets")))
# 4) a batch: the helper is in every prompt
J("""()=>{const u=window.__app.graph._nodes.find(n=>n.type==='NDUI'); const m=JSON.parse(JSON.stringify(u.properties.nd_ui)); m.widgets[0].props={batch:true}; u.properties.nd_ui=m; u.ndUiApi.reload()}""")
pg.wait_for_timeout(900)
pg.fill(".ndk-nodeview .ndk-runto .batch input", "3"); pg.keyboard.press("Tab"); pg.wait_for_timeout(200)
J("document.querySelectorAll('.ndk-nodeview .ndk-runto .run')[0].click()"); pg.wait_for_timeout(2200)
ps = prompts()[n0 + 3:]
check("a batch of three sends three prompts with the helper", len(ps) == 3 and all(q.get("partial_execution_targets") == ["ndui_run_target"] and "ndui_run_target" in q["prompt"] for q in ps), str([q.get("partial_execution_targets") for q in ps]))
# 5) a muted target cannot be run
J("window.__app.graph._nodes.find(n=>n.type==='KSampler').mode = 2"); pg.evaluate("window.__app.graph.setDirtyCanvas(true,true)")
J("document.dispatchEvent(new Event('visibilitychange'))")
J("()=>{const u=window.__app.graph._nodes.find(n=>n.type==='NDUI'); u.ndUiApi.reload()}"); pg.wait_for_timeout(900)
check("a muted target disables the button", btns()[0]["d"] is True, str(btns()))
finish(p, br, errs)
