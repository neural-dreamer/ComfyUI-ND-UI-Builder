# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 3: the editor — creating, moving (grid, guides), resizing, aligning, panels, undo/redo, binding, Save / Cancel.
from lib import *
p, br, pg, errs = start()
setup(pg)
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDUI').ndUiApi.openEdit();}"); pg.wait_for_timeout(700)
check("the editor opens", pg.query_selector(".nde") is not None)
pg.click("text=Add all"); pg.wait_for_timeout(200)
pg.click(".nde-card-h:has-text('Sampler')"); pg.wait_for_timeout(200)
def create(card, i):
    pg.query_selector_all(f".nde-card:has-text('{card}') .nde-param .nde-ibtn[title^='Create']")[i].click(); pg.wait_for_timeout(120)
create("Sampler", 0)   # seed (+ control)
create("Sampler", 1)   # steps
def ui(): return pg.evaluate("""()=>{const E=window.__nde; return null}""")
def widgets():
    return pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); return null}""")
# the model of the editor is reachable through the overlay boxes; read positions from the inspector instead
def inspector_pos():
    return pg.evaluate("[...document.querySelectorAll('.nde-right .nde-pair .nde-in')].slice(-4).map(i=>Number(i.value))")
n = pg.evaluate("document.querySelectorAll('.nde-sel').length")
check("a created widget is selected", n == 1, str(n))
pos = inspector_pos()
check("a new widget stands on the grid", pos[0] % 8 == 0 and pos[1] % 8 == 0, str(pos))
# drag it: the position snaps to the grid
b = pg.query_selector(".nde-sel").bounding_box()
pg.mouse.move(b["x"] + 30, b["y"] + b["height"] / 2); pg.mouse.down()
pg.mouse.move(b["x"] + 80, b["y"] + 100, steps=5)
pg.mouse.move(b["x"] + 83, b["y"] + 103, steps=2)
guides_while = pg.evaluate("document.querySelectorAll('.nde-guide').length")
pg.mouse.up(); pg.wait_for_timeout(200)
pos2 = inspector_pos()
check("dragging moves the widget", pos2[0] != pos[0] or pos2[1] != pos[1], f"{pos}->{pos2}")
check("a dragged widget snaps to the grid", pos2[0] % 8 == 0 and pos2[1] % 8 == 0, str(pos2))
# resize by the south-east handle
b = pg.query_selector(".nde-sel").bounding_box()
h = pg.query_selector(".nde-h8[data-dir='se']").bounding_box()
pg.mouse.move(h["x"] + 4, h["y"] + 4); pg.mouse.down(); pg.mouse.move(h["x"] + 60, h["y"] + 30, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
pos3 = inspector_pos()
check("the handle resizes the widget", pos3[2] > pos2[2] and pos3[3] > pos2[3] and pos3[2] % 8 == 0, f"{pos2}->{pos3}")
pos_resized = inspector_pos()
# smart guide: drag the widget close to the horizontal centre of the page
st = pg.query_selector(".nde-stage").bounding_box(); b = pg.query_selector(".nde-sel").bounding_box()
cx = b["x"] + b["width"] / 2; target = st["x"] + st["width"] / 2
pg.mouse.move(cx, b["y"] + b["height"] / 2); pg.mouse.down(); pg.mouse.move(cx + (target - cx) * 0.5, b["y"] + b["height"] / 2, steps=4); pg.mouse.move(target + 2, b["y"] + b["height"] / 2, steps=4)
g = pg.evaluate("document.querySelectorAll('.nde-guide').length")
pg.mouse.up(); pg.wait_for_timeout(150)
b2 = pg.query_selector(".nde-sel").bounding_box()
check("a guide is drawn while the widget meets the page centre", g > 0, str(g))
check("the widget snaps to the page centre", abs((b2["x"] + b2["width"] / 2) - target) < 1.5, f"{b2['x'] + b2['width'] / 2} vs {target}")
pos_moved = inspector_pos()
# undo / redo
pg.keyboard.press("Control+z"); pg.wait_for_timeout(250)
check("Ctrl+Z undoes the last move", inspector_pos() == pos_resized, f"{inspector_pos()} vs {pos_resized}")
pg.keyboard.press("Control+Shift+z"); pg.wait_for_timeout(250)
check("Ctrl+Shift+Z redoes it", inspector_pos() == pos_moved, f"{inspector_pos()} vs {pos_moved}")
pg.keyboard.press("Control+z"); pg.keyboard.press("Control+z"); pg.wait_for_timeout(250)
check("a second Ctrl+Z undoes the resize", inspector_pos()[2:] == pos2[2:], str(inspector_pos()))
pg.keyboard.press("Control+Shift+z"); pg.keyboard.press("Control+Shift+z"); pg.wait_for_timeout(250)
check("ComfyUI itself did not react to Ctrl+Z (the editor is still open)", pg.query_selector(".nde") is not None)
# align: select all, align left
pg.keyboard.press("Control+a"); pg.wait_for_timeout(200)
check("Ctrl+A selects all widgets", pg.evaluate("document.querySelectorAll('.nde-sel').length") == 2)
pg.click(".nde-tabs button:has-text('Layout')"); pg.wait_for_timeout(200)
pg.click(".nde-tools button[title='Align left']"); pg.wait_for_timeout(200)
xs = pg.evaluate("[...document.querySelectorAll('.nde-sel')].map(b=>Math.round(b.getBoundingClientRect().left))")
check("Align left puts the widgets on one line", len(set(xs)) == 1, str(xs))
# add a panel from the library, put the widgets on it, move the panel: the widgets follow
pg.click(".nde-tabs button:has-text('Widgets')"); pg.wait_for_timeout(200)
pg.click(".nde-lib-i:has-text('Panel')"); pg.wait_for_timeout(300)
check("the library adds a widget", pg.evaluate("document.querySelectorAll('.nde-sel').length") == 1)
# bind by the popup: add a Text widget and bind it
pg.click(".nde-lib-i:has-text('Dropdown')"); pg.wait_for_timeout(300)
pg.click(".nde-slot-b"); pg.wait_for_timeout(300)
items = pg.evaluate("[...document.querySelectorAll('.nde-bindpop .nde-param .nde-pn')].map(e=>e.textContent)")
check("the bind popup lists compatible parameters only", "sampler_name" in items and "scheduler" in items and "steps" not in items, str(items))
pg.click(".nde-bindpop .nde-param:has-text('scheduler')"); pg.wait_for_timeout(300)
check("binding fills the slot", "scheduler" in pg.inner_text(".nde-slot-b"), pg.inner_text(".nde-slot-b"))
# preview: widgets answer the mouse
pg.click(".nde-top .nde-btn:has-text('Preview')"); pg.wait_for_timeout(300)
check("Preview hides the selection layer", pg.evaluate("document.querySelectorAll('.nde-sel').length") == 0)
pg.click(".nde-top .nde-btn:has-text('Preview')"); pg.wait_for_timeout(200)
# zoom with the wheel
z0 = pg.inner_text(".nde-zoom > span")
pg.mouse.move(700, 500); pg.mouse.wheel(0, -300); pg.wait_for_timeout(200)
check("the wheel zooms", pg.inner_text(".nde-zoom > span") != z0, z0 + "->" + pg.inner_text(".nde-zoom > span"))
# Cancel throws away (with a confirm), Save writes
pg.click(".nde-top .nde-btn:has-text('Cancel')"); pg.wait_for_timeout(200)
check("Cancel asks before throwing the changes away", pg.query_selector(".nde-confirm") is not None)
pg.click(".nde-confirm .nde-btn:has-text('Keep editing')"); pg.wait_for_timeout(200)
check("Keep editing stays in the editor", pg.query_selector(".nde") is not None and pg.query_selector(".nde-confirm") is None)
pg.click(".nde-top .nde-btn.primary"); pg.wait_for_timeout(800)
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); const w=window.ndUi.host().ui.widgets; return {n:w.length, types:w.map(x=>x.type), frames:u.ndUiApi.root.querySelectorAll('.ndk-w').length, srcs:window.ndUi.host().ui.sources.length, bound:w.filter(x=>x.type==='dropdown').map(x=>x.slots.value?.name)}}""")
check("Save writes the panel to the node", r["n"] == 4 and r["srcs"] == 2 and r["frames"] == 4 and r["bound"] == ["scheduler"], str(r))
check("the editor is closed after Save", pg.query_selector(".nde") is None)
# Cancel really discards
pg.evaluate("async()=>{const m=await import('/scripts/app.js'); m.app.graph._nodes.find(n=>n.type==='NDUI').ndUiApi.openEdit();}"); pg.wait_for_timeout(500)
pg.click(".nde-tabs button:has-text('Widgets')"); pg.click(".nde-lib-i:has-text('Number')"); pg.wait_for_timeout(200)
pg.click(".nde-top .nde-btn:has-text('Cancel')"); pg.wait_for_timeout(200)
pg.click(".nde-confirm .nde-btn:has-text('Throw away')"); pg.wait_for_timeout(500)
n = pg.evaluate("async()=>{const m=await import('/scripts/app.js'); return window.ndUi.host().ui.widgets.length}")
check("Cancel throws the changes away", n == 4 and pg.query_selector(".nde") is None, str(n))
finish(p, br, errs)
