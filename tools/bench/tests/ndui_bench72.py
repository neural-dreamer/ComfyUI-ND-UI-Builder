# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 72: the speaker and the volume of the live preview follow the audio VAE pin of the bridge (also when the wire is put or pulled out later), in all widgets with the live preview;
# the Variant Preview: a click on the picture opens it in full size, Save and Full size buttons.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const b = mk('NDUILiveBridge',60,700,'Bridge [bridge]'), vs = mk('NDVariantPreviewSelector',60,900,'Variants [vars]'), u = mk('NDUI',480,60); u.size=[1000,700];
  b.properties.nd_ui_src={uid:'sb',tag:'bridge'}; vs.properties.nd_ui_src={uid:'vs',tag:'vars'}; window.__vs = vs;
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  const L={live:{src:'sb',kind:'live',name:''}};
  u.properties.nd_ui={sources:[{uid:'sb',tag:'bridge',class:'NDUILiveBridge',title:'Bridge [bridge]'},{uid:'vs',tag:'vars',class:'NDVariantPreviewSelector',title:'Variants [vars]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('v1','viewer',10,10,400,260,L,{live:true,results:true,compare:false,sound:true}),
            W('v2','viewer',420,10,400,260,L,{live:true,results:false,compare:true,sound:true}),
            W('v3','viewer',10,280,400,260,L,{live:true,results:true,compare:false,progress:'both',sound:true}),
            W('vp','videoplayer',420,280,400,260,L,{live:true,sound:true}),
            W('vv','variantsel',830,10,300,300,{node:{src:'vs',kind:'variantsel',name:''}},{})],
   view:{}};
  window.ndUi.host().save(u.properties.nd_ui); return {b:b.id}; }""")
pg.wait_for_timeout(900)
J("window.ndUi.enter()"); pg.wait_for_timeout(1000)
SND = "document.querySelectorAll('.ndk-uimode .ndk-vw-tools .snd, .ndk-uimode .ndk-pwl-tools .snd').length"
VOL = "document.querySelectorAll('.ndk-uimode .ndk-vw-vol').length"
check("no audio VAE: no speaker in any widget", J(SND) == 0, str(J(SND)))
check("no audio VAE: no volume in any widget", J(VOL) == 0)
J("""(id)=>{const LG=window.LiteGraph, g=window.__app.graph; const b=g._nodes.find(n=>String(n.id)===String(id)); const v=LG.createNode('VAELoader'); v.pos=[60,420]; g.add(v); window.__vae=v; v.connect(0,b,b.inputs.findIndex(x=>x.name==='audio_vae')); }""", str(ids["b"])); pg.wait_for_timeout(1500)
check("the wire is put: every live widget gets its speaker", J(SND) == 4, str(J(SND)))
J("""(id)=>{const g=window.__app.graph; const b=g._nodes.find(n=>String(n.id)===String(id)); b.disconnectInput(b.inputs.findIndex(x=>x.name==='audio_vae')); g.setDirtyCanvas(true,true)}""", str(ids["b"])); pg.wait_for_timeout(1500)
check("the wire is pulled out: the speakers go away without any other action", J(SND) == 0, str(J(SND)))
check("and the volume goes too", J(VOL) == 0)
# Variant Preview
VS = "document.querySelector('.ndk-uimode .ndk-vs')"
J("""()=>{window.__vs.ndApi.onExecuted({nd_batch:[1,2,3].map(i=>({filename:'v'+i+'.png',subfolder:'',type:'temp',width:832,height:1216})), nd_mode:[false]})}"""); pg.wait_for_timeout(500)
box = J("(()=>{const r=document.querySelector('.ndk-uimode .ndk-vs .stage').getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]})()")
pg.mouse.click(box[0], box[1]); pg.wait_for_timeout(500)
check("a click on the picture opens it in full size", J("!!document.querySelector('.ndk-lightbox')"))
check("the full-size window has the Download button", J("!!document.querySelector('.ndk-lightbox button[title=Download]')"))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("Esc closes it", not J("!!document.querySelector('.ndk-lightbox')"))
check("the Save and Full size buttons are on the widget", J("!!document.querySelector('.ndk-uimode .ndk-vs .tbtn.save') && !!document.querySelector('.ndk-uimode .ndk-vs .tbtn.full')"))
J("document.querySelector('.ndk-uimode .ndk-vs .tbtn.full').click()"); pg.wait_for_timeout(400)
check("Full size opens the lightbox", J("!!document.querySelector('.ndk-lightbox')"))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
J("window.__dl=[]; const o=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(this.download) window.__dl.push([this.download,this.href]); else o.call(this) }; null")
J("document.querySelector('.ndk-uimode .ndk-vs .tbtn.save').click()"); pg.wait_for_timeout(300)
dl = J("window.__dl")
check("Save downloads the shown variant", len(dl) == 1 and "v1.png" in dl[0][1], str(dl))
finish(p, br, errs)
