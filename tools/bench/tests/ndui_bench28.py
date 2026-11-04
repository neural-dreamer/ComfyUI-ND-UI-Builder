# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 28 (pre-release polish): spelling check and the weight of a word (Ctrl+Up / Down) in the text fields of ND UI and of Node Embed.
# The weight code is compared with the real extension of the ComfyUI frontend (Comfy.EditAttention) on the same texts.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)

# ---- 1. our code against the code of ComfyUI, on plain text areas
CASES = [
    ("a cat, a dog", 2, 5, "ArrowUp"), ("a cat, a dog", 10, 10, "ArrowUp"), ("(cat:1.1), dog", 4, 4, "ArrowDown"),
    ("(cat:1.0)", 3, 3, "ArrowDown"), ("(cat:1.0)", 3, 3, "ArrowUp"), ("(cat:1.05) dog", 3, 3, "ArrowDown"),
    ("masterpiece, best quality", 0, 25, "ArrowUp"), ("a  b", 2, 2, "ArrowUp"), ("a cat , b", 2, 6, "ArrowUp"),
    ("((cat:1.1) dog:1.2)", 14, 14, "ArrowUp"), ("(cat:1.1)", 0, 0, "ArrowUp"), ("a (b c:0.5) d", 5, 5, "ArrowDown"),
    ("one\ntwo three", 6, 6, "ArrowUp"), ("12:30 time", 4, 4, "ArrowUp"), ("(x:1.1)", 1, 1, "ArrowUp"),
    ("", 0, 0, "ArrowUp"), ("word", 2, 2, "ArrowDown"), ("(cat)", 2, 2, "ArrowUp"),
]
J("""async()=>{ window.__T = await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/textedit.js');
  for (const id of ['ref','mine']) { const t=document.createElement('textarea'); t.id=id; t.style.cssText='position:fixed;left:10px;top:10px;width:300px;height:80px;z-index:99999'; document.body.append(t); } }""")
bad = []
for text, a, b, key in CASES:
    out = {}
    for who in ("ref", "mine"):
        J("([id,text,a,b])=>{const t=document.getElementById(id); t.value=text; t.focus(); t.setSelectionRange(a,b);}", [who, text, a, b])
        if who == "ref": pg.keyboard.press("Control+" + key)       # the extension of ComfyUI, from the key itself
        else: J("([key])=>window.__T.editWeight(document.getElementById('mine'), key, 0.05)", [key])
        out[who] = J("(id)=>{const t=document.getElementById(id); return [t.value,t.selectionStart,t.selectionEnd]}", who)
    if out["ref"] != out["mine"]: bad.append((text, a, b, key, out))
check(f"{len(CASES)} texts: the result and the selection are those of ComfyUI", not bad, str(bad[:2]))
step = J("window.__T.weightStep()")
check("the step is the setting of ComfyUI (0.05 by default)", abs(step - 0.05) < 1e-9 or step > 0, str(step))
J("()=>{document.getElementById('ref').remove(); document.getElementById('mine').remove();}")

# ---- 2. the Prompt and Text widgets of ND UI
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const n = LG.createNode('CLIPTextEncode'); n.pos=[40,60]; a.graph.add(n); n.properties.nd_ui_src={uid:'pp',tag:''}; window.__n = n;
  const k = LG.createNode('CLIPTextEncode'); k.pos=[40,500]; a.graph.add(k); k.properties.nd_ui_src={uid:'p2',tag:''}; window.__k = k;
  const u = LG.createNode('NDUI'); u.pos=[500,40]; u.size=[1000,700]; a.graph.add(u); window.__u = u;
  const W=(id,type,x,y,w,h,src,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots:{value:{src,kind:'widget',name:'text'}},props:props||{}});
  u.properties.nd_ui={sources:[{uid:'pp',tag:'',class:'CLIPTextEncode',title:'P'},{uid:'p2',tag:'',class:'CLIPTextEncode',title:'P2'}],pages:[{id:'p1',name:'One'}],
   widgets:[W('pr','prompt',10,10,440,140,'pp'), W('tx','text',10,170,440,60,'p2'), W('pr2','prompt',10,250,440,140,'pp',{spell:false,weights:false})]}; u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1500)
