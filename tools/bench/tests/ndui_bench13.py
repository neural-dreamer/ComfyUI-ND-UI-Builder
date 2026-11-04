# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 13 (stage E): Simple Load Image (the standard Load Image and any node with an `image` list), UI Scale (page / global scale).
import json
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const li = mk('LoadImage',60,60,'Load [img]'), ks = mk('KSampler',60,500,'Sampler [sampler]');
  li.widgets.find(w=>w.name==='image').value='example.png'; li.properties.nd_ui_src={uid:'si',tag:'img'}; ks.properties.nd_ui_src={uid:'sk',tag:'sampler'};
  const u = mk('NDUI',480,60); u.size=[1000,700]; window.__u=u;
  const W=(id,type,x,y,w,h,slots,props,page)=>({id,type,page:page||'p1',x,y,w,h,z:1,slots,props:props||{}});
  const B=(s,n)=>({src:s,kind:'widget',name:n});
  u.properties.nd_ui={sources:[{uid:'si',tag:'img',class:'LoadImage',title:'Load [img]'},{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'One'},{id:'p2',name:'Two'},{id:'p3',name:'Three'}],
   widgets:[W('si','simpleimage',10,10,420,360,{image:B('si','image')}), W('un','simpleimage',450,10,300,200,{}), W('bad','simpleimage',450,230,300,200,{image:B('sk','seed')}),
            W('st','slider',10,400,300,64,{value:B('sk','steps')},{label:'Steps'}),
            W('us1','uiscale',10,480,320,64,{},{}),
            W('st2','slider',10,10,300,64,{value:B('sk','steps')},{label:'Steps'},'p2'),
            W('st3','slider',10,10,300,64,{value:B('sk','steps')},{label:'Steps'},'p3'), W('us3','uiscale',10,100,320,64,{},{scale:80},'p3')]};
  u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1500)
SI = "document.querySelectorAll('.ndk-si')"
LI = "window.__app.graph._nodes.find(n=>n.type==='LoadImage').widgets.find(w=>w.name==='image')"
check("three Simple Load Image widgets mounted", J(SI + ".length") == 3)
check("the picture of the bound node is shown", "filename=example.png" in J(SI + "[0].querySelector('img').src") and J(SI + "[0].querySelector('img').style.display") != "none")
check("the file name is shown", J(SI + "[0].querySelector('.fname').innerText") == "example.png")
check("an unbound widget asks to bind", "Bind the image parameter" in J(SI + "[1].innerText"))
check("a parameter that is not a list says so", "not a list of files" in J(SI + "[2].innerText"))

