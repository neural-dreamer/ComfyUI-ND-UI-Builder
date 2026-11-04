# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 65: the Show Any As Text widget: the preview tab, the notes (add, write, rename, move, delete with a second click), the node follows.
from lib import *
p, br, pg, errs = start(1500, 950)
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
has = J("!!window.LiteGraph.registered_node_types['NDShowAnyAsText']")
if not has:
    print("SKIP: the Neural Dreamer Nodes pack is not loaded"); br.close(); p.stop(); sys.exit(0)
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const s = LG.createNode('NDShowAnyAsText'); s.pos=[40,40]; a.graph.add(s); s.properties.nd_ui_src={uid:'sa',tag:'text'}; window.__s=s;
  s.properties.nd_preview_text='hello value'; s.properties.nd_notes=[{title:'Note 1',text:'first note'}]; s.ndApi.restore();
  const u = LG.createNode('NDUI'); u.pos=[500,60]; u.size=[900,500]; a.graph.add(u);
  const ui={sources:[{uid:'sa',tag:'text',class:'NDShowAnyAsText',title:'Show [text]'}],pages:[{id:'p1',name:'Main'}],widgets:[
    {id:'w',type:'showany',page:'p1',x:20,y:20,w:520,h:320,z:1,slots:{node:{src:'sa',kind:'showany',name:''}},props:{}},
    {id:'e',type:'showany',page:'p1',x:560,y:20,w:300,h:200,z:1,slots:{},props:{}}],view:{}};
  u.properties.nd_ui = ui; window.__u = u; window.ndUi.host().save(ui); }""")
pg.wait_for_timeout(600)
J("window.ndUi.enter()"); pg.wait_for_timeout(1400)
W = ".ndk-uimode .ndk-w[data-id=w]"
tabs = lambda: J(f"()=>[...document.querySelectorAll('{W} .ndk-ts-tab')].map(t=>t.firstChild.textContent+(t.classList.contains('on')?'*':''))")
check("the tabs: Preview first, then the note", tabs() == ["Preview*", "Note 1"], str(tabs()))
check("the preview shows the value of the node", J(f"()=>document.querySelector('{W} .ndk-sa-text.pv').value") == "hello value")
check("an unbound widget asks for the node", "Bind an ND Show Any As Text" in J("()=>document.querySelector('.ndk-uimode .ndk-w[data-id=e]').innerText"))
check("the copy button is there for the preview", J(f"()=>getComputedStyle(document.querySelector('{W} .ndk-sa-copy')).display") != "none")
# the node ran again: the preview is refreshed
J("()=>{window.__s.properties.nd_preview_text='second run'}"); pg.wait_for_timeout(900)
check("a new value of the node shows in the preview", J(f"()=>document.querySelector('{W} .ndk-sa-text.pv').value") == "second run")
# add a tab
J(f"()=>document.querySelector('{W} .ndk-ts-add').click()"); pg.wait_for_timeout(600)
notes = lambda: J("()=>window.__s.properties.nd_notes")
check("add: a note is made in the node and opens", len(notes()) == 2 and notes()[1]["title"] == "Note 2" and tabs()[2] == "Note 2*", str([notes(), tabs()]))
# write
J(f"()=>{{const ta=[...document.querySelectorAll('{W} .ndk-sa-text:not(.pv)')].find(t=>getComputedStyle(t).display!=='none'); ta.value='typed text'; ta.dispatchEvent(new Event('input'))}}"); pg.wait_for_timeout(300)
check("typing goes to the node", notes()[1]["text"] == "typed text", str(notes()))
# rename
J(f"()=>document.querySelectorAll('{W} .ndk-ts-l')[2].dispatchEvent(new MouseEvent('dblclick',{{bubbles:true}}))"); pg.wait_for_timeout(300)
J(f"()=>{{const i=document.querySelector('{W} .ndk-ts-rename'); i.value='Ideas'; i.dispatchEvent(new KeyboardEvent('keydown',{{key:'Enter',bubbles:true}}))}}"); pg.wait_for_timeout(500)
check("rename: the node has the new title", notes()[1]["title"] == "Ideas" and tabs()[2].startswith("Ideas"), str([notes(), tabs()]))
# move: the second note before the first
J("""async()=>{const t=[...document.querySelectorAll('.ndk-uimode .ndk-w[data-id=w] .ndk-ts-tab')]; const a=t[2].getBoundingClientRect(), b=t[1].getBoundingClientRect();
  const fire=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,pointerId:1,isPrimary:true}));
  const y=a.top+a.height/2; fire(t[2],'pointerdown',a.left+10,y); for(let x=a.left+10;x>b.left-6;x-=8) fire(t[2],'pointermove',x,y); fire(t[2],'pointerup',b.left-6,y);}""")
pg.wait_for_timeout(600)
check("drag: the order changes in the node", [n["title"] for n in notes()] == ["Ideas", "Note 1"], str(notes()))
check("drag: the preview stays first", tabs()[0].startswith("Preview"), str(tabs()))
# delete: a note with text needs a second click
def closes(): return J(f"()=>document.querySelectorAll('{W} .ndk-ts-x').length")
J(f"()=>document.querySelectorAll('{W} .ndk-ts-x')[0].click()"); pg.wait_for_timeout(300)
check("delete asks first (a note with text)", len(notes()) == 2 and J(f"()=>document.querySelector('{W} .ndk-ts-x.armed')?.textContent") == "Delete?", str(notes()))
J(f"()=>document.querySelector('{W} .ndk-ts-x.armed').click()"); pg.wait_for_timeout(500)
check("the second click deletes it", [n["title"] for n in notes()] == ["Note 1"], str(notes()))
check("the Preview tab cannot be closed", J(f"()=>document.querySelector('{W} .ndk-ts-tab.pin .ndk-ts-x')") is None)
# options
J("()=>{const u=window.__u; const ui=u.properties.nd_ui; ui.widgets[0].props.edit=false; window.ndUi.host().save(ui)}"); pg.wait_for_timeout(900)
check("'Tabs can be changed' off: no plus and no close buttons", J(f"()=>getComputedStyle(document.querySelector('{W} .ndk-ts-add')).display") == "none" and closes() == 0)
d = J("""async()=>{const W=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/widgets/index.js'); return ['showany','tabbox'].map(t=>{const d=W.defOf(t); return d&&[d.label,d.group,W.GROUPS.includes(d.group)]})}""")
check("the library has both widgets in known groups", d == [["Show Any As Text", "Results", True], ["Tab panel", "Layout", True]], str(d))
finish(p, br, errs)
