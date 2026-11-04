# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 4: ND UI Kit — contrast of every theme (>= 4.5:1), every style and shape renders, overrides, backgrounds, font.
# Optional: python3 ndui_bench4.py shots  -> writes contact sheets to ./shots
import os, sys
from lib import *
p, br, pg, errs = start()
setup(pg); build(pg)
K = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/kit.js"
res = pg.evaluate("""async(K)=>{const k=await import(K); const out={}; for (const t of k.THEMES) out[t.id]=k.themeContrast(t.tokens).map(x=>[x.name,+x.ratio.toFixed(2)]); out.custom=k.themeContrast(k.customTheme('#7757fa','#0e1014')).map(x=>[x.name,+x.ratio.toFixed(2)]); out.customLight=k.themeContrast(k.customTheme('#e11d48','#f5f5f7')).map(x=>[x.name,+x.ratio.toFixed(2)]); return out}""", K)
for t, rows in res.items():
    low = [r for r in rows if r[1] < 4.5]
    check(f"contrast of the theme {t} is at least 4.5:1", not low, str(low))
check("Inter is loaded", pg.evaluate("document.fonts.check('13px \"Inter ND\"')") is True)
def apply(patch):
    pg.evaluate("""async(patch)=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); const ui=u.properties.nd_ui; for (const [k,v] of Object.entries(patch)) { if (typeof v==='object') Object.assign(ui[k], v); else ui[k]=v; } u.ndUiApi.reload();}""", patch)
    pg.wait_for_timeout(350)
def frame_ok():
    return pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].every(f=>f.getBoundingClientRect().width>10)")
os.makedirs("shots", exist_ok=True) if "shots" in sys.argv else None
for th in ["midnight", "studio", "neon", "comfyui", "glass", "sakura", "mono", "custom"]:
    apply({"theme": {"id": th}})
    check(f"theme {th} renders", frame_ok())
    if "shots" in sys.argv: pg.query_selector(".ndk-nodeview").screenshot(path=f"shots/theme_{th}.png")
apply({"theme": {"id": "midnight"}})
for st in ["filled", "outline", "soft", "glass", "minimal"]:
    for sh in ["sharp", "rounded", "pill"]:
        apply({"kit": {"style": st, "shape": sh}})
        ok = frame_ok()
        bg = pg.evaluate("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w .ndk-field, .ndk-nodeview .ndk-w')).borderRadius")
        check(f"style {st} / shape {sh} renders", ok)
    if "shots" in sys.argv: pg.query_selector(".ndk-nodeview").screenshot(path=f"shots/style_{st}.png")
apply({"kit": {"style": "soft", "shape": "rounded"}})
r1 = pg.evaluate("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-accent')")
apply({"theme": {"id": "midnight", "overrides": {"accent": "#ff3366"}}})
r2 = pg.evaluate("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-accent')")
check("an accent override reaches the widgets", r1.strip() != r2.strip() and "ff3366" in r2.lower(), f"{r1} / {r2}")
apply({"theme": {"overrides": {}}})
# a widget's own look wins over the kit
pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); u.properties.nd_ui.widgets[1].look={accent:'#00ff88',shape:'pill'}; u.ndUiApi.reload();}"""); pg.wait_for_timeout(400)
acc = pg.evaluate("[...document.querySelectorAll('.ndk-nodeview .ndk-w')].map(f=>getComputedStyle(f).getPropertyValue('--ndk-accent').trim())")
check("the look of one widget overrides the kit for it alone", acc[1].lower() == "#00ff88" and acc[0].lower() != "#00ff88", str(acc))
for bgp in [{"type": "solid", "color": "#223344"}, {"type": "gradient", "a": "#112233", "b": "#445566", "angle": 45}, {"type": "theme"}]:
    pg.evaluate("async(b)=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); Object.assign(u.properties.nd_ui.page.bg, b); u.ndUiApi.reload();}", bgp); pg.wait_for_timeout(300)
    css = pg.evaluate("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-page-bg')).background")
    check(f"page background {bgp['type']} is set", bool(css) and "none" not in css[:10], css[:80])
finish(p, br, errs)