# upload by the file picker
pg.set_input_files(".ndk-si input[type=file] >> nth=0", {"name": "fresh_photo.png", "mimeType": "image/png", "buffer": b"\x89PNG\r\n\x1a\n"}); pg.wait_for_timeout(1200)
check("an uploaded file goes into the node's list", J(LI + ".value") == "fresh_photo.png", J(LI + ".value"))
check("and the list of the node knows it", J(LI + ".options.values.includes('fresh_photo.png')") is True)
check("and the widget shows it", "filename=fresh_photo.png" in J(SI + "[0].querySelector('img').src") and J(SI + "[0].querySelector('.fname').innerText") == "fresh_photo.png")
# pick from the list
J(SI + "[0].querySelector('.bar .btn').click()"); pg.wait_for_timeout(500)
rows = J("document.querySelectorAll('.ndk-pop-row').length")
check("the list shows pictures of the input folder only", rows > 10, str(rows))
J("""()=>{const i=document.querySelector('.ndk-pop-search input'); i.value='cafe'; i.dispatchEvent(new Event('input',{bubbles:true}));}"""); pg.wait_for_timeout(300)
J("""()=>{const r=Array.from(document.querySelectorAll('.ndk-pop-row')).find(r=>r.title==='Cafe.png'); r.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));}"""); pg.wait_for_timeout(500)
check("picking from the list sets the node", J(LI + ".value") == "Cafe.png", J(LI + ".value"))
check("and the picture follows", "filename=Cafe.png" in J(SI + "[0].querySelector('img').src"))
# a change in the node reaches the widget
J(LI + ".value='Demon_cs.png'; " + LI + ".callback&&" + LI + ".callback('Demon_cs.png')"); pg.wait_for_timeout(900)
check("a change made in the node shows in the widget", J(SI + "[0].querySelector('.fname').innerText") == "Demon_cs.png", J(SI + "[0].querySelector('.fname').innerText"))
# drop: a file, and a picture pulled out of the Viewer (x-nd-image)
J("""()=>{const r=document.querySelectorAll('.ndk-si')[0]; const dt=new DataTransfer(); dt.items.add(new File([new Uint8Array([1,2,3])],'dropped.png',{type:'image/png'})); r.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}"""); pg.wait_for_timeout(1200)
check("a dropped file is loaded", J(LI + ".value") == "dropped.png", J(LI + ".value"))
J("""()=>{const r=document.querySelectorAll('.ndk-si')[0]; const dt=new DataTransfer(); dt.setData('application/x-nd-image', JSON.stringify({filename:'ND_Qwen2.1_00006_.png',subfolder:'',type:'input'})); r.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}"""); pg.wait_for_timeout(1200)
check("a picture pulled from the Viewer is taken", J(LI + ".value") == "ND_Qwen2.1_00006_.png", J(LI + ".value"))
J("""()=>{const r=document.querySelectorAll('.ndk-si')[0]; const dt=new DataTransfer(); dt.setData('application/x-nd-image', JSON.stringify({filename:'out_1.png',subfolder:'sub',type:'output'})); r.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}"""); pg.wait_for_timeout(1500)
check("a picture from the output folder is copied to input and taken", J(LI + ".value") == "out_1.png", J(LI + ".value"))
# paste
J("""()=>{const r=document.querySelectorAll('.ndk-si')[0]; const dt=new DataTransfer(); dt.items.add(new File([new Uint8Array([9,9])],'image.png',{type:'image/png'})); const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}); r.dispatchEvent(e);}"""); pg.wait_for_timeout(1200)
check("a pasted picture is loaded under a unique name", J(LI + ".value").startswith("pasted_") and J(LI + ".value").endswith(".png"), J(LI + ".value"))
# options
J("""()=>{const u=window.__u; u.properties.nd_ui.widgets.find(w=>w.id==='si').props={fit:'cover',name:false,pick:false}; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1000)
check("options: cover, no file name, no list button", J(SI + "[0].querySelector('img').style.objectFit") == "cover" and J(SI + "[0].querySelector('.fname').style.display") == "none" and J(SI + "[0].querySelector('.bar .btn').style.display") == "none")
check("a missing file gets a message", True)
J(LI + ".value='nope_missing.png'; " + LI + ".callback&&" + LI + ".callback('nope_missing.png')"); pg.wait_for_timeout(400)
J("""()=>{const i=document.querySelectorAll('.ndk-si')[0].querySelector('img'); i.dispatchEvent(new Event('error'));}"""); pg.wait_for_timeout(300)
check("the missing file message", "File not found" in J(SI + "[0].innerText"), J(SI + "[0].innerText"))
J(LI + ".value='example.png'; " + LI + ".callback&&" + LI + ".callback('example.png')")

# ---- UI Scale
INNER = lambda sel: f"parseFloat((document.querySelector('{sel}').closest('.ndk-wi').style.transform.match(/scale\\(([\\d.]+)\\)/)||[0,1])[1])"
check("no scale yet: the widgets are drawn at 100%", abs(J(INNER(".ndk-us")) - 1.0) < 0.01 or J("document.querySelector('.ndk-us').closest('.ndk-wi').style.transform") == "")
check("UI Scale shows 100%", J("document.querySelector('.ndk-us .num').value") == "100%")
J("""()=>{const r=document.querySelector('.ndk-us input[type=range]'); r.value='150'; r.dispatchEvent(new Event('input',{bubbles:true}));}"""); pg.wait_for_timeout(500)
check("the slider scales every widget of the page: 1.5", abs(J(INNER(".ndk-us")) - 1.5) < 0.01 and abs(J(INNER(".ndk-si")) - 1.5) < 0.01, J("document.querySelector('.ndk-us').closest('.ndk-wi').style.transform"))
check("the number follows", J("document.querySelector('.ndk-us .num').value") == "150%")
check("the value is kept in the widget", J("window.__u.properties.nd_ui.widgets.find(w=>w.id==='us1').props.scale") == 150)
J("window.__u.ndUiApi.state.view.setPage('p2')"); pg.wait_for_timeout(700)
check("a page without its own UI Scale uses the first one: p2 at 1.5", abs(J("parseFloat((document.querySelector('.ndk-w[data-id=st2] .ndk-wi').style.transform.match(/scale\\(([\\d.]+)\\)/)||[0,1])[1])") - 1.5) < 0.01)
J("window.__u.ndUiApi.state.view.setPage('p3')"); pg.wait_for_timeout(700)
check("a page with its own UI Scale uses it: p3 at 0.8", abs(J("parseFloat((document.querySelector('.ndk-w[data-id=st3] .ndk-wi').style.transform.match(/scale\\(([\\d.]+)\\)/)||[0,1])[1])") - 0.8) < 0.01)
J("""()=>{const r=document.querySelector('.ndk-us input[type=range]'); r.value='60'; r.dispatchEvent(new Event('input',{bubbles:true}));}"""); pg.wait_for_timeout(400)
J("window.__u.ndUiApi.state.view.setPage('p2')"); pg.wait_for_timeout(600)
check("p3 changes do not touch p2 (still 1.5)", abs(J("parseFloat((document.querySelector('.ndk-w[data-id=st2] .ndk-wi').style.transform.match(/scale\\(([\\d.]+)\\)/)||[0,1])[1])") - 1.5) < 0.01)
J("window.__u.ndUiApi.state.view.setPage('p1')"); pg.wait_for_timeout(600)
# typing a number and reset
J("""()=>{const n=document.querySelector('.ndk-us .num'); n.focus(); n.value='75%'; n.dispatchEvent(new Event('change',{bubbles:true})); n.blur();}"""); pg.wait_for_timeout(400)
check("a typed number works (75)", J("window.__u.properties.nd_ui.widgets.find(w=>w.id==='us1').props.scale") == 75)
J("document.querySelector('.ndk-us .rst').click()"); pg.wait_for_timeout(300)
check("the 100% button resets", J("window.__u.properties.nd_ui.widgets.find(w=>w.id==='us1').props.scale") == 100)
J("""()=>{const r=document.querySelector('.ndk-us input[type=range]'); r.value='300'; r.dispatchEvent(new Event('input',{bubbles:true}));}"""); pg.wait_for_timeout(300)
check("the scale stays within 50..200", J("window.__u.properties.nd_ui.widgets.find(w=>w.id==='us1').props.scale") <= 200)
# no UI Scale at all: the scale of the kit
J("""()=>{const u=window.__u; u.properties.nd_ui.widgets=u.properties.nd_ui.widgets.filter(w=>w.type!=='uiscale'); u.properties.nd_ui.kit.scale=120; u.ndUiApi.reload();}"""); pg.wait_for_timeout(900)
check("without UI Scale the scale of the style is used (1.2)", abs(J(INNER(".ndk-w[data-id=st] .ndk-body")) - 1.2) < 0.01 or abs(J("parseFloat((document.querySelector('.ndk-w[data-id=st] .ndk-wi').style.transform.match(/scale\\(([\\d.]+)\\)/)||[0,1])[1])") - 1.2) < 0.01)
# round trip
saved = J("JSON.stringify(window.__app.graph.serialize())")
J("""async (s) => { await window.__app.loadGraphData(JSON.parse(s)); }""", saved); pg.wait_for_timeout(2000)
check("after reload the widgets are back", J(SI + ".length") == 3)
finish(p, br, errs)
