# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 68: node.ndApi of ND Variant Preview Selector + the Variant Preview widget (variants, switch with the node's name, Upscale, live frames).
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const vs = LG.createNode('NDVariantPreviewSelector'); vs.pos=[40,40]; a.graph.add(vs); vs.properties.nd_ui_src={uid:'vs',tag:'vars'}; window.__vs = vs;
  const u = LG.createNode('NDUI'); u.pos=[900,40]; u.size=[1000,760]; a.graph.add(u); window.__u=u;
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'vs',tag:'vars',class:'NDVariantPreviewSelector',title:'Variants [vars]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('a','variantsel',10,10,460,420,{node:{src:'vs',kind:'variantsel',name:''}},{}), W('b','variantsel',490,10,300,300,{node:{src:'vs',kind:'variantsel',name:''}},{thumbs:false,toggle:false,upscale:false,live:false}), W('e','variantsel',10,450,300,200,{},{})]};
  u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1800)
API = "window.__vs.ndApi"
check("ndApi: kind and version", J(API + ".kind") == "variant-preview" and J(API + ".version") == 1)
check("ndApi has the actions", all(J(f"typeof {API}.actions.{a} === 'function'") for a in ["select", "selectFinal", "setMulti", "setCompare", "setLive", "setLiveShown", "upscale"]))
VS = "document.querySelectorAll('.ndk-vs')"
check("three Variant Preview widgets", J(VS + ".length") == 3)
check("an unbound widget asks to bind", "Bind an ND Variant Preview Selector" in J(VS + "[2].innerText"))
check("empty: asks to run", "Press Run" in J(VS + "[0].innerText"))
check("the first widget turned the node's Live preview on", J("window.__vs.properties.nd_live") is True)
# the node gets a batch
J("""()=>{const m={nd_batch:[1,2,3].map(i=>({filename:'v'+i+'.png',subfolder:'',type:'temp',width:832,height:1216})), nd_mode:[false]}; window.__vs.ndApi.onExecuted(m)}""")
pg.wait_for_timeout(400)
check("thumbnails: three", J(VS + "[0].querySelectorAll('.th').length") == 3)
check("the first widget shows 1/3", "1/3" in J(VS + "[0].querySelector('.badge').innerText"))
check("size line", "832 × 1216" in J(VS + "[0].querySelector('.info').innerText"))
check("the second widget has no thumbnails, switch and button", J(VS + "[1].querySelector('.thumbs').style.display") == "none" and J(VS + "[1].querySelector('.sw').style.display") == "none" and J(VS + "[1].querySelector('.up').style.display") == "none")
J(VS + "[0].querySelectorAll('.th')[2].click()"); pg.wait_for_timeout(300)
check("click on a thumbnail selects the variant in the node", J(API + ".getState().sel") == 2 and J("window.__vs.ndApi.promptValues().selected_index") == 2)
check("and the badge follows", "3/3" in J(VS + "[0].querySelector('.badge').innerText"))
# the switch: the name comes from the node
J("window.__vs.properties.nd_toggle_label='Several at once'; window.__vs.ndApi.restore(true); null"); pg.wait_for_timeout(300)
check("switch named as in the node", J(VS + "[0].querySelector('.sw .lbl').innerText") == "Several at once", J(VS + "[0].querySelector('.sw .lbl').innerText"))
J(VS + "[0].querySelector('.sw input').click()"); pg.wait_for_timeout(300)
check("switch in the widget sets multi_variant in the node", J("window.__vs.ndApi.promptValues().multi_variant") is True)
# Upscale button follows the node setting
check("Upscale button is shown", J(VS + "[0].querySelector('.up').style.display") != "none" and J(VS + "[0].querySelector('.up').disabled") is False)
J("window.__vs.widgets.find(w=>w.name==='upscale_button').value=false; window.__vs.ndApi.restore(true); null"); pg.wait_for_timeout(300)
check("node's Upscale button off: gone from the widget", J(VS + "[0].querySelector('.up').style.display") == "none")
J("window.__vs.widgets.find(w=>w.name==='upscale_button').value=true; window.__vs.ndApi.restore(true); null"); pg.wait_for_timeout(300)
# live frames of the node reach the widget
J("window.__vs.ndApi.live.batch(['/view?filename=live1.png&type=temp'], 5, 20); null"); pg.wait_for_timeout(300)
check("live frame over the picture with step", J(VS + "[0].querySelector('img.live').style.display") != "none" and "5/20" in J(VS + "[0].querySelector('.ndk-live-badge').innerText"))
check("the widget with live off shows no frame", J(VS + "[1].querySelector('img.live').style.display") == "none")
J(VS + "[0].querySelector('.eye').click()"); pg.wait_for_timeout(300)
check("the eye hides it (node property too)", J("window.__vs.properties.nd_live_hidden") is True and J(VS + "[0].querySelector('img.live').style.display") == "none")
J(VS + "[0].querySelector('.eye').click()"); pg.wait_for_timeout(200)
J("window.__vs.ndApi.live.end(); null"); pg.wait_for_timeout(300)
check("the run is over: the frame is gone", J(VS + "[0].querySelector('img.live').style.display") == "none")
# the final upscaled image + compare
J("window.__vs.ndApi.markSource(); window.__vs.ndApi.setFinal({filename:'up.png',subfolder:'',type:'output',width:1664,height:2432}); null"); pg.wait_for_timeout(400)
check("the UP thumbnail and badge", J(VS + "[0].querySelector('.th.final')") is not None and "Upscaled" in J(VS + "[0].querySelector('.badge').innerText"))
J(VS + "[0].querySelector('.cmpb').click()"); pg.wait_for_timeout(300)
check("compare overlay", J(VS + "[0].querySelector('.cmp').style.display") == "block" and J(API + ".getState().compare") is True)
# keyboard
J(VS + "[0].querySelectorAll('.th')[0].click()"); pg.wait_for_timeout(200)
J(VS + "[0].focus(); null")
pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(200)
check("arrow keys switch variants", J(API + ".getState().sel") == 1)
finish(p, br, errs)
