# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 66: the colour picker applies the colour when it is closed (not while dragging); the colour of the strip under the top panel; the recolour in glass themes.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
C = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/controls.js"; M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"
J("""async()=>{const C=await import('%s'); window.__n=0; window.__last=null;
  const host=document.createElement('div'); host.id='cph'; host.style.cssText='position:fixed;left:200px;top:200px;z-index:99999'; document.body.append(host);
  const c=C.colorInput({value:'#336699',palette:[['A','#ff0000']],host,tr:(s)=>s,onChange:(v)=>{window.__n++; window.__last=v}}); host.append(c); }""" % C)
J("()=>document.querySelector('#cph .nde-sw').click()"); pg.wait_for_timeout(300)
J("""()=>{const n=document.querySelector('.nde-colorpop input[type=color]'); for (const v of ['#445566','#556677','#667788']) { n.value=v; n.dispatchEvent(new Event('input',{bubbles:true})); } }""")
pg.wait_for_timeout(200)
check("dragging in the picker does not apply the colour", J("window.__n") == 0, str(J("window.__n")))
check("but the swatch and the field follow", J("()=>document.querySelector('#cph .nde-sw-t').textContent") == "#667788")
J("()=>document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); J("()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:5,clientY:5}))"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("closing the picker applies the colour once", J("window.__n") == 1 and J("window.__last") == "#667788", str([J("window.__n"), J("window.__last")]))
J("()=>document.querySelector('#cph .nde-sw').click()"); pg.wait_for_timeout(300)
J("()=>document.querySelector('.nde-colorpop .nde-cp-c').click()"); pg.wait_for_timeout(200)
check("a colour of the palette applies at once", J("window.__last") == "#ff0000", str(J("window.__last")))
# the strip colour
r = J("""async()=>{const M=await import('%s'); const a=M.normalizeNdUi({view:{bar:{strip:'#102030'}}}), b=M.normalizeNdUi({view:{bar:{strip:'nope'}}}); return [a.view.bar.strip, b.view.bar.strip]}""" % M)
check("the colour of the strip is kept; a bad one is dropped", r == ["#102030", ""], str(r))
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1400)
labs = J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
check("the editor: the colour field of the strip under the top panel", "Strip under the top panel" in labs, str(labs[:40]))
J("window.ndUi.host().editor?.close?.()"); pg.wait_for_timeout(300)
finish(p, br, errs)
