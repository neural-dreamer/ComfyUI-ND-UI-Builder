# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 57: the themes Lime Noir and Frost (frosted glass with a gradient of your own).
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
K = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/kit.js"; M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"
r = J("""async()=>{const K=await import('%s'), M=await import('%s'); const u=M.normalizeNdUi({theme:{id:'limenoir'}}); const t=K.tokensOf(u);
  const f=M.normalizeNdUi({theme:{id:'frost'}}); const ft=K.tokensOf(f);
  return {ids:K.THEME_IDS, lime:[t.bg,t.accent,t.onAccent], frost:f.theme.frost, ftok:{blur:ft.blur,accent:ft.accent,page:ft.page.slice(0,40), s2:ft.s2, sw:ft.sw}}}""" % (K, M))
check("both themes are in the list", "limenoir" in r["ids"] and "frost" in r["ids"], str(r["ids"]))
check("Lime Noir: black, lime accent, dark text on the accent", r["lime"] == ["#0a0a0a", "#d1fe17", "#0a0a0a"], str(r["lime"]))
check("Frost has defaults (teal, mint accent, blur 18)", r["frost"]["accent"] == "#8ee3cf" and r["frost"]["blur"] == 18 and r["frost"]["g1"] == "#12363a", str(r["frost"]))
check("Frost tokens: translucent cards, blur, gradient page", r["ftok"]["blur"] == "18px" and "rgba(" in r["ftok"]["s2"] and "gradient" in r["ftok"]["page"] and len(r["ftok"]["sw"]) == 4, str(r["ftok"]))
n = J("""async()=>{const M=await import('%s'); const u=M.normalizeNdUi({theme:{id:'frost',frost:{tint:'nope',accent:'#ff0000',angle:999,blur:-5,opacity:9,g3:''}}}); return u.theme.frost}""" % M)
check("bad Frost values are cleaned; an empty third colour stays empty", n["tint"] == "#ffffff" and n["accent"] == "#ff0000" and n["angle"] == 360 and n["blur"] == 0 and n["opacity"] == 0.4 and n["g3"] == "", str(n))
fa = J("""async()=>{const K=await import('%s'); return K.frostFromAccent('#ff8800')}""" % K)
check("a gradient can be made from an accent (three dark tones)", all(v.startswith("#") for v in fa.values()) and set(fa) == {"g1", "g2", "g3"}, str(fa))
# in the mode: the variables follow the theme
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[{id:'a',type:'generate',page:'p1',x:40,y:60,w:240,h:64,z:1,slots:{},props:{}}],view:{},theme:{id:'limenoir'}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(500)
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
v = lambda: J("()=>{const r=document.querySelector('.ndk-uimode'); const c=getComputedStyle(r); return [c.getPropertyValue('--ndk-accent').trim(), c.getPropertyValue('--ndk-bg').trim()||c.getPropertyValue('--ndk-s1').trim()]}")
check("Lime Noir in the mode: the accent is lime", v()[0] == "#d1fe17", str(v()))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.theme.id='frost'; u.theme.frost.accent='#ff4081'; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(700)
check("Frost in the mode: the accent follows the settings", v()[0] == "#ff4081", str(v()))
bg = J("()=>getComputedStyle(document.querySelector('.ndk-uimode .ndk-um-stage, .ndk-uimode')).backgroundImage + ''")
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
# the editor
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
th = J("()=>[...document.querySelectorAll('.nde-theme')].map(b=>b.dataset.theme)")
check("the editor lists both themes", "limenoir" in th and "frost" in th, str(th))
J("()=>document.querySelector('.nde-theme[data-theme=limenoir]').click()"); pg.wait_for_timeout(400)
check("choosing Lime Noir sets the theme", J("()=>window.ndUi.host().editor.ui.theme.id") == "limenoir")
J("()=>document.querySelector('.nde-theme[data-theme=frost]').click()"); pg.wait_for_timeout(500)
labs = J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
check("Frost shows its settings", all(x in labs for x in ["Glass tint", "Gradient 1", "Gradient 2", "Gradient 3", "Gradient angle", "Blur behind the cards", "Opacity of the cards"]), str(labs))
before = J("()=>JSON.stringify(window.ndUi.host().editor.ui.theme.frost)")
J("()=>[...document.querySelectorAll('.nde-right .nde-btn')].find(b=>b.textContent==='Gradient from the accent').click()"); pg.wait_for_timeout(400)
after = J("()=>JSON.stringify(window.ndUi.host().editor.ui.theme.frost)")
check("«Gradient from the accent» changes the three colours", before != after)
J("()=>{const E=window.ndUi.host().editor; E.change(null,(u)=>{u.theme.frost.blur=30; u.theme.frost.opacity=0.2})}"); pg.wait_for_timeout(300)
fb = J("()=>{const r=document.querySelector('.nde-stage .ndk, .nde-stage'); return getComputedStyle(document.querySelector('.nde-stage .ndk')||r).getPropertyValue('--ndk-blur')||''}")
check("the editor stage follows (no console errors, settings kept)", J("()=>window.ndUi.host().editor.ui.theme.frost.blur") == 30)
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
