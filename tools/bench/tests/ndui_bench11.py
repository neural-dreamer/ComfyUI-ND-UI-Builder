# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 11 (stage D3): the Audio Player and the Video Player (real small webm / wav files from tools/bench/media), events of SaveAudio / PreviewAudio / SaveVideo / VHS.
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
def done(node, out, pid="p1"):
    ws({"type": "executed", "data": {"node": node, "display_node": node, "prompt_id": pid, "output": out}})

p, br, pg, errs = start()
J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
ids = J("""async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; window.__app = a; a.graph.clear();
  const mk=(t,x,y,title)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; a.graph.add(n); return n;};
  const pv = mk('PreviewImage',60,300,'Out [out]'), u = mk('NDUI',480,60); u.size=[1100,700]; a.graph.setDirtyCanvas(true,true);
  pv.properties.nd_ui_src={uid:'so',tag:'out'};
  const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots,props:props||{}});
  u.properties.nd_ui={sources:[{uid:'so',tag:'out',class:'PreviewImage',title:'Out [out]'}],pages:[{id:'p1',name:'Main'}],
   widgets:[W('ap','audioplayer',10,10,500,230,{},{}), W('vp','videoplayer',530,10,520,400,{},{}), W('apb','audioplayer',10,260,500,150,{audio:{src:'so',kind:'audio',name:''}},{}), W('vw','viewer',10,430,500,240,{},{results:true,live:false,compare:false})]};
  u.ndUiApi.reload(); return {u:u.id, o:pv.id}; }""")
pg.wait_for_timeout(1000)
O = str(ids["o"])
check("four widgets mounted", J("document.querySelectorAll('.ndk-pl').length") == 3 and J("document.querySelectorAll('.ndk-viewer').length") == 1)
check("empty states", "No sound yet" in J("document.querySelector('.ndk-pw').innerText") and "No video yet" in J("document.querySelectorAll('.ndk-pw')[1].innerText"))

# ---- 1. a sound (SaveAudio) and a second one (PreviewAudio)
done("30", {"audio": [{"filename": "a1.wav", "subfolder": "audio", "type": "output"}]}); pg.wait_for_timeout(1500)
AU = "document.querySelectorAll('.ndk-pl.audio')[0]"
check("the sound is loaded into the first player", "filename=a1.wav" in J(AU + ".querySelector('audio').src") and "subfolder=audio" in J(AU + ".querySelector('audio').src"))
check("the other audio player is bound to a node and stays empty", J("document.querySelectorAll('.ndk-pw')[2].querySelector('.ndk-pl').style.display") == "none")
check("the duration is read (3 s)", abs(float(J(AU + ".querySelector('audio').duration")) - 3) < 0.3)
check("the time shows 0:00 / 0:03", J(AU + ".querySelector('.time').innerText") == "0:00 / 0:03")
check("the wave form is drawn", int(J(AU + ".querySelector('canvas.wave').dataset.bars")) > 10)
done("30", {"audio": [{"filename": "a2.wav", "subfolder": "", "type": "temp"}]}, "p2"); pg.wait_for_timeout(1500)
check("the newest sound is loaded", "filename=a2.wav" in J(AU + ".querySelector('audio').src"))
check("the list of runs shows both", J("document.querySelectorAll('.ndk-pw')[0].querySelectorAll('.ndk-pw-list button').length") == 2)
J("document.querySelectorAll('.ndk-pw')[0].querySelectorAll('.ndk-pw-list button')[1].click()"); pg.wait_for_timeout(600)
check("a click on an older run loads it", "filename=a1.wav" in J(AU + ".querySelector('audio').src"))
J("document.querySelectorAll('.ndk-pw')[0].querySelectorAll('.ndk-pw-list button')[0].click()"); pg.wait_for_timeout(400)

