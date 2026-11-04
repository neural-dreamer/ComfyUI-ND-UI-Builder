# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 60: Use blur (a widget and its lists), borders of the theme, the shadow of the theme.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
K = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/kit.js"; M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/model.js"
r = J("""async()=>{const K=await import('%s'), M=await import('%s');
  const u=M.normalizeNdUi({theme:{id:'frost'}}); const t=K.tokensOf(u), v=K.varsFor(t,u.kit,{}), vo=K.varsFor(t,u.kit,{blur:false});
  const n=M.normalizeNdUi({theme:{borders:false,shadow:{blur:60,strength:150,color:'#ff0000'}}}); const tn=K.tokensOf(n), vn=K.varsFor(tn,n.kit,{}), vb=K.varsFor(tn,n.kit,{border:'#00ff00'});
  const d=M.normalizeNdUi({}); const bad=M.normalizeNdUi({theme:{shadow:{blur:999,strength:-4,color:'zzz'}}});
  const l=M.normalizeLook({blur:false}), l2=M.normalizeLook({blur:true});
  return {blur:v['--ndk-field-blur'], blurOff:vo['--ndk-field-blur'], on:v['--ndk-blur-on'], off:vo['--ndk-blur-on'], noB:[vn['--ndk-cbd'],vn['--ndk-field-border'],vn['--ndk-cbds']], ownB:vb['--ndk-cbd'], sh:[vn['--ndk-sh-blur'], tn.shadow], dflt:[d.theme.borders, d.theme.shadow], bad:bad.theme.shadow, l:[l.blur,l2.blur]}}""" % (K, M))
check("Frost: the blur of the theme reaches the widget", r["blur"] == "18px" and r["on"] == "1", str(r))
check("Use blur off: no blur and the flag is 0", r["blurOff"] == "0px" and r["off"] == "0", str(r))
check("borders off: card, field and strong borders are transparent", r["noB"] == ["transparent", "transparent", "transparent"], str(r["noB"]))
check("a colour set on the widget still shows", r["ownB"] == "#00ff00", str(r["ownB"]))
check("shadow: blur and colour from the theme settings", r["sh"][0] == "60px" and r["sh"][1].startswith("rgba(255,0,0,"), str(r["sh"]))
check("defaults: borders on, shadow 30 / 100%", r["dflt"] == [True, {"blur": 30, "strength": 100, "color": ""}], str(r["dflt"]))
check("bad shadow values are cleaned", r["bad"] == {"blur": 120, "strength": 0, "color": ""}, str(r["bad"]))
check("look.blur: only false is kept", r["l"] == [False, None], str(r["l"]))
# a page with a dropdown on a panel
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const k=LG.createNode('KSampler'); k.pos=[60,380]; k.title='Sampler [sampler]'; k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; a.graph.add(k);
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'}],widgets:[
   {id:'pan',type:'panel',page:'p1',x:20,y:20,w:500,h:260,z:1,slots:{},props:{label:'P'},look:{}},
   {id:'dd',type:'dropdown',page:'p1',x:40,y:80,w:300,h:64,z:2,slots:{value:{src:'sk',kind:'widget',name:'sampler_name'}},props:{label:'Sampler'},look:{}}],view:{},theme:{id:'frost'}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(500)
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
def popup_state():
    J("()=>{document.querySelector('.ndk-uimode [data-ndw=dd] .ndk-field, .ndk-uimode .ndk-field').click()}"); pg.wait_for_timeout(300)
    s = J("()=>{const p=document.querySelector('.ndk-pop'); if(!p) return null; const c=getComputedStyle(p); return {bf:c.backdropFilter||c.webkitBackdropFilter, blur:p.dataset.blur, bd:c.borderTopColor}}")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    return s
s1 = popup_state()
check("the list of a drop-down is blurred (Frost, Use blur on)", s1 and "blur(18px)" in (s1["bf"] or "") and s1["blur"] == "1", str(s1))
panel_bf = J("()=>getComputedStyle(document.querySelector('.ndk-uimode .ndk-panel-box')).backdropFilter")
check("the panel is blurred", "blur(18px)" in panel_bf, panel_bf)
# Use blur off for the drop-down only
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.widgets.find(w=>w.id==='dd').look.blur=false; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(700)
s2 = popup_state()
check("Use blur off on the widget: its list has no blur and a solid look", s2 and ("blur(0px)" in (s2["bf"] or "") or (s2["bf"] or "") in ("none", "")) and s2["blur"] == "0", str(s2))
# borders off, shadow
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.theme.borders=false; u.theme.shadow={blur:90,strength:200,color:'#00ff88'}; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(700)
st = J("()=>{const b=document.querySelector('.ndk-uimode .ndk-panel-box'), c=getComputedStyle(b); return {bd:c.borderTopColor, sh:c.boxShadow}}")
check("borders off: the panel line is transparent", st["bd"] in ("rgba(0, 0, 0, 0)", "transparent"), str(st))
check("the shadow follows the theme settings (colour and size)", "0, 255, 136" in st["sh"] and "90px" in st["sh"], str(st))
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
# the editor
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
labs = J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
check("theme settings: borders and shadow", all(x in labs for x in ["Borders of the widgets", "Shadow blur", "Shadow strength", "Shadow colour"]), str(labs))
J("()=>{const E=window.ndUi.host().editor; E.select(['dd'])}"); pg.wait_for_timeout(500)
labs = J("()=>[...document.querySelectorAll('.nde-right .nde-lab')].map(l=>l.textContent)")
check("a widget has Use blur", "Use blur" in labs, str(labs))
J("window.ndUi.host().editor?.close?.()")
pg.wait_for_timeout(300)
finish(p, br, errs)
