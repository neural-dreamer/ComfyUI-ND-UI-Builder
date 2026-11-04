# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 1: the node is virtual (not in the prompt), saves and loads without loss, copies are independent, uid on paste.
from lib import *
p, br, pg, errs = start()
setup(pg); build(pg)
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const a=m.app; const u=a.graph._nodes.find(n=>n.type==='NDUI'); const pr=await a.graphToPrompt();
  return {virtual:u.isVirtualNode, ids:Object.keys(pr.output), types:Object.values(pr.output).map(x=>x.class_type), uid:String(u.id), serializeHasUi: !!u.serialize().properties?.nd_ui}}""")
check("NDUI is a virtual node", r["virtual"] is True)
check("NDUI is not in the prompt", r["uid"] not in r["ids"] and "NDUI" not in r["types"], str(r))
check("the other nodes are in the prompt", set(r["types"]) == {"KSampler", "EmptyLatentImage"}, str(r))
n0 = len(prompts())
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); await m.app.queuePrompt(0,1)}"); pg.wait_for_timeout(1000)
ps = prompts()
check("the queued prompt reached the backend", len(ps) == n0 + 1, str(len(ps)))
last = ps[-1]; body = last.get("prompt", last) if isinstance(last, dict) else {}
check("NDUI is not in the queued prompt", all(v.get("class_type") != "NDUI" for v in body.values() if isinstance(v, dict)))
# save / load
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const a=m.app; const g=a.graph; const u=g._nodes.find(n=>n.type==='NDUI'); const before=JSON.stringify(u.properties.nd_ui);
  const s=JSON.parse(JSON.stringify(g.serialize())); g.clear(); g.configure(s); await new Promise(r=>setTimeout(r,800));
  const u2=g._nodes.find(n=>n.type==='NDUI'); return {same: JSON.stringify(u2.properties.nd_ui)===before, widgets:u2.properties.nd_ui.widgets.length, frames:u2.ndUiApi.root.querySelectorAll('.ndk-w').length, virtual:u2.isVirtualNode}}""")
check("save/load keeps the panel", r["same"] and r["widgets"] == 5, str(r))
check("the loaded panel is drawn", r["frames"] == 5 and r["virtual"], str(r))
# a copy is independent
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const u=g._nodes.find(n=>n.type==='NDUI'); const c=u.clone(); g.add(c); await new Promise(r=>setTimeout(r,500));
  c.properties.nd_ui.widgets.pop(); return {orig:u.properties.nd_ui.widgets.length, copy:c.properties.nd_ui.widgets.length, same:u.properties.nd_ui===c.properties.nd_ui}}""")
check("a copy of the panel is independent", (not r["same"]) and r["orig"] == 5 and r["copy"] == 4, str(r))
# uid on paste
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const S=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/sources.js');
  const k=g._nodes.find(n=>n.type==='KSampler'); const c=k.clone(); c.pos=[600,700]; g.add(c); S.invalidateSources(); S.dedupeUids();
  const f=S.findSource({uid:'sk',tag:'sampler'}); return {origUid:k.properties.nd_ui_src.uid, copyUid:c.properties.nd_ui_src?.uid, found: f===k}}""")
check("a pasted source gets a new uid and the original keeps the link", r["origUid"] == "sk" and r["copyUid"] != "sk" and r["found"], str(r))
finish(p, br, errs)
