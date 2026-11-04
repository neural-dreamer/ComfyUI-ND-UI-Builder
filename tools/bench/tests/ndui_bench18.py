# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 18 (stage E6): themes ComfyUI / Neon and the Activity animation (widget and the Viewer option).
import json, base64, io, urllib.request
from lib import *
from PIL import Image

def png(color, size=(64, 48)):
    b = io.BytesIO(); Image.new("RGB", size, color).save(b, "PNG"); return b.getvalue()
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
def wsbin(meta, data, kind=4):
    r = urllib.request.Request(URL + "/bench/wsbin", data=json.dumps({"meta": meta, "b64": base64.b64encode(data).decode(), "kind": kind}).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)

ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[1000,640]; a.graph.add(u); window.__u = u;
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[],pages:[{id:'p1',name:'One'}],
   widgets:[
    W('v1','viewer',10,10,420,300,{},{live:false,results:true,compare:false,progress:'both',busy:'orbit'}),
    W('v2','viewer',450,10,300,300,{},{live:false,results:true,compare:false,progress:'line'}),
    W('a1','activity',10,330,220,180,{},{style:'rings',when:'run'}),
    W('a2','activity',250,330,220,180,{},{style:'pulse',when:'always'})]};
  u.ndUiApi.reload(); return {u:u.id}; }""")
pg.wait_for_timeout(1000)
V = "document.querySelectorAll('.ndk-viewer')"
check("widgets mounted", J("document.querySelectorAll('.ndk-act').length") == 2)
vis = lambda sel: J(f"(()=>{{const e={sel}; return !!e && e.style.display!=='none' && e.style.visibility!=='hidden'}})()")
check("no animation in the viewer before a run", J(f"!{V}[0].querySelector('.ndk-act') || {V}[0].querySelector('.ndk-act').style.display==='none'"))
check("Activity (only while it works) hidden before a run", J("document.querySelectorAll('.ndk-act.solo')[0].style.visibility") == "hidden")
check("Activity (always) visible before a run", J("document.querySelectorAll('.ndk-act.solo')[1].style.visibility") == "")
ws({"type": "execution_start", "data": {"prompt_id": "p1"}})
ws({"type": "progress", "data": {"value": 5, "max": 20, "prompt_id": "p1", "node": "1"}})
pg.wait_for_timeout(600)
check("the viewer with the option shows the animation during a run without a live frame", vis(f"{V}[0].querySelector('.ndk-act')"))
check("its style is the chosen one", J(f"{V}[0].querySelector('.ndk-act').dataset.style") == "orbit")
check("the viewer without the option shows none", J(f"!{V}[1].querySelector('.ndk-act')"))
check("Activity (while it works) is visible during a run", J("document.querySelectorAll('.ndk-act.solo')[0].style.visibility") == "")
check("the logo is painted with theme colours (gradient stops use variables)", J("document.querySelector('.ndk-act-mark stop').getAttribute('style')").startswith("stop-color:var(--ndk-accent)"))
anim = J("getComputedStyle(document.querySelector('.ndk-act-fx.orbit')).animationName")
check("the orbit light animates", anim == "ndk-act-spin", anim)
ws({"type": "execution_success", "data": {"prompt_id": "p1"}})
ws({"type": "executing", "data": {"node": None, "prompt_id": "p1"}})
pg.wait_for_timeout(600)
check("the animation goes away when the run ends", not vis(f"{V}[0].querySelector('.ndk-act')"))
check("Activity (while it works) hides again", J("document.querySelectorAll('.ndk-act.solo')[0].style.visibility") == "hidden")
# themes
def theme(t):
    J("(t)=>{const u=window.__u; u.properties.nd_ui.theme={id:t}; u.ndUiApi.reload();}", t); pg.wait_for_timeout(500)
theme("neon")
cs = J("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-accent')").strip().lower()
a2 = J("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-accent2')").strip().lower()
check("Neon is the Launcher palette (cyan -> pink)", cs == "#00e5ff" and a2 == "#ff2bd6", f"{cs} {a2}")
check("Neon has a gradient", "linear-gradient" in J("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-grad')"))
theme("comfyui")
cs = J("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-bg')").strip().lower()
check("the ComfyUI theme applies", cs == "#171718", cs)
check("the ComfyUI theme has no glow", J("getComputedStyle(document.querySelector('.ndk-nodeview .ndk-w')).getPropertyValue('--ndk-glow')").strip() == "none")
check("the theme survives normalizing (id kept)", J("window.__u.properties.nd_ui.theme.id") == "comfyui" and J("(()=>{const w=document.querySelector('.ndk-nodeview .ndk-w'); return w.offsetWidth>10})()"))
# reduced motion
pg.emulate_media(reduced_motion="reduce")
ws({"type": "execution_start", "data": {"prompt_id": "p2"}}); pg.wait_for_timeout(500)
an = J("getComputedStyle(document.querySelector('.ndk-act-fx.orbit')).display")
check("reduced motion: the running light is not drawn", an == "none", an)
ws({"type": "execution_success", "data": {"prompt_id": "p2"}})
check("no console errors", not errs, str(errs[:2]))
finish(p, br, errs)
