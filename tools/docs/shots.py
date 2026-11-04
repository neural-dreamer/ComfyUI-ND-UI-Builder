# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Screenshots for the documentation, taken on the bench stand (see ../bench/README.md).
# Start the stand with real pictures:  BENCH_PICS=<folder of png> bash devkit/restart.sh
# Run:  python3 tools/docs/shots.py <out dir> [en ru zh]
import json, os, sys, urllib.request
from playwright.sync_api import sync_playwright

URL = os.environ.get("BENCH_URL", "http://127.0.0.1:8188")
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/docshots"
LANGS = sys.argv[2:] or ["en", "ru", "zh"]
for _l in LANGS: os.makedirs(f"{OUT}/{_l}", exist_ok=True)

sys.path.insert(0, os.path.dirname(__file__))
from demo import GRAPH, PANEL, VALUES, ws

def run(lang):
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 1600, "height": 1000})
        ctx.add_init_script(f"try{{localStorage.setItem('nd-builder-lang','{lang}')}}catch(e){{}}")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.goto(URL + "/"); pg.wait_for_timeout(8000)
        for _ in range(3): pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
        pg.evaluate(GRAPH); pg.wait_for_timeout(500)
        pg.evaluate(PANEL); pg.wait_for_timeout(1200)
        pg.evaluate(VALUES); pg.wait_for_timeout(300)
        pg.evaluate("window.ndUi.enter()"); pg.wait_for_timeout(1500)
        pg.screenshot(path=f"{OUT}/{lang}/01_panel_empty.png")
        ws({"type": "execution_start", "data": {"prompt_id": "d1"}})
        ws({"type": "executed", "data": {"node": "9", "display_node": "9", "prompt_id": "d1", "output": {"images": [{"filename": "space_a.png", "subfolder": "", "type": "output"}]}}})
        ws({"type": "execution_success", "data": {"prompt_id": "d1"}})
        ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 0}}}})
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f"{OUT}/{lang}/02_panel_result.png")
        for th in ["neon", "sakura", "frost"]:
            pg.evaluate("(t)=>{const d=window.__u.properties.nd_ui; d.theme={id:t}; window.ndUi.host().save(d);}", th); pg.wait_for_timeout(1500)
            pg.screenshot(path=f"{OUT}/{lang}/03_theme_{th}.png")
        pg.evaluate("(t)=>{const d=window.__u.properties.nd_ui; d.theme={id:'midnight'}; window.ndUi.host().save(d);}", "x"); pg.wait_for_timeout(800)
        pg.evaluate("window.ndUi.exit()"); pg.wait_for_timeout(500)
        pg.evaluate("window.ndUi.host().openEditor()"); pg.wait_for_timeout(2000)
        pg.screenshot(path=f"{OUT}/{lang}/04_editor.png")
        print(lang, "errors:", errs[:3])
        br.close()

for l in LANGS: run(l)
# the pictures go to the repository: WebP is about ten times smaller than PNG
from PIL import Image
for l in LANGS:
    d = f"{OUT}/{l}"
    for f in os.listdir(d):
        if f.endswith(".png"):
            Image.open(f"{d}/{f}").convert("RGB").save(f"{d}/{f[:-4]}.webp", quality=86, method=6); os.remove(f"{d}/{f}")