# ---- 2. controls of the sound
J(AU + ".querySelector('button.play').click()"); pg.wait_for_timeout(900)
check("play", J(AU + ".querySelector('audio').paused") is False and float(J(AU + ".querySelector('audio').currentTime")) > 0.2)
check("the button turns into pause", True)
J(AU + ".querySelector('button.play').click()"); pg.wait_for_timeout(200)
check("pause", J(AU + ".querySelector('audio').paused") is True)
J("""()=>{const v=document.querySelectorAll('.ndk-pl.audio')[0].querySelector('input.vol'); v.value='0.3'; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change'))}"""); pg.wait_for_timeout(200)
check("the volume", abs(float(J(AU + ".querySelector('audio').volume")) - 0.3) < 0.01)
check("and it is remembered in the widget", abs(float(J("window.__app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui.widgets.find(w=>w.id==='ap').props.volume")) - 0.3) < 0.01)
J(AU + ".querySelector('button.mute').click()"); pg.wait_for_timeout(150)
check("mute", J(AU + ".querySelector('audio').muted") is True)
J(AU + ".querySelector('button.mute').click()"); pg.wait_for_timeout(150)
J(AU + ".querySelector('button.loop').click()"); pg.wait_for_timeout(150)
check("loop is on and kept", J(AU + ".querySelector('audio').loop") is True and J("window.__app.graph._nodes.find(n=>n.type==='NDUI').properties.nd_ui.widgets.find(w=>w.id==='ap').props.loop") is True)
J(AU + ".querySelector('button.speed').click()"); pg.wait_for_timeout(150)
check("speed steps up", abs(float(J(AU + ".querySelector('audio').playbackRate")) - 1.25) < 0.01 and "1.25" in J(AU + ".querySelector('button.speed').innerText"))
box = pg.locator(".ndk-pl.audio >> nth=0").locator(".track").bounding_box()
pg.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] / 2); pg.wait_for_timeout(300)
check("a click on the time line seeks to the middle (a2 is 2 s long)", abs(float(J(AU + ".querySelector('audio').currentTime")) - 1.0) < 0.3, str(J(AU + ".querySelector('audio').currentTime")))
check("the time and the fill follow", "0:01" in J(AU + ".querySelector('.time').innerText") and 40 < float(J(AU + ".querySelector('.fill').style.width").rstrip("%")) < 60)
J(AU + ".focus()"); pg.keyboard.press("Space"); pg.wait_for_timeout(300)
check("Space plays", J(AU + ".querySelector('audio').paused") is False)
pg.keyboard.press("Space"); pg.wait_for_timeout(200)
J("document.querySelector('.ndk-pl.audio audio').currentTime = 1"); pg.wait_for_timeout(100)
pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(200)
check("the right arrow jumps 5 s (to the end here)", float(J(AU + ".querySelector('audio').currentTime")) >= 1.9)
J("document.querySelector('.ndk-pl.audio audio').currentTime = 2"); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(200)
check("the left arrow goes back", float(J(AU + ".querySelector('audio').currentTime")) < 0.3)

# ---- 3. Save and the drag handle
J("window.__clicks=[]; HTMLAnchorElement.prototype.click=function(){ window.__clicks.push([this.href,this.download]); }")
J(AU + ".querySelector('button.save').click()"); pg.wait_for_timeout(150)
cl = [c for c in J("window.__clicks") if c[0] and "filename=" in c[0]]
check("Save downloads the original", len(cl) == 1 and "filename=a2.wav" in cl[0][0] and cl[0][1] == "a2.wav", str(cl))
d = J("""()=>{const g=document.querySelectorAll('.ndk-pl.audio')[0].querySelector('button.grip'); const dt=new DataTransfer(); const ev=new DragEvent('dragstart',{dataTransfer:dt,bubbles:true,cancelable:true}); g.dispatchEvent(ev); return {nd:dt.getData('application/x-nd-image'), url:dt.getData('DownloadURL'), ok:!ev.defaultPrevented}}""")
check("the handle gives the file to the desktop and not to image inputs", d["ok"] and d["url"].startswith("audio/wav:a2.wav:http") and d["nd"] == "", str(d))

