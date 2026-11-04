# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 25 (pre-release polish): the Bind popup of the editor scrolls on its own and has a search.
# Before: the list of parameters was cut off at the height of the popup (overflow:hidden on the popup, no scroll box), so the parameters of the
# nodes lower in the list (for example the combo edit_format of a node linked late) could not be reached.
from lib import *
p, br, pg, errs = start()
J = lambda s: pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph;
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; n.title=title; a.graph.add(n); return n;};
  mk('UNETLoader',700,40,'Load Diffusion Model [unet]'); mk('LoraLoaderModelOnly',700,160,'Load LoRA [lora]'); mk('CLIPLoader',700,260,'Load CLIP [clip]'); mk('VAELoader',700,400,'Load VAE [vae]'); mk('LoadImage',700,500,'Load Image [img]'); }""")
pg.wait_for_timeout(500)
J("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDUI').ndUiApi.openEdit();}"); pg.wait_for_timeout(900)
pg.click("text=Add all"); pg.wait_for_timeout(400)
pg.click(".nde-tabs button:has-text('Widgets')"); pg.wait_for_timeout(200)
pg.click(".nde-lib-i:has-text('Dropdown')"); pg.wait_for_timeout(400)
pg.click(".nde-slot-b"); pg.wait_for_timeout(400)

POP = ".nde-bindpop"
info = J("""(()=>{const l=document.querySelector('.nde-bindpop .ndk-pop-list'); const b=document.querySelector('.nde-bindpop');
  return l ? {sh:l.scrollHeight, ch:l.clientHeight, box:b.getBoundingClientRect().height, rows:b.querySelectorAll('.nde-param').length, ov:getComputedStyle(l).overflowY, search:!!b.querySelector('.ndk-pop-search input')} : null})()""")
check("the popup has its own scroll box", info is not None and info["ov"] == "auto", str(info))
check("there is more in the list than the box shows (the case that was cut off)", info and info["sh"] > info["ch"] + 5, str(info))
check("a search line is there when there are many parameters", info and info["search"] is True, str(info))
# the wheel over the popup scrolls the list and does not zoom the stage
z0 = J("window.ndUi.host().editor?.zoom ?? 0")
bb = pg.query_selector(POP + " .ndk-pop-list").bounding_box()
pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.mouse.wheel(0, 2000); pg.wait_for_timeout(250)
st = J("document.querySelector('.nde-bindpop .ndk-pop-list').scrollTop")
check("the wheel scrolls the list", st > 20, str(st))
check("the last parameter of the list can be reached", J("""(()=>{const l=document.querySelector('.nde-bindpop .ndk-pop-list'); const r=[...l.querySelectorAll('.nde-param')].pop(); const a=l.getBoundingClientRect(), b=r.getBoundingClientRect(); return b.bottom <= a.bottom + 1 && b.top >= a.top - 1;})()""") is True)
check("the stage did not zoom", J("window.ndUi.host().editor?.zoom ?? 0") == z0, f"{z0}")
# search
pg.fill(POP + " .ndk-pop-search input", "vae_name"); pg.wait_for_timeout(250)
vis = J("[...document.querySelectorAll('.nde-bindpop .nde-param')].filter(e=>e.style.display!=='none').map(e=>e.querySelector('.nde-pn').textContent)")
grp = J("[...document.querySelectorAll('.nde-bindpop .nde-pgrp')].filter(e=>e.style.display!=='none').map(e=>e.textContent)")
check("the search shows only the matching parameter and its node", vis == ["vae_name"] and len(grp) == 1, f"{vis} {grp}")
pg.fill(POP + " .ndk-pop-search input", "load vae"); pg.wait_for_timeout(250)
vis = J("[...document.querySelectorAll('.nde-bindpop .nde-param')].filter(e=>e.style.display!=='none').length")
check("the search also looks at the title of the node", vis == 1, str(vis))
pg.fill(POP + " .ndk-pop-search input", "zzzz"); pg.wait_for_timeout(250)
check("nothing found is said", "Nothing found" in J("document.querySelector('.nde-bindpop').innerText"))
pg.fill(POP + " .ndk-pop-search input", "vae_name"); pg.wait_for_timeout(200)
pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
check("Enter binds the first match", "vae_name" in pg.inner_text(".nde-slot-b"), pg.inner_text(".nde-slot-b"))
check("the popup closed", pg.query_selector(POP) is None)
# a click on a row still works
pg.click(".nde-slot-b"); pg.wait_for_timeout(300)
pg.click(POP + " .nde-param:has-text('scheduler')"); pg.wait_for_timeout(300)
check("a click on a row binds it", "scheduler" in pg.inner_text(".nde-slot-b"), pg.inner_text(".nde-slot-b"))
finish(p, br, errs)
