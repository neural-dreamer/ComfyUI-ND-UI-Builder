# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 15 (stage E4): spoiler with a maximum height (scroll), Spread modes, the ghost of the top panel in the editor.
import json
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const ks = LG.createNode('KSampler'); ks.pos=[60,60]; ks.properties.nd_ui_src={uid:'sk',tag:'sampler'}; a.graph.add(ks);
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[1000,760]; a.graph.add(u); window.__u=u;
  const W=(id,type,x,y,w,h,slots,props,parent)=>({id,type,page:'p1',x,y,w,h,z:1,parent:parent||null,slots,props:props||{}});
  const B=(s,n)=>({src:s,kind:'widget',name:n});
  const sl=(id,y)=>W(id,'slider',0,y,360,64,{value:B('sk','steps')},{label:'S '+id},'sp');
  u.properties.nd_ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'One'},{id:'p2',name:'Two'}],
   widgets:[W('sp','spoiler',20,20,400,44,{},{title:'Many',open:true,remember:false,pad:12,max_h:150}),
            sl('a',0), sl('b',70), sl('c',140), sl('d',210), sl('e',280),
            W('below','slider',20,90,400,64,{value:B('sk','cfg')},{label:'Below'}),
            W('s2','spoiler',460,20,300,44,{},{title:'Free',open:true,remember:false,pad:12}),
            W('f','slider',0,0,276,64,{value:B('sk','steps')},{label:'F'},'s2')]};
  u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1800)
