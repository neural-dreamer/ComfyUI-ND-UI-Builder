// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI Kit — styles of the LoRA widgets and of the gallery of models.
export const LORA_CSS = `
/* the gallery */
.ndk-lg .ndk-mp-grid{flex:1 1 auto;min-height:120px;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.ndk-lg-title{padding:10px 14px 0;font-weight:650;color:var(--ndk-text)}
.ndk-lg-filters{display:flex;gap:8px;padding:8px 10px 0}
.ndk-lg-filters:empty{display:none}
.ndk-lg-sel{flex:1 1 0;min-width:0;height:28px;padding:0 8px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-value);font:inherit;font-size:12px;outline:0}
.ndk-lg-sel:focus{border-color:var(--ndk-accent)}
.ndk-lg-clear{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:transparent;color:var(--ndk-value);font:inherit;font-size:12px;cursor:pointer}
.ndk-lg-clear:hover:not(:disabled){border-color:var(--ndk-accent);color:var(--ndk-accent)}
.ndk-lg-clear:disabled{opacity:.4;cursor:default}
.ndk-lg-favbtn.on{color:var(--ndk-accent)}
.ndk-lg-sec{grid-column:1/-1;margin-top:4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ndk-faint)}
.ndk-lg-card .pic{position:relative;flex:1 1 auto;aspect-ratio:auto;background:var(--ndk-s3);overflow:hidden;display:flex;align-items:center;justify-content:center}
.ndk-lg-card .pic.empty{min-height:96px}
.ndk-lg-card .pic .bgblur{position:absolute;left:-14px;top:-14px;width:calc(100% + 28px);height:calc(100% + 28px);object-fit:cover;filter:blur(14px) brightness(.72) saturate(1.1);pointer-events:none}
.ndk-lg-card .pic .main{position:relative;z-index:1;display:block;width:100%;height:auto;max-height:260px;object-fit:contain}
.ndk-lg-card .pic .ndk-lg-base,.ndk-lg-card .pic .ndk-lg-fav,.ndk-lg-card .pic .ndk-lr-ib{z-index:2}
.ndk-lg-card .nm{flex:0 0 auto}
.ndk-lg-base{position:absolute;left:5px;bottom:5px;max-width:calc(100% - 10px);padding:1px 6px;border-radius:999px;font-size:10px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(8,10,14,.72);color:#e8edf3;backdrop-filter:blur(4px)}
.ndk-lg-fav{position:absolute;right:4px;top:4px;display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:rgba(8,10,14,.55);color:rgba(255,255,255,.75);cursor:pointer;opacity:0;transition:opacity .12s}
.ndk-lg-card:hover .ndk-lg-fav,.ndk-lg-fav.on,.ndk-lg-fav:focus-visible{opacity:1}
.ndk-lg-fav.on{color:#ffc94d}
.ndk-lg-fav.on svg{fill:currentColor}
.ndk-lg-fav:hover{background:rgba(8,10,14,.85)}
.ndk-lg-favbtn.on svg{fill:currentColor}
/* the stack */
.ndk-lora{display:flex;flex-direction:column;height:100%;min-height:0}
.ndk-lr{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;color:var(--ndk-text);font-size:var(--ndk-fs)}
.ndk-lr-list{display:flex;flex-direction:column;justify-content:flex-start;align-content:flex-start;gap:6px;flex:1 1 auto;min-height:0;overflow-y:auto;padding-right:2px}
.ndk-lr-list>.ndk-lr-card{flex:0 0 auto}
.ndk-lr-bar{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.ndk-lr-bar .ndk-btn{height:30px;padding:0 12px;gap:6px}
.ndk-lr-count{margin-left:auto;color:var(--ndk-faint);font-size:11px}
.ndk-lr-empty{display:flex;align-items:center;justify-content:center;gap:8px;padding:18px 10px;text-align:center;color:var(--ndk-faint)}
.ndk-lr-empty.warn{color:var(--ndk-danger)}
.ndk-lr-card{position:relative;display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--ndk-cbd,var(--ndk-border));border-radius:calc(var(--ndk-rm) * .9);background:var(--ndk-s2);transition:border-color .12s,opacity .12s}
.ndk-lr-card:hover{border-color:var(--ndk-border-strong)}
.ndk-lr-card.off{opacity:.55}
.ndk-lr-card.miss{border-color:var(--ndk-danger)}
.ndk-lr-card.drag{opacity:.35}
.ndk-lr-card.over-t::before,.ndk-lr-card.over-b::after{content:"";position:absolute;left:6px;right:6px;height:2px;border-radius:2px;background:var(--ndk-accent);box-shadow:0 0 6px var(--ndk-accent)}
.ndk-lr-card.over-t::before{top:-5px}.ndk-lr-card.over-b::after{bottom:-5px}
.ndk-lr-top{display:flex;align-items:center;gap:8px;min-width:0}
.ndk-lr-grip{display:flex;align-items:center;color:var(--ndk-faint);cursor:grab;padding:2px 0}
.ndk-lr-grip:active{cursor:grabbing}
.ndk-lr-pic{flex:0 0 auto;width:40px;height:40px;border-radius:calc(var(--ndk-rs) + 1px);background:var(--ndk-s3);overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--ndk-faint)}
.ndk-lr-name{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;line-height:1.25}
.ndk-lr-name b{font-weight:600;color:var(--ndk-value);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-lr-name small{color:var(--ndk-faint);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-lr-name small.warn{color:var(--ndk-danger)}
.ndk-lr-sw{position:relative;flex:0 0 auto;width:34px;height:20px;padding:0;border:1px solid var(--ndk-field-border);border-radius:999px;background:var(--ndk-field-bg);cursor:pointer;transition:background .12s,border-color .12s}
.ndk-lr-sw i{position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:var(--ndk-muted);transition:transform .14s,background .12s}
.ndk-lr-sw.on{background:var(--ndk-accent);border-color:transparent}
.ndk-lr-sw.on i{transform:translateX(14px);background:var(--ndk-on-accent)}
.ndk-lr .ndk-lr-del,.ndk-lr .ndk-lr-link{width:26px;height:26px;border-radius:var(--ndk-rs)}
.ndk-lr-link.on{color:var(--ndk-accent)}
.ndk-lr-body{display:flex;flex-direction:column;gap:4px}
.ndk-lr-str{display:flex;align-items:center;gap:8px}
.ndk-lr-str.off{opacity:.5}
.ndk-lr-lab{flex:0 0 46px;color:var(--ndk-muted);font-size:11px}
.ndk-lr-str input[type=range]{flex:1 1 auto;min-width:40px;height:16px;margin:0;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;--p:50%}
.ndk-lr-str input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(90deg,var(--ndk-accent) var(--p),var(--ndk-s3) var(--p))}
.ndk-lr-str input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;border:2px solid var(--ndk-accent);background:var(--ndk-s1);box-shadow:0 1px 3px var(--ndk-shadow)}
.ndk-lr-str input[type=range]::-moz-range-track{height:4px;border-radius:4px;background:var(--ndk-s3)}
.ndk-lr-str input[type=range]::-moz-range-progress{height:4px;border-radius:4px;background:var(--ndk-accent)}
.ndk-lr-str input[type=range]::-moz-range-thumb{width:10px;height:10px;border-radius:50%;border:2px solid var(--ndk-accent);background:var(--ndk-s1)}
.ndk-lr-num{flex:0 0 auto;width:52px;height:24px;padding:0 4px;text-align:center;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-value);font:inherit;font-size:12px;font-weight:500;outline:0}
.ndk-lr-num:focus{border-color:var(--ndk-accent);box-shadow:0 0 0 2px var(--ndk-accent-ring)}
.ndk-lr-words{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.ndk-lr-word{height:22px;min-width:0;font-size:11px;padding:0 8px;opacity:.6}
.ndk-lr-word.on{opacity:1;border-color:var(--ndk-accent);color:var(--ndk-accent);background:var(--ndk-accent-soft)}
.ndk-lr-prerow{display:flex;gap:6px;padding:8px}
.ndk-lr-prerow .ndk-field{flex:1 1 auto}
/* the preview of a LoRA: a picture or a video, blurred when it is NSFW (the switch is the attribute data-nd-nsfw on <html>, shared with Neural Dreamer Nodes) */
.ndk-lmedia{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:hidden;background:var(--ndk-s3);color:var(--ndk-faint)}
.ndk-lmedia.plain{background:transparent}
.ndk-lmedia>img,.ndk-lmedia>video{display:block;width:100%;height:100%;object-fit:cover;transition:filter .12s,transform .12s}
.ndk-mp-thumb .ndk-lmedia{border-radius:inherit}
.ndk-nsfwtag{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;padding:1px 6px;border-radius:999px;font-size:9px;line-height:14px;letter-spacing:.06em;font-weight:700;color:#fff;background:rgba(8,10,14,.6);pointer-events:none}
.ndk-lr-pic .ndk-nsfwtag,.ndk-mp-thumb .ndk-nsfwtag{font-size:7px;line-height:11px;padding:0 4px}
.ndk-lmedia.nsfw>img,.ndk-lmedia.nsfw>video,.ndk-lg-card .pic.nsfw .main,.ndk-lg-card .pic.nsfw .bgblur{filter:blur(14px) brightness(.8);transform:scale(1.25)}
.ndk-lmedia.nsfw .ndk-nsfwtag,.ndk-lg-card .pic.nsfw .ndk-nsfwtag{display:block}
html[data-nd-nsfw="show"] .ndk-lmedia.nsfw>img,html[data-nd-nsfw="show"] .ndk-lmedia.nsfw>video,html[data-nd-nsfw="show"] .ndk-lg-card .pic.nsfw .main,html[data-nd-nsfw="show"] .ndk-lg-card .pic.nsfw .bgblur{filter:none;transform:none}
html[data-nd-nsfw="show"] .ndk-lmedia.nsfw .ndk-nsfwtag,html[data-nd-nsfw="show"] .ndk-lg-card .pic.nsfw .ndk-nsfwtag{display:none}
.ndk-lg-card .pic.nsfw .bgblur{filter:blur(20px) brightness(.7)}
html[data-nd-nsfw="show"] .ndk-lg-card .pic.nsfw .bgblur{filter:blur(14px) brightness(.72) saturate(1.1)}
.ndk-lg-card .pic.vid{aspect-ratio:4/5;flex:0 0 auto}
.ndk-lg-card .pic.vid video.main{position:absolute;inset:0;width:100%;height:100%;max-height:none;object-fit:cover;transition:filter .12s,transform .12s}
.ndk-lg-card .pic .ndk-nsfwtag{z-index:3}
.ndk-nsfw-eye.on,.ndk-lr-eye.on{color:var(--ndk-accent)}
.ndk-lg-shield{left:4px;right:auto}
.ndk-lg-card:hover .ndk-lg-shield,.ndk-lg-shield.on,.ndk-lg-shield:focus-visible{opacity:1}
.ndk-lg-shield.on{color:#ff8a8a}
.ndk-lg-shield.on svg,.ndk-lg-shield.user svg,.ndk-lr-shield.on svg,.ndk-lr-shield.user svg{fill:currentColor}
.ndk-lr .ndk-lr-shield{width:26px;height:26px;border-radius:var(--ndk-rs)}
.ndk-lr-shield.on{color:#ff8a8a}
.ndk-nsfw-menu{position:absolute;left:4px;top:30px;z-index:8;display:flex;flex-direction:column;min-width:150px;padding:4px;border:1px solid var(--ndk-border-strong);border-radius:var(--ndk-rm);background:var(--ndk-s1);box-shadow:0 10px 28px var(--ndk-shadow)}
.ndk-lr-card>.ndk-nsfw-menu{right:8px;left:auto;top:44px}
.ndk-nsfw-it{display:flex;align-items:center;gap:7px;height:28px;padding:0 8px;border:0;border-radius:var(--ndk-rs);background:transparent;color:var(--ndk-text);font:inherit;font-size:12px;text-align:left;cursor:pointer;white-space:nowrap}
.ndk-nsfw-it:hover:not(:disabled){background:var(--ndk-accent-soft)}
.ndk-nsfw-it.on{color:var(--ndk-accent)}
.ndk-nsfw-it:disabled{opacity:.4;cursor:default}
/* the arrows of the strength */
.ndk-lr-arr{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:20px;height:24px;margin:0 -3px;padding:0;border:1px solid transparent;border-radius:var(--ndk-rs);background:transparent;color:var(--ndk-muted);cursor:pointer;touch-action:none}
.ndk-lr-arr:hover:not(:disabled){color:var(--ndk-accent);border-color:var(--ndk-field-border)}
.ndk-lr-arr:active:not(:disabled){background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-lr-arr:disabled{opacity:.35;cursor:default}
/* LoRA Picker */
.ndk-lp{display:flex;flex-direction:column;gap:6px;height:100%;justify-content:center}
.ndk-lp-str{display:flex;flex-direction:column;gap:2px}
.ndk-lora.noclip .ndk-lr-cliprow{display:none}
/* the buttons and the info of a LoRA */
.ndk-lr-ib{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto}
.ndk-lr-ib .ndk-iconbtn:disabled{opacity:.3;cursor:default;pointer-events:none}
.ndk-li{display:flex;flex-direction:column;min-height:0;flex:1 1 auto}
.ndk-li-head{display:flex;flex-direction:column;gap:2px;padding:10px 14px 8px;border-bottom:1px solid var(--ndk-border)}
.ndk-li-head b{font-size:13px;word-break:break-word}.ndk-li-head small{color:var(--ndk-faint);font-size:11px}
.ndk-li-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px 14px 12px;display:flex;flex-direction:column;gap:12px}
.ndk-li-lab{margin-bottom:4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ndk-faint)}
.ndk-li-word{display:flex;align-items:center;gap:8px;padding:4px 8px;margin:0 -8px;border-radius:var(--ndk-rs)}
.ndk-li-word.alt{background:color-mix(in srgb,var(--ndk-text) 7%,transparent)}
.ndk-li-word:hover{background:color-mix(in srgb,var(--ndk-accent) 14%,transparent)}
.ndk-li-txt{flex:1 1 auto;min-width:0;word-break:break-word;user-select:text}
.ndk-li-text{white-space:pre-wrap;word-break:break-word;color:var(--ndk-text);user-select:text;line-height:1.4}
.ndk-li-cb{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:1px solid var(--ndk-border-strong);border-radius:5px;background:var(--ndk-field-bg);color:transparent;cursor:pointer}
.ndk-li-cb.on{background:var(--ndk-accent);border-color:transparent;color:var(--ndk-on-accent)}
.ndk-li-copy.done{color:var(--ndk-accent)}
.ndk-lg-info{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;background:var(--ndk-s1);animation:ndk-pop .12s ease-out}
.ndk-lg-info-bar{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--ndk-border)}
.ndk-lg-card .ndk-lr-ib{position:absolute;right:4px;top:32px;flex-direction:column;gap:4px}
.ndk-lg-card .ndk-lr-ib .ndk-iconbtn{width:24px;height:24px;padding:0;border-radius:50%;background:rgba(8,10,14,.55);color:rgba(255,255,255,.8)}
.ndk-lg-card .ndk-lr-ib .ndk-iconbtn:not(:disabled):hover{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-lg-card .nm .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ndk-lg-card .nm{display:block;overflow:visible;-webkit-line-clamp:unset}
.ndk-lg-card .nm small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-li-head.has-pic{display:grid;grid-template-columns:64px 1fr;column-gap:12px;align-items:center}
.ndk-li-head.has-pic .ndk-li-pic{grid-row:1 / span 3}
.ndk-li-pic{width:64px;height:64px;padding:0;border:1px solid var(--ndk-border-strong);border-radius:var(--ndk-rs);overflow:hidden;background:var(--ndk-s3);cursor:zoom-in}
.ndk-li-pic img{width:100%;height:100%;object-fit:cover;display:block}
.ndk-li-pic:hover{border-color:var(--ndk-accent)}
.ndk-li-big{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,6,10,.82);cursor:zoom-out}
.ndk-li-big img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
`;
