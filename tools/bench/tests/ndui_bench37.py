# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Bench 37: the Queue widget counts jobs right: one click = one job (the status message arrives BEFORE execution_start).
import json, urllib.request
from lib import *
def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()
def status(n): ws({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": n}}}})
p, br, pg, errs = start()
setup(pg)
pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const u=m.app.graph._nodes.find(n=>n.type==='NDUI'); u.size=[600,300];
 u.properties.nd_ui={sources:[],pages:[{id:'p1',name:'Main'}],widgets:[{id:'q',type:'queue',page:'p1',x:20,y:20,w:260,h:64,z:1,slots:{},props:{}}]}; u.ndUiApi.reload(); }""")
pg.wait_for_timeout(1000)
num = lambda: pg.evaluate("document.querySelector('.ndk-queue .num, .ndk-queue > *:first-child').innerText")
txt = lambda: pg.evaluate("document.querySelector('.ndk-queue').innerText.replace(/\\s+/g,' ')")
check("empty queue to start", "empty" in txt(), txt())
# one click: status(1) comes first, then execution_start
status(1); ws({"type": "execution_start", "data": {"prompt_id": "a"}}); pg.wait_for_timeout(300)
check("one job running shows 1, nobody waits", num() == "1" and "waiting" not in txt(), txt())
# second click while the first runs
status(2); pg.wait_for_timeout(300)
check("two jobs: running + 1 waiting", num() == "2" and "1 waiting" in txt(), txt())
# the first finishes, the second starts
ws({"type": "execution_success", "data": {"prompt_id": "a"}}); status(1); ws({"type": "execution_start", "data": {"prompt_id": "b"}}); pg.wait_for_timeout(300)
check("second job running alone shows 1", num() == "1" and "waiting" not in txt(), txt())
ws({"type": "execution_success", "data": {"prompt_id": "b"}}); status(0); pg.wait_for_timeout(300)
check("queue empty again", "empty" in txt() and num() == "0", txt())
# several clicks at once, before anything starts
status(3); pg.wait_for_timeout(200)
ws({"type": "execution_start", "data": {"prompt_id": "c"}}); pg.wait_for_timeout(300)
check("three queued: running + 2 waiting", num() == "3" and "2 waiting" in txt(), txt())
ws({"type": "execution_success", "data": {"prompt_id": "c"}}); pg.wait_for_timeout(200)
check("a finished job is not counted before the next status", num() == "2", txt())
status(2); ws({"type": "execution_start", "data": {"prompt_id": "d"}}); pg.wait_for_timeout(300)
check("the next job runs, 1 waits", num() == "2" and "1 waiting" in txt(), txt())
ws({"type": "execution_interrupted", "data": {"prompt_id": "d"}}); status(0); pg.wait_for_timeout(300)
check("interrupt and empty queue", "empty" in txt(), txt())
finish(p, br, errs)
