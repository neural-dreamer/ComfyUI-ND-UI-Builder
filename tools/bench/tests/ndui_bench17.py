# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 17 (stage E5b): common transform frame for a group.
import json
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const ks = LG.createNode('KSampler'); ks.pos=[60,60]; ks.properties.nd_ui_src={uid:'sk',tag:'sampler'}; a.graph.add(ks);
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[1000,760]; a.graph.add(u); window.__u=u;
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,parent:null,slots:slots||{},props:props||{}});
  const B=(s,n)=>({src:s,kind:'widget',name:n});
  u.properties.nd_ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'One'}],
   widgets:[W('h1','heading',100,120,200,40,{},{text:'A',size:'M',align:'left'}), W('h2','heading',100,200,300,50,{},{text:'B',size:'L',align:'left'}), W('h3','heading',100,300,260,60,{},{text:'C',size:'M',align:'center'}),
            W('s1','slider',500,120,300,64,{value:B('sk','steps')},{label:'Steps'}), W('s2','slider',500,220,300,64,{value:B('sk','cfg')},{label:'CFG'}),
            W('lk','heading',100,420,200,40,{},{text:'Locked',size:'M',align:'left'})]};
  u.properties.nd_ui.widgets.find(w=>w.id==='lk').locked = true;
  u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1500)
J("() => window.__u.ndUiApi.openEdit()"); pg.wait_for_timeout(1500)
EF = lambda i: f"document.querySelector('.nde .ndk-w[data-id=\"{i}\"]')"
pos = lambda i: J(f"(()=>{{const e={EF(i)}; return [parseFloat(e.style.left), parseFloat(e.style.top), parseFloat(e.style.width), parseFloat(e.style.height)]}})()")
def blank():
    r = J("(()=>{const r=document.querySelector('.nde-stage').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]})()")
    pg.mouse.click(r[0] + 20, r[1] + r[3] - 20); pg.wait_for_timeout(200)
def select(ids):
    blank()
    for k, i in enumerate(ids):
        c = J(f"(()=>{{const r={EF(i)}.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]}})()")
        pg.keyboard.down("Shift") if k else None
        pg.mouse.click(c[0], c[1])
        pg.keyboard.up("Shift") if k else None
    pg.wait_for_timeout(300)
def drag(dirn, dx, dy, shift=False):
    c = J(f"(()=>{{const r=document.querySelector('.nde-grp .nde-h8[data-dir=\"{dirn}\"]').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]}})()")
    pg.mouse.move(c[0], c[1]); pg.mouse.down()
    if shift: pg.keyboard.down("Shift")
    pg.mouse.move(c[0] + dx / 2, c[1] + dy / 2, steps=3); pg.mouse.move(c[0] + dx, c[1] + dy, steps=3)
    pg.mouse.up()
    if shift: pg.keyboard.up("Shift")
    pg.wait_for_timeout(300)
select(["h1", "h2", "h3"])
check("one group frame with 8 handles", J("document.querySelectorAll('.nde-grp').length") == 1 and J("document.querySelectorAll('.nde-grp .nde-h8').length") == 8)
select(["h1", "lk", "h3"])
check("a locked widget is not in the frame", J("document.querySelectorAll('.nde-grp').length") == 1)
lk0 = pos("lk"); drag("se", 80, 40)
check("a locked widget is untouched", pos("lk") == lk0)
select(["h1", "h2", "h3"])
before = {i: pos(i) for i in ["h1", "h2", "h3"]}
drag("se", 150, 60)
after = {i: pos(i) for i in ["h1", "h2", "h3"]}
gx0 = min(b[0] for b in before.values()); gw0 = max(b[0] + b[2] for b in before.values()) - gx0
kx = (max(a[0] + a[2] for a in after.values()) - min(a[0] for a in after.values())) / gw0
check("group widened", kx > 1.1, str(kx))
check("every widget scaled by the same factor in width", all(abs(after[i][2] / before[i][2] - kx) < 0.05 for i in before), f"{before} {after}")
check("top left corner stays", abs(min(a[0] for a in after.values()) - gx0) < 1.5)
check("positions are proportional", all(abs((after[i][0] - gx0) - (before[i][0] - gx0) * kx) < 2 for i in before))
ky = after["h3"][3] / before["h3"][3]
check("heights scaled too", ky > 1.05 and all(abs(after[i][3] / before[i][3] - ky) < 0.08 for i in before), f"{ky}")
drag("w", -60, 0)
check("a west handle keeps the right edge", abs(max(pos(i)[0] + pos(i)[2] for i in before) - max(a[0] + a[2] for a in after.values())) < 2)
select(["h1"])
check("no group frame for one widget", J("document.querySelectorAll('.nde-grp').length") == 0)
J("() => window.__app.graph.clear()")
check("no console errors", not errs, str(errs[:2]))
finish(p, br, errs)