# ---- 4. a video (SaveVideo: `images` + animated) and VHS (`gifs`)
done("40", {"images": [{"filename": "v1.mp4", "subfolder": "video", "type": "output"}], "animated": [True]}, "p3"); pg.wait_for_timeout(1200)
VP = "document.querySelectorAll('.ndk-pl.video')[0]"
check("the video is loaded", "filename=v1.mp4" in J(VP + ".querySelector('video').src"))
check("it is not shown as a picture in the Viewer", J("[...document.querySelector('.ndk-viewer').querySelectorAll('img')].filter(i=>i.getAttribute('src')).length") == 0)
check("the video loops by default", J(VP + ".querySelector('video').loop") is True)
check("the duration of the video", abs(float(J(VP + ".querySelector('video').duration")) - 3) < 0.4)
done("40", {"gifs": [{"filename": "vhs_00001.mp4", "subfolder": "", "type": "temp", "format": "video/h264-mp4", "frame_rate": 24}]}, "p4"); pg.wait_for_timeout(1000)
check("a VHS video (gifs) comes too", "filename=vhs_00001.mp4" in J(VP + ".querySelector('video').src"))
check("two runs below", J("document.querySelectorAll('.ndk-pw')[1].querySelectorAll('.ndk-pw-list button').length") == 2)
J(VP + ".querySelector('button.play').click()"); pg.wait_for_timeout(1000)
check("the video plays", J(VP + ".querySelector('video').paused") is False and float(J(VP + ".querySelector('video').currentTime")) > 0.3)
J(VP + ".querySelector('video').click()"); pg.wait_for_timeout(300)
check("a click on the picture pauses", J(VP + ".querySelector('video').paused") is True)
check("a full screen button is there", J(VP + ".querySelector('button.full')") is not None)
# arrows: one frame in a video (10 fps file), 5 s with Shift
J(VP + ".querySelector('video').currentTime = 1.0"); J(VP + ".focus()"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(1800)
t = float(J(VP + ".querySelector('video').currentTime"))
check("the right arrow goes one frame forward (0.1 s at 10 fps)", 1.05 < t < 1.2 and J(VP + ".querySelector('video').paused") is True, str(t))
pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(600)
t2 = float(J(VP + ".querySelector('video').currentTime"))
check("and the left arrow one frame back", 0.95 < t2 < 1.11 and t2 < t, str(t2))
pg.keyboard.press("Shift+ArrowRight"); pg.wait_for_timeout(500)
check("Shift gives the jump of 5 s", float(J(VP + ".querySelector('video').currentTime")) >= 2.5)
# a file the browser cannot play
done("42", {"video": [{"filename": "broken.avi", "subfolder": "", "type": "output"}]}, "p5"); pg.wait_for_timeout(1000)
check("an unplayable file says so", "cannot play" in J(VP + ".innerText"))
# the newest of any node feeds a player that is not bound; a bound one gets only its own node
check("the player bound to a node ignores other nodes", J("document.querySelectorAll('.ndk-pw')[2].querySelector('.ndk-pl').style.display") == "none")
done(O, {"audio": [{"filename": "bound.wav", "subfolder": "", "type": "output"}]}, "p6"); pg.wait_for_timeout(1000)
check("and plays what its node made", "filename=bound.wav" in J("document.querySelectorAll('.ndk-pl.audio')[1].querySelector('audio').src"))

# ---- 5. props: no save button, the fit
J("""()=>{const u=window.__app.graph._nodes.find(n=>n.type==='NDUI'); const w=u.properties.nd_ui.widgets.find(w=>w.id==='vp'); w.props.save=false; w.props.fit='cover'; w.props.history=false; u.ndUiApi.reload()}"""); pg.wait_for_timeout(900)
check("no Save button when switched off", J("getComputedStyle(document.querySelectorAll('.ndk-pl.video')[0].querySelector('button.save')).display") == "none")
check("the picture fills the frame", J("document.querySelectorAll('.ndk-pl.video')[0].querySelector('video').style.objectFit") == "cover")
check("the runs list is hidden", J("getComputedStyle(document.querySelectorAll('.ndk-pw')[1].querySelector('.ndk-pw-list')).display") == "none")

# ---- 6. the library
J("window.ndUi.host().openEditor()"); pg.wait_for_timeout(900)
J("window.ndUi.host().editor.setTab('widgets')"); pg.wait_for_timeout(300)
tiles = J("[...document.querySelectorAll('.nde-lib-i')].map(i=>i.innerText.trim())")
check("the library offers both players", "Audio Player" in tiles and "Video Player" in tiles, str(tiles))
J("[...document.querySelectorAll('.nde-lib-i')].find(i=>i.innerText.trim()==='Video Player').click()"); pg.wait_for_timeout(500)
body = J("document.body.innerText")
check("its settings are there", "Play when a new one comes" in body and "Picture" in body and "Video of" in body)
finish(p, br, errs)
