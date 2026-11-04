# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 2b: parameters of typical nodes (Load Diffusion Model, Load LoRA, Int, Text multiline) and the widget they get by default.
from lib import *
p, br, pg, errs = start()
setup(pg)
r = pg.evaluate("""async()=>{const m=await import('/scripts/app.js'); const g=m.app.graph; const LG=window.LiteGraph; const S=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/sources.js'); const out={};
 for (const t of ['UNETLoader','LoraLoader','PrimitiveInt','PrimitiveStringMultiline','PrimitiveString','CLIPTextEncode']) { const n=LG.createNode(t); if(!n){out[t]=null; continue;} g.add(n); out[t]=S.listParams(n).map(p=>p.name+':'+p.ptype+'>'+(S.defaultWidgetFor(p)||'-')); }
 return out}""")
for t, v in r.items(): print(t, v)
check("Load Diffusion Model: model is a dropdown", r["UNETLoader"] and any(x.startswith("unet_name:COMBO>") for x in r["UNETLoader"]), str(r["UNETLoader"]))
check("Load LoRA: strength is a slider/number", r["LoraLoader"] and any(x.startswith("strength_model:FLOAT>") for x in r["LoraLoader"]))
check("Int is a number or slider", r["PrimitiveInt"] and r["PrimitiveInt"][0].startswith("value:INT>"), str(r["PrimitiveInt"]))
check("multiline text gets the Prompt widget", r["PrimitiveStringMultiline"] and r["PrimitiveStringMultiline"][0].endswith(">prompt"), str(r["PrimitiveStringMultiline"]))
check("CLIP Text Encode text gets the Prompt widget", r["CLIPTextEncode"] and r["CLIPTextEncode"][0].endswith(">prompt"), str(r["CLIPTextEncode"]))
finish(p, br, errs)
