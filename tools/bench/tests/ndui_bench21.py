# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 21 (E7b): Node Embed, live mirror of a node (second LGraphCanvas) and the DOM parts laid over it.
# KSampler needs nothing from outside; Value Presets (obvpm) is used when its pack is staged (stage_thirdparty.sh), else that part is skipped.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
vp = J("async()=>!!window.LiteGraph.registered_node_types['ValuePresets (obvpm)'] && (await (await fetch('/extensions')).json()).some(u=>u.includes('tp-obvpm'))")
E = lambda id, src, x, y, w, h, pr=None: f"{{id:'{id}',type:'nodeembed',page:'p1',x:{x},y:{y},w:{w},h:{h},z:1,slots:{{node:{{src:'{src}',kind:'anynode',name:''}}}},props:Object.assign({{label:'E'}},{pr or '{}'})}}"
def model(extra="", title=False):
    ws = [E('a', 'sk', 20, 20, 440, 330, "{part:'@mirror'" + (",title:true" if title else "") + "}")]
    if vp: ws.append(E('b', 'sv', 480, 20, 440, 420))
    return "(function(){return {sources:[{uid:'sk',tag:'',class:'KSampler',title:'KS'},{uid:'sv',tag:'',class:'ValuePresets (obvpm)',title:'VP'}],pages:[{id:'p1',name:'Main'}],widgets:[" + ",".join(ws) + "]}})()"
J("""async (vp) => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const k=LG.createNode('KSampler'); k.pos=[60,60]; a.graph.add(k); k.properties.nd_ui_src={uid:'sk',tag:''};
  if (vp) { const v=LG.createNode('ValuePresets (obvpm)'); v.pos=[700,60]; a.graph.add(v); v.properties.nd_ui_src={uid:'sv',tag:''}; }
  window.__app=a; await new Promise(r=>setTimeout(r,1500)); }""", vp)
J(f"() => window.ndUi.host().save({model()})"); pg.wait_for_timeout(500)
ncv = lambda: J("window.__app.graph.list_of_graphcanvas?.length")
check("at first only the main canvas is attached", ncv() == 1, str(ncv()))

# ---- the mode: the mirror draws and takes clicks (the page is scaled, so this also checks the pointer mapping)
J("window.ndUi.enter()"); pg.wait_for_timeout(1800)
n_exp = 3 if vp else 2
check("the mirrors are attached to the graph", ncv() == n_exp, str(ncv()))
cvs = J("document.querySelectorAll('.ndk-uimode canvas.ndk-emb-cv').length"); check("one canvas per mirror", cvs == n_exp - 1, str(cvs))
pix = J("""()=>{const c=document.querySelector('.ndk-uimode .ndk-w[data-id=a] canvas'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; const s=new Set(); for(let i=0;i<d.length;i+=4*37) s.add(d[i]+','+d[i+1]+','+d[i+2]); return s.size}""")
check("the mirror really draws the node", pix > 6, str(pix))
st = J("""()=>{const g=window.__app.graph, k=g._nodes.find(n=>n.type==='KSampler'); const c=document.querySelector('.ndk-uimode .ndk-w[data-id=a] canvas'); const gc=g.list_of_graphcanvas.find(x=>x.canvas===c);
 const w=k.widgets.find(w=>w.name==='steps'); const r=c.getBoundingClientRect(); const s=1;
 const gx=k.pos[0]+k.size[0]-18, gy=k.pos[1]+(w.last_y??w.y)+10;
 return {x:r.left+(gx+gc.ds.offset[0])*gc.ds.scale*s, y:r.top+(gy+gc.ds.offset[1])*gc.ds.scale*s, steps:w.value, s, pg:r.width/c.offsetWidth}}""")
check("the page around the frame is really scaled", st["pg"] > 1.05, str(st["pg"]))
pg.mouse.click(st["x"], st["y"]); pg.wait_for_timeout(400)
now = J("window.__app.graph._nodes.find(n=>n.type==='KSampler').widgets.find(w=>w.name==='steps').value")
check("a click on the arrow in the mirror changes the node (the page is scaled x%.2f)" % st["pg"], now == st["steps"] + 1, f"{st['steps']} -> {now}")
# a combo opens its menu above the page
cb = J("""()=>{const g=window.__app.graph, k=g._nodes.find(n=>n.type==='KSampler'); const c=document.querySelector('.ndk-uimode .ndk-w[data-id=a] canvas'); const gc=g.list_of_graphcanvas.find(x=>x.canvas===c);
 const w=k.widgets.find(w=>w.name==='sampler_name'); const r=c.getBoundingClientRect(); const s=1;
 return {x:r.left+(k.pos[0]+k.size[0]/2+gc.ds.offset[0])*gc.ds.scale*s, y:r.top+(k.pos[1]+(w.last_y??w.y)+10+gc.ds.offset[1])*gc.ds.scale*s}}""")
