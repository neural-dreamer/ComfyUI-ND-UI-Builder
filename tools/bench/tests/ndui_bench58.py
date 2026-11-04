# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 58: ND Slider / ND Resolution as sources (virtual parameters), Resolution options, widget tooltips, toolbar separator glow.
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
BASE = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const s = LG.createNode('NDValueSlider'); s.pos=[40,60]; a.graph.add(s);
  const r = LG.createNode('NDResolution'); r.pos=[40,300]; a.graph.add(r);
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,520]; a.graph.add(u);
  s.properties.nd_ui_src={uid:'ss',tag:'sl'}; r.properties.nd_ui_src={uid:'sr',tag:'rs'};
  const sw = s.widgets.find(w=>w.name==='state'); sw.value = JSON.stringify({value:7,min:0,max:20,step:1,integer:true}); s.ndSlider?.restore?.();
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  const B=(s,n)=>({src:s,kind:'widget',name:n});
  const ui={sources:[{uid:'ss',tag:'sl',class:'NDValueSlider',title:'ND Slider'},{uid:'sr',tag:'rs',class:'NDResolution',title:'ND Resolution'}],pages:[{id:'p1',name:'Main'}],
    widgets:[W('a','slider',20,20,360,64,{value:B('ss','value')},{label:'Steps',tip:'How many steps'}),W('b','number',20,110,240,64,{value:B('ss','value')},{label:'Num'}),
             W('c','resolution',20,200,420,176,{width:B('sr','width'),height:B('sr','height')},{label:'Size'})],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); u.ndUiApi?.reload?.(); }""")
pg.wait_for_timeout(800)
res = J("""async()=>{const S=await import('%ssources.js');
  const g=(await import('/scripts/app.js')).app.graph; const s=g._nodes.find(n=>n.type==='NDValueSlider'), r=g._nodes.find(n=>n.type==='NDResolution');
  const ps=S.listParams(s), pr=S.listParams(r);
  const v=S.paramByName(s,'value'); const before=S.readParam(v); S.writeParam(v, 13);
  const st=JSON.parse(s.widgets.find(w=>w.name==='state').value);
  const w=S.paramByName(r,'width'), h=S.paramByName(r,'height'); const r0=[S.readParam(w),S.readParam(h)];
  S.writeParam(w, 768); const r1=[S.readParam(S.paramByName(r,'width')),S.readParam(S.paramByName(r,'height'))];
  S.writeParam(S.paramByName(r,'height'), 1344); const r2=r.ndRes.size();
  return {slider:ps.map(p=>[p.name,p.ptype,p.min,p.max,p.step]), res:pr.filter(p=>p.virtual).map(p=>[p.name,p.ptype]), before, st, r0, r1, r2, mult:w.step}}""" % BASE)
check("ND Slider appears in the parameters as an INT 'value' with its range", any(x[0]=="value" and x[1]=="INT" and x[2]==0 and x[3]==20 for x in res["slider"]), str(res))
check("reading gives the value of the node", res["before"] == 7, str(res))
check("writing changes the state of the node (snapped)", res["st"]["value"] == 13, str(res))
check("ND Resolution gives width and height", [x[0] for x in res["res"]] == ["width", "height"], str(res))
check("width written -> the node outputs it", res["r1"][0] == 768, str(res))
check("height written -> the node outputs both", res["r2"] == [768, 1344], str(res))
# widgets in the mode
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
val = J("()=>{const i=document.querySelectorAll('.ndk-uimode .ndk-w'); return [...i].map(f=>[f.querySelector('.ndk-label')?.textContent, f.querySelector('input')?.value])}")
check("the slider and the number show the node's value", any(v[0]=="Num" and v[1]=="13" for v in val), str(val))
sz = J("()=>[...document.querySelectorAll('.ndk-uimode .ndk-res .ndk-input')].map(i=>i.value)")
check("the Resolution widget shows the node's size", sz == ["768", "1344"], str(sz))
J("()=>{const i=[...document.querySelectorAll('.ndk-uimode .ndk-res .ndk-input')][0]; i.focus(); i.value='1024'; i.dispatchEvent(new Event('change',{bubbles:true}))}"); pg.wait_for_timeout(500)
z = J("async()=>{const g=(await import('/scripts/app.js')).app.graph; return g._nodes.find(n=>n.type==='NDResolution').ndRes.size()}")
check("typing a width in the widget reaches ND Resolution", z[0] == 1024, str(z))
# options of the Resolution widget: the chips are optional
chips = lambda: J("()=>[...document.querySelectorAll('.ndk-uimode .ndk-res-opts .ndk-chip')].map(c=>getComputedStyle(c).display!=='none')")
check("both chips show by default", chips() == [True, True], str(chips()))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); const w=u.widgets.find(w=>w.id==='c'); w.props.showFam=false; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(600)
check("the size of the model can be hidden", chips() == [False, True], str(chips()))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); const w=u.widgets.find(w=>w.id==='c'); w.props.showMul=false; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(600)
check("and the multiple too", chips() == [False, False], str(chips()))
# the default 1:1 button still uses the hidden multiple / family
J("()=>document.querySelector('.ndk-uimode .ndk-res-ratios .ndk-chip').click()"); pg.wait_for_timeout(400)
z = J("async()=>{const g=(await import('/scripts/app.js')).app.graph; return g._nodes.find(n=>n.type==='NDResolution').ndRes.size()}")
check("hidden options still work (ratio button gives a square)", z[0] == z[1], str(z))
# tooltips
box = J("()=>{const f=[...document.querySelectorAll('.ndk-uimode .ndk-w')].find(f=>f.dataset.ndtip); return f? f.dataset.ndtip : null}")
check("the widget carries its tooltip text", box == "How many steps", str(box))
J("()=>{const f=document.querySelector('.ndk-uimode .ndk-w[data-ndtip]'); const r=f.getBoundingClientRect(); window.__tipf=f; f.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,clientX:r.left+5,clientY:r.top+5}))}")
pg.wait_for_timeout(250)
check("not at once", not J("!!document.querySelector('.ndk-tip') && getComputedStyle(document.querySelector('.ndk-tip')).display!=='none'"))
pg.wait_for_timeout(400)
check("after a short rest the tooltip shows", J("(()=>{const t=document.querySelector('.ndk-tip'); return !!t && getComputedStyle(t).display!=='none' && t.textContent==='How many steps'})()"))
J("()=>document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
check("a click hides it", J("getComputedStyle(document.querySelector('.ndk-tip')).display==='none'"))
check("no tooltip when empty", J("()=>[...document.querySelectorAll('.ndk-uimode .ndk-w')].filter(f=>f.dataset.ndtip).length")==1)
# separator
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.toolbar.items=[{id:'t1',kind:'sep',w:20,line:true,variant:'accent',thick:4,scale:100,style:'flat',bg:'',fg:'',border:''}]; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(700)
sp = J("()=>{const e=document.querySelector('.ndk-uimode .ndk-tb-item.sep'); if(!e) return null; const a=getComputedStyle(e,'::after'); return [e.classList.contains('acc'), a.width, a.boxShadow!=='none']}")
check("an accent separator is thick and glows", sp and sp[0] and sp[1] == "4px" and sp[2], str(sp))
it = J("()=>window.ndUi.host().ui.view.toolbar.items[0]")
check("the model keeps variant and thickness", it["variant"] == "accent" and it["thick"] == 4, str(it))
J("""()=>{const u=JSON.parse(JSON.stringify(window.ndUi.host().ui)); u.view.toolbar.items[0].thick=99; u.view.toolbar.items[0].variant='x'; window.ndUi.host().save(u)}"""); pg.wait_for_timeout(500)
it = J("()=>window.ndUi.host().ui.view.toolbar.items[0]")
check("bad values are cleaned", it["thick"] == 8 and it["variant"] == "line", str(it))
# the editor: tooltip field + separator settings
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1200)
J("()=>{const E=window.ndUi.host().editor; E.select(['a'])}"); pg.wait_for_timeout(500)
check("the inspector has a Tooltip field with the text", J("()=>[...document.querySelectorAll('.nde-lab')].some(l=>l.textContent==='Tooltip') && [...document.querySelectorAll('.nde-insp input, .nde-right input')].some(i=>i.value==='How many steps')"))
J("()=>{const E=window.ndUi.host().editor; E.tbSelect?.('t1')}"); pg.wait_for_timeout(500)
check("the separator inspector has Look and Thickness", J("()=>{const l=[...document.querySelectorAll('.nde-lab')].map(x=>x.textContent); return l.includes('Look') && l.includes('Thickness')}"))
J("window.ndUi.host().editor?.close?.()")
finish(p, br, errs)
