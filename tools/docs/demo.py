# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Demo graph, panel and values shared by shots.py and the video recorder.
import json, os, urllib.request
URL = os.environ.get("BENCH_URL", "http://127.0.0.1:8188")

def ws(msg):
    r = urllib.request.Request(URL + "/bench/ws", data=json.dumps(msg).encode(), headers={"Content-Type": "application/json"}); urllib.request.urlopen(r).read()

# the demo graph: a plain text-to-image workflow, tagged for the panel
GRAPH = """async () => { const m = await import('/scripts/app.js'); const a = m.app; const LG = window.LiteGraph; a.graph.clear();
  const mk=(t,x,y,title,src)=>{const n=LG.createNode(t); n.pos=[x,y]; if(title) n.title=title; if(src) n.properties.nd_ui_src=src; a.graph.add(n); return n;};
  mk('CheckpointLoaderSimple',40,60,'Model [model]',{uid:'ck',tag:'model'});
  mk('CLIPTextEncode',420,40,'Prompt [prompt]',{uid:'pp',tag:'prompt'});
  mk('CLIPTextEncode',420,300,'Negative [negative]',{uid:'ng',tag:'negative'});
  mk('EmptyLatentImage',40,300,'Size [size]',{uid:'sz',tag:'size'});
  mk('KSampler',820,60,'Sampler [sampler]',{uid:'sk',tag:'sampler'});
  mk('VAEDecode',1200,60); mk('SaveImage',1200,200,'Save [save]',{uid:'sv',tag:'save'});
  const u = mk('NDUI',40,640); u.size=[900,600]; window.__u=u; return u.id; }"""

PANEL = """() => { const u=window.__u; const W=(id,type,x,y,w,h,slots,props)=>({id,type,page:'p1',x,y,w,h,z:1,slots:slots||{},props:props||{}});
 const B=(s,n)=>({src:s,kind:'widget',name:n});
 u.size=[1200,760];
 u.properties.nd_ui={sources:[
   {uid:'ck',tag:'model',class:'CheckpointLoaderSimple',title:'Model [model]'},{uid:'pp',tag:'prompt',class:'CLIPTextEncode',title:'Prompt [prompt]'},
   {uid:'ng',tag:'negative',class:'CLIPTextEncode',title:'Negative [negative]'},{uid:'sz',tag:'size',class:'EmptyLatentImage',title:'Size [size]'},
   {uid:'sk',tag:'sampler',class:'KSampler',title:'Sampler [sampler]'},{uid:'sv',tag:'save',class:'SaveImage',title:'Save [save]'}],
  pages:[{id:'p1',name:'Generate'}],
  widgets:[
   W('h','heading',20,16,420,40,{},{text:'Photo studio'}),
   W('mp','modelpicker',20,64,420,64,{value:B('ck','ckpt_name')},{label:'Model'}),
   W('pr','prompt',20,140,420,170,{value:B('pp','text')},{label:'Prompt'}),
   W('ng','prompt',20,320,420,110,{value:B('ng','text')},{label:'Negative'}),
   W('rs','resolution',20,440,420,200,{width:B('sz','width'),height:B('sz','height')},{label:'Size'}),
   W('st','slider',460,64,300,64,{value:B('sk','steps')},{label:'Steps'}),
   W('cf','slider',460,140,300,64,{value:B('sk','cfg')},{label:'CFG'}),
   W('sm','dropdown',460,216,300,64,{value:B('sk','sampler_name')},{label:'Sampler'}),
   W('sd','seed',460,292,300,64,{value:B('sk','seed'),control:B('sk','control_after_generate')},{label:'Seed'}),
   W('g','generate',460,380,300,64),
   W('pg','progress',460,456,300,64),
   W('vw','viewer',780,16,400,560,{},{live:true,results:true,progress:'line'})
  ],view:{}};
 window.ndUi.host().save(u.properties.nd_ui); }"""

VALUES = """async () => { const m = await import('/scripts/app.js'); const g = m.app.graph;
  const set=(t,tag,n,v)=>{const nd=g._nodes.find(x=>x.type===t && (x.properties?.nd_ui_src?.tag===tag)); const w=nd?.widgets?.find(w=>w.name===n); if(w) w.value=v;};
  set('CLIPTextEncode','prompt','text','a smiling spice seller in a sunlit bazaar, warm light, cinematic, ultra detailed');
  set('CLIPTextEncode','negative','text','blurry, low quality, watermark, text');
  set('CheckpointLoaderSimple','model','ckpt_name','Krea2.safetensors');
  set('KSampler','sampler','steps',28); set('KSampler','sampler','cfg',6.5); set('KSampler','sampler','seed',482913);
  set('KSampler','sampler','control_after_generate','randomize'); set('EmptyLatentImage','size','width',832); set('EmptyLatentImage','size','height',1216); }"""

