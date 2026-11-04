// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI Kit — the styles of the widgets of stage 2 (run, results, Resolution, Model Picker, text output) and the full screen.
export const EXTRA_CSS = `
/* buttons */
.ndk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:var(--ndk-ctl);padding:0 16px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rm);background:var(--ndk-field-bg);color:var(--ndk-value);font-weight:600;cursor:pointer;white-space:nowrap;user-select:none;transition:background-color .12s,border-color .12s,box-shadow .12s,transform .08s}
.ndk-btn:hover{border-color:var(--ndk-cbds,var(--ndk-border-strong));background:var(--ndk-accent-soft)}
.ndk-btn:active{transform:translateY(1px)}
.ndk-btn:disabled{opacity:.45;cursor:default;pointer-events:none}
.ndk-btn.primary{border-color:transparent;background:var(--ndk-grad-btn,linear-gradient(180deg,var(--ndk-accent-hi),var(--ndk-accent)));color:var(--ndk-on-accent);box-shadow:var(--ndk-glow),0 1px 2px var(--ndk-shadow)}
.ndk-btn.primary:hover{filter:brightness(1.08)}
.ndk-btn.danger:hover{border-color:var(--ndk-danger);background:color-mix(in srgb,var(--ndk-danger) 18%,transparent);color:var(--ndk-danger)}
.ndk[data-minimal="1"] .ndk-btn:not(.primary),.ndk-w[data-minimal="1"] .ndk-btn:not(.primary){background:transparent;border-color:transparent;border-bottom-color:var(--ndk-border-strong);border-radius:0}
/* generate */
.ndk-gen{display:flex;align-items:stretch;gap:8px;height:100%;min-height:var(--ndk-ctl)}
.ndk-gen .run{flex:1 1 auto;font-size:calc(var(--ndk-fs) + 2px);letter-spacing:.02em}
.ndk-gen .run .spin{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ndk-spin .8s linear infinite}
@keyframes ndk-spin{to{transform:rotate(360deg)}}
.ndk-gen .batch{flex:0 0 auto;width:84px;height:auto}
.ndk-gen .batch .ndk-input{text-align:center;padding:0}
.ndk-gen .stop{flex:0 0 auto;padding:0 12px}
/* progress */
.ndk-prog{display:flex;flex-direction:column;justify-content:center;gap:7px;min-height:var(--ndk-ctl)}
.ndk-prog-bar{position:relative;height:10px;border-radius:99px;background:var(--ndk-s3);overflow:hidden}
.ndk-prog-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--ndk-accent),var(--ndk-accent-hi));box-shadow:var(--ndk-glow);transition:width .18s ease-out}
.ndk-prog.idle .ndk-prog-fill{opacity:.35}
.ndk-prog-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;font-size:12px;color:var(--ndk-muted);white-space:nowrap}
.ndk-prog-row .mid{text-align:center}.ndk-prog-row .end{text-align:right}
.ndk-prog-row b{color:var(--ndk-value);font-weight:600}
.ndk-prog-row span:first-child{overflow:hidden;text-overflow:ellipsis;min-width:0}
.ndk-prog.err .ndk-prog-fill{background:var(--ndk-danger);box-shadow:none}
/* queue */
.ndk-queue{display:flex;align-items:center;gap:10px;height:var(--ndk-ctl)}
.ndk-queue .num{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:calc(var(--ndk-ctl) - 6px);padding:0 10px;border-radius:99px;background:var(--ndk-accent-soft);color:var(--ndk-accent);font-weight:700}
.ndk-queue .txt{flex:1;color:var(--ndk-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-queue.busy .num{background:var(--ndk-accent);color:var(--ndk-on-accent);box-shadow:var(--ndk-glow)}
/* pictures */
.ndk-media{position:relative;display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:0;width:100%;height:100%}
.ndk-media-main{position:relative;flex:1 1 auto;min-height:0;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);overflow:hidden;display:flex;align-items:center;justify-content:center}
.ndk-media-main img{max-width:100%;max-height:100%;object-fit:contain;display:block;cursor:zoom-in;user-select:none;-webkit-user-drag:none}
.ndk-media-grid{display:grid;gap:6px;width:100%;height:100%;padding:6px}
.ndk-media-grid img{width:100%;height:100%;min-height:0;object-fit:contain;border-radius:calc(var(--ndk-rm) * .7);background:rgba(0,0,0,.18)}
.ndk-media-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ndk-faint);text-align:center;padding:16px;font-size:12.5px}
.ndk-media-tools{position:absolute;right:8px;top:8px;display:flex;gap:6px;opacity:0;transition:opacity .15s}
.ndk-media-main:hover .ndk-media-tools{opacity:1}
.ndk-media-tools button{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:var(--ndk-rs);background:rgba(10,12,18,.62);color:#fff;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ndk-media-tools button:hover{background:rgba(10,12,18,.85)}
.ndk-media-strip{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:2px 1px 4px}
.ndk-media-strip button{flex:0 0 auto;height:54px;aspect-ratio:1;padding:0;border:2px solid transparent;border-radius:calc(var(--ndk-rm) * .7);background:var(--ndk-s2);overflow:hidden;cursor:pointer;opacity:.7;transition:opacity .12s,border-color .12s}
.ndk-media-strip button img{width:100%;height:100%;object-fit:cover;display:block}
.ndk-media-strip button:hover{opacity:1}
.ndk-media-strip button.on{opacity:1;border-color:var(--ndk-accent)}
.ndk-live-badge{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;background:rgba(10,12,18,.62);color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ndk-live-badge i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:ndk-blink 1s ease-in-out infinite}
@keyframes ndk-blink{50%{opacity:.35}}
.ndk-live-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.12)}
.ndk-live-bar i{display:block;height:100%;width:0;background:var(--ndk-accent);transition:width .15s}
/* compare */
.ndk-cmp{position:relative;width:100%;height:100%;overflow:hidden;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);touch-action:none;cursor:ew-resize;user-select:none}
.ndk-cmp img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;-webkit-user-drag:none}
.ndk-cmp .top{clip-path:inset(0 50% 0 0)}
.ndk-cmp .bar{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;left:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 0 12px rgba(0,0,0,.4);pointer-events:none}
.ndk-cmp .bar::after{content:"";position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.45)}
.ndk-cmp .tag{position:absolute;top:8px;padding:2px 9px;border-radius:99px;background:rgba(10,12,18,.62);color:#fff;font-size:11px;font-weight:600;pointer-events:none}
.ndk-cmp .tag.a{left:8px}.ndk-cmp .tag.b{right:8px}
/* lightbox */
.ndk-lightbox{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;justify-content:center;background:rgba(4,5,8,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:ndk-pop .14s ease-out}
.ndk-lightbox .stage{position:absolute;inset:0;overflow:hidden;cursor:grab}
.ndk-lightbox .stage.drag{cursor:grabbing}
.ndk-lightbox img{position:absolute;left:50%;top:50%;max-width:92vw;max-height:88vh;user-select:none;-webkit-user-drag:none;will-change:transform}
.ndk-lightbox .bar{position:absolute;top:14px;right:14px;z-index:2;display:flex;gap:8px}
.ndk-lightbox .bar button,.ndk-lightbox .nav{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;cursor:pointer}
.ndk-lightbox .bar button:hover,.ndk-lightbox .nav:hover{background:rgba(255,255,255,.24)}
.ndk-lightbox .nav{position:absolute;top:50%;z-index:2;margin-top:-20px}
.ndk-lightbox .nav.prev{left:16px}.ndk-lightbox .nav.next{right:16px}
.ndk-lightbox .cap{position:absolute;left:0;right:0;bottom:16px;z-index:2;text-align:center;color:rgba(255,255,255,.75);font-size:12.5px;pointer-events:none}
/* resolution */
.ndk-res{display:flex;gap:12px;height:100%;min-height:0}
.ndk-res-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:8px;justify-content:center}
.ndk-res-ratios{display:flex;flex-wrap:wrap;gap:5px}
.ndk-chip{display:inline-flex;align-items:center;justify-content:center;height:calc(var(--ndk-ctl) - 8px);min-width:38px;padding:0 9px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-muted);font-size:12px;font-weight:600;cursor:pointer;transition:background-color .12s,color .12s,border-color .12s}
.ndk-chip:hover{color:var(--ndk-value);border-color:var(--ndk-cbds,var(--ndk-border-strong))}
.ndk-chip.on{background:var(--ndk-accent);border-color:transparent;color:var(--ndk-on-accent);box-shadow:var(--ndk-glow)}
.ndk-res-size{display:flex;align-items:center;gap:6px}
.ndk-res-size .ndk-field{flex:1 1 0;min-width:0}
.ndk-res-size .ndk-input{text-align:center;padding:0 4px}
.ndk-res-size .x{flex:0 0 auto;color:var(--ndk-faint)}
.ndk-res-size .ndk-iconbtn{width:var(--ndk-ctl);height:var(--ndk-ctl);border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rm);background:var(--ndk-field-bg)}
.ndk-res-size .ndk-iconbtn.on{background:var(--ndk-accent-soft);color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-res-opts{display:flex;gap:6px;align-items:center}
.ndk-res-opts .ndk-field{flex:1 1 auto}
.ndk-res-view{flex:0 0 38%;max-width:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--ndk-faint);font-size:11.5px;text-align:center}
.ndk-res-box{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1}
.ndk-res-rect{border:2px solid var(--ndk-accent);border-radius:calc(var(--ndk-rs) + 1px);background:var(--ndk-accent-soft);box-shadow:var(--ndk-glow);transition:width .15s,height .15s}
/* model picker */
.ndk-mp{display:flex;align-items:center;gap:10px;cursor:pointer;padding:0 8px 0 4px}
.ndk-mp-thumb{flex:0 0 auto;width:calc(var(--ndk-ctl) - 8px);height:calc(var(--ndk-ctl) - 8px);margin-left:3px;border-radius:calc(var(--ndk-rm) * .6);background:var(--ndk-s3) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--ndk-faint)}
.ndk-mp-name{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;color:var(--ndk-value)}
.ndk-mp-name small{color:var(--ndk-faint);margin-right:2px}
.ndk-mp-pop{display:flex;flex-direction:column;min-height:0}
.ndk-strip .tab.mode::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.55;margin-right:6px;vertical-align:middle}
.ndk-sp-box{position:absolute;inset:0;-webkit-backdrop-filter:blur(var(--ndk-field-blur,0px));backdrop-filter:blur(var(--ndk-field-blur,0px));background:var(--ndk-pbg,var(--ndk-s1));border:1px solid var(--ndk-cbd,var(--ndk-border));border-radius:var(--ndk-rl);box-shadow:0 calc(var(--ndk-sh-blur,30px) / 3) var(--ndk-sh-blur,30px) var(--ndk-shadow);overflow:hidden}
.ndk-sp-bar{position:absolute;right:3px;width:6px;border-radius:99px;background:transparent;z-index:2}
.ndk-sp-bar:hover{background:var(--ndk-s2)}
.ndk-sp-bar .thumb{position:absolute;left:1px;right:1px;border-radius:99px;background:var(--ndk-border-strong);cursor:grab}
.ndk-sp-bar .thumb:hover,.ndk-sp-bar .thumb:active{background:var(--ndk-accent)}
.ndk-sp-box.noshadow{box-shadow:none}
.ndk-sp-head{display:flex;align-items:center;gap:8px;width:100%;padding:0 14px 0 10px;border:0;background:transparent;color:var(--ndk-ptitle,var(--ndk-text));font:inherit;font-size:13px;font-weight:600;letter-spacing:.02em;cursor:pointer;text-align:left;user-select:none}
.ndk-sp-head:hover{background:var(--ndk-accent-soft)}
.ndk-sp-head:focus-visible{outline:2px solid var(--ndk-accent-ring);outline-offset:-2px}
.ndk-sp-chev{display:inline-flex;transition:transform .16s ease-out;color:var(--ndk-muted)}
.ndk-sp-box.open .ndk-sp-chev{transform:rotate(90deg)}
.ndk-sp-box.open .ndk-sp-head{border-bottom:1px solid var(--ndk-border)}
.ndk-sp-ic{display:inline-flex;color:var(--ndk-accent)}
.ndk-sp-title{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndk-sp-count{flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:var(--ndk-accent-soft);color:var(--ndk-accent);font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center}
.ndk-page.anim .ndk-w{transition:top .16s ease-out,height .16s ease-out}
.ndk-page.anim .ndk-wi{transition:height .16s ease-out}
.ndk-uimode{position:fixed;inset:0;z-index:1500;background:var(--ndk-stage-bg,#000);overflow:hidden}
.ndk-um-stage{position:absolute;inset:0}
/* the scrollbars of the kit (the same as in ND Show Any Text): a thin rounded thumb, no arrows; the track keeps off the strips of the mode */
.ndk::-webkit-scrollbar,.ndk ::-webkit-scrollbar{width:10px;height:10px}
.ndk::-webkit-scrollbar-track,.ndk ::-webkit-scrollbar-track{background:transparent;margin:var(--ndk-sb-top,6px) 0 var(--ndk-sb-bot,6px)}
.ndk::-webkit-scrollbar-track:horizontal,.ndk ::-webkit-scrollbar-track:horizontal{margin:0 6px}
.ndk::-webkit-scrollbar-thumb,.ndk ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ndk-text,#fff) 22%,transparent);border:3px solid transparent;border-radius:6px;background-clip:padding-box}
.ndk::-webkit-scrollbar-thumb:hover,.ndk ::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,var(--ndk-text,#fff) 38%,transparent)}
.ndk::-webkit-scrollbar-button,.ndk ::-webkit-scrollbar-button,.ndk::-webkit-scrollbar-corner,.ndk ::-webkit-scrollbar-corner{display:none;background:transparent}
@supports not selector(::-webkit-scrollbar){.ndk,.ndk *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.25) transparent}}
.ndk-um-strip{position:absolute;left:0;right:0;height:62px;z-index:4;background:var(--ndk-bar-strip,var(--ndk-stage-bg,#0e1014));-webkit-backdrop-filter:blur(var(--ndk-bar-blur,10px));backdrop-filter:blur(var(--ndk-bar-blur,10px));opacity:0;pointer-events:none;transition:opacity .18s ease-out}
.ndk-um-strip.top{top:0;border-bottom:1px solid var(--ndk-border);box-shadow:0 8px 24px var(--ndk-shadow)}
.ndk-um-strip.bottom{bottom:0;border-top:1px solid var(--ndk-border);box-shadow:0 -8px 24px var(--ndk-shadow)}
.ndk-um-strip.on{opacity:1;pointer-events:auto}
.ndk-um-tabs{position:absolute;z-index:5;height:34px;border:1px solid var(--ndk-bar-bd,var(--ndk-border-strong));border-radius:var(--ndk-bar-r,99px);background:var(--ndk-bar-bg,rgba(14,16,22,.72));-webkit-backdrop-filter:blur(var(--ndk-bar-blur,10px));backdrop-filter:blur(var(--ndk-bar-blur,10px));display:flex;align-items:center;overflow:hidden}
.ndk-um-tabs .tabs{display:flex;gap:2px}
.ndk-um-tabs .tab{border-radius:var(--ndk-bar-r2,99px)}
.ndk-um-tabs .tab:not(.on){color:var(--ndk-bar-fg,var(--ndk-muted))}
.ndk-um-logo{position:absolute;z-index:6;display:flex;align-items:center;gap:var(--ndk-bar-gap,18px);opacity:.7;transition:opacity .2s}
.ndk-um-logo:hover,.ndk-um-logo:focus-within{opacity:1}
.ndk-um-logo.dim:not(:hover):not(:focus-within){opacity:.28}
.ndk-um-logo[data-corner=tl]{left:14px;top:14px}
.ndk-um-logo[data-corner=tr]{right:14px;top:14px;flex-direction:row-reverse}
.ndk-um-logo[data-corner=bl]{left:14px;bottom:14px}
.ndk-um-logo[data-corner=br]{right:14px;bottom:14px;flex-direction:row-reverse}
.ndk-um-logobtn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 10px 0 5px;border:1px solid var(--ndk-bar-bd,var(--ndk-border-strong));border-radius:var(--ndk-bar-r,99px);background:var(--ndk-bar-bg,rgba(14,16,22,.78));color:var(--ndk-bar-fg,#e8eaf0);cursor:pointer;font-weight:600;letter-spacing:.04em;-webkit-backdrop-filter:blur(var(--ndk-bar-blur,10px));backdrop-filter:blur(var(--ndk-bar-blur,10px))}
.ndk-uimode .ndk-um-logobtn{color:var(--ndk-bar-fg,#e8eaf0)}
.ndk-um-logobtn:hover{background:color-mix(in srgb,var(--ndk-bar-bg,#1e222e) 72%,var(--ndk-accent,#7757fa) 28%)}
.ndk-um-logobtn.sw{width:34px;padding:0;justify-content:center}
.ndk-um-save{gap:0;flex-direction:row !important}
.ndk-um-save .ndk-um-logobtn{padding:0 9px;justify-content:center}
.ndk-um-save .ndk-um-logobtn.main{border-radius:var(--ndk-bar-r,99px) 0 0 var(--ndk-bar-r,99px);border-right-width:0;padding-left:11px}
.ndk-um-save .ndk-um-logobtn.more{border-radius:0 var(--ndk-bar-r,99px) var(--ndk-bar-r,99px) 0;padding:0 10px 0 7px}
.ndk-um-save .caret{width:0;height:0;border:4px solid transparent;border-top-color:currentColor;border-bottom-width:0}
.ndk-um-mem{flex-direction:row !important}
.ndk-um-tools{align-items:center}
html.ndk-um-open .p-popover,html.ndk-um-open .p-menu,html.ndk-um-open .p-tieredmenu,html.ndk-um-open .p-select-overlay,html.ndk-um-open .p-contextmenu,html.ndk-um-open [data-reka-popper-content-wrapper],html.ndk-um-open .comfyui-popup{z-index:2147482000 !important}
.ndk-um-tools.plated{padding:var(--tb-pad,4px);border:1px solid var(--ndk-bar-bd,var(--ndk-border-strong));border-radius:var(--ndk-bar-r,99px);background:var(--ndk-bar-bg,rgba(14,16,22,.72));-webkit-backdrop-filter:blur(var(--ndk-bar-blur,10px));backdrop-filter:blur(var(--ndk-bar-blur,10px))}
.ndk-tb-item{display:flex;align-items:center;flex:0 0 auto;position:relative;color:var(--ndk-bar-fg,#e8eaf0)}
.ndk-tb-item.sep{height:22px;justify-content:center}
.ndk-tb-item.sep.line::after{content:"";width:var(--tb-th,1px);border-radius:2px;height:100%;background:var(--tb-bg,rgba(255,255,255,.28));opacity:.9}
.ndk-tb-item.sep.line.has-bg::after{background:var(--tb-bg)}
.ndk-tb-item.sep.line:not(.has-bg)::after{background:rgba(255,255,255,.28)}
.ndk-tb-item.sep.line.acc::after{background:linear-gradient(180deg,transparent,var(--tb-line,var(--ndk-accent,#7757fa)),transparent);box-shadow:0 0 8px var(--tb-line,var(--ndk-accent,#7757fa));opacity:1}
.ndk-tb-item.sep.line.acc.has-bg{--tb-line:var(--tb-bg)}
.ndk-tb-item[data-style=flat] .ndk-um-logobtn{background:none;border-color:transparent;-webkit-backdrop-filter:none;backdrop-filter:none}
.ndk-tb-item.comfy[data-style=pill]{border:1px solid var(--ndk-bar-bd,var(--ndk-border-strong));border-radius:var(--ndk-bar-r,99px);background:var(--ndk-bar-bg,rgba(14,16,22,.78));padding:0 4px;min-height:34px}
.ndk-tb-item.comfy[data-style=pill] button,.ndk-tb-item.comfy[data-style=flat] button{background:transparent !important;border-color:transparent !important;box-shadow:none !important}
.ndk-tb-item.comfy[data-style=flat]{background:none}
.ndk-tb-item.comfy[data-style=flat] button{border:0 !important}
.ndk-tb-item.has-bg:not(.sep){background:var(--tb-bg) !important}
.ndk-tb-item.has-bd:not(.sep){border:1px solid var(--tb-bd) !important}
.ndk-tb-item.has-bd:not(.sep) .ndk-um-logobtn{border-color:var(--tb-bd)}
.ndk-tb-item.has-bg:not(.sep) .ndk-um-logobtn{background:var(--tb-bg)}
.ndk-tb-item.has-fg,.ndk-tb-item.has-fg *{color:var(--tb-fg) !important}
.ndk-tb-item.missing{opacity:.6;border:1px dashed var(--ndk-bar-bd,var(--ndk-border-strong));border-radius:var(--ndk-bar-r,99px);padding:0 10px;min-height:28px;font-size:12px}
.ndk-tb-name{white-space:nowrap}
.ndk-tb-item .ndk-tb-nodrag,.ndk-tb-item .drag-handle,.ndk-tb-item [class*="drag-handle"],.ndk-tb-item [class*="lucide--grip"]{display:none !important}
.ndk-um-mem .ndk-um-logobtn.busy{opacity:.55;cursor:progress}
.ndk-um-mem .ndk-um-logobtn.ok{border-color:#4ade80;color:#4ade80}
.ndk-um-mem .ndk-um-logobtn.err{border-color:#f87171;color:#f87171}
.ndk-um-menu{position:fixed;z-index:2147483000;min-width:210px;padding:6px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(14,16,22,.96);color:#e8eaf0;box-shadow:0 12px 34px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font:13px/1.3 system-ui,sans-serif}
.ndk-um-menu .item{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ndk-um-menu .item:hover,.ndk-um-menu .item:focus-visible{background:rgba(255,255,255,.1);outline:none}
.ndk-um-menu .item .l{flex:1}
.ndk-um-menu .item .h{opacity:.55;font-size:11px}
.ndk-um-menu .ext{padding:6px 10px 3px;opacity:.55;font-size:11px}
.ndk-um-logoimg{width:24px;height:24px;background:center/contain no-repeat}
.ndk-um-sw{position:relative;width:22px;height:12px;border-radius:99px;background:var(--ndk-accent);margin-left:2px}
.ndk-um-sw i{position:absolute;right:2px;top:2px;width:8px;height:8px;border-radius:50%;background:#fff}
.ndk-um-empty{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;color:var(--ndk-muted)}
.ndk-um-empty .t{font-size:14px}
.ndk-um-empty .s{font-size:12.5px;color:var(--ndk-faint)}
.ndk-um-empty .act{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 18px;border:0;border-radius:var(--ndk-rm);background:var(--ndk-accent);color:var(--ndk-on-accent);font-weight:600;cursor:pointer;box-shadow:var(--ndk-glow)}
.ndk-strip .tabs[data-align=center]{justify-content:center}
.ndk-strip .tabs[data-align=right]{justify-content:flex-end}

.ndk-mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;padding:10px;overflow-y:auto;align-content:start;grid-auto-rows:max-content;min-height:0;flex:1 1 auto}
.ndk-mp-card{position:relative;display:flex;flex-direction:column;border:1px solid var(--ndk-cbd,var(--ndk-border));border-radius:calc(var(--ndk-rm) * .8);background:var(--ndk-s2);overflow:hidden;cursor:pointer;text-align:left;padding:0;color:var(--ndk-text);transition:border-color .12s,transform .1s}
.ndk-mp-card:hover{border-color:var(--ndk-accent);transform:translateY(-1px)}
.ndk-mp-card.on{border-color:var(--ndk-accent);box-shadow:0 0 0 2px var(--ndk-accent-ring)}
.ndk-mp-card .pic{aspect-ratio:1;background:var(--ndk-s3) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--ndk-faint)}
.ndk-mp-card .nm{padding:6px 8px 7px;font-size:11.5px;line-height:1.25;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ndk-mp-card .nm small{display:block;color:var(--ndk-faint);font-size:10px}
.ndk-mp-head{display:flex;align-items:center;gap:6px;padding-right:6px}
.ndk-mp-head .ndk-pop-search{flex:1 1 auto}
/* text output */
.ndk-tout{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0}
.ndk-tout-box{flex:1 1 auto;min-height:0;overflow:auto;padding:10px 12px;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);color:var(--ndk-value);white-space:pre-wrap;word-break:break-word;line-height:1.5;user-select:text;cursor:text}
.ndk-tout-box.mono{font-family:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:calc(var(--ndk-fs) - 1px)}
.ndk-tout-box.empty{color:var(--ndk-faint);font-style:italic}
.ndk-tout .copy{position:absolute;right:8px;top:8px;opacity:0;transition:opacity .15s}
.ndk-tout:hover .copy{opacity:1}
/* the full screen */
.ndk-w.hint-drop>.ndk-wi{outline:2px dashed var(--ndk-accent)}
/* tooltip of a widget (props.tip) */
.ndk-tip{position:fixed;z-index:2147483000;display:none;max-width:280px;padding:6px 10px;border-radius:8px;font:12px/1.35 system-ui,sans-serif;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.45);white-space:pre-wrap}
/* the progress bar of the ND UI mode */
.ndk-pbar{position:absolute;left:0;right:0;z-index:7;pointer-events:none;--pb-bgd:var(--pb-bg,rgba(255,255,255,.08))}
.ndk-pbar[data-pos=top]{top:0}.ndk-pbar[data-pos=bottom]{bottom:0}
.ndk-pb-track{position:relative;height:var(--pb-h,6px);background:var(--pb-bg,rgba(255,255,255,.08));overflow:hidden}
.ndk-pbar[data-mode=split] .ndk-pb-fill{position:absolute;left:0;height:50%;background:var(--pb-fill);transition:width .25s ease-out}
.ndk-pbar[data-mode=split] .ndk-pb-fill.a{top:0}.ndk-pbar[data-mode=split] .ndk-pb-fill.b{bottom:0;opacity:.75}
.ndk-pbar[data-mode=single] .ndk-pb-fill{position:absolute;left:0;top:0;bottom:0;background:var(--pb-fill);transition:width .25s ease-out}
.ndk-pbar.glow .ndk-pb-track{overflow:visible}.ndk-pbar.glow .ndk-pb-fill{box-shadow:0 0 10px var(--pb-glow)}
.ndk-pbar.err .ndk-pb-fill{background:#e5484d;box-shadow:none}.ndk-pbar.err .ndk-pb-fill.b{display:none}
.ndk-pb-text{position:absolute;right:12px;font:600 11px/1 system-ui,sans-serif;color:var(--ndk-text,#eee);background:rgba(14,16,22,.78);border:1px solid var(--ndk-border-strong,rgba(255,255,255,.18));padding:4px 8px;border-radius:99px;white-space:nowrap;max-width:60%;overflow:hidden;text-overflow:ellipsis}
.ndk-pbar[data-pos=top] .ndk-pb-text{top:calc(var(--pb-h,6px) + 6px)}.ndk-pbar[data-pos=bottom] .ndk-pb-text{bottom:calc(var(--pb-h,6px) + 6px)}
.ndk-pbar.err .ndk-pb-text{color:#ffb4b6}
/* the blurred surfaces get a layer of their own: the compositor does not redo (and flash) their backdrop every time something behind them is redrawn */
.ndk-panel-box,.ndk-sp-box,.ndk-field,.ndk-um-strip,.ndk-um-tabs,.ndk-um-logobtn,.ndk-um-tools.plated{transform:translateZ(0)}
`;