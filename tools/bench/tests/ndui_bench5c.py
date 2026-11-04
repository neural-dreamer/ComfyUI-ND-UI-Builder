# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 5c: the editor — mode settings of a page, templates, export/import, relink of a lost source.
import json
from lib import *
exec(open('ndui_bench5b.py').read().split("pg.evaluate(INIT)")[0].split("setup(pg)\n",1)[1])
p, br, pg, errs = start()
setup(pg); pg.evaluate(INIT); pg.wait_for_timeout(800)
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDUI').ndUiApi.openEdit()}"); pg.wait_for_timeout(1200)
txt = lambda: pg.evaluate("document.querySelector('.nde')?.innerText || document.body.innerText")
t = txt()
check("the editor shows the mode settings of the page", "Mode of this page" in t and "Inactive nodes are" in t and "Parameter of the active mode" in t, t[:200])
check("nodes list of the mode", "Sampler [sampler]" in t or "Latent [size]" in t)
# templates
pg.evaluate("document.querySelector('[data-rtab=templates]').click()"); pg.wait_for_timeout(300)
pg.evaluate("document.querySelector('.nde-tpl[data-id=generator] .nde-tpl-act button').click()"); pg.wait_for_timeout(600)
pg.evaluate("document.querySelector('[data-rtab=settings]').click()"); pg.wait_for_timeout(300)
pages = pg.evaluate("[...document.querySelectorAll('.nde-pages button')].map(b=>b.textContent)")
check("a template page was added", len(pages) >= 5 and any("Generator" in x for x in pages), str(pages))
nw = pg.evaluate("document.querySelectorAll('.nde .ndk-w').length"); check("its widgets are on the stage", nw >= 5, str(nw))
# switch the page to Page kind
pg.evaluate("[...document.querySelectorAll('.nde .nde-seg button, .nde button')].find(b=>b.textContent==='Page' && b.closest('.nde-row, .nde-sec, div'))?.click()")
pg.screenshot(path="/tmp/ndui_shots/s2d.png")
finish(p, br, errs)
