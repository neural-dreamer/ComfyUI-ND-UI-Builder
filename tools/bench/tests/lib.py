# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Shared helpers of the ND UI bench tests (Playwright on the real frontend, see ../README.md).
import json, sys, urllib.request
from playwright.sync_api import sync_playwright

import os
os.makedirs("/tmp/ndui_shots", exist_ok=True)
URL = os.environ.get("BENCH_URL", "http://127.0.0.1:8188")
FAILS = []

def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
    if not cond: FAILS.append(name)

def start(w=1500, h=950):
    p = sync_playwright().start(); br = p.chromium.launch(); pg = br.new_page(viewport={"width": w, "height": h})
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)[:500]))
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errs.append("console " + m.text[:400]))
    pg.goto(URL + "/"); pg.wait_for_timeout(8000)
    for _ in range(3): pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    return p, br, pg, errs

def finish(p, br, errs):
    check("no console errors", not errs, "; ".join(errs[:4]))
    br.close(); p.stop()
    print("\nFAILED: " + ", ".join(FAILS) if FAILS else "\nALL PASSED")
    sys.exit(1 if FAILS else 0)

def prompts():
    return json.load(urllib.request.urlopen(URL + "/bench/prompts"))

SETUP = """async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph;
  a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  mk('KSampler',60,380,'Sampler [sampler]'); mk('EmptyLatentImage',60,80,'Latent [size]');
  const u = mk('NDUI',480,60); u.size=[900,600]; a.graph.setDirtyCanvas(true,true); return u.id; }"""

def setup(pg):
    pg.evaluate(SETUP); pg.wait_for_timeout(500)

# a ready panel: the widgets of the two nodes above
BUILD = """async () => { const m = await import('/scripts/app.js'); const a=m.app; const g=a.graph;
 const u=g._nodes.find(n=>n.type==='NDUI'), k=g._nodes.find(n=>n.type==='KSampler'), l=g._nodes.find(n=>n.type==='EmptyLatentImage');
 k.properties.nd_ui_src={uid:'sk',tag:'sampler'}; l.properties.nd_ui_src={uid:'sl',tag:'size'};
 const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
 const B=(s,n)=>({src:s,kind:'widget',name:n});
 u.size=[900,520];
 u.properties.nd_ui={sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'sl',tag:'size',class:'EmptyLatentImage',title:'Latent [size]'}],pages:[{id:'p1',name:'Main'}],
 widgets:[W('a','seed',20,20,360,64,{value:B('sk','seed'),control:B('sk','control_after_generate')},{label:'Seed'}),W('b','slider',20,110,360,64,{value:B('sk','steps')},{label:'Steps'}),W('c','dropdown',20,200,360,64,{value:B('sk','sampler_name')},{label:'Sampler'}),W('d','number',420,20,240,64,{value:B('sl','width')},{label:'Width'}),W('e','toggle',420,110,240,48,{},{text:'Demo'})]};
 u.ndUiApi.reload(); }"""

def build(pg):
    pg.evaluate(BUILD); pg.wait_for_timeout(900)

def val(pg, name):
    return pg.evaluate("async(n)=>{const m=await import('/scripts/app.js'); for (const nd of m.app.graph._nodes) for (const w of nd.widgets||[]) if (nd.type+'.'+w.name===n) return w.value}", name)

def setval(pg, name, v):
    pg.evaluate("async([n,v])=>{const m=await import('/scripts/app.js'); for (const nd of m.app.graph._nodes) for (const w of nd.widgets||[]) if (nd.type+'.'+w.name===n) w.value=v}", [name, v])
