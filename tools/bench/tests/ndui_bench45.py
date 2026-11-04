# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 45: the hotkeys of ComfyUI in the ND UI mode: held back, except the keys of the allowed COMMANDS (the setting "Allowed ComfyUI Hotkeys").
import json, urllib.request
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
setup(pg)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const u = LG.createNode('NDUI'); u.pos=[480,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[{id:'g',type:'generate',page:'p1',x:20,y:60,w:300,h:64,z:1,slots:{},props:{}},{id:'t',type:'text',page:'p1',x:20,y:150,w:300,h:120,z:1,slots:{},props:{}}],view:{}};
  u.properties.nd_ui = ui; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(800)
SET = "async(v)=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set('NeuralDreamerUI.AllowedHotkeys', v)}"
# the real hotkey of ComfyUI: R = Refresh Node Definitions, which asks the server for /object_info again
reqs = []
pg.on("request", lambda r: reqs.append(r.url) if "object_info" in r.url else None)
def refresh_after(key):
    n = len(reqs); pg.keyboard.press(key); pg.wait_for_timeout(1100); return len(reqs) - n
check("outside the mode R refreshes the node definitions", refresh_after("r") == 1)
J("window.ndUi.enter()"); pg.wait_for_timeout(800)
pg.evaluate(SET, [])
check("in the mode R does nothing by default", refresh_after("r") == 0)
pg.evaluate(SET, ["Comfy.RefreshNodeDefinitions"]); pg.wait_for_timeout(300)
check("with the command allowed, its key works in the mode (the real command runs)", refresh_after("r") == 1)
pg.evaluate(SET, ["Comfy.Interrupt"]); pg.wait_for_timeout(300)
check("an allowed command does not let other commands through", refresh_after("r") == 0)
# it is the command that is allowed, not the letter: another key bound to the command works too
J("""async()=>{const m=await import('/scripts/app.js'); const kb=m.app.extensionManager._p._s.get('keybinding'); window.__kb=kb;
  const old=kb.getKeybindingsByCommandId('Comfy.RefreshNodeDefinitions'); window.__oldKb=old;
  kb.updateKeybindingOnCommand ? 0 : 0; }""")
pg.evaluate(SET, ["Comfy.RefreshNodeDefinitions"]); pg.wait_for_timeout(300)
J("""()=>{const kb=window.__kb; const KC=kb.keybindings[0].combo.constructor; const KB=kb.keybindings[0].constructor;
  kb.addUserKeybinding(new KB({commandId:'Comfy.RefreshNodeDefinitions', combo:{key:'j'}}));}""")
check("a new key that the user gave to the command works as well", refresh_after("j") == 1)
pg.evaluate(SET, []); pg.wait_for_timeout(300)
check("and without the command in the list it is held back", refresh_after("j") == 0)
# a key that ComfyUI does not use is not touched
J("window.__seen=[]; window.addEventListener('keydown', (e)=>window.__seen.push(e.key))")
pg.keyboard.press("x"); pg.wait_for_timeout(100)
check("keys that ComfyUI has no command for still reach the page", J("window.__seen") == ["x"])
# typing in a field
tx = ".ndk-uimode .ndk-w[data-id='t'] textarea"
if J("(s)=>!!document.querySelector(s)", tx):
    pg.focus(tx); pg.keyboard.type("qrq"); pg.wait_for_timeout(200)
    check("typing in a text field is not touched", "qrq" in J("(s)=>document.querySelector(s).value", tx))
# the mode's own keys keep working
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
check("after leaving the mode the hotkeys are not held back any more", refresh_after("r") == 1)
J("window.ndUi.enter()"); pg.wait_for_timeout(500)
check("the mode is not a dialog for ComfyUI (a dialog makes it ignore the hotkeys)", J("document.querySelector('.ndk-uimode').getAttribute('role')") != "dialog" and J("document.querySelector('.ndk-uimode').getAttribute('aria-modal')") is None)
J("window.ndUi.exit()"); pg.wait_for_timeout(300)
# ---- the field of the settings
src = json.loads(urllib.request.urlopen(URL + "/extensions").read())
ext = next(e for e in src if e.endswith("/ndui.js")); base = URL + ext[:-len("/ndui.js")]
J("""async(b)=>{ const h = await import(b + '/ndui/hotkeys.js'); let saved=null; const el = h.renderSetting('x', v=>{saved=v}, ['Comfy.RefreshNodeDefinitions']); document.body.append(el); window.__hkSaved = ()=>saved; window.__h = h; }""", base)
chips = J("[...document.querySelectorAll('.ndui-hk .chip')].map(c=>c.textContent)")
check("the field shows a chip with the command and its key", len(chips) == 1 and "Refresh Node Definitions" in chips[0] and "R" in chips[0], str(chips))
check("it has the button Add ComfyUI Hotkey", J("document.querySelector('.ndui-hk .add').textContent") == "Add ComfyUI Hotkey")
J("document.querySelector('.ndui-hk .add').click()"); pg.wait_for_timeout(300)
rows = J("[...document.querySelectorAll('.ndui-hkp .row')].map(r=>r.textContent)")
check("the button opens the list of all the commands of ComfyUI (like the Keybinding tab)", len(rows) > 50, str(len(rows)))
check("the commands that have a key come first and show the key", any("Unload" in r or "Queue" in r for r in rows[:40]) and J("document.querySelectorAll('.ndui-hkp .row kbd').length") > 5)
pg.fill(".ndui-hkp input", "interrupt"); pg.wait_for_timeout(200)
rows = J("[...document.querySelectorAll('.ndui-hkp .row')].map(r=>r.textContent)")
check("the search narrows the list", 0 < len(rows) < 6 and any("Interrupt" in r for r in rows), str(rows))
pg.click(".ndui-hkp .row"); pg.wait_for_timeout(200)
saved = J("window.__hkSaved()")
check("a click adds the command (its id, not a key) and closes the list", saved == ["Comfy.RefreshNodeDefinitions", "Comfy.Interrupt"] and J("!document.querySelector('.ndui-hkp')"), str(saved))
J("document.querySelectorAll('.ndui-hk .chip button')[0].click()"); pg.wait_for_timeout(100)
check("the cross removes a command", J("window.__hkSaved()") == ["Comfy.Interrupt"])
J("document.querySelector('.ndui-hk .add').click()"); pg.wait_for_timeout(200); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
check("Esc closes the list", J("!document.querySelector('.ndui-hkp')"))
check("an old entry (a key combination) is still read: Ctrl+Z -> Ctrl+Z", J("window.__h.normalizeCombo('ctrl + z')") == "Ctrl+Z")
finish(p, br, errs)
