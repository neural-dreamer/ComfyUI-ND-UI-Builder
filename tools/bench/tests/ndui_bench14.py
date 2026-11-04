# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 14 (stage E3): node.ndApi of ND Load Images + the Image Input widget (grid / tabs), reset / remove options.
import json
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const li = LG.createNode('NDLoadImages'); li.pos=[40,40]; a.graph.add(li); li.properties.nd_ui_src={uid:'li',tag:'imgs'}; window.__li = li;
  const u = LG.createNode('NDUI'); u.pos=[700,40]; u.size=[1000,760]; a.graph.add(u); window.__u=u;
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'li',tag:'imgs',class:'NDLoadImages',title:'Images [imgs]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('g','imageinput',10,10,560,420,{node:{src:'li',kind:'loadimages',name:''}},{}), W('t','imageinput',590,10,360,420,{node:{src:'li',kind:'loadimages',name:''}},{layout:'tabs'}), W('e','imageinput',10,450,300,200,{},{})]};
  u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1800)
API = "window.__li.ndApi"
ST = "JSON.parse(window.__li.widgets.find(w=>w.name==='state').value)"
check("ndApi exists: kind and version", J(API + ".kind") == "load-images" and J(API + ".version") == 1)
check("ndApi has all actions", all(J(f"typeof {API}.actions.{a} === 'function'") for a in ["addBlock","removeBlock","moveBlock","setFile","setEnabled","setKeep","openEditor","openMask","openSettings","reset","clearMask","setSlider","setTitle","setEye"]))
check("getState matches the state widget", J(f"JSON.stringify({API}.getState()) === JSON.stringify({ST})") is True)
check("meta: titles, keep modes, max blocks", J(API + ".meta().maxBlocks") == 20 and "crop" in J(API + ".meta().keepModes"))
II = "document.querySelectorAll('.ndk-ii')"
check("three Image Input widgets", J(II + ".length") == 3)
check("grid: one card and an add card", J(II + "[0].querySelectorAll('.card').length") == 1 and J(II + "[0].querySelector('.addcard')") is not None)
check("tabs: strip with 1 and +", J(II + "[1].querySelectorAll('.tabbtn').length") == 1 and J(II + "[1].querySelector('.plus')") is not None)
check("an unbound widget asks to bind", "Bind an ND Load Images" in J(II + "[2].innerText"))
# add a block in the widget
J(II + "[0].querySelector('.addcard').click()"); pg.wait_for_timeout(700)
check("add: node state has 2 blocks", J(ST + ".blocks.length") == 2)
check("add: both widgets show 2", J(II + "[0].querySelectorAll('.card').length") == 2 and J(II + "[1].querySelectorAll('.tabbtn').length") == 2)
check("add: the node's own UI shows 2", J("window.__li.ndApi && document.querySelectorAll('.nd-li-block').length") == 2)
# a change in the node's own UI reaches the widget
J("document.querySelectorAll('.nd-li-block')[1].querySelector('.nd-li-on').click()"); pg.wait_for_timeout(600)
check("toggle in the node: widget card goes off", J(II + "[0].querySelectorAll('.card')[1].classList.contains('off')") is True)
J(II + "[0].querySelectorAll('.card')[1].querySelector('.dot').click()"); pg.wait_for_timeout(600)
check("toggle in the widget: node state enabled", J(ST + ".blocks[1].enabled") is True and J("document.querySelectorAll('.nd-li-block')[1].classList.contains('off')") is False)
# file by the picker
pg.set_input_files(".ndk-ii >> nth=0 >> .card >> nth=1 >> input[type=file]", {"name": "ii_photo.png", "mimeType": "image/png", "buffer": b"\x89PNG\r\n\x1a\n"}); pg.wait_for_timeout(1200)
check("picked file goes to the block", J(ST + ".blocks[1].image") == "ii_photo.png", J(ST + ".blocks[1].image"))
check("and the widget shows the name", "ii_photo.png" in J(II + "[0].querySelectorAll('.card')[1].querySelector('.fname').innerText"))
# drop a file / x-nd-image
J("""()=>{const c=document.querySelectorAll('.ndk-ii')[0].querySelectorAll('.card')[0]; const dt=new DataTransfer(); dt.items.add(new File([new Uint8Array([1,2,3])],'dropped_ii.png',{type:'image/png'})); c.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}"""); pg.wait_for_timeout(1200)
check("a dropped file goes to block 1", J(ST + ".blocks[0].image") == "dropped_ii.png", J(ST + ".blocks[0].image"))
J("""()=>{const c=document.querySelectorAll('.ndk-ii')[0].querySelectorAll('.card')[1]; const dt=new DataTransfer(); dt.setData('application/x-nd-image', JSON.stringify({filename:'ND_Qwen2.1_00006_.png',subfolder:'',type:'input'})); c.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}"""); pg.wait_for_timeout(1200)
check("a picture from the Viewer goes to block 2", J(ST + ".blocks[1].image") == "ND_Qwen2.1_00006_.png", J(ST + ".blocks[1].image"))
check("a new file resets mask and edit", J(ST + ".blocks[1].masked") is None)
# paste in tabs mode goes to the active tab
J("""()=>{const r=document.querySelectorAll('.ndk-ii')[1]; const dt=new DataTransfer(); dt.items.add(new File([new Uint8Array([9,9])],'image.png',{type:'image/png'})); r.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}));}"""); pg.wait_for_timeout(1200)
check("paste goes to the active tab block", J(ST + ".blocks[0].image").startswith("pasted_"), J(ST + ".blocks[0].image"))
# tabs
J(II + "[1].querySelectorAll('.tabbtn')[1].click()"); pg.wait_for_timeout(500)
check("tabs: second tab shows the second block", J(II + "[1].querySelector('.card').dataset.id") == J(ST + ".blocks[1].id"))
# keep select
J("""()=>{const s=document.querySelectorAll('.ndk-ii')[0].querySelectorAll('.card')[1].querySelector('select.keep'); s.value='stretch'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(500)
check("keep proportion from the widget", J(ST + ".blocks[1].keep") == "stretch")
# canvas painted
check("preview is painted", J("(()=>{const c=document.querySelectorAll('.ndk-ii')[0].querySelector('canvas'); return c.width>8 && c.height>8})()") is True)
# move
ids = J(ST + ".blocks.map(b=>b.id)")
J(f"{API}.actions.moveBlock('{ids[1]}','{ids[0]}')"); pg.wait_for_timeout(500)
check("moveBlock reorders", J(ST + ".blocks[0].id") == ids[1])
# reset and remove buttons: reset on, remove off by default
RB = ".ibtn[title^=\"Reset to example\"]"
check("reset button is there, remove is not (defaults)", J(II + "[0].querySelector('.card " + RB + "')") is not None and J(II + "[0].querySelector('.ibtn[title=\"Remove this image\"]')") is None)
J(II + "[0].querySelectorAll('.card')[1].querySelector('" + RB + "').click()"); pg.wait_for_timeout(600)
check("reset puts example.png back", J(ST + ".blocks[1].image") == "example.png" and J(ST + ".blocks[1].masked") is None)
J("""()=>{const u=window.__u; const w=u.properties.nd_ui.widgets.find(w=>w.id==='g'); w.props={remove:true}; u.ndUiApi.reload();}"""); pg.wait_for_timeout(900)
check("option: the remove button appears", J(II + "[0].querySelector('.ibtn[title=\"Remove this image\"]')") is not None)
J("""()=>{const u=window.__u; const w=u.properties.nd_ui.widgets.find(w=>w.id==='g'); w.props={reset:false,remove:true}; u.ndUiApi.reload();}"""); pg.wait_for_timeout(900)
check("option: the reset button can be switched off", J(II + "[0].querySelector('" + RB + "')") is None)
# remove in widget
J(II + "[0].querySelectorAll('.card')[0].querySelector('.ibtn[title=\"Remove this image\"]').click()"); pg.wait_for_timeout(600)
check("remove: one block left, no remove button", J(ST + ".blocks.length") == 1 and J(II + "[0].querySelector('.ibtn[title=\"Remove this image\"]')") is None)
# subscribe / setState
J(f"()=>{{ window.__n=0; {API}.subscribe(()=>{{window.__n++}}); }}"); J(f"()=>{API}.actions.setEnabled({API}.getState().blocks[0].id,false)"); pg.wait_for_timeout(300)
check("subscribe is called on change", J("window.__n") >= 1)
st = J(f"{API}.getState()"); st["blocks"].append(dict(st["blocks"][0], id="zz1")); 
J(f"(s)=>{API}.setState(s)", st); pg.wait_for_timeout(600)
check("setState replaces the state everywhere", J(ST + ".blocks.length") == 2 and J(II + "[0].querySelectorAll('.card').length") == 2 and J("document.querySelectorAll('.nd-li-block').length") == 2)
# without ndApi
J("""()=>{const n=window.__li; window.__saved=n.ndApi; n.ndApi=undefined; window.__u.ndUiApi.reload();}"""); pg.wait_for_timeout(900)
check("without ndApi the widget asks to update the Nodes", "Update Neural Dreamer Nodes" in J(II + "[0].innerText"), J(II + "[0].innerText"))
J("""()=>{window.__li.ndApi=window.__saved; window.__u.ndUiApi.reload();}"""); pg.wait_for_timeout(900)
# round trip
saved = J("JSON.stringify(window.__app.graph.serialize())")
J("""async (s) => { await window.__app.loadGraphData(JSON.parse(s)); }""", saved); pg.wait_for_timeout(2200)
check("after reload the widgets are back with 2 blocks", J(II + ".length") == 3 and J(II + "[0].querySelectorAll('.card').length") == 2)
finish(p, br, errs)