val = lambda nm: J(f"(()=>{{const n=window.__{nm}; return n.widgets.find(w=>w.name==='text').value}})()")
J("()=>{const n=window.__n; n.widgets.find(w=>w.name==='text').value='a cat, a dog'; window.__k.widgets.find(w=>w.name==='text').value='a cat, a dog'; window.__u.ndUiApi.reload();}"); pg.wait_for_timeout(1000)
ta = ".ndk-w[data-id=pr] textarea"
check("the spelling check is on in the Prompt and the Text widgets", J("document.querySelector('.ndk-w[data-id=pr] textarea').spellcheck") is True and J("document.querySelector('.ndk-w[data-id=tx] input').spellcheck") is True)
check("and off where the property says so", J("document.querySelector('.ndk-w[data-id=pr2] textarea').spellcheck") is False)
sel = lambda s, a, b: J("([s,a,b])=>{const t=document.querySelector(s); t.focus(); t.setSelectionRange(a,b);}", [s, a, b])
sel(ta, 2, 5); pg.keyboard.press("Control+Shift+ArrowUp"); pg.wait_for_timeout(300)
check("Ctrl+Shift+Up on a selected word: (cat:1.05), the node gets it", val("n") == "a (cat:1.05), a dog", val("n"))
check("the text area shows it, the selection is the phrase", J(f"document.querySelector('{ta}').value") == "a (cat:1.05), a dog" and J(f"(()=>{{const t=document.querySelector('{ta}'); return t.value.substring(t.selectionStart,t.selectionEnd)}})()") == "(cat:1.05)")
pg.keyboard.press("Control+ArrowUp"); pg.wait_for_timeout(200); pg.keyboard.press("Control+ArrowUp"); pg.wait_for_timeout(200)
check("Ctrl+Up again: 1.15", val("n") == "a (cat:1.15), a dog", val("n"))
for _ in range(3): pg.keyboard.press("Control+ArrowDown"); pg.wait_for_timeout(120)
check("three times Ctrl+Down: the weight is 1, the brackets go", val("n") == "a cat, a dog", val("n"))
pg.keyboard.press("Control+z"); pg.wait_for_timeout(250)
check("the undo of the field takes the last change back", J(f"document.querySelector('{ta}').value") != "a cat, a dog", J(f"document.querySelector('{ta}').value"))
# no selection: the word under the cursor
sel(ta, 0, 0); J("()=>{const t=document.querySelector('.ndk-w[data-id=pr] textarea'); t.value='one two'; t.dispatchEvent(new Event('input',{bubbles:true})); t.setSelectionRange(5,5);}"); pg.keyboard.press("Control+ArrowUp"); pg.wait_for_timeout(250)
check("without a selection the word under the cursor changes", val("n") == "one (two:1.05)", val("n"))
# the one-line Text widget
sel(".ndk-w[data-id=tx] input", 2, 5); pg.keyboard.press("Control+ArrowDown"); pg.wait_for_timeout(250)
check("the one-line Text widget does the same", val("k") == "a (cat:0.95), a dog", val("k"))
# the property turns it off
J("()=>{const t=document.querySelector('.ndk-w[data-id=pr2] textarea'); t.focus(); t.setSelectionRange(2,5);}"); pg.keyboard.press("Control+ArrowUp"); pg.wait_for_timeout(250)
check("with the property off the key changes nothing", J("document.querySelector('.ndk-w[data-id=pr2] textarea').value") == "one (two:1.05)", J("document.querySelector('.ndk-w[data-id=pr2] textarea').value"))

# ---- 3. a text area of a node inside Node Embed
J("""()=>{const u=window.__u; const m=JSON.parse(JSON.stringify(u.properties.nd_ui));
  m.sources=[{uid:'pp',tag:'',class:'CLIPTextEncode',title:'P'},{uid:'p2',tag:'',class:'CLIPTextEncode',title:'P2'}];
  const W=(id,src,x,y,props)=>({id,type:'nodeembed',page:'p1',x,y,w:440,h:200,z:1,slots:{node:{src,kind:'anynode',name:''}},props:Object.assign({label:'E'},props||{})});
  m.widgets=[W('e1','pp',10,10,{}), W('e2','p2',10,260,{spell:false,weights:false})];
  window.__n.widgets.find(w=>w.name==='text').value='a cat, a dog'; window.__k.widgets.find(w=>w.name==='text').value='a cat, a dog'; u.properties.nd_ui=m; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1500)
J("window.ndUi.host().save(JSON.parse(JSON.stringify(window.__u.properties.nd_ui))); window.ndUi.enter()"); pg.wait_for_timeout(1800)
emb = ".ndk-uimode .ndk-w[data-id=e1] textarea"
n_ta = J(f"document.querySelectorAll('{emb}').length")
check("the text area of the node sits in the frame", n_ta == 1, str(n_ta))
if n_ta:
    J(f"()=>{{const t=document.querySelector('{emb}'); t.focus(); t.setSelectionRange(2,5);}}"); pg.wait_for_timeout(200)
    check("the spelling check is switched on when the field gets the focus", J(f"document.querySelector('{emb}').spellcheck") is True)
    pg.keyboard.press("Control+ArrowUp"); pg.wait_for_timeout(300)
    check("Ctrl+Up in the frame changes the weight, the node gets it, once", val("n") == "a (cat:1.05), a dog", val("n"))
    pg.keyboard.press("Control+Shift+ArrowUp"); pg.wait_for_timeout(300)
    check("Ctrl+Shift+Up too", val("n") == "a (cat:1.1), a dog", val("n"))
    emb2 = ".ndk-uimode .ndk-w[data-id=e2] textarea"
    J(f"()=>{{const t=document.querySelector('{emb2}'); t.focus(); t.setSelectionRange(2,5);}}"); pg.wait_for_timeout(150)
    pg.keyboard.press("Control+ArrowUp"); pg.wait_for_timeout(300)
    check("a frame with both properties off leaves the field alone", val("k") == "a cat, a dog" and J(f"document.querySelector('{emb2}').spellcheck") is False, val("k"))
else:
    print("SKIP the embed checks: the frame has no text area here")
finish(p, br, errs)
