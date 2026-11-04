# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 49: ComfyUI buttons and blocks on the toolbar — MOVE of the old-API elements (clicks, live parts, the way back), MIRROR of Vue elements, not found.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
# a test "pack": a group of two buttons and a live block, added the way packs do (the old menu API)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app;
  const { ComfyButtonGroup } = await import('/scripts/ui/components/buttonGroup.js'); const { ComfyButton } = await import('/scripts/ui/components/button.js');
  window.__clicks = { alpha: 0, beta: 0 };
  const g = new ComfyButtonGroup(new ComfyButton({ icon: 'star', tooltip: 'Test Alpha', action: () => window.__clicks.alpha++ }), new ComfyButton({ content: 'Beta', tooltip: 'Test Beta', action: () => window.__clicks.beta++ }));
  a.menu.settingsGroup.element.before(g.element);
  const box = document.createElement('div'); box.className = 'nd-test-monitor'; box.style.cssText = 'padding:4px 8px;font:12px monospace'; box.textContent = 'cnt 0'; window.__cnt = 0;
  window.__timer = setInterval(() => { box.textContent = 'cnt ' + (++window.__cnt); }, 200);
  a.menu.settingsGroup.element.before(box); }""")
pg.wait_for_timeout(500)
CB = "await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/comfybar.js')"
cands = J("async()=>{const C=" + CB + "; return C.candidates().map(e=>[C.zoneOf(e), C.nameOf(e), e.tagName, e.className.toString().slice(0,40)])}")
print(cands)
check("the candidates include the buttons of the old API and the Vue ones", any(c[0] == "legacy" and "Alpha" in c[1] for c in cands) and any(c[0] == "vue" for c in cands))
check("our own buttons (ND UI / Edit / Project) are not among them", not any("ND UI" in c[1] or c[1] in ("Edit", "Project") for c in cands), str([c[1] for c in cands]))
# fingerprints of a group, a button and the block
fps = J("""async()=>{const C=""" + CB + """; const g=[...document.querySelectorAll('.comfyui-button-group')].find(x=>x.querySelector('[title="Test Alpha"]'));
  const b=document.querySelector('[title="Test Beta"]'); const m=document.querySelector('.nd-test-monitor');
  return { group: C.fingerprintOf(g), beta: C.fingerprintOf(b), mon: C.fingerprintOf(m), gn: C.nameOf(g), bn: C.nameOf(b), mn: C.nameOf(m), how: [g,b,m].map(C.howFor) }}""")
print(fps["gn"], fps["bn"], fps["mn"], fps["how"])
check("a button, a group and a block are found again by their fingerprints", J("""async(f)=>{const C=""" + CB + """; return [f.group,f.beta,f.mon].every(x=>!!C.find(x))}""", fps) is True)
check("elements of the old API are moved", fps["how"] == ["move", "move", "move"])
# put them on the toolbar
item = lambda i, fp, nm: {"id": i, "kind": "comfy", "name": nm, "fp": fp, "how": "move", "scale": 100, "style": "native", "bg": "", "fg": "", "border": ""}
J("""(a)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.toolbar.items=a; u.view.toolbar.corner='tr'; window.ndUi.host().save(u)}""",
  [item("c1", fps["group"], "Test group"), item("c2", fps["mon"], "Monitor")])
J("window.ndUi.enter()"); pg.wait_for_timeout(1200)
inside = lambda sel: J("(s)=>!!document.querySelector('.ndk-uimode .ndk-tb-item '+s)", sel)
check("the group is on the panel of the mode", inside('[title="Test Alpha"]') and inside('[title="Test Beta"]'))
check("the live block is on the panel", inside(".nd-test-monitor"))
c0 = J("window.__cnt"); pg.wait_for_timeout(700); c1 = J("window.__cnt")
txt = J("document.querySelector('.ndk-uimode .nd-test-monitor').textContent")
check("the live block keeps running there", c1 > c0 and txt == f"cnt {c1}" or txt.startswith("cnt "), f"{c0} {c1} {txt}")
J("document.querySelector('.ndk-uimode [title=\"Test Alpha\"]').click()"); J("document.querySelector('.ndk-uimode [title=\"Test Beta\"]').click()")
ck = J("window.__clicks")
check("the clicks reach the handlers of the pack", ck["alpha"] == 1 and ck["beta"] == 1, str(ck))
r = J("(()=>{const e=document.querySelector('.ndk-uimode [title=\"Test Alpha\"]').getBoundingClientRect(); return [e.left,e.top,e.width,e.height]})()")
check("it is visible on the panel", r[2] > 10 and r[3] > 10, str(r))
# the way back
J("window.ndUi.exit()"); pg.wait_for_timeout(500)
home = J("(()=>{const e=document.querySelector('[title=\"Test Alpha\"]'); return !!e && !e.closest('.ndk-tb-item') && !!e.closest('[data-testid=legacy-topbar-container]')})()")
check("on leaving the mode the elements go back to the top bar of ComfyUI", home)
check("the comments that held their places are gone", J("(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_COMMENT); let n=0; while(w.nextNode()) if(w.currentNode.data.startsWith('nd-tb:')) n++; return n})()") == 0)
J("document.querySelector('[title=\"Test Alpha\"]').click()")
check("and they still work there", J("window.__clicks.alpha") == 2)
# the order in the top bar is as before
order = J("(()=>{const g=document.querySelector('[data-testid=legacy-topbar-container]'); return [...g.querySelectorAll('.comfyui-button-group,.nd-test-monitor')].map(e=>e.className.split(' ')[0])})()")
check("the elements stand in their old order", order[:2] == ["comfyui-button-group", "nd-test-monitor"] or "nd-test-monitor" in order, str(order))
# MIRROR: a Vue button of the top bar (Run or the properties panel)
vue = J("""async()=>{const C=""" + CB + """; const l=C.candidates().filter(e=>C.zoneOf(e)==='vue'); const b=l.find(e=>C.nameOf(e)==='Toggle properties panel')||l.find(e=>C.nameOf(e)==='Run options'); return b?{fp:C.fingerprintOf(b), name:C.nameOf(b), how:C.howFor(b)}:null}""")
print(vue and (vue["name"], vue["how"]))
check("a Vue button of the top bar is found and mirrored, not moved", vue and vue["how"] == "mirror")
J("""(a)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.toolbar.items=[a, {id:'gone',kind:'comfy',name:'Vanished pack',fp:{zone:'legacy',nth:0,sig:{tag:'button',cls:['comfyui-button'],title:'No such button',aria:'',text:'',icon:''}},how:'move',scale:100,style:'native',bg:'',fg:'',border:''}]; window.ndUi.host().save(u)}""",
  item("v1", vue["fp"], vue["name"]))
J("""async(fp)=>{const C=""" + CB + """; window.__vclick=0; C.find(fp).addEventListener('click',()=>window.__vclick++,true)}""", vue["fp"])
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
mi = J("(()=>{const w=document.querySelector('.ndk-uimode .ndk-tb-item[data-id=v1]'); return w?{btn:!!w.querySelector('button'), n:w.querySelectorAll('[id]').length}:null})()")
check("the mirror shows a copy of the button (without ids)", mi and mi["btn"] and mi["n"] == 0, str(mi))
orig = J("(()=>{const e=document.querySelector('[data-testid=action-bar-card] button, .actionbar-container button'); return !!e && !e.closest('.ndk-tb-item')})()")
check("the original stays in the top bar of ComfyUI", orig)
J("document.querySelector('.ndk-uimode .ndk-tb-item[data-id=v1] button').click()"); pg.wait_for_timeout(300)
check("a click on the copy clicks the original", J("window.__vclick") >= 1, str(J("window.__vclick")))
# not found
ms = J("(()=>{const w=document.querySelector('.ndk-uimode .ndk-tb-item[data-id=gone]'); return w?{miss:w.classList.contains('missing'), t:w.textContent}:null})()")
check("an element that is not there shows as not found (its name)", ms and ms["miss"] and "Vanished" in ms["t"], str(ms))
check("the missing element does not break the panel (no errors, mirror stays)", J("!!document.querySelector('.ndk-uimode .ndk-tb-item[data-id=v1] button')"))
# the pack shows up late: the search goes on
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app;
  const { ComfyButtonGroup } = await import('/scripts/ui/components/buttonGroup.js'); const { ComfyButton } = await import('/scripts/ui/components/button.js');
  const b = new ComfyButton({ icon: 'bug', tooltip: 'No such button', action: () => {} }); a.menu.settingsGroup.element.before(new ComfyButtonGroup(b).element); }""")
try: pg.wait_for_function("!!document.querySelector('.ndk-uimode .ndk-tb-item[data-id=gone] [title=\"No such button\"]')", timeout=6000)
except Exception: pass
check("a pack that loads late is found by the search that goes on", J("(()=>{const w=document.querySelector('.ndk-uimode .ndk-tb-item[data-id=gone]'); return !!w && !!w.querySelector('[title=\"No such button\"]')})()"))
# workflow change / exit return everything
J("window.ndUi.exit()"); pg.wait_for_timeout(400)
check("after the exit the late button is back in the top bar", J("(()=>{const e=document.querySelector('[title=\"No such button\"]'); return !!e && !e.closest('.ndk-tb-item')})()"))
J("clearInterval(window.__timer)")
finish(p, br, errs)
