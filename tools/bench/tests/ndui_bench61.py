# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 61: the top panel (logo, tabs, buttons) follows the theme: shape, colours; and its own look.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"
r = J("""async()=>{const M=await import('%s'); const d=M.normalizeNdUi({}).view.bar, b=M.normalizeNdUi({view:{bar:{shape:'pill',bg:'#112233',fg:'bad',border:'#445566',opacity:500,blur:-3}}}).view.bar; return {d,b}}""" % M)
check("defaults: as the theme", r["d"] == {"shape": "", "bg": "", "fg": "", "border": "", "strip": "", "opacity": 78, "blur": 10}, str(r["d"]))
check("bad values are cleaned", r["b"] == {"shape": "pill", "bg": "#112233", "fg": "", "border": "#445566", "strip": "", "opacity": 100, "blur": 0}, str(r["b"]))
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[],pages:[{id:'p1',name:'Main'},{id:'p2',name:'Two'}],widgets:[{id:'a',type:'generate',page:'p1',x:40,y:60,w:240,h:64,z:1,slots:{},props:{}}],view:{},kit:{shape:'sharp'},theme:{id:'midnight'}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(500)
J("window.ndUi.enter()"); pg.wait_for_timeout(900)
q = lambda: J("""()=>{const r=document.querySelector('.ndk-uimode'), c=getComputedStyle(r), t=getComputedStyle(r.querySelector('.ndk-um-tabs')), l=getComputedStyle(r.querySelector('.ndk-um-logobtn'));
  return {r:c.getPropertyValue('--ndk-bar-r').trim(), bg:c.getPropertyValue('--ndk-bar-bg').trim(), fg:c.getPropertyValue('--ndk-bar-fg').trim(), tabR:t.borderTopLeftRadius, logoR:l.borderTopLeftRadius, tabBg:t.backgroundColor, logoFg:l.color, bd:t.borderTopColor}}""")
s = q()
check("sharp kit: the top panel is sharp too", s["r"] == "6px" and s["tabR"] == "6px" and s["logoR"] == "6px", str(s))
def setk(shape=None, theme=None, bar=None, borders=None):
    J("""(a)=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); if(a.shape) u.kit.shape=a.shape; if(a.theme) u.theme.id=a.theme; if(a.bar) Object.assign(u.view.bar,a.bar); if(a.borders!==null) u.theme.borders=a.borders; window.ndUi.host().save(u)}""", {"shape": shape, "theme": theme, "bar": bar, "borders": borders}); pg.wait_for_timeout(700)
setk(shape="pill"); s = q()
check("pill kit: the top panel is a pill", s["r"] == "99px" and s["tabR"] != "6px", str(s))
setk(shape="rounded"); s = q()
check("rounded kit: 12 px", s["r"] == "12px", str(s))
a = q(); setk(theme="limenoir"); b = q()
check("another theme: the panel colours change", a["bg"] != b["bg"] and a["fg"] != b["fg"], str((a, b)))
setk(bar={"shape": "sharp", "bg": "#102030", "fg": "#ffeedd", "border": "#ff0000", "opacity": 100}); s = q()
check("its own look: shape, background, text and border", s["r"] == "6px" and s["bg"] == "#102030" and s["fg"] == "#ffeedd" and s["tabBg"] == "rgb(16, 32, 48)" and s["bd"] == "rgb(255, 0, 0)" and s["logoFg"] == "rgb(255, 238, 221)", str(s))
setk(bar={"bg": "", "border": "", "fg": "", "shape": ""}, borders=False); s = q()
check("borders off in the theme: the panel border goes", s["bd"] in ("rgba(0, 0, 0, 0)", "transparent"), str(s))
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
labs = J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
check("the editor: the look of the top panel", all(x in labs for x in ["Top panel shape", "Top panel background", "Top panel opacity", "Top panel text", "Top panel border", "Top panel blur"]), str(labs))
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
