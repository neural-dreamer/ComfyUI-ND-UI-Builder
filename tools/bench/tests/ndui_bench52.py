# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 52: grips of ComfyUI panels are hidden on the toolbar in the mode; the editor shows a square; the pick bar stays below the top bar; library labels centred.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui);
  // a panel like the monitor of a pack: a grip, then the content
  const box = document.createElement('div'); box.className = 'nd-test-panel'; box.style.cssText='display:flex;align-items:center;gap:4px;padding:2px';
  box.innerHTML = '<span class="drag-handle" style="width:14px;height:20px;display:inline-block">::</span><span class="grab-thing" style="width:12px;height:18px;display:inline-block;cursor:grab"></span><b style="font:12px monospace">CPU 1%</b>';
  a.menu.settingsGroup.element.before(box); }""")
pg.wait_for_timeout(500)
CB = "await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/comfybar.js')"
fp = J("""async()=>{const C=""" + CB + """; const e=document.querySelector('.nd-test-panel'); return C.fingerprintOf(e)}""")
item = {"id": "m1", "kind": "comfy", "name": "Monitor", "fp": fp, "how": "move", "scale": 100, "style": "native", "bg": "", "fg": "", "border": ""}
J("(a)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.toolbar.items=[a]; window.ndUi.host().save(u)}", item)
J("window.ndUi.enter()"); pg.wait_for_timeout(2400)
vis = lambda sel: J("(s)=>{const e=document.querySelector('.ndk-uimode '+s); return !!e && getComputedStyle(e).display!=='none'}", sel)
check("the content of the panel shows in the mode", vis(".nd-test-panel b"))
check("its grip (drag handle) is hidden", not vis(".nd-test-panel .drag-handle"))
check("an empty small element with a grab cursor is hidden too", not vis(".nd-test-panel .grab-thing"))
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
check("the editor shows the ComfyUI element as a square plate with its name", J("(()=>{const q=document.querySelector('.nde-ghost .ndk-tb-item.comfy.sq'); return !!q && q.textContent.includes('Monitor') && !q.querySelector('b') && q.getBoundingClientRect().height<=36})()"))
check("the top bar of the editor keeps its row (the square is not tall)", J("(()=>{const q=document.querySelector('.nde-ghost .ndk-um-tools'); return q.getBoundingClientRect().height<=40})()"))
# the labels of the library tiles are centred
J("[...document.querySelectorAll('.nde-tabs button')].find(b=>b.textContent.includes('Widgets')).click()"); pg.wait_for_timeout(300)
check("the labels of the library tiles are centred", J("[...document.querySelectorAll('.nde-lib-i span')].every(s=>getComputedStyle(s).textAlign==='center')"))
# the pick bar under the top bar of ComfyUI, with an accent frame
J("[...document.querySelectorAll('.nde-tabs button')].find(b=>b.textContent.includes('Link')).click()"); pg.wait_for_timeout(300)
J("[...document.querySelectorAll('.nde button, .nde .btn')].find(b=>b.textContent.includes('Pick on canvas'))?.click()"); pg.wait_for_timeout(500)
r = J("(()=>{const h=document.querySelector('.nde-hint'); const t=document.querySelector('[data-testid=action-bar-card], .actionbar-container'); if(!h) return null; return [h.getBoundingClientRect().top, t?t.getBoundingClientRect().bottom:0, getComputedStyle(h).borderTopWidth]})()")
check("the pick bar lies below the top bar of ComfyUI", r and r[0] >= r[1] + 8, str(r))
check("it has an accent frame (2px)", r and r[2] == "2px", str(r))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
finish(p, br, errs)
