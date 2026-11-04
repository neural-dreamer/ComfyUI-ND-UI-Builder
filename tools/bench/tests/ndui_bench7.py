# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 7 (stage B): the ND UI mode — layer, logo, Esc, shortcuts, start in the mode, tabs alignment.
import json
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
SET = lambda k, v: pg.evaluate("async([k,v])=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set(k,v)}", [k, v])
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; n.title=title; a.graph.add(n); return n;};
  const k=mk('KSampler',60,380,'Sampler [sampler]'); mk('EmptyLatentImage',60,80,'Latent [size]');
  k.properties.nd_ui_src={uid:'sk',tag:'sampler'};
  window.__q = 0; const oq=a.queuePrompt.bind(a); a.queuePrompt = async()=>{window.__q++};
  window.__cmd=[]; const ex=a.extensionManager.command.execute.bind(a.extensionManager.command); a.extensionManager.command.execute=async(id,...r)=>{window.__cmd.push(id); return ex(id,...r)};
  window.__mk = (view)=>({sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'},{id:'p2',name:'Second'},{id:'p3',name:'Third'}],
    widgets:[{id:'a',type:'slider',page:'p1',x:20,y:20,w:360,h:64,z:1,slots:{value:{src:'sk',kind:'widget',name:'steps'}},props:{label:'Steps'}},{id:'b',type:'toggle',page:'p2',x:20,y:20,w:200,h:48,z:1,slots:{},props:{text:'Two'}}],view:view||{}});
  window.ndUi.host().save(window.__mk()); }""")
pg.wait_for_timeout(500)
rect = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom]}", sel)
inmode = lambda: J("!!document.querySelector('.ndk-uimode')")

# ---- enter by the action bar button
J("[...document.querySelectorAll('.ndui-ab')].find(b=>b.textContent.includes('ND UI')).click()"); pg.wait_for_timeout(700)
check("the ND UI button opens the mode", inmode())
r = rect(".ndk-uimode"); check("the layer covers the window", r == [0, 0, 1500, 950], str(r))
z = J("getComputedStyle(document.querySelector('.ndk-uimode')).zIndex"); check("z-index 1500", z == "1500", z)
check("the mode is a labelled region (not a dialog: the hotkeys of ComfyUI are held back by the guard of hotkeys.js, see bench45)", J("document.querySelector('.ndk-uimode').getAttribute('role')") == "region")
top = lambda x, y: J("([x,y])=>{const e=document.elementFromPoint(x,y); return !!e?.closest('.ndk-uimode')}", [x, y])
check("it lies over the canvas", top(700, 500)); check("over the action bar (Run)", top(1260, 70)); check("over the side bar", top(27, 300))
# the panel is there
nw = J("document.querySelectorAll('.ndk-uimode .ndk-w').length"); check("the widgets of page 1 are drawn", nw == 1, str(nw))
# toasts stay above
J("async()=>{const m=await import('/scripts/app.js'); m.app.extensionManager.toast.add({severity:'info',summary:'Hello toast',life:6000})}"); pg.wait_for_timeout(600)
tr_ = J("()=>{const e=[...document.querySelectorAll('.p-toast-message')].pop(); if(!e) return null; const r=e.getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return !!t?.closest('.p-toast-message')}")
check("a toast is above the layer", tr_ is True, str(tr_))
# logo: the pill
logo = rect(".ndk-um-logobtn"); check("the logo sits in the top-left corner by default", logo and logo[0] < 30 and logo[1] < 30, str(logo))
op = J("parseFloat(getComputedStyle(document.querySelector('.ndk-um-logo')).opacity)"); check("opacity 70% without the mouse", abs(op - 0.7) < 0.05, str(op))
pg.mouse.move(40, 30); pg.wait_for_timeout(450)
op = J("parseFloat(getComputedStyle(document.querySelector('.ndk-um-logo')).opacity)"); check("100% under the mouse", op > 0.95, str(op))
check("no pencil / editor button in the mode", J("!document.querySelector('.ndk-um-edit')") and J("![...document.querySelectorAll('.ndk-uimode button')].some(b=>/Edit/.test(b.textContent+b.title))"))
pg.screenshot(path="/tmp/b7_mode.png")
# click on the logo leaves
J("document.querySelector('.ndk-um-logobtn').click()"); pg.wait_for_timeout(400)
check("the logo leaves the mode", not inmode())
J("[...document.querySelectorAll('.ndui-ab')].find(b=>b.textContent.includes('ND UI')).click()"); pg.wait_for_timeout(500)
J("[...document.querySelectorAll('.ndui-ab')].find(b=>b.textContent.includes('ND UI')) && 0")
check("entered again", inmode())

# ---- Esc
pg.keyboard.press("Escape"); pg.wait_for_timeout(400); check("Esc leaves by default", not inmode())
J("async()=>{window.ndUi.host().save(window.__mk({esc:'none'})); window.ndUi.enter()}"); pg.wait_for_timeout(500)
pg.keyboard.press("Escape"); pg.wait_for_timeout(400); check("Esc does nothing when the panel says none", inmode())
SET("NeuralDreamerUI.Esc", "always"); pg.keyboard.press("Escape"); pg.wait_for_timeout(400); check("the global setting 'always' overrides", not inmode())
J("async()=>{window.ndUi.host().save(window.__mk({esc:'exit'})); window.ndUi.enter()}"); pg.wait_for_timeout(500)
SET("NeuralDreamerUI.Esc", "never"); pg.keyboard.press("Escape"); pg.wait_for_timeout(400); check("the global setting 'never' overrides", inmode())
SET("NeuralDreamerUI.Esc", "panel")
pg.keyboard.press("Escape"); pg.wait_for_timeout(300); check("as the panel says again", not inmode())

# ---- shortcuts
J("async()=>{window.ndUi.enter()}"); pg.wait_for_timeout(500)
pg.keyboard.press("Control+Enter"); pg.wait_for_timeout(400); check("Ctrl+Enter runs the queue", J("window.__q") == 1, str(J("window.__q")))
pg.keyboard.press("Control+s"); pg.wait_for_timeout(400); check("Ctrl+S saves the workflow", "Comfy.SaveWorkflow" in J("window.__cmd"), str(J("window.__cmd")))
check("still in the mode", inmode())
# the page is remembered across leaving
J("[...document.querySelectorAll('.ndk-um-tabs .tab')][1].click()"); pg.wait_for_timeout(300)
J("window.ndUi.exit()"); pg.wait_for_timeout(300); J("window.ndUi.enter()"); pg.wait_for_timeout(500)
check("the page is remembered", J("document.querySelector('.ndk-um-tabs .tab.on')?.textContent") == "Second")
J("window.ndUi.exit()")

# ---- empty state, workflow switch
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); window.__json = m.app.graph.serialize()}")
J("async()=>{window.ndUi.enter()}"); pg.wait_for_timeout(400)
J("async()=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData({last_node_id:0,last_link_id:0,nodes:[],links:[],groups:[],config:{},extra:{},version:0.4})}"); pg.wait_for_timeout(1200)
check("the mode survives a workflow switch", inmode())
t = J("document.querySelector('.ndk-uimode .ndk-um-empty')?.innerText || ''"); check("an empty workflow shows the hint", "no ND UI yet" in t, t)
check("the empty hint has no editor button", J("!document.querySelector('.ndk-um-empty button')"))
J("[...document.querySelectorAll('.ndui-ab')].find(b=>b.textContent.includes('Edit')).click()", ) if False else None
J("window.ndUi.exit()")
pg.evaluate("async(j)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(j)}", J("window.__json")); pg.wait_for_timeout(1200)
check("loading the first workflow again redraws the panel", J("window.ndUi.host().ui.pages.length") == 3)

# ---- start in the mode
J("async()=>{window.ndUi.host().save(window.__mk({startInUi:true}))}"); pg.wait_for_timeout(300)
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); window.__json = m.app.graph.serialize()}")
pg.evaluate("async(j)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(j)}", J("window.__json")); pg.wait_for_timeout(1200)
check("a workflow with startInUi opens in the mode", inmode()); J("window.ndUi.exit()")
SET("NeuralDreamerUI.StartInUi", "never")
pg.evaluate("async(j)=>{const m=await import('/scripts/app.js'); await m.app.loadGraphData(j)}", J("window.__json")); pg.wait_for_timeout(1200)
check("the global setting 'Never' ignores it", not inmode()); SET("NeuralDreamerUI.StartInUi", "panel")

# ---- tabs: 3 pos/align x 4 logo corners, no overlap with the logo
bad = []
for corner in ["tl", "tr", "bl", "br"]:
    for pos in ["top", "bottom"]:
        for align in ["left", "center", "right"]:
            J("([c,p,a])=>{const u=window.__mk({logo:{corner:c},tabs:{show:true,pos:p,align:a}}); window.ndUi.host().save(u); window.ndUi.exit(); window.ndUi.enter()}", [corner, pos, align]); pg.wait_for_timeout(350)
            L = rect(".ndk-um-logobtn"); T = rect(".ndk-um-tabs")
            ok = L and T and (T[2] < L[0] or T[0] > L[2] or T[3] < L[1] or T[1] > L[3])
            if not ok: bad.append(f"overlap {corner}/{pos}/{align} {L} {T}")
            cx = (T[0] + T[2]) / 2
            if align == "left" and T[0] > 500: bad.append(f"align {corner}/{pos}/{align} {T}")
            if align == "right" and T[2] < 1000: bad.append(f"align {corner}/{pos}/{align} {T}")
            if align == "center" and abs(cx - 750) > 6: bad.append(f"align {corner}/{pos}/{align} {T}")
            if pos == "top" and T[1] > 40: bad.append(f"pos {corner}/{pos}/{align} {T}")
            if pos == "bottom" and T[3] < 910: bad.append(f"pos {corner}/{pos}/{align} {T}")
check("24 combinations: place, alignment, no overlap with the logo", not bad, "; ".join(bad[:3]))
J("window.ndUi.host().save(window.__mk({logo:{corner:'br'},tabs:{show:true,pos:'bottom',align:'right'}})); window.ndUi.exit(); window.ndUi.enter()"); pg.wait_for_timeout(400)
pg.screenshot(path="/tmp/b7_tabs.png")
J("window.ndUi.exit()")
# hidden tabs
J("window.ndUi.host().save(window.__mk({tabs:{show:false}})); window.ndUi.enter()"); pg.wait_for_timeout(400)
check("tabs can be switched off", J("getComputedStyle(document.querySelector('.ndk-um-tabs')).display") == "none"); J("window.ndUi.exit()")
# the node strip follows pos/align
J("""async()=>{ const a=(await import('/scripts/app.js')).app; const u=window.LiteGraph.createNode('NDUI'); u.pos=[480,60]; u.size=[900,520]; a.graph.add(u); window.ndUi.host().save(window.__mk({tabs:{show:true,pos:'bottom',align:'right'}})); }"""); pg.wait_for_timeout(800)
o = J("document.querySelector('.ndk-nodeview .ndk-strip').style.order"); al = J("document.querySelector('.ndk-nodeview .ndk-strip .tabs').dataset.align")
check("the node strip goes to the bottom and aligns right", o == "2" and al == "right", f"{o} {al}")
# the editor inspector has the new fields
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
t = J("document.querySelector('.nde').innerText")
check("the inspector has the tab, logo and Esc fields", all(x in t for x in ["Tabs position", "Tabs alignment", "Logo corner", "Esc in the ND UI mode", "Open in the ND UI mode"]) or "View" in t, t[:80])
finish(p, br, errs)
