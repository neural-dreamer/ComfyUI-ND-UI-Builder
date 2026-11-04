# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 36: ND Show Any As Text — the tabs of the notes are dragged with the pointer to change their order (the Preview tab stays first).
import json
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
J("async()=>{ window.__app = (await import('/scripts/app.js')).app }")
J("""async () => { const a = window.__app, LG = window.LiteGraph; a.graph.clear();
  const n = LG.createNode('NDShowAnyAsText'); n.pos = [80, 80]; a.graph.add(n); a.graph.setDirtyCanvas(true, true); }""")
pg.wait_for_timeout(1200)
NODE = "(()=>window.__app.graph._nodes.find(n=>n.type==='NDShowAnyAsText'))()"
order = lambda: J("(()=>{const n=%s; return (n.properties.nd_notes||[]).map(x=>x.title+':'+x.text)})()" % NODE)
labels = lambda: J("[...document.querySelectorAll('.nd-st-tab .nd-st-label')].map(x=>x.textContent)")
active = lambda: J("(document.querySelector('.nd-st-tab.active .nd-st-label')||{}).textContent")
for i in (1, 2, 3):
    J("document.querySelector('.nd-st-add').click()"); pg.wait_for_timeout(200)
    pg.fill(".nd-st-note:not([style*='none']):visible", f"text{i}") if False else J("(v)=>{const ta=[...document.querySelectorAll('.nd-st-note')].filter(t=>t.offsetParent!==null)[0]; ta.value=v; ta.dispatchEvent(new Event('input',{bubbles:true}))}", f"text{i}")
check("three notes with their texts", order() == ["Note 1:text1", "Note 2:text2", "Note 3:text3"], str(order()))
check("Preview is the first tab", labels() == ["Preview", "Note 1", "Note 2", "Note 3"], str(labels()))
tab = lambda name: pg.locator(".nd-st-tab", has_text=name).first
def drag(src, dst, side=0):
    a = tab(src).bounding_box(); b = tab(dst).bounding_box()
    pg.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2); pg.mouse.down()
    tx = b["x"] + (6 if side < 0 else b["width"] - 6 if side > 0 else b["width"] / 2)
    for k in range(1, 13): pg.mouse.move(a["x"] + a["width"] / 2 + (tx - a["x"] - a["width"] / 2) * k / 12, a["y"] + a["height"] / 2); pg.wait_for_timeout(15)
    mid = J("!!document.querySelector('.nd-st-tab.dragging')")
    pg.mouse.up(); pg.wait_for_timeout(400)
    return mid
# 1) the last tab to the front of the notes
mid = drag("Note 3", "Note 1", -1)
check("while dragging the tab is lifted", mid)
check("Note 3 now stands first (the Preview stays before it)", labels() == ["Preview", "Note 3", "Note 1", "Note 2"], str(labels()))
check("the notes keep their texts and the order is saved with the node", order() == ["Note 3:text3", "Note 1:text1", "Note 2:text2"], str(order()))
check("the dragged note is the active one (it was active)", active() == "Note 3", str(active()))
check("its editor shows its own text", J("[...document.querySelectorAll('.nd-st-note')].filter(t=>t.offsetParent!==null).map(t=>t.value)") == ["text3"])
check("a drag does not click another tab", J("!document.querySelector('.nd-st-tab-preview.active')"))
# 2) the first note to the end
drag("Note 3", "Note 2", 1)
check("a note dragged to the end", labels() == ["Preview", "Note 1", "Note 2", "Note 3"] and order() == ["Note 1:text1", "Note 2:text2", "Note 3:text3"], str(order()))
check("the active note follows its tab", active() == "Note 3", str(active()))
# 3) a tab dragged over a part of the way back stays
before = order()
drag("Note 1", "Note 2", -1)
check("a tiny move over the neighbour edge keeps the order or swaps, never loses a note", sorted(order()) == sorted(before), str(order()))
# 4) the Preview tab cannot be dragged and a click still works
a = tab("Preview").bounding_box(); b = tab("Note 2").bounding_box()
pg.mouse.move(a["x"] + 20, a["y"] + 10); pg.mouse.down(); pg.mouse.move(b["x"] + 30, b["y"] + 10, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
check("Preview stays first", labels()[0] == "Preview", str(labels()))
tab("Note 2").click(); pg.wait_for_timeout(300)
check("a plain click still opens a tab", active() == "Note 2", str(active()))
# 5) rename and delete still work on a tab
J("document.querySelector('.nd-st-tab.active .nd-st-label').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))"); pg.wait_for_timeout(200)
check("double click renames", J("!!document.querySelector('.nd-st-rename')"))
pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
# 6) the order survives a reload of the node from the workflow
J("async()=>{ const a=window.__app; const g=a.graph.serialize(); window.__g=g; a.graph.clear(); await a.loadGraphData(g); }"); pg.wait_for_timeout(1500)
check("the order is restored after loading the workflow", labels()[0] == "Preview" and len(labels()) == 4 and [l for l in labels()[1:]] == [x.split(":")[0] for x in order()], str(labels()) + str(order()))
finish(p, br, errs)
