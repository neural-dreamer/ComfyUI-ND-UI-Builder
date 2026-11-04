# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={"width": 1400, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)[:300]))
    pg.on("console", lambda m: m.type in ("error","warning") and errs.append(m.type+" " + m.text[:200]))
    pg.goto("http://127.0.0.1:8188/")
    pg.wait_for_timeout(15000)
    print(pg.evaluate("""async () => { const m = await import('/scripts/app.js'); const a = m.app; return {graph: !!a.graph, nodes: a.graph?._nodes?.length, lg: typeof window.LiteGraph, types: window.LiteGraph ? Object.keys(window.LiteGraph.registered_node_types).length : -1}; }"""))
    pg.screenshot(path="boot.png")
    print("\n".join(errs[:20]))
    br.close()