pg.mouse.click(cb["x"], cb["y"]); pg.wait_for_timeout(500)
menu = J("""()=>{const m=document.querySelector('.litecontextmenu'); if(!m) return null; const r=m.getBoundingClientRect(); const e=document.elementFromPoint(r.left+10,r.top+10); return {z:getComputedStyle(m).zIndex, top: !!e?.closest('.litecontextmenu')}}""")
check("the combo menu opens and is on top of the page", bool(menu) and menu["top"], str(menu))
J("document.querySelectorAll('.litecontextmenu').forEach(m=>m.remove())")

if vp:
    hb = J("""()=>{const b=document.querySelectorAll('.ndk-uimode .ndk-emb-hbox'); const f=document.querySelector('.ndk-uimode .ndk-w[data-id=b]').getBoundingClientRect(); return {n:b.length, txt:b[0]?.innerText||'', top:b[0]?.getBoundingClientRect().top-f.top, h:b[0]?.getBoundingClientRect().height}}""")
    check("the preset bar of Value Presets is laid over the mirror (hidden fields are not)", hb["n"] == 1 and "save as preset" in hb["txt"], str(hb))
    check("the bar sits below the preset widgets", hb["top"] > 60, str(hb))
    ex = J("""()=>{const g=window.__app.graph, v=g._nodes.find(n=>n.type==='ValuePresets (obvpm)'); const c=document.querySelector('.ndk-uimode .ndk-w[data-id=b] canvas'); const gc=g.list_of_graphcanvas.find(x=>x.canvas===c);
      const w=v.widgets.find(w=>w.name==='obvpm_presets_bar'); const r=c.getBoundingClientRect(); const b=document.querySelector('.ndk-uimode .ndk-w[data-id=b] .ndk-emb-hbox').getBoundingClientRect();
      return {want:r.top+(v.pos[1]+w.y+4+gc.ds.offset[1])*gc.ds.scale, got:b.top, k:gc.ds.scale}}""")
    check("the bar is exactly where the node's own layout puts it (not shifted by the zoom)", abs(ex["want"] - ex["got"]) < 3, str(ex))

# ---- leaving the mode
J("window.ndUi.exit()"); pg.wait_for_timeout(900)
check("leaving the mode: the mirrors are detached", ncv() == 1, str(ncv()))
check("and their canvases are gone", J("document.querySelectorAll('canvas.ndk-emb-cv').length") == 0)
if vp:
    check("the preset bar went back into its wrapper", J("window.__app.graph._nodes.find(n=>n.type==='ValuePresets (obvpm)').widgets.find(w=>w.name==='obvpm_presets_bar').element.parentElement.className").find("dom-widget") >= 0)

# ---- no leaks: many open / close cycles
for i in range(25):
    J("window.ndUi.enter()"); pg.wait_for_timeout(250); J("window.ndUi.exit()"); pg.wait_for_timeout(150)
check("25 cycles of the mode leave one canvas attached", ncv() == 1, str(ncv()))
check("no canvas elements left", J("document.querySelectorAll('canvas.ndk-emb-cv').length") == 0)

# ---- the editor: a card in the layout, the live mirror in the preview
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
check("editor layout: no mirror, a card instead", ncv() == 1 and J("document.querySelectorAll('.nde .ndk-emb-card:not([style*=none])').length") >= 1)
J("[...document.querySelectorAll('.nde button')].find(b=>/Preview/.test(b.textContent)).click()"); pg.wait_for_timeout(1500)
check("editor preview: the mirror is live", ncv() == n_exp, str(ncv()))
J("[...document.querySelectorAll('.nde button')].find(b=>/Preview/.test(b.textContent)).click()"); pg.wait_for_timeout(800)
check("preview off: the mirror is gone", ncv() == 1, str(ncv()))
J("window.ndUi.host().editor?.close?.()"); pg.wait_for_timeout(500)

# ---- the title option moves the camera
J(f"() => window.ndUi.host().save({model(title=True)})"); pg.wait_for_timeout(400)
J("window.ndUi.enter()"); pg.wait_for_timeout(1500)
off = J("""()=>{const g=window.__app.graph, k=g._nodes.find(n=>n.type==='KSampler'); const c=document.querySelector('.ndk-uimode .ndk-w[data-id=a] canvas'); const gc=g.list_of_graphcanvas.find(x=>x.canvas===c); return [gc.ds.offset[1]+k.pos[1]]}""")
check("with the title the body starts one title bar lower", 25 <= off[0] <= 35, str(off))
J("window.ndUi.exit()"); pg.wait_for_timeout(600)
finish(p, br, errs)
