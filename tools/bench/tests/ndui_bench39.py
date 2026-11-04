# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 39: project files — the format (packed graph, own extension), the project pill in its own corner, Save / Save as / Open, the open setting.
import json
from lib import *
p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
SET = lambda k, v: pg.evaluate("async([k,v])=>{const m=await import('/scripts/app.js'); await m.app.extensionManager.setting.set(k,v)}", [k, v])
M = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"
J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear(); window.__app = a;
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; n.title=title; a.graph.add(n); return n;};
  const k=mk('KSampler',60,380,'Sampler [sampler]'); mk('EmptyLatentImage',60,80,'Latent [size]');
  k.properties.nd_ui_src={uid:'sk',tag:'sampler'};
  window.__toasts=[]; a.extensionManager.toast.add=(t)=>window.__toasts.push(t);
  window.__loads=[]; a.loadGraphData=async(...r)=>{window.__loads.push(r.map(x=>typeof x==='string'?x:(x&&typeof x==='object'&&'nodes' in x?'GRAPH':x&&x.path?'WF:'+x.path:String(x))))};
  window.__mk = (view)=>({sources:[{uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'}],pages:[{id:'p1',name:'Main'},{id:'p2',name:'Second'}],
    widgets:[{id:'a',type:'slider',page:'p1',x:20,y:20,w:360,h:64,z:1,slots:{value:{src:'sk',kind:'widget',name:'steps'}},props:{label:'Steps'}}],view:view||{}});
  window.ndUi.host().save(window.__mk()); }""")
pg.wait_for_timeout(500)

# ---- the format
J("async()=>{ window.__P = await import('%sproject.js'); window.__MD = await import('%smodel.js'); }" % (M, M))
r = J("""async()=>{ const P=window.__P; const big={nodes:Array.from({length:600},(_,i)=>({id:i,type:'KSampler',pos:[i,i],widgets_values:['Привет, мир — 日本語 ✓ '+i,i,0.5]})),links:[],extra:{nd_ui:{pages:[]}}};
  const t=await P.encodeProject(big,{ext:'MMH3',name:'Мой проект'}); const env=JSON.parse(t);
  const d=await P.decodeProject(t,'mmh3');
  return {fmt:env.format, ver:env.version, ext:env.ext, name:env.name, packed:typeof env.workflow==='string' && !env.workflow.includes('KSampler'), small:t.length < JSON.stringify(big).length/3,
          same:JSON.stringify(d.graph)===JSON.stringify(big), dname:d.name} }""")
check("envelope fields", r["fmt"] == "nd-ui-project" and r["ver"] == 1 and r["ext"] == "mmh3" and r["name"] == "Мой проект", str(r))
check("the graph is packed, not plain text", r["packed"] and r["small"], str(r))
check("a big graph with unicode comes back unchanged", r["same"], str(r))
codes = J("""async()=>{ const P=window.__P, out={}; const t=await P.encodeProject({nodes:[]},{ext:'ndui'});
  const tryit=async(k,txt,ext)=>{ try{ await P.decodeProject(txt,ext); out[k]='ok' }catch(e){ out[k]=e.code } };
  await tryit('plain','{"nodes":[]}','ndui'); await tryit('junk','hello','ndui'); await tryit('ext',t,'mmh3'); await tryit('same',t,'.NDUI');
  await tryit('newer',JSON.stringify({...JSON.parse(t),version:9}),'ndui'); await tryit('corrupt',JSON.stringify({...JSON.parse(t),workflow:'AAAA'}),'ndui');
  await tryit('nonodes',await P.encodeProject({foo:1},{ext:'ndui'}),'ndui'); return out }""")
check("a plain workflow is not a project", codes["plain"] == "notproject" and codes["junk"] == "notproject", str(codes))
check("a project of another type is refused", codes["ext"] == "ext" and codes["same"] == "ok", str(codes))
check("newer and damaged files are refused", codes["newer"] == "version" and codes["corrupt"] == "corrupt" and codes["nonodes"] == "corrupt", str(codes))
e = J("""()=>{ const c=window.__MD.cleanExt; return [c('ndui'),c('.MMH3'),c('a'),c('x y!z'),c(''),c('averyveryverylongextension'),c(null)] }""")
check("extension cleaning", e == ["ndui", "mmh3", "ndui", "xyz", "ndui", "averyveryver", "ndui"], str(e))
v = J("window.ndUi.host().ui.view.save")
check("default view.save", v == {"show": True, "corner": "tr", "ext": "ndui"}, str(v))

# ---- the pill in the mode
J("window.ndUi.enter()"); pg.wait_for_timeout(700)
rect = lambda sel: J("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom]}", sel)
check("the project pill is in the mode", rect(".ndk-uimode .ndk-um-save") is not None)
sr, lr = rect(".ndk-uimode .ndk-um-save"), rect(".ndk-uimode .ndk-um-logo:not(.ndk-um-save)")
check("it stands top right, the logo top left", sr[2] > 1400 and sr[1] < 30 and lr[0] < 30, str([sr, lr]))
def setview(**kw):
    J("""(kw)=>{const h=window.ndUi.host(); const u=JSON.parse(JSON.stringify(h.ui)); Object.assign(u.view.save, kw); h.save({...window.__mk(u.view)}); }""", kw); pg.wait_for_timeout(500)
    if not J("!!document.querySelector('.ndk-uimode')"): J("window.ndUi.enter()"); pg.wait_for_timeout(600)
setview(corner="tl")
sr, lr = rect(".ndk-uimode .ndk-um-save"), rect(".ndk-uimode .ndk-um-logo:not(.ndk-um-save)")
check("same corner: the pills stand side by side without overlap", sr[0] >= lr[2] - 0.5 and abs(sr[1] - lr[1]) < 4, str([sr, lr]))
tb = rect(".ndk-uimode .ndk-um-tabs")
check("the page tabs keep clear of both pills", tb is None or J("getComputedStyle(document.querySelector('.ndk-uimode .ndk-um-tabs')).display") == "none" or tb[0] >= sr[2] - 0.5 or tb[1] > sr[3], str([tb, sr]))
setview(corner="br")
sr = rect(".ndk-uimode .ndk-um-save"); check("bottom right", sr[2] > 1400 and sr[3] > 900, str(sr))
setview(show=False)
check("the pill can be hidden", J("getComputedStyle(document.querySelector('.ndk-uimode .ndk-um-save')).display") == "none")
setview(show=True, corner="tr", ext="mmh3")

# ---- Save / Save as with a mock file dialog
J("""()=>{ window.__pick=0; window.__written=[]; window.__names=[];
  window.showSaveFilePicker=async(o)=>{ window.__pick++; window.__names.push(o.suggestedName+'|'+JSON.stringify(o.types[0].accept)); let buf=''; const h={name:o.suggestedName, createWritable:async()=>({write:async(t)=>{buf=t}, close:async()=>{window.__written.push(buf)}})}; return h };
  window.showOpenFilePicker=async()=>{ throw new Error('unset') } }""")
J("document.querySelector('.ndk-uimode .ndk-um-save .main').click()"); pg.wait_for_timeout(900)
n = J("window.__pick")
check("the first Save asks where", n == 1, str(n))
acc = J("window.__names[0]")
check("the file dialog offers only this type", ".mmh3" in acc and acc.split("|")[0].endswith(".mmh3"), acc)
w = J("window.__written")
check("the file was written", len(w) == 1)
d = J("async(t)=>{ const x=await window.__P.decodeProject(t,'mmh3'); return {nodes:x.graph.nodes.length, ui:!!x.graph.extra?.nd_ui, ext:x.ext} }", w[0])
check("it holds the whole workflow including the panel", d["nodes"] == 2 and d["ui"] and d["ext"] == "mmh3", str(d))
J("document.querySelector('.ndk-uimode .ndk-um-save .main').click()"); pg.wait_for_timeout(700)
check("the second Save writes the same file without asking", J("window.__pick") == 1 and len(J("window.__written")) == 2)
check("a toast says it is saved", any("Project" in (t.get("summary") or "") for t in J("window.__toasts")), str(J("window.__toasts")))
J("document.querySelector('.ndk-uimode .ndk-um-save .more').click()"); pg.wait_for_timeout(400)
items = J("[...document.querySelectorAll('.ndk-um-menu .item .l')].map(x=>x.textContent)")
check("the menu has Save, Save as, Open", len(items) == 3, str(items))
pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
check("Esc closes the menu and keeps the mode", not J("!!document.querySelector('.ndk-um-menu')") and J("!!document.querySelector('.ndk-uimode')"))
J("document.querySelector('.ndk-uimode .ndk-um-save .more').click()"); pg.wait_for_timeout(300)
J("document.querySelectorAll('.ndk-um-menu .item')[1].click()"); pg.wait_for_timeout(900)
check("Save as asks again", J("window.__pick") == 2, str(J("window.__pick")))
# Ctrl+S goes into the project file now that one is bound
J("document.dispatchEvent(new Event('x'))")
pg.keyboard.press("Control+s"); pg.wait_for_timeout(800)
check("Ctrl+S saves into the project file", len(J("window.__written")) == 4, str(len(J("window.__written"))))

# ---- Open
good = w[0]
bad_ext = J("async()=>window.__P.encodeProject({nodes:[]},{ext:'zzzz',name:'x'})")
def serve(text, name):
    J("""([t,n])=>{ window.showOpenFilePicker=async()=>[{ name:n, getFile:async()=>({name:n, text:async()=>t}) }]; window.__loads.length=0; window.__toasts.length=0 }""", [text, name])
def openit():
    J("document.querySelector('.ndk-uimode .ndk-um-save .more').click()"); pg.wait_for_timeout(300)
    J("document.querySelectorAll('.ndk-um-menu .item')[2].click()"); pg.wait_for_timeout(1000)
serve(good, "My story.mmh3"); openit()
ld = J("window.__loads")
check("a project opens in a new tab by default (the name is given)", len(ld) == 1 and ld[0][0] == "GRAPH" and ld[0][3] == "My story", str(ld))
SET("NeuralDreamerUI.ProjectOpen", "replace"); serve(good, "My story.mmh3"); openit()
ld = J("window.__loads")
check("with the setting 'replace' it goes into the current workflow", len(ld) == 1 and ld[0][0] == "GRAPH" and ld[0][3] != "My story", str(ld))
SET("NeuralDreamerUI.ProjectOpen", "tab")
serve(bad_ext, "other.zzzz"); openit()
check("a project of another type is not loaded, an error toast shows", J("window.__loads.length") == 0 and any(t.get("severity") == "error" for t in J("window.__toasts")), str(J("window.__toasts")))
serve('{"nodes":[],"links":[]}', "plain.mmh3"); openit()
check("a plain workflow file is not loaded", J("window.__loads.length") == 0 and any(t.get("severity") == "error" for t in J("window.__toasts")))
check("the mode stays open", J("!!document.querySelector('.ndk-uimode')"))
# ---- the editor ghost and the inspector
J("window.ndUi.exit()"); pg.wait_for_timeout(400)
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(1500)
check("the ghost of the top panel draws the project pill", J("!!document.querySelector('.nde-ghost .ndk-um-save')") is True)
J("""()=>{ const h=[...document.querySelectorAll('.nde *')].find(e=>e.children.length<=2 && e.textContent.trim()==='View'); if(h){ h.click() } }"""); pg.wait_for_timeout(500)
t = J("document.querySelector('.nde')?.innerText || ''")
check("the inspector has the project button fields", all(x in t for x in ["Project button", "Project button corner", "Project file type"]), t[:120])
J("""()=>{ const i=[...document.querySelectorAll('.nde .nde-text')].find(e=>e.placeholder==='ndui'); i.value='Pro Jekt!'; i.dispatchEvent(new Event('change',{bubbles:true})) }"""); pg.wait_for_timeout(400)
ext_now = J("window.ndUi.host().editor?.ui?.view?.save?.ext")
check("the file type typed in the inspector is cleaned and kept in the editor", ext_now == "projekt", str(ext_now))
finish(p, br, errs)
