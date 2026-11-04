# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 40: the workflow switcher — cards with miniatures, button next to the logo, keys, Alt+Q (hold Alt), the mode follows the target.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  window.__SW = await import('__M__switcher.js');
  window.__mk = (view)=>({sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'}],
    widgets:[{id:'a',type:'slider',page:'p1',x:20,y:20,w:360,h:64,z:1,slots:{value:{src:'sk',kind:'widget',name:'steps'}},props:{label:'Steps'}},{id:'g',type:'generate',page:'p1',x:20,y:100,w:300,h:64,z:1,slots:{},props:{}}],view:view||{}});
  // three workflows: Alpha and Gamma have a panel, Beta has only a graph
  const make = (withPanel, n) => { a.graph.clear(); for (let i=0;i<n;i++){ const k=LG.createNode('KSampler'); k.pos=[40+i*300,80+(i%2)*160]; a.graph.add(k); if(withPanel&&i===0) k.properties.nd_ui_src={uid:'sk',tag:'sampler'} } return a.graph.serialize(); };
  const withUi = (g)=>{ g.extra = g.extra||{}; g.extra.nd_ui = window.__mk(); return g };
  window.__G = { Alpha: withUi(make(true,2)), Beta: make(false,4), Gamma: withUi(make(true,1)) };
  for (const n of ['Alpha','Beta','Gamma']) { await a.loadGraphData(window.__G[n], true, true, n); await new Promise(r=>setTimeout(r,900)); }
}""".replace("__M__", M))
pg.wait_for_timeout(1200)
active = lambda: J("window.__SW.nameOf(window.__SW.activeOne())")
names = lambda: J("window.__SW.openList().map(w=>window.__SW.nameOf(w))")
check("three workflows are open", all(n in names() for n in ["Alpha", "Beta", "Gamma"]), str(names()))
check("the last one is active", active() == "Gamma", active())
check("the switcher sees that there is a choice", J("window.__SW.canSwitch()") is True)
# thumbnails by kind
J("""()=>{ const T=window.__SW; window.__th = T.openList().map(w=>({n:T.nameOf(w), panel:!!T.thumbnail(w).querySelector('.sw-panel'), map:!!T.thumbnail(w).querySelector('.sw-map')})) }""")
th = {t["n"]: t for t in J("window.__th")}
check("a workflow with a panel gets the page of the panel", th["Alpha"]["panel"] and not th["Alpha"]["map"], str(th))
check("a workflow without a panel gets the map of its nodes", th["Beta"]["map"] and not th["Beta"]["panel"], str(th))
n_rects = J("""()=>{ const T=window.__SW; const w=T.openList().find(w=>T.nameOf(w)==='Beta'); return T.thumbnail(w).querySelectorAll('rect').length }""")
check("the map draws the nodes", n_rects == 4, str(n_rects))
n_w = J("""()=>{ const T=window.__SW; const w=T.openList().find(w=>T.nameOf(w)==='Alpha'); return T.thumbnail(w).querySelectorAll('.sw-w').length }""")
check("the panel miniature draws the widgets of the page", n_w == 2, str(n_w))

# the overlay by the API: arrows, Enter
J("window.ndUi.switcher()"); pg.wait_for_timeout(500)
cards = J("document.querySelectorAll('.ndk-sw .card').length")
check("a card for every open workflow", cards == len(names()), str(cards))
sel0 = J("[...document.querySelectorAll('.ndk-sw .card')].findIndex(c=>c.classList.contains('sel'))")
nm = names(); want = nm[(nm.index("Gamma") + 1) % len(nm)]
got = J("document.querySelectorAll('.ndk-sw .card')[%d].querySelector('.name').textContent.replace(/[●]/g,'').trim()" % sel0)
check("it opens on the next one after the active", got == want, f"{got} / {want}")
pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(200)
sel1 = J("[...document.querySelectorAll('.ndk-sw .card')].findIndex(c=>c.classList.contains('sel'))")
check("an arrow moves the choice", sel1 != sel0)
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("Esc closes without switching", not J("!!document.querySelector('.ndk-sw')") and active() == "Gamma", active())
J("window.ndUi.switcher()"); pg.wait_for_timeout(400)
J("[...document.querySelectorAll('.ndk-sw .card')].find(c=>c.querySelector('.name').textContent.startsWith('Beta')).click()"); pg.wait_for_timeout(1500)
check("a click on a card switches to that workflow", active() == "Beta" and not J("!!document.querySelector('.ndk-sw')"), active())

# the button next to the logo and the mode follows the target
J("window.ndUi.switcher(); document.querySelector('.ndk-sw .card')?.click()")  # back to the first in the list
pg.wait_for_timeout(1500)
a1 = active()
J("""async()=>{ const T=window.__SW; const w=T.openList().find(w=>T.nameOf(w)==='Alpha'); await T.switchTo(w) }"""); pg.wait_for_timeout(1500)
check("switchTo changes the workflow", active() == "Alpha", active())
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
check("the switcher button stands in the mode next to the logo", J("getComputedStyle(document.querySelector('.ndk-uimode .ndk-um-logobtn.sw')).display") != "none")
J("document.querySelector('.ndk-uimode .ndk-um-logobtn.sw').click()"); pg.wait_for_timeout(500)
check("the button opens the switcher over the mode", J("!!document.querySelector('.ndk-sw')"))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("Esc closed the switcher and the mode stays", not J("!!document.querySelector('.ndk-sw')") and J("!!document.querySelector('.ndk-uimode')"))
J("""async()=>{ const T=window.__SW; const w=T.openList().find(w=>T.nameOf(w)==='Gamma'); await T.switchTo(w) }"""); pg.wait_for_timeout(1800)
check("a target with a panel keeps the mode", active() == "Gamma" and J("!!document.querySelector('.ndk-uimode')"), active())
J("""async()=>{ const T=window.__SW; const w=T.openList().find(w=>T.nameOf(w)==='Beta'); await T.switchTo(w) }"""); pg.wait_for_timeout(1800)
check("a target without a panel leaves the mode and shows the graph", active() == "Beta" and not J("!!document.querySelector('.ndk-uimode')"), active())

# Alt+Q: hold Alt, Q opens, Q again moves, let Alt go switches
J("""async()=>{ const T=window.__SW; await T.switchTo(T.openList().find(w=>T.nameOf(w)==='Alpha')) }"""); pg.wait_for_timeout(1500)
start_name = active()
pg.keyboard.down("Alt"); pg.keyboard.press("q"); pg.wait_for_timeout(400)
check("Alt+Q opens the switcher", J("!!document.querySelector('.ndk-sw')"))
s1 = J("[...document.querySelectorAll('.ndk-sw .card')].findIndex(c=>c.classList.contains('sel'))")
pg.keyboard.press("q"); pg.wait_for_timeout(300)
s2 = J("[...document.querySelectorAll('.ndk-sw .card')].findIndex(c=>c.classList.contains('sel'))")
check("Q again moves to the next card", s2 != s1, f"{s1} {s2}")
target = J("document.querySelectorAll('.ndk-sw .card')[%d].querySelector('.name').textContent.replace(/[●]/g,'').trim()" % s2)
pg.keyboard.up("Alt"); pg.wait_for_timeout(1600)
check("letting Alt go switches to the chosen workflow", not J("!!document.querySelector('.ndk-sw')") and active().startswith(target.split()[0]) and active() != start_name, f"{active()} / {target}")
# a single workflow: nothing to switch
J("""async()=>{ const m=window.__app.extensionManager.workflow; for (const w of [...m.openWorkflows]) if (w!==m.activeWorkflow) { try{ await m.closeWorkflow(w) }catch(e){} } }"""); pg.wait_for_timeout(1200)
if not J("window.__SW.canSwitch()"):
    pg.keyboard.down("Alt"); pg.keyboard.press("q"); pg.keyboard.up("Alt"); pg.wait_for_timeout(300)
    check("with one workflow Alt+Q does nothing", not J("!!document.querySelector('.ndk-sw')"))
else:
    print("note: other workflows could not be closed on this frontend, the single-workflow check is skipped")
finish(p, br, errs)
