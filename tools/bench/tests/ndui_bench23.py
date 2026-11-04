# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 23 (E7c): colours of Node Embed — comfy variables, own CSS, recolour (experiment), switching off leaves no traces.
# Needs the real packs (tools/bench/stage_thirdparty.sh); without them the test is skipped.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
has = J("!!window.LiteGraph.registered_node_types['H3Timeline'] && !!window.LiteGraph.registered_node_types['MiniMaxH3MediaLoader']")
if not has:
    print("SKIP: the third-party packs are not staged (tp-*)"); br.close(); p.stop(); sys.exit(0)
import json
def model(pr, theme="midnight"):
    return json.dumps({"sources": [{"uid": "sl", "tag": "", "class": "MiniMaxH3MediaLoader", "title": "Loader"}, {"uid": "st", "tag": "", "class": "H3Timeline", "title": "Timeline"}],
        "pages": [{"id": "p1", "name": "Main"}], "theme": {"id": theme},
        "widgets": [{"id": "a", "type": "nodeembed", "page": "p1", "x": 20, "y": 20, "w": 640, "h": 480, "z": 1, "slots": {"node": {"src": "sl", "kind": "anynode", "name": ""}}, "props": dict({"label": "E"}, **pr)},
                    {"id": "b", "type": "nodeembed", "page": "p1", "x": 680, "y": 20, "w": 560, "h": 480, "z": 1, "slots": {"node": {"src": "st", "kind": "anynode", "name": ""}}, "props": dict({"label": "E"}, **{k: v for k, v in pr.items() if k != "css"})}]})
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const mk=(t,x,y)=>{const n=LG.createNode(t); n.pos=[x,y]; a.graph.add(n); return n;};
  const l=mk('MiniMaxH3MediaLoader',40,60), t=mk('H3Timeline',760,60);
  l.properties.nd_ui_src={uid:'sl',tag:''}; t.properties.nd_ui_src={uid:'st',tag:''}; window.__app=a;
  await new Promise(r=>setTimeout(r,1500)); }""")
def use(pr, theme="midnight", wait=1500):
    J("(m) => window.ndUi.host().save(JSON.parse(m))", model(pr, theme)); pg.wait_for_timeout(wait)
snap = lambda: J("""()=>{const b=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box'); return [...b.querySelectorAll('*')].slice(0,500).map(e=>{const s=getComputedStyle(e); return [s.color,s.backgroundColor,s.borderTopColor].join('|')})}""")
J("window.ndUi.enter()"); use({"colors": "off"})
base = snap()
check("panel is there", len(base) > 20, str(len(base)))
check("off: no variables, no style tags", J("(()=>{const a=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb'); return a.style.getPropertyValue('--comfy-menu-bg')==='' && document.querySelectorAll('style[data-ndemb]').length===0})()") is True)
use({"colors": "comfy"})
v = J("""()=>{const a=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb'); const cs=getComputedStyle(a); return [cs.getPropertyValue('--comfy-menu-bg').trim(), cs.getPropertyValue('--ndk-s1').trim(), cs.getPropertyValue('--p-primary-color').trim(), cs.getPropertyValue('--ndk-accent').trim()]}""")
check("comfy (default): the variables of ComfyUI carry the theme", v[0] == v[1] != "" and v[2] == v[3] != "", str(v))
check("comfy leaves the panel's own colours alone", snap() == base)
# own css
use({"colors": "comfy", "css": "* { caret-color: rgb(1, 2, 3); }"})
cc = J("""()=>{const b=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box'); return [getComputedStyle(b.firstElementChild).caretColor, getComputedStyle(document.body).caretColor, getComputedStyle(document.querySelector('.ndk-uimode .ndk-w[data-id=b] .ndk-emb-box').firstElementChild).caretColor]}""")
check("own CSS reaches the panel of its frame only", cc[0] == "rgb(1, 2, 3)" and cc[1] != "rgb(1, 2, 3)" and cc[2] != "rgb(1, 2, 3)", str(cc))
use({"colors": "comfy", "css": ""})
check("empty CSS: the style tag is gone", J("document.querySelectorAll('style[data-ndemb]').length") == 0)
# recolour
use({"colors": "recolor"}, wait=2500)
rc = snap()
diff = sum(1 for x, y in zip(base, rc) if x != y)
check("recolour: the colours of the panel changed", diff > 10, f"{diff}/{len(base)}")
check("recolour: its style tag is present, scoped to the frame", J("[...document.querySelectorAll('style[data-ndemb]')].some(s=>s.textContent.includes('[data-ndemb=')&&s.textContent.length>200)") is True)
pg.screenshot(path="/tmp/b23_midnight_recolor.png")
# the inline colours set later by the pack are recoloured too, and given back
J("""()=>{const b=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box'); const e=document.createElement('div'); e.textContent='x'; b.append(e); e.style.color='rgb(255, 184, 77)'; window.__ie=e}"""); pg.wait_for_timeout(600)
ic = J("window.__ie.style.color"); check("an inline colour set after the start is recoloured", ic != "rgb(255, 184, 77)" and ic != "", ic)
use({"colors": "off"}, wait=2000)
given = J("""()=>{ const c=window.__ie.style.color; window.__ie.remove(); return c }""")
check("recolour off: the inline colour is given back", given == "rgb(255, 184, 77)", given)
back = snap()
check("recolour off: every colour is as it was", back == base, str([(i, x, y) for i, (x, y) in enumerate(zip(base, back)) if x != y]))
check("recolour off: no style tags left", J("document.querySelectorAll('style[data-ndemb]').length") == 0)
# screenshots in the themes
for th in ("neon", "studio"):
    for mode in ("comfy", "recolor"):
        use({"colors": mode}, theme=th, wait=2500); pg.screenshot(path=f"/tmp/b23_{th}_{mode}.png")
# glass themes: the surfaces are see-through; the recolour must still give real colours (not a plain grey)
use({"colors": "recolor"}, theme="frost", wait=2500)
fr = J("""()=>{const b=document.querySelector('.ndk-uimode .ndk-w[data-id=a] .ndk-emb-box'); const st=[...document.querySelectorAll('style[data-ndemb]')].map(s=>s.textContent).join(' '); return st}""")
check("frost: the recolour has no bare white surfaces", "rgba(255, 255, 255, 1)" not in fr.replace("rgba(255, 255, 255, 1) ", "X") or fr.count("rgba(255, 255, 255, 1)") < 3, str(fr.count("rgba(255, 255, 255, 1)")))
J("window.ndUi.exit()"); pg.wait_for_timeout(600)
check("leaving the mode removes everything", J("document.querySelectorAll('style[data-ndemb]').length") == 0)
finish(p, br, errs)
