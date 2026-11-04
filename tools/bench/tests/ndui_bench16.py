# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 16 (stage E5): editing several selected widgets at once.
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
RIGHT = "document.querySelector('.nde-right, .nde-insp, .nde-scroll:last-of-type')"
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
panel = lambda: J("[...document.querySelectorAll('.nde-scroll')].pop().innerText")
select(["h1", "h2", "h3"])
check("three headings selected", J("document.querySelectorAll('.nde-sel').length") == 3)
t = panel()
check("the inspector says how many are selected", "3 widgets selected" in t, t[:120])
check("common settings of the kind are shown (Size, Align)", "Align" in t and "Size" in t, t[:300])
check("a value that differs is shown as Mixed", "Mixed" in t)
fs0 = [J(f"parseFloat(getComputedStyle({EF(i)}.querySelector('.ndk-heading')).fontSize)") for i in ["h1", "h2", "h3"]]
# set Size for all: the select of the row "Size" in the Values section
J("""()=>{const row=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...row.querySelectorAll('.nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='Size' && r.querySelector('select')); const s=r.querySelector('select'); s.value=[...s.options].find(o=>o.textContent==='Extra large').value; s.dispatchEvent(new Event('change',{bubbles:true}));}""")
pg.wait_for_timeout(500)
fs1 = [J(f"parseFloat(getComputedStyle({EF(i)}.querySelector('.ndk-heading')).fontSize)") for i in ["h1", "h2", "h3"]]
check("Size set for all three", len(set(fs1)) == 1 and fs1[0] != fs0[0], f"{fs0} -> {fs1}")
# the same width for all
before = [pos(i) for i in ["h1", "h2", "h3"]]
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...root.querySelectorAll('.nde-pair .nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='W'); const i=r.querySelector('input'); i.focus(); i.value='333'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); i.blur();}""")
pg.wait_for_timeout(500)
after = [pos(i) for i in ["h1", "h2", "h3"]]
check("the same width for all", len(set(round(a[2]) for a in after)) == 1, str(after))
check("the heights did not change", [round(a[3]) for a in after] == [round(b[3]) for b in before], f"{before} {after}")
# scale the frames: 200 percent with the gaps
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...root.querySelectorAll('.nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='Frames, %'); const i=r.querySelector('input'); i.focus(); i.value='200'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); i.blur();}""")
pg.wait_for_timeout(200)
b2 = [pos(i) for i in ["h1", "h2", "h3"]]
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const b=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()==='Scale'); b.click();}"""); pg.wait_for_timeout(500)
a2 = [pos(i) for i in ["h1", "h2", "h3"]]
check("frames scaled to 200%: sizes doubled", all(abs(a[2] - 2 * b[2]) < 3 and abs(a[3] - 2 * b[3]) < 3 for a, b in zip(a2, b2)), f"{b2} -> {a2}")
check("with the gaps: places scaled from the top left of the selection", abs((a2[1][1] - a2[0][1]) - 2 * (b2[1][1] - b2[0][1])) < 3, f"{b2} -> {a2}")
# state: hidden for all
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...root.querySelectorAll('.nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='Hidden'); r.querySelector('.nde-tg').click();}"""); pg.wait_for_timeout(500)
op = [J(f"parseFloat({EF(i)}.style.opacity)") for i in ["h1", "h2", "h3"]]
check("Hidden for all three", all(o < 0.5 for o in op), str(op))
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...root.querySelectorAll('.nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='Hidden'); r.querySelector('.nde-tg').click();}"""); pg.wait_for_timeout(300)
# different kinds: only the common settings remain
select(["h3", "s2"])
t = panel()
check("different kinds: the header counts the kinds, no shared Values section", "(2 kinds)" in t and "\nValues\n" not in t, t[:300])
check("different kinds: size and state are still there", "Frames, %" in t and "Locked" in t, t[:400])
# a locked widget is not resized
select(["h1", "lk"])
lk0 = pos("lk")
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...root.querySelectorAll('.nde-pair .nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='W'); const i=r.querySelector('input'); i.focus(); i.value='222'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); i.blur();}""")
pg.wait_for_timeout(400)
check("a locked widget keeps its size", pos("lk")[2] == lk0[2] and abs(pos("h1")[2] - 222) < 2, f"{lk0} {pos('lk')} {pos('h1')}")
# the look for all (content scale)
select(["h1", "h2"])
J("""()=>{const root=[...document.querySelectorAll('.nde-scroll')].pop(); const r=[...root.querySelectorAll('.nde-row')].find(r=>r.querySelector('.nde-lab')?.textContent==='Content scale'); const i=r.querySelector('input[type=range]'); i.value='150'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(500)
sc = [J(f"{EF(i)}.querySelector('.ndk-wi, .ndk-inner') ? 1 : 0") for i in ["h1", "h2"]]
check("content scale row exists for several widgets", J("[...document.querySelectorAll('.nde-scroll')].pop().innerText.includes('Content scale')") is True)
check("no console errors so far", not errs, str(errs[:2]))
finish(p, br, errs)
