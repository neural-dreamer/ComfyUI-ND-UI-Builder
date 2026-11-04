# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 12 (stage D4): ND Load Video / ND Load Audio nodes (compact view inside the node) and the Video Input / Audio Input widgets:
# file choice, segment strip, start / end fields, crop overlay, settings JSON. Real small webm / wav files from tools/bench/media.
import json
from lib import *

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const v = mk('NDLoadVideo',40,40,'Video [vid]'), s = mk('NDLoadAudio',40,760,'Sound [snd]');
  v.widgets.find(w=>w.name==='video').value='clip.mp4'; s.widgets.find(w=>w.name==='audio').value='tone.wav';
  a.graph.setDirtyCanvas(true,true); return {v:v.id, s:s.id}; }""")
pg.wait_for_timeout(2500)
NV = "window.__app.graph._nodes.find(n=>n.type==='NDLoadVideo')"
NS = "window.__app.graph._nodes.find(n=>n.type==='NDLoadAudio')"
SET = lambda node: json.loads(J(f"{node}.widgets.find(w=>w.name==='settings').value"))
TV = "document.querySelectorAll('.ndk-tv.video')[0]"
TA = "document.querySelectorAll('.ndk-tv.audio')[0]"

# ---- 1. the nodes
check("both views are in the nodes", J("document.querySelectorAll('.ndk-tv').length") == 2)
check("the technical widgets are hidden", J(f"{NV}.widgets.filter(w=>w.name==='settings'||w.name==='video').every(w=>w.hidden===true)") is True)
check("the size widgets stay", J(f"['width','height','multiple_of'].every(n=>!!{NV}.widgets.find(w=>w.name===n))") is True)
check("the file list shows the files", J(TV + ".querySelectorAll('select.ndk-tv-sel option').length") >= 3)
check("the file is selected", J(TV + ".querySelector('select.ndk-tv-sel').value") == "clip.mp4")
check("the player has the file", "filename=clip.mp4" in J(TV + ".querySelector('video').src"))
check("the audio file is selected too", J(TA + ".querySelector('select.ndk-tv-sel').value") == "tone.wav")
check("info line: size, frames, fps and memory", all(x in J(TV + ".querySelector('.ndk-tv-info').innerText") for x in ["160×120", "30", "10", "MB"]), J(TV + ".querySelector('.ndk-tv-info').innerText"))
check("length is 3 s", "3.00 s" in J(TV + ".querySelector('.ndk-tv-len').innerText"), J(TV + ".querySelector('.ndk-tv-len').innerText"))
check("the frame strip is drawn", J("""()=>{const c=document.querySelector('.ndk-tv.video canvas.bg'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let s=0; for(let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2]; return s>1000}""") is True)
check("the wave strip is drawn", J("""()=>{const c=document.querySelector('.ndk-tv.audio canvas.bg'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let s=0; for(let i=0;i<d.length;i+=4) s+=d[i+3]; return s>1000}""") is True)

# ---- 2. fields
def type_in(root, idx, text):
    loc = pg.locator(f"{root.replace('document.querySelectorAll(', '').split(')')[0].strip(chr(39))} >> nth=0")
fields = lambda root: root + ".querySelectorAll('.ndk-tv-seg input[type=text]')"
def setfield(root, i, text):
    J(f"""()=>{{const i={fields(root)}[{i}]; i.focus(); i.value='{text}'; i.dispatchEvent(new Event('change',{{bubbles:true}})); i.blur();}}""")
    pg.wait_for_timeout(250)
setfield(TV, 0, "0.5")
check("start field -> settings", abs(SET(NV)["start"] - 0.5) < 1e-6, str(SET(NV)))
setfield(TV, 1, "2.5")
check("end field -> settings", abs(SET(NV)["end"] - 2.5) < 1e-6)
check("length follows: 2.00 s", "2.00 s" in J(TV + ".querySelector('.ndk-tv-len').innerText"))
check("frames in the info line follow: 20", " 20 " in J(TV + ".querySelector('.ndk-tv-info').innerText"), J(TV + ".querySelector('.ndk-tv-info').innerText"))
setfield(TV, 1, "99")
check("end beyond the file = 0 (to the end)", SET(NV)["end"] == 0)
setfield(TV, 0, "9")
check("start can not pass the end", SET(NV)["start"] < 3, str(SET(NV)))
setfield(TV, 0, "0.5"); setfield(TV, 1, "2.5")
# arrows in the field
J(f"""()=>{{const i={fields(TV)}[0]; i.focus(); i.dispatchEvent(new KeyboardEvent('keydown',{{key:'ArrowUp',bubbles:true}}));}}""") ; pg.wait_for_timeout(200)
check("ArrowUp = +0.01", abs(SET(NV)["start"] - 0.51) < 1e-6, str(SET(NV)["start"]))
J(f"""()=>{{const i={fields(TV)}[0]; i.dispatchEvent(new KeyboardEvent('keydown',{{key:'ArrowDown',shiftKey:true,bubbles:true}}));}}""") ; pg.wait_for_timeout(200)
check("Shift+ArrowDown = -0.1", abs(SET(NV)["start"] - 0.41) < 1e-6, str(SET(NV)["start"]))
setfield(TV, 0, "0.5")
# [ and ] take the player position
J(TV + ".querySelector('video').currentTime = 1.2"); pg.wait_for_timeout(500)
J(TV + ".querySelectorAll('.ndk-tv-btn.mark')[0].click()"); pg.wait_for_timeout(200)
check("[ = start at the player position", abs(SET(NV)["start"] - 1.2) < 0.15, str(SET(NV)["start"]))
J(TV + ".querySelector('video').currentTime = 2.0"); pg.wait_for_timeout(500)
J(TV + ".querySelectorAll('.ndk-tv-btn.mark')[1].click()"); pg.wait_for_timeout(200)
check("] = end at the player position", abs(SET(NV)["end"] - 2.0) < 0.15, str(SET(NV)["end"]))
setfield(TV, 0, "0.5"); setfield(TV, 1, "2.5")

# ---- 3. the strip: drag the edges and the middle
sb = pg.locator(".ndk-tv.video .ndk-tv-strip >> nth=0").bounding_box()
x_of = lambda t: sb["x"] + sb["width"] * t / 3.0
y = sb["y"] + sb["height"] / 2
pg.mouse.move(x_of(0.5) + 2, y); pg.mouse.down(); pg.mouse.move(x_of(1.0), y, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
check("drag of the left edge moves the start to ~1.0", abs(SET(NV)["start"] - 1.0) < 0.2, str(SET(NV)))
pg.mouse.move(x_of(2.5) - 2, y); pg.mouse.down(); pg.mouse.move(x_of(2.0), y, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
check("drag of the right edge moves the end to ~2.0", abs(SET(NV)["end"] - 2.0) < 0.2, str(SET(NV)))
s0, e0 = SET(NV)["start"], SET(NV)["end"]
pg.mouse.move(x_of((s0 + e0) / 2), y); pg.mouse.down(); pg.mouse.move(x_of((s0 + e0) / 2 - 0.5), y, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
s1, e1 = SET(NV)["start"], SET(NV)["end"]
check("drag of the middle moves both, the length stays", s1 < s0 - 0.3 and abs((e1 - s1) - (e0 - s0)) < 0.05, f"{s0},{e0} -> {s1},{e1}")
pg.mouse.click(x_of(2.8), y); pg.wait_for_timeout(500)
check("a click outside the segment seeks", abs(float(J(TV + ".querySelector('video').currentTime")) - 2.8) < 0.3, str(J(TV + ".querySelector('video').currentTime")))
check("the playhead follows", abs(float(J(TV + ".querySelector('.head').style.left").rstrip('%')) - 93) < 6)
# play the segment only
setfield(TV, 0, "0.5"); setfield(TV, 1, "1.0")
J(TV + ".querySelectorAll('.ndk-tv-f.chk input')[0].click()"); pg.wait_for_timeout(200)
J(TV + ".querySelector('video').currentTime = 2.0"); pg.wait_for_timeout(300)
J(TV + ".querySelector('button.play').click()"); pg.wait_for_timeout(1500)
t = float(J(TV + ".querySelector('video').currentTime"))
check("segment-only play stays inside 0.5..1.0", 0.4 <= t <= 1.05 or J(TV + ".querySelector('video').paused"), str(t))
J(TV + ".querySelector('video').pause()")
J(TV + ".querySelectorAll('.ndk-tv-f.chk input')[0].click()"); setfield(TV, 0, "0"); setfield(TV, 1, "99")

# ---- 4. settings
def sel(root, label, value):
    J(f"""()=>{{const f=Array.from({root}.querySelectorAll('.ndk-tv-set label.ndk-tv-f')).find(l=>l.innerText.trim().startsWith('{label}')); const s=f.querySelector('select'); s.value='{value}'; s.dispatchEvent(new Event('change',{{bubbles:true}}));}}""")
    pg.wait_for_timeout(250)
def num(root, label, text):
    J(f"""()=>{{const f=Array.from({root}.querySelectorAll('.ndk-tv-set label.ndk-tv-f')).find(l=>l.innerText.trim().startsWith('{label}')); const i=f.querySelector('input'); i.focus(); i.value='{text}'; i.dispatchEvent(new Event('change',{{bubbles:true}})); i.blur();}}""")
    pg.wait_for_timeout(250)
num(TV, "Frame rate", "5")
check("fps -> settings", SET(NV)["fps"] == 5)
check("the info line: 15 frames at 5 fps", " 15 " in J(TV + ".querySelector('.ndk-tv-info').innerText") and "5 fps" in J(TV + ".querySelector('.ndk-tv-info').innerText"), J(TV + ".querySelector('.ndk-tv-info').innerText"))
num(TV, "Max frames", "7")
check("max frames -> settings and info", SET(NV)["max_frames"] == 7 and " 7 " in J(TV + ".querySelector('.ndk-tv-info').innerText"))
num(TV, "Frame rate", "0"); num(TV, "Max frames", "0")
sel(TV, "Fit", "pad color")
check("fit -> settings", SET(NV)["fit"] == "pad color")
check("pad colour picker appears for bars of a colour", J(TV + ".querySelector('.ndk-tv-color').style.display") == "")
sel(TV, "Fit", "crop")
check("pad colour picker hidden for crop", J(TV + ".querySelector('.ndk-tv-color').style.display") == "none")
J(TV + ".querySelectorAll('.ndk-tv-set .chk input')[0].click()"); pg.wait_for_timeout(200)
check("sound switch -> settings", SET(NV)["audio"] is False)
J(TV + ".querySelectorAll('.ndk-tv-set .chk input')[0].click()"); pg.wait_for_timeout(200)
# the size widgets of the node change the info line
J(f"""()=>{{const w={NV}.widgets.find(n=>n.name==='width'); w.value=64; w.callback&&w.callback(64); const h={NV}.widgets.find(n=>n.name==='height'); h.value=64; h.callback&&h.callback(64);}}"""); pg.wait_for_timeout(700)
check("target size in the info line (64×64)", "64×64" in J(TV + ".querySelector('.ndk-tv-info').innerText"), J(TV + ".querySelector('.ndk-tv-info').innerText"))
J(f"""()=>{{for (const n of ['width','height']) {{ const w={NV}.widgets.find(x=>x.name===n); w.value=0; }}}}"""); pg.wait_for_timeout(700)

# ---- 5. crop
J(TV + ".querySelector('.ndk-tv-tools .ndk-tv-btn').click()"); pg.wait_for_timeout(300)
check("crop mode on: the overlay takes the pointer", J(TV + ".querySelector('.ndk-tv-pic').classList.contains('on')") is True)
pb = pg.locator(".ndk-tv.video .ndk-tv-pic >> nth=0").bounding_box()
check("the overlay sits on the picture (4:3)", pb is not None and abs(pb["width"] / pb["height"] - 4 / 3) < 0.05, str(pb))
px = lambda fx, fy: (pb["x"] + pb["width"] * fx, pb["y"] + pb["height"] * fy)
a, b = px(0.2, 0.2), px(0.7, 0.8)
pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(*b, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
c = SET(NV)["crop"]
check("drawing a crop: [0.2,0.2,0.5,0.6]", c and abs(c[0] - 0.2) < 0.04 and abs(c[1] - 0.2) < 0.04 and abs(c[2] - 0.5) < 0.05 and abs(c[3] - 0.6) < 0.05, str(c))
check("the info line shows the cropped size 80×72", "80×72" in J(TV + ".querySelector('.ndk-tv-info').innerText"), J(TV + ".querySelector('.ndk-tv-info').innerText"))
# move the whole rectangle
a2 = px(0.45, 0.5); pg.mouse.move(*a2); pg.mouse.down(); pg.mouse.move(a2[0] + pb["width"] * 0.1, a2[1], steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
c2 = SET(NV)["crop"]
check("moving the crop shifts x by ~0.1, size stays", abs(c2[0] - (c[0] + 0.1)) < 0.04 and abs(c2[2] - c[2]) < 0.01, f"{c} -> {c2}")
# a handle: the east edge
hb = pg.locator(".ndk-tv.video .ndk-tv-crop .hd.e >> nth=0").bounding_box()
pg.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); pg.mouse.down(); pg.mouse.move(pb["x"] + pb["width"] * 0.95, hb["y"] + hb["height"] / 2, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
c3 = SET(NV)["crop"]
check("east handle widens to the right", c3[2] > c2[2] + 0.1 and abs(c3[0] - c2[0]) < 0.01, f"{c2} -> {c3}")
# aspect 1:1 (picture is 160×120, so a square is 0.75 wide in normalized units)
sel(TV.replace("[0]", "[0]"), "Shape", "1:1") if False else None
J(f"""()=>{{const f=Array.from({TV}.querySelectorAll('.ndk-tv-tools label.ndk-tv-f')).find(l=>l.innerText.trim().startsWith('Shape')); const s=f.querySelector('select'); s.value='1:1'; s.dispatchEvent(new Event('change',{{bubbles:true}}));}}"""); pg.wait_for_timeout(300)
c4 = SET(NV)["crop"]
check("aspect 1:1 makes a square in pixels", c4 and abs(c4[2] * 160 - c4[3] * 120) < 2, str(c4))
check("the aspect is kept in the settings", SET(NV).get("aspect") == "1:1")
# a handle drag keeps the square
hb = pg.locator(".ndk-tv.video .ndk-tv-crop .hd.se >> nth=0").bounding_box()
pg.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); pg.mouse.down(); pg.mouse.move(hb["x"] - 25, hb["y"] - 10, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
c5 = SET(NV)["crop"]
check("corner drag with 1:1 stays square", c5 and abs(c5[2] * 160 - c5[3] * 120) < 3 and c5[2] < c4[2], f"{c4} -> {c5}")
# reset
J(TV + ".querySelectorAll('.ndk-tv-tools .ndk-tv-btn')[1].click()"); pg.wait_for_timeout(250)
check("reset removes the crop", SET(NV)["crop"] is None)
J(f"""()=>{{const f=Array.from({TV}.querySelectorAll('.ndk-tv-tools label.ndk-tv-f')).find(l=>l.innerText.trim().startsWith('Shape')); const s=f.querySelector('select'); s.value=''; s.dispatchEvent(new Event('change',{{bubbles:true}}));}}""")
J(TV + ".querySelector('.ndk-tv-tools .ndk-tv-btn').click()"); pg.wait_for_timeout(200)
check("crop mode off lets clicks through to the player", J(TV + ".querySelector('.ndk-tv-pic').classList.contains('on')") is False)

# ---- 6. file choice resets the segment and the crop
setfield(TV, 0, "0.5"); setfield(TV, 1, "2.5")
J(f"""()=>{{const s={TV}.querySelector('select.ndk-tv-sel'); s.value='other.mp4'; s.dispatchEvent(new Event('change',{{bubbles:true}}));}}"""); pg.wait_for_timeout(1500)
check("a new file goes to the node's combo", J(f"{NV}.widgets.find(w=>w.name==='video').value") == "other.mp4")
check("and the segment starts over", SET(NV)["start"] == 0 and SET(NV)["end"] == 0 and SET(NV)["crop"] is None)
check("the player has the new file", "filename=other.mp4" in J(TV + ".querySelector('video').src"))
# upload through the picker (the mock server keeps the name)
pg.set_input_files(".ndk-tv.video input[type=file] >> nth=0", {"name": "fresh.mp4", "mimeType": "video/mp4", "buffer": b"abc"}); pg.wait_for_timeout(1500)
check("an uploaded file is chosen", J(f"{NV}.widgets.find(w=>w.name==='video').value") == "fresh.mp4", J(f"{NV}.widgets.find(w=>w.name==='video').value"))
# a file the server does not know
J(f"""()=>{{const w={NV}.widgets.find(w=>w.name==='video'); w.value='missing.mp4'; w.callback&&w.callback('missing.mp4');}}"""); pg.wait_for_timeout(1200)
check("an unknown file gets a message", "does not know" in J(TV + ".querySelector('.ndk-tv-note').innerText"), J(TV + ".querySelector('.ndk-tv-note').innerText"))
J(f"""()=>{{const w={NV}.widgets.find(w=>w.name==='video'); w.value='clip.mp4';}}"""); pg.wait_for_timeout(1000)
J(f"""()=>{{const w={NV}.widgets.find(w=>w.name==='video'); w.value='rot.mp4'; w.callback&&w.callback('rot.mp4');}}"""); pg.wait_for_timeout(1200)
check("a rotated file: the info says it is turned", "90°" in J(TV + ".querySelector('.ndk-tv-info').innerText"), J(TV + ".querySelector('.ndk-tv-info').innerText"))
J(f"""()=>{{const w={NV}.widgets.find(w=>w.name==='video'); w.value='clip.mp4'; w.callback&&w.callback('clip.mp4');}}"""); pg.wait_for_timeout(800)

# ---- 7. the audio node
sfields = lambda: TA + ".querySelectorAll('.ndk-tv-seg input[type=text]')"
J(f"""()=>{{const i={sfields()}[0]; i.focus(); i.value='1'; i.dispatchEvent(new Event('change',{{bubbles:true}})); i.blur();}}"""); pg.wait_for_timeout(250)
check("audio start -> settings", SET(NS)["start"] == 1)
sel(TA, "Sample rate", "16000")
check("sample rate -> settings", SET(NS)["sample_rate"] == 16000)
J(TA + ".querySelectorAll('.ndk-tv-set .chk input')[0].click()"); pg.wait_for_timeout(200)
check("mono -> settings", SET(NS)["mono"] is True)
num(TA, "Gain", "-6")
check("gain -> settings", SET(NS)["gain_db"] == -6)
check("audio info line: 2.00 s, 16000 Hz, mono", all(x in J(TA + ".querySelector('.ndk-tv-info').innerText") for x in ["2.00 s", "16000", "mono"]), J(TA + ".querySelector('.ndk-tv-info').innerText"))
sbA = pg.locator(".ndk-tv.audio .ndk-tv-strip >> nth=0").bounding_box()
pg.mouse.move(sbA["x"] + sbA["width"] * 0.9, sbA["y"] + 10); 
check("audio crop controls are absent", J(TA + ".querySelector('.ndk-tv-pic')") is None)

# ---- 8. the widgets of the panel
J("""async () => { const a = window.__app; const LG = window.LiteGraph;
  const nv = a.graph._nodes.find(n=>n.type==='NDLoadVideo'), ns = a.graph._nodes.find(n=>n.type==='NDLoadAudio');
  nv.properties.nd_ui_src={uid:'sv',tag:'vid'}; ns.properties.nd_ui_src={uid:'ss',tag:'snd'};
  const u = LG.createNode('NDUI'); u.pos=[700,40]; u.size=[1000,760]; a.graph.add(u);
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'sv',tag:'vid',class:'NDLoadVideo',title:'Video [vid]'},{uid:'ss',tag:'snd',class:'NDLoadAudio',title:'Sound [snd]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('vi','videoinput',10,10,470,640,{node:{src:'sv',kind:'videoload',name:''}},{}), W('ai','audioinput',500,10,470,340,{node:{src:'ss',kind:'audioload',name:''}},{}), W('v0','videoinput',500,370,470,200,{},{})]};
  u.ndUiApi.reload(); }""")
pg.wait_for_timeout(2500)
check("widgets mount views next to the node views", J("document.querySelectorAll('.ndk-tvw .ndk-tv').length") == 2, str(J("document.querySelectorAll('.ndk-tvw .ndk-tv').length")))
check("an unbound Video Input asks to bind", "Bind an ND Load Video node" in J("document.body.innerText"))
W1 = "document.querySelector('.ndk-tvw .ndk-tv.video')"
check("the widget shows the node's file", J(W1 + ".querySelector('select.ndk-tv-sel').value") == "clip.mp4")
check("the widget view is not compact", J(W1 + ".classList.contains('compact')") is False)
check("the widget has the size fields", J(f"Array.from({W1}.querySelectorAll('.ndk-tv-set label.ndk-tv-f')).some(l=>l.innerText.trim().startsWith('Width'))") is True)
setfieldW = lambda i, text: J(f"""()=>{{const i={W1}.querySelectorAll('.ndk-tv-seg input[type=text]')[{i}]; i.focus(); i.value='{text}'; i.dispatchEvent(new Event('change',{{bubbles:true}})); i.blur();}}""")
setfieldW(0, "0.7"); pg.wait_for_timeout(300)
check("the widget edits the node's settings", abs(SET(NV)["start"] - 0.7) < 1e-6)
pg.wait_for_timeout(900)
check("and the node's own view follows", J(f"{fields(TV)}[0].value") == "0.7", J(f"{fields(TV)}[0].value"))
check("in the widget the controls are under a spoiler, closed", J(W1 + ".querySelector('.ndk-tv-body').style.display") == "none" and J(W1 + ".querySelector('.ndk-tv-spoiler').style.display") == "")
check("the closed spoiler shows a summary", "0.70" in J(W1 + ".querySelector('.ndk-tv-spoiler .sum').innerText"), J(W1 + ".querySelector('.ndk-tv-spoiler .sum').innerText"))
top = J("""()=>{const w=document.querySelector('.ndk-tvw').closest('.ndk-w'); const f=document.querySelector('.ndk-tvw .ndk-tv .ndk-tv-file'); return [f.getBoundingClientRect().top-w.getBoundingClientRect().top, w.getBoundingClientRect().height]}""")
check("a closed spoiler keeps the widget at the top, not centred", top[0] < 40 and top[1] > 400, str(top))
check("default spoiler title", J(W1 + ".querySelector('.ndk-tv-spoiler b').innerText") == "Trim, crop and settings")
J("""()=>{const u=window.__app.graph._nodes.filter(n=>n.type==='NDUI').pop(); u.properties.nd_ui.widgets.find(w=>w.id==='vi').props.spoiler_title='Video tools'; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1200)
check("custom spoiler title", J(W1 + ".querySelector('.ndk-tv-spoiler b').innerText") == "Video tools", J(W1 + ".querySelector('.ndk-tv-spoiler b').innerText"))
J("""()=>{const u=window.__app.graph._nodes.filter(n=>n.type==='NDUI').pop(); u.properties.nd_ui.widgets.find(w=>w.id==='vi').props.spoiler_title=''; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1000)
check("empty title goes back to the default", J(W1 + ".querySelector('.ndk-tv-spoiler b').innerText") == "Trim, crop and settings")
check("the node's own view has no spoiler", J(TV + ".querySelector('.ndk-tv-spoiler').style.display") == "none" and J(TV + ".querySelector('.ndk-tv-body').style.display") == "")
J(W1 + ".querySelector('.ndk-tv-spoiler').click()"); pg.wait_for_timeout(500)
check("a click opens the controls", J(W1 + ".querySelector('.ndk-tv-body').style.display") == "")
check("the open state is remembered in the widget", J("window.__app.graph._nodes.filter(n=>n.type==='NDUI').pop().properties.nd_ui.widgets.find(w=>w.id==='vi').props.open") is True)
check("the frame strip is drawn after opening", J("""()=>{const c=document.querySelector('.ndk-tvw .ndk-tv.video canvas.bg'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let s=0; for(let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2]; return c.width>50 && s>1000}""") is True)
check("memory limit field with the explanation", J(f"Array.from({W1}.querySelectorAll('.ndk-tv-set label.ndk-tv-f')).some(l=>l.innerText.includes('Memory limit') && l.title.includes('RAM'))") is True)
num(W1, "Memory limit", "-1")
check("memory limit -> settings", SET(NV)["memory_gb"] == -1)
num(W1, "Memory limit", "0")
J(W1 + ".querySelector('.ndk-tv-spoiler').click()"); pg.wait_for_timeout(300)
J("""()=>{const u=window.__app.graph._nodes.filter(n=>n.type==='NDUI').pop(); u.properties.nd_ui.widgets.find(w=>w.id==='vi').props.collapse=false; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1500)
check("option off: no spoiler, controls always shown", J(W1 + ".querySelector('.ndk-tv-spoiler').style.display") == "none" and J(W1 + ".querySelector('.ndk-tv-body').style.display") == "")
# the other way round
setfield(TV, 0, "1.1"); pg.wait_for_timeout(1200)
check("a change in the node reaches the widget", J(W1 + ".querySelector('.ndk-tv-seg input[type=text]').value") == "1.1", J(W1 + ".querySelector('.ndk-tv-seg input[type=text]').value"))
# a wrong node kind
J("""()=>{const a=window.__app; const u=a.graph._nodes.filter(n=>n.type==='NDUI').pop(); u.properties.nd_ui.widgets.find(w=>w.id==='ai').slots.node={src:'sv',kind:'audioload',name:''}; u.ndUiApi.reload();}"""); pg.wait_for_timeout(1500)
check("an Audio Input bound to a video node says so", "This node is not an ND Load Audio" in J("document.body.innerText"))
# the editor offers loader nodes only
check("registered widget types", J("""async()=>{const m=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/widgets/index.js'); return ['videoinput','audioinput'].every(t=>!!m.defOf(t))}""") is True)
# ---- 9. workflow round trip
saved = J("JSON.stringify(window.__app.graph.serialize())")
J("""async (s) => { const a = window.__app; await a.loadGraphData(JSON.parse(s)); }""", saved); pg.wait_for_timeout(2500)
check("after a reload the settings are kept and the views are back", J("document.querySelectorAll('.ndk-tv').length") >= 2 and abs(SET(NV)["start"] - 1.1) < 1e-6)
check("technical widgets are hidden again after the load", J(f"{NV}.widgets.filter(w=>w.name==='settings'||w.name==='video').every(w=>w.hidden===true)") is True)
finish(p, br, errs)