FR = lambda i: f"document.querySelector('.ndk-w[data-id=\"{i}\"]')"
top = lambda i: J(f"parseFloat({FR(i)}.style.top)")
hgt = lambda i: J(f"parseFloat({FR(i)}.style.height)")
disp = lambda i: J(f"{FR(i)}.style.display")
clip = lambda i: J(f"{FR(i)}.style.clipPath")
sp_h = hgt("sp")
check("spoiler with max height: as tall as header + padding + max_h", abs(sp_h - (44 + 24 + 150)) < 3, str(sp_h))
check("the widget under it follows the shortened spoiler", abs(top("below") - (top("sp") + sp_h + (90 - 20 - 44))) < 3, f"{top('below')} {top('sp')} {sp_h}")
check("the unlimited spoiler is taller than the cut one", hgt("s2") > 100)
check("widgets inside: a and b are shown, e is hidden", disp("a") != "none" and disp("b") != "none" and disp("e") == "none", f"{disp('a')} {disp('b')} {disp('e')}")
check("a widget on the edge of the window is clipped", clip("c") != "" and "inset" in clip("c"), clip("c"))
check("the scroll bar is shown", J("getComputedStyle(document.querySelector('.ndk-w[data-id=\"sp\"] .ndk-sp-bar')).display") != "none")
t0 = top("a")
# wheel over a widget inside scrolls the spoiler
box = J(f"(()=>{{const r={FR('a')}.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]}})()")
pg.mouse.move(box[0], box[1]); pg.mouse.wheel(0, 120); pg.wait_for_timeout(500)
t1 = top("a")
check("the wheel scrolls the inside of the spoiler", t1 < t0 - 20, f"{t0} -> {t1}")
check("the spoiler itself did not move", abs(top("sp") - 20) < 1 and abs(hgt("sp") - sp_h) < 1)
check("after scrolling the first widget is hidden or clipped", disp("a") == "none" or clip("a") != "", f"{disp('a')} {clip('a')}")
pg.mouse.wheel(0, 3000); pg.wait_for_timeout(500)
check("scrolled to the end: e is shown", disp("e") != "none")
last = top("a"); pg.mouse.wheel(0, 500); pg.wait_for_timeout(300)
check("at the end it does not go further", abs(top("a") - last) < 1)
pg.mouse.wheel(0, -5000); pg.wait_for_timeout(500)
check("back to the top", abs(top("a") - t0) < 1)
# the bar thumb is draggable
th = J("(()=>{const r=document.querySelector('.ndk-w[data-id=\"sp\"] .ndk-sp-bar .thumb').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
pg.mouse.move(th[0], th[1]); pg.mouse.down(); pg.mouse.move(th[0], th[1] + 30, steps=4); pg.mouse.up(); pg.wait_for_timeout(400)
check("dragging the bar scrolls", top("a") < t0 - 10, str(top("a")))
pg.mouse.wheel(0, -5000); pg.wait_for_timeout(300)
# the property
J("""()=>{const u=window.__u; u.properties.nd_ui.widgets.find(w=>w.id==='sp').props.max_h=0; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1200)
check("max_h 0: no limit, all inside shown, no bar", disp("e") != "none" and hgt("sp") > 300 and J("getComputedStyle(document.querySelector('.ndk-w[data-id=\"sp\"] .ndk-sp-bar')).display") == "none")
J("""()=>{const u=window.__u; u.properties.nd_ui.widgets.find(w=>w.id==='sp').props.max_h=150; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1200)

# ---- the editor
J("""()=>{const u=window.__u; const ui=u.properties.nd_ui; const W=(id,x,y,w,h)=>({id,type:'heading',page:'p2',x,y,w,h,z:1,parent:null,slots:{},props:{text:id}}); ui.widgets.push(W('h1',100,200,100,40),W('h2',260,210,100,40),W('h3',500,190,100,40),W('h4',620,300,100,40)); ui.pages.push({id:'p3',name:'Three',kind:'page',control:{nodes:[],groups:[],how:'mute',bindIndex:null}}); const C=(id,y,w)=>Object.assign(W(id,100,y,w,40),{page:'p3'}); ui.widgets.push(C('c1',100,300),C('c2',160,200),C('c3',220,260),C('c4',280,340));}""")
J("() => window.__u.ndUiApi.openEdit()"); pg.wait_for_timeout(1500)
# a spoiler's inside belongs to the editor of the spoiler, so work on page 2 with plain widgets
pg.evaluate("document.querySelector('.nde-brand')"); 
check("the editor is open", J("!!document.querySelector('.nde')") is True)
check("the ghost of the top panel is drawn", J("!!document.querySelector('.nde-ghost .ndk-um-logo')") is True)
check("the reserved band is drawn", J("!!document.querySelector('.nde-ghost .band.top')") is True)
# the band is 62 screen px of the mode: on the stage it is 62 * zoom / s, where s is the scale of the page in the mode (the window / the page)
bh = J("""(()=>{const pg=window.__u.properties.nd_ui.page; const s=Math.min(innerWidth/pg.w, innerHeight/pg.h);
  const gl=document.querySelector('.nde-ghost'), zoom=gl.getBoundingClientRect().width/pg.w;
  return {got: document.querySelector('.nde-ghost .band.top').getBoundingClientRect().height, want: 62*zoom/s, s};})()""")
check("the ghost band follows the scale of the page in the mode", abs(bh["got"] - bh["want"]) < 0.8, str(bh))
lh = J("""(()=>{const pg=window.__u.properties.nd_ui.page; const s=Math.min(innerWidth/pg.w, innerHeight/pg.h);
  const gl=document.querySelector('.nde-ghost'), zoom=gl.getBoundingClientRect().width/pg.w;
  return {got: document.querySelector('.nde-ghost .ndk-um-logobtn').getBoundingClientRect().height, want: 34*zoom/s};})()""")
check("the logo of the ghost is a miniature of the real one", abs(lh["got"] - lh["want"]) < 0.8, str(lh))
J("document.querySelector('.nde .nde-tools button[title^=\"Show the top panel\"], .nde button[title^=\"Show the top panel\"]').click()"); pg.wait_for_timeout(400)
check("the ghost button hides it", J("!!document.querySelector('.nde-ghost')") is False)
J("document.querySelector('.nde button[title^=\"Show the top panel\"]').click()"); pg.wait_for_timeout(400)
check("and shows it again", J("!!document.querySelector('.nde-ghost')") is True)

# Spread: page two, four headings
J("[...document.querySelectorAll('.nde-pages button')].find(b=>b.textContent==='Two').click()"); pg.wait_for_timeout(800)
EF = lambda i: f"document.querySelector('.nde .ndk-w[data-id=\"{i}\"]')"
pos = lambda i: J(f"(()=>{{const e={EF(i)}; return [parseFloat(e.style.left), parseFloat(e.style.top), parseFloat(e.style.width), parseFloat(e.style.height)]}})()")
check("four headings on page two", J("document.querySelectorAll('.nde .ndk-w').length") == 4)
J("[...document.querySelectorAll('.nde-tabs button')].find(b=>b.textContent.includes('Layout')).click()"); pg.wait_for_timeout(400)
check("Spread settings in the Layout tab", "Spread" in J("document.querySelector('.nde-spread').innerText"))
def blank():
    r = J("(()=>{const r=document.querySelector('.nde-stage').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]})()")
    pg.mouse.click(r[0] + 20, r[1] + r[3] - 20); pg.wait_for_timeout(200)
sel_all = lambda: (pg.keyboard.press("Control+a"), pg.wait_for_timeout(300))
blank(); sel_all()
check("all four selected", J("document.querySelectorAll('.nde-sel').length") == 4)
SH = "document.querySelector('.nde button[title^=\"Spread horizontally\"]')"
SV = "document.querySelector('.nde button[title^=\"Spread vertically\"]')"
check("default mode is Within margins", J("document.querySelectorAll('.nde-spread select')[1].value") == "margins")
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[1]; s.value='even'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
before = [pos(i) for i in ["h1", "h2", "h3", "h4"]]
J(SH + ".click()"); pg.wait_for_timeout(500)
after = [pos(i) for i in ["h1", "h2", "h3", "h4"]]
xs = sorted([(a[0], a[2]) for a in after]); gaps = [round(xs[k+1][0] - (xs[k][0] + xs[k][1]), 1) for k in range(3)]
check("evenly: equal gaps between the outer ones", max(gaps) - min(gaps) < 2.5 and abs(xs[0][0] - min(b[0] for b in before)) < 2, f"{gaps} {before} {after}")
# by gap
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[1]; s.value='gap'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
fields = pg.locator(".nde-spread input")
check("by gap: two fields (after the four margins)", fields.count() == 6)
fields.nth(4).fill("30"); fields.nth(4).press("Enter"); fields.nth(5).fill("12"); fields.nth(5).press("Enter"); pg.wait_for_timeout(200)
blank(); sel_all()
J(SH + ".click()"); pg.wait_for_timeout(500)
a2 = sorted([pos(i) for i in ["h1", "h2", "h3", "h4"]]); g2 = [round(a2[k+1][0] - (a2[k][0] + a2[k][2]), 1) for k in range(3)]
check("by gap: the gap between widgets is 30", all(abs(g - 30) < 1.5 for g in g2), str(g2))
J(SV + ".click()"); pg.wait_for_timeout(500)
a3 = sorted([pos(i) for i in ["h1", "h2", "h3", "h4"]], key=lambda r: r[1]); g3 = [round(a3[k+1][1] - (a3[k][1] + a3[k][3]), 1) for k in range(3)]
check("by gap: vertical gap is 12", all(abs(g - 12) < 1.5 for g in g3), str(g3))
# margins
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[1]; s.value='margins'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
f = pg.locator(".nde-spread input"); check("margins: four fields", f.count() == 4)
for k, v in enumerate(["40", "50", "60", "70"]): f.nth(k).fill(v); f.nth(k).press("Enter")
pg.wait_for_timeout(200)
blank(); sel_all()
J(SH + ".click()"); pg.wait_for_timeout(500)
a4 = sorted([pos(i) for i in ["h1", "h2", "h3", "h4"]])
pw = J("parseFloat(document.querySelector('.nde-stage').style.width)")
PW = J("window.__u.properties.nd_ui.page.w")
check("margins: first at the left margin 40, last ends at the right margin 50", abs(a4[0][0] - 40) < 1.5 and abs(a4[-1][0] + a4[-1][2] - (PW - 50)) < 1.5, f"{a4} {PW}")
zoom = J("parseFloat(document.querySelector('.nde-stage').style.width)") / 1000
print("positions", a4, "stage", pw)
# a column of widgets of different widths (page three): Spread horizontally stretches them to the full width between the margins
J("[...document.querySelectorAll('.nde-pages button')].find(b=>b.textContent==='Three').click()"); pg.wait_for_timeout(800)
f = pg.locator(".nde-spread input")
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[1]; s.value='margins'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
f = pg.locator(".nde-spread input")
for k, v in enumerate(["24", "36", "16", "16"]): f.nth(k).fill(v); f.nth(k).press("Enter")
pg.wait_for_timeout(200)
blank(); sel_all()
check("column: four selected", J("document.querySelectorAll('.nde-sel').length") == 4)
J(SH + ".click()"); pg.wait_for_timeout(500)
col = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("column: every widget starts at the left margin (24)", all(abs(c[0] - 24) < 1.5 for c in col), str(col))
check("column: every widget ends at the right margin (36)", all(abs(c[0] + c[2] - (PW - 36)) < 1.5 for c in col), str(col))
check("column: the places up and down did not change", len(set(round(c[1]) for c in col)) == 4 and [round(c[3]) for c in col] == [40, 40, 40, 40], str(col))
# Spread vertically in Within margins: top one at the top margin, bottom one at the bottom margin, equal gaps between
PH = J("window.__u.properties.nd_ui.page.h")
blank(); sel_all()
J(SV + ".click()"); pg.wait_for_timeout(500)
cv = sorted([pos(i) for i in ["c1", "c2", "c3", "c4"]], key=lambda r: r[1])
vg = [round(cv[k+1][1] - (cv[k][1] + cv[k][3]), 1) for k in range(3)]
check("vertical margins: the top widget touches the top margin (16)", abs(cv[0][1] - 16) < 1.5, str(cv))
check("vertical margins: the bottom widget touches the bottom margin (16)", abs(cv[-1][1] + cv[-1][3] - (PH - 16)) < 1.5, f"{cv} {PH}")
check("vertical margins: equal gaps between the others", max(vg) - min(vg) < 2.5, str(vg))
check("vertical margins: sizes did not change", all(abs(c[3] - 40) < 1 for c in cv))
# By gap, anchored to the bottom
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[1]; s.value='gap'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
check("by gap shows the anchor choice", J("document.querySelectorAll('.nde-spread select').length") == 3)
f = pg.locator(".nde-spread input"); f.nth(5).fill("30"); f.nth(5).press("Enter")
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[2]; s.value='end'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
blank(); sel_all()
bottom0 = max(c[1] + c[3] for c in [pos(i) for i in ["c1", "c2", "c3", "c4"]])
J(SV + ".click()"); pg.wait_for_timeout(500)
ce = sorted([pos(i) for i in ["c1", "c2", "c3", "c4"]], key=lambda r: r[1]); eg = [round(ce[k+1][1] - (ce[k][1] + ce[k][3]), 1) for k in range(3)]
check("anchored to the bottom: the bottom widget stays", abs(ce[-1][1] + ce[-1][3] - bottom0) < 1.5, f"{ce} {bottom0}")
check("anchored to the bottom: the others step up with gap 30", all(abs(g - 30) < 1.5 for g in eg), str(eg))
# anchored to the top
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[2]; s.value='start'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
blank(); sel_all()
top0 = min(c[1] for c in [pos(i) for i in ["c1", "c2", "c3", "c4"]])
f = pg.locator(".nde-spread input"); f.nth(5).fill("10"); f.nth(5).press("Enter")
J(SV + ".click()"); pg.wait_for_timeout(500)
ct = sorted([pos(i) for i in ["c1", "c2", "c3", "c4"]], key=lambda r: r[1]); tg = [round(ct[k+1][1] - (ct[k][1] + ct[k][3]), 1) for k in range(3)]
check("anchored to the top: the top widget stays", abs(ct[0][1] - top0) < 1.5, f"{ct} {top0}")
check("anchored to the top: the others follow with gap 10", all(abs(g - 10) < 1.5 for g in tg), str(tg))
# Align buttons use the margins (margins are 24 / 36 / 16 / 16 here)
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[0]; if(s.value!=='margins'){s.value='margins'; s.dispatchEvent(new Event('change',{bubbles:true}));}}""")
AL = lambda t: f"document.querySelector('.nde button[title=\"{t}\"]')"
blank(); sel_all()
J(AL("Align left") + ".click()"); pg.wait_for_timeout(400)
al = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("align left: against the left margin (24)", all(abs(c[0] - 24) < 1.5 for c in al), str(al))
J(AL("Align right") + ".click()"); pg.wait_for_timeout(400)
al = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("align right: against the right margin (36)", all(abs(c[0] + c[2] - (PW - 36)) < 1.5 for c in al), str(al))
J(AL("Align to the top") + ".click()"); pg.wait_for_timeout(400)
al = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("align top: against the top margin (16)", all(abs(c[1] - 16) < 1.5 for c in al), str(al))
J(AL("Align to the bottom") + ".click()"); pg.wait_for_timeout(400)
al = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("align bottom: against the bottom margin (16)", all(abs(c[1] + c[3] - (PH - 16)) < 1.5 for c in al), str(al))
J(AL("Align to the centre") + ".click()"); pg.wait_for_timeout(400)
al = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("align centre: in the middle between the margins", all(abs(c[0] + c[2] / 2 - (24 + (PW - 24 - 36) / 2)) < 2 for c in al), str(al))
# "The selection": the old behaviour (against the outermost widget)
J("""()=>{const s=document.querySelectorAll('.nde-spread select')[0]; s.value='selection'; s.dispatchEvent(new Event('change',{bubbles:true}));}"""); pg.wait_for_timeout(300)
blank(); sel_all()
J(AL("Align left") + ".click()"); pg.wait_for_timeout(400)
al = [pos(i) for i in ["c1", "c2", "c3", "c4"]]
check("align to the selection: left edge of the outermost widget", len(set(round(c[0]) for c in al)) == 1, str(al))
# new widget keeps clear of the top panel
J("[...document.querySelectorAll('.nde-tabs button')].find(b=>b.textContent.includes('Widgets')).click()"); pg.wait_for_timeout(300)
n0 = J("document.querySelectorAll('.nde .ndk-w').length")
J("[...document.querySelectorAll('.nde-lib-i')].find(b=>b.title==='Divider').click()"); pg.wait_for_timeout(600)
check("a new widget was added", J("document.querySelectorAll('.nde .ndk-w').length") == n0 + 1)
ys = J("[...document.querySelectorAll('.nde .ndk-w')].map(e=>[e.dataset.id, parseFloat(e.style.top)])")
new = [y for k, y in ys if k not in ("h1","h2","h3","h4")]
band_pg = J("(()=>{const pg=window.__u.properties.nd_ui.page; const s=Math.min(innerWidth/pg.w, innerHeight/pg.h); return 62/s;})()")
check("a new widget lies below the reserved band of the top panel (62 screen px of the mode, in page units)", new and new[0] >= band_pg - 0.6, f"{ys} band={band_pg}")
finish(p, br, errs)
