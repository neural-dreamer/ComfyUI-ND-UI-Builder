// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI editor — the look of the editor itself (the chrome around the page). It always uses the Midnight theme of the Kit.
export const EDITOR_CSS = `
.nde{position:fixed;inset:0;z-index:100000;display:grid;grid-template-columns:var(--nde-lw,304px) minmax(0,1fr) var(--nde-rw,332px);grid-template-rows:54px minmax(0,1fr);background:#0a0b0f;color:var(--ndk-text);font-size:13px;user-select:none}
.nde button,.nde input,.nde select,.nde textarea{font:inherit}
.nde-top{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--nde-top,#11131a);border-bottom:1px solid var(--ndk-border);min-width:0}
.nde-brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
.nde-brand i{display:inline-block;width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,var(--ndk-accent),var(--ndk-accent2))}
.nde-pages{display:flex;align-items:center;gap:2px;margin-left:10px;min-width:0;overflow:hidden}
.nde-pages .pg{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--ndk-muted);cursor:pointer;white-space:nowrap}
.nde-pages .pg:hover{background:var(--ndk-accent-soft);color:var(--ndk-text)}
.nde-pages .pg.on{background:var(--ndk-s3);color:var(--ndk-text)}
.nde-sp{flex:1 1 auto}
.nde-btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border:1px solid var(--ndk-border);border-radius:9px;background:var(--ndk-s2);color:var(--ndk-text);cursor:pointer;white-space:nowrap;transition:background-color .12s,border-color .12s}
.nde-btn:hover{background:var(--ndk-s3);border-color:var(--ndk-border-strong)}
.nde-btn.primary{background:var(--ndk-accent);border-color:transparent;color:var(--ndk-on-accent);font-weight:600}
.nde-btn.primary:hover{background:var(--ndk-accent-hi)}
.nde-btn.ghost{background:transparent;border-color:transparent;color:var(--ndk-muted)}
.nde-btn.ghost:hover{background:var(--ndk-accent-soft);color:var(--ndk-text)}
.nde-btn.sm{height:28px;padding:0 10px;font-size:12px}
.nde-btn.on{background:var(--ndk-accent-soft);border-color:var(--ndk-accent);color:var(--ndk-accent)}
.nde-btn.danger:hover{background:rgba(248,113,113,.16);border-color:var(--ndk-danger);color:var(--ndk-danger)}
.nde-btn[disabled],.nde-ibtn[disabled]{opacity:.38;pointer-events:none}
.nde-ibtn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--ndk-muted);cursor:pointer;flex:0 0 auto}
.nde-ibtn:hover{background:var(--ndk-accent-soft);color:var(--ndk-text)}
.nde-ibtn.on{background:var(--ndk-accent-soft);color:var(--ndk-accent)}
.nde-ibtn.danger:hover{background:rgba(248,113,113,.16);color:var(--ndk-danger)}
.nde-zoom{display:flex;align-items:center;gap:2px;color:var(--ndk-muted)}
.nde-zoom > span{min-width:46px;text-align:center;font-variant-numeric:tabular-nums}
.nde-split{position:absolute;top:54px;bottom:0;width:9px;margin-left:-4px;cursor:col-resize;z-index:30;touch-action:none}
.nde-split::after{content:'';position:absolute;left:4px;top:0;bottom:0;width:1px;background:transparent;transition:background .12s,width .12s}
.nde-split:hover::after,.nde-split.drag::after{background:var(--ndk-accent);width:2px;left:3px}
.nde-left,.nde-right{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--nde-side,#11131a)}
.nde-left{border-right:1px solid var(--ndk-border)}
.nde-right{border-left:1px solid var(--ndk-border)}
.nde-tabs{display:flex;padding:8px;gap:4px;border-bottom:1px solid var(--ndk-border)}
.nde-tabs button{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;border:0;border-radius:9px;background:transparent;color:var(--ndk-muted);cursor:pointer;font-weight:500}
.nde-tabs button:hover{color:var(--ndk-text);background:var(--ndk-accent-soft)}
.nde-tabs button.on{background:var(--ndk-s3);color:var(--ndk-text);box-shadow:inset 0 -2px 0 var(--ndk-accent)}
.nde-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:10px}
.nde-scroll::-webkit-scrollbar{width:8px}.nde-scroll::-webkit-scrollbar-thumb{background:var(--ndk-s3);border-radius:8px}
.nde-h{display:flex;align-items:center;gap:8px;margin:2px 0 10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ndk-faint)}
.nde-h .nde-sp{flex:1}
.nde-note{padding:10px 12px;border-radius:10px;background:var(--ndk-s1);border:1px solid var(--ndk-border);color:var(--ndk-muted);line-height:1.5;font-size:12px;margin-bottom:10px;user-select:text}
.nde-center{position:relative;overflow:hidden;background-color:var(--nde-canvas-c,#0a0b0f);background-image:var(--nde-dots,radial-gradient(circle,#1a1d27 1px,transparent 1.2px)),var(--nde-canvas-g,none);background-size:22px 22px,100% 100%;cursor:default;touch-action:none}
.nde-center.pan{cursor:grabbing}
.nde-stage{position:absolute;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 24px 80px rgba(0,0,0,.6);border-radius:var(--page-r,14px)}
.nde-ovl{position:absolute;inset:0;z-index:100000;pointer-events:auto}
.nde-ovl.preview{pointer-events:none}
.nde-gridbg{position:absolute;inset:0;pointer-events:none;opacity:.5}
.nde-sel{position:absolute;box-sizing:border-box;border:1.5px solid var(--ndk-accent);border-radius:3px;pointer-events:none;background:rgba(124,92,255,.05)}
.nde-grp{position:absolute;box-sizing:border-box;border:1.5px solid var(--ndk-accent);border-radius:3px;pointer-events:none}\n.nde-grp .tag{position:absolute;left:-1px;top:-22px;padding:2px 8px;border-radius:5px 5px 5px 0;background:var(--ndk-accent);color:var(--ndk-on-accent);font-size:11px;font-weight:600;white-space:nowrap}\n.nde-sel.multi{border-style:dashed}
.nde-sel.locked{border-color:var(--ndk-warning)}
.nde-sel .tag{position:absolute;left:-1px;top:-22px;padding:2px 8px;border-radius:5px 5px 5px 0;background:var(--ndk-accent);color:var(--ndk-on-accent);font-size:11px;font-weight:600;white-space:nowrap;pointer-events:none}
.nde-h8{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:3px;background:#fff;border:1.5px solid var(--ndk-accent);pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.nde-hover{position:absolute;box-sizing:border-box;border:1px solid var(--ndk-accent);border-radius:3px;pointer-events:none;opacity:.55}
.nde-guide{position:absolute;background:#ff4fa3;pointer-events:none}
.nde-pvw{height:28px;border-radius:8px;border:1px solid var(--ndk-border);background:var(--ndk-s1);color:var(--ndk-text);font-size:12px;padding:0 6px}
.nde-fold{position:absolute;left:0;height:0;border-top:1.5px dashed rgba(255,255,255,.5);pointer-events:none}
.nde-fold span{position:absolute;right:6px;top:-20px;padding:1px 7px;border-radius:5px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;white-space:nowrap}
.nde-lenh{position:absolute;width:76px;height:12px;margin:-6px 0 0 -38px;border-radius:7px;background:#fff;border:1.5px solid var(--ndk-accent);cursor:ns-resize;pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.nde-lenh .tag{position:absolute;left:50%;top:16px;transform:translateX(-50%);padding:2px 8px;border-radius:5px;background:var(--ndk-accent);color:var(--ndk-on-accent);font-size:11px;font-weight:600;white-space:nowrap;pointer-events:none}
.nde-marq{position:absolute;border:1px solid var(--ndk-accent);background:rgba(124,92,255,.12);pointer-events:none}
.nde-sec{border-bottom:1px solid var(--ndk-border);margin:0 -10px;padding:0 10px}
.nde-sec-h{display:flex;align-items:center;justify-content:space-between;width:100%;height:40px;padding:0;border:0;background:transparent;color:var(--ndk-text);font-weight:600;cursor:pointer;letter-spacing:.01em}
.nde-sec-h .ndk-ic{transition:transform .15s;color:var(--ndk-muted)}
.nde-sec.closed .nde-sec-h .ndk-ic{transform:rotate(-90deg)}
.nde-sec.closed .nde-sec-b{display:none}
.nde-sec-b{padding:2px 0 14px;display:flex;flex-direction:column;gap:9px}
.nde-row{display:flex;align-items:center;gap:10px;min-height:30px}
.nde-row>.nde-tg:last-child:not(.nde-lab){flex:0 0 38px;margin-left:auto}
.nde-row.col{flex-direction:column;align-items:stretch;gap:6px}
.nde-lab{flex:0 0 50%;min-width:96px;color:var(--ndk-muted);font-size:12px;line-height:1.25;overflow-wrap:anywhere}
.nde-row>:last-child:not(.nde-lab){flex:1 1 auto;min-width:0}
.nde-in{width:100%;height:30px;padding:0 10px;border:1px solid var(--ndk-border);border-radius:8px;background:var(--ndk-s2);color:var(--ndk-text);outline:0;user-select:text;transition:border-color .12s,box-shadow .12s}
.nde-in:hover{border-color:var(--ndk-border-strong)}
.nde-in:focus{border-color:var(--ndk-accent);box-shadow:0 0 0 3px var(--ndk-accent-ring)}
textarea.nde-in{height:auto;padding:8px 10px;resize:vertical;line-height:1.45}
.nde-select{appearance:none;padding-right:26px;background-image:linear-gradient(45deg,transparent 50%,#a4adbf 50%),linear-gradient(135deg,#a4adbf 50%,transparent 50%);background-position:calc(100% - 15px) 13px,calc(100% - 10px) 13px;background-size:5px 5px;background-repeat:no-repeat;cursor:pointer}
.nde-select option{background:#1d212a;color:#e8eaf0}
.nde-num{position:relative}
.nde-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.nde-pair>.nde-row{min-width:0}
.nde-pair .nde-lab{flex:0 0 auto;min-width:14px}
.nde-seg{display:flex;gap:2px;padding:2px;border-radius:9px;background:var(--ndk-s1);border:1px solid var(--ndk-border)}
.nde-seg button{flex:1 1 0;min-width:0;height:26px;padding:0 6px;border:0;border-radius:7px;background:transparent;color:var(--ndk-muted);cursor:pointer;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-seg button:hover{color:var(--ndk-text)}
.nde-seg button.on{background:var(--ndk-accent);color:var(--ndk-on-accent);font-weight:600}
.nde-tg{position:relative;width:38px;height:22px;padding:0;border:0;border-radius:99px;background:var(--ndk-s3);cursor:pointer;flex:0 0 auto;transition:background-color .15s}
.nde-tg .nde-tg-k{position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.nde-tg.on{background:var(--ndk-accent)}.nde-tg.on .nde-tg-k{transform:translateX(16px)}
.nde-range{display:flex;align-items:center;gap:10px}
.nde-range input{flex:1;appearance:none;height:5px;border-radius:99px;background:linear-gradient(90deg,var(--ndk-accent) var(--p,0%),var(--ndk-s3) var(--p,0%));outline:0}
.nde-range input::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--ndk-accent-ring);cursor:pointer}
.nde-range input::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--ndk-accent-ring);cursor:pointer}
.nde-range-v{min-width:42px;text-align:right;color:var(--ndk-muted);font-variant-numeric:tabular-nums}
.nde-color{display:flex;align-items:center;gap:8px}
.nde-sw{width:34px;height:26px;padding:0;border:1px solid var(--ndk-border-strong);border-radius:7px;background:linear-gradient(var(--c),var(--c)),conic-gradient(#555 25%,#888 0 50%,#555 0 75%,#888 0) 0 0/10px 10px;cursor:pointer;flex:0 0 auto}
.nde-sw.none{background:repeating-linear-gradient(45deg,#2a3040 0 4px,#1d212a 4px 8px)}
.nde-sw-t{flex:1;color:var(--ndk-muted);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-sw-x{width:24px;height:24px}
.nde-colorpop{padding:12px;gap:8px;max-height:none!important}
.nde-colorpop,.nde-colorpop *{user-select:none}
.nde-cp-h{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ndk-faint);margin:4px 0}
.nde-cp-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.nde-cp-c{aspect-ratio:1;border:1px solid var(--ndk-border-strong);border-radius:7px;background:var(--c);cursor:pointer;padding:0}
.nde-cp-c:hover{outline:2px solid var(--ndk-accent)}
.nde-cp-line{display:flex;align-items:center;gap:8px}
.nde-cp-line input[type=color]{width:34px;height:30px;padding:0;border:0;border-radius:7px;background:transparent;cursor:pointer}
.nde-cp-prev{width:30px;height:30px;border-radius:7px;border:1px solid var(--ndk-border-strong);background:linear-gradient(var(--c),var(--c)),conic-gradient(#555 25%,#888 0 50%,#555 0 75%,#888 0) 0 0/10px 10px;flex:0 0 auto}
.nde-cp-reset{margin-top:6px;justify-content:center}
.nde-card{border:1px solid var(--ndk-border);border-radius:11px;background:var(--ndk-s1);margin-bottom:8px;overflow:hidden}
.nde-card.lost{border-color:rgba(248,113,113,.55)}
.nde-card-h{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 12px;cursor:pointer}
.nde-card-h:hover{background:var(--ndk-accent-soft)}
.nde-card-t{flex:1;min-width:0}
.nde-card-t b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-card-t small{display:block;color:var(--ndk-faint);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-dot{width:8px;height:8px;border-radius:50%;background:var(--ndk-success);flex:0 0 auto}
.nde-dot.lost{background:var(--ndk-danger)}.nde-dot.muted{background:var(--ndk-warning)}
.nde-card-b{border-top:1px solid var(--ndk-border);padding:6px;display:flex;flex-direction:column;gap:2px}
.nde-param{display:flex;align-items:center;gap:8px;min-height:34px;padding:0 6px 0 8px;border-radius:8px}
.nde-param:hover{background:var(--ndk-accent-soft)}
.nde-param.used .nde-pn{color:var(--ndk-faint)}
.nde-ty{flex:0 0 auto;min-width:44px;padding:1px 6px;border-radius:5px;background:var(--ndk-s3);color:var(--ndk-muted);font-size:10px;font-weight:700;letter-spacing:.04em;text-align:center}
.nde-ty.INT,.nde-ty.FLOAT{color:#7fb2ff}.nde-ty.STRING{color:#f2c46b}.nde-ty.COMBO{color:#9be0a8}.nde-ty.BOOLEAN{color:#e59be5}
.nde-pn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-pv{flex:0 1 84px;min-width:0;color:var(--ndk-faint);font-size:11.5px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-lib{display:grid;grid-template-columns:repeat(auto-fill,136px);justify-content:start;gap:8px;margin-bottom:14px}
.nde-lib-i{width:136px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:84px;border:1px solid var(--ndk-border);border-radius:11px;background:var(--ndk-s1);color:var(--ndk-muted);cursor:grab;transition:border-color .12s,background-color .12s,color .12s}
.nde-lib-i:hover{border-color:var(--ndk-accent);background:var(--ndk-accent-soft);color:var(--ndk-text)}
.nde-lib-i span{font-size:12px;font-weight:500;text-align:center;line-height:1.25}
.nde-layer{display:flex;align-items:center;gap:6px;height:36px;padding:0 4px 0 8px;border-radius:9px;cursor:pointer;color:var(--ndk-text)}
.nde-layer:hover{background:var(--ndk-accent-soft)}
.nde-layer.on{background:var(--ndk-s3);box-shadow:inset 3px 0 0 var(--ndk-accent)}
.nde-layer .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-layer .nm small{color:var(--ndk-faint);margin-left:6px}
.nde-layer.dim{opacity:.5}
.nde-tools{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:10px;padding:4px;border-radius:10px;background:var(--ndk-s1);border:1px solid var(--ndk-border)}
.nde-ghost{position:absolute;left:0;top:0;pointer-events:none;overflow:hidden;border-radius:inherit;z-index:3}
.nde-ghost .band{position:absolute;left:0;right:0;background:linear-gradient(var(--ndk-accent-soft),transparent);opacity:.55}
.nde-ghost .band.top{top:0;border-bottom:1px dashed var(--ndk-accent)}
.nde-ghost .band.bottom{bottom:0;border-top:1px dashed var(--ndk-accent);background:linear-gradient(transparent,var(--ndk-accent-soft))}
.nde-ghost .ghost{opacity:.8}
.nde-ghost .ndk-um-tools.editable{pointer-events:auto}
.nde-ghost .ndk-um-tools.editable .ndk-tb-item{cursor:grab;pointer-events:auto;border-radius:99px}
.nde-ghost .ndk-um-tools.editable .ndk-tb-item *{pointer-events:none}
.nde-ghost .ndk-tb-item.sel{outline:2px solid var(--ndk-accent);outline-offset:3px}
.nde-ghost .ndk-tb-item.sep{min-width:6px;background:repeating-linear-gradient(90deg,transparent 0 3px,rgba(255,255,255,.07) 3px 4px)}
.nde-ghost .ndk-tb-item.sq{height:34px;min-width:34px;box-sizing:border-box;padding:0 8px;border:1px dashed var(--ndk-border-strong);border-radius:8px;background:rgba(14,16,22,.7);color:var(--ndk-muted);font-size:11px;justify-content:center;overflow:hidden}
.nde-ghost .ndk-tb-item.sq span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-ghost .ndk-tb-item.ph{width:150px;height:34px;border:2px dashed var(--ndk-accent);border-radius:99px;justify-content:center;font-size:12px;color:var(--ndk-accent)}
.nde-ghost .ndk-um-tools.over{outline:2px dashed var(--ndk-accent);outline-offset:4px;border-radius:99px}
.ndk-tb-float.remove{outline:2px solid #f87171;opacity:.5 !important}
.nde-hl-lab{position:fixed;z-index:2147483150;pointer-events:none;padding:3px 8px;border-radius:6px;background:#161920;border:1px solid var(--ndk-accent);color:#e8eaf0;font:12px system-ui,sans-serif;white-space:nowrap}
.nde-ghost .ndk-um-tabs.ghost{position:absolute}
.nde-spread{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.nde-spread-hint{font-size:11.5px;line-height:1.4;color:var(--ndk-faint)}
.nde-spread-f{display:flex;flex-direction:column;gap:6px}
.nde-tools .sep{width:1px;background:var(--ndk-border);margin:4px 3px}
.nde-slot{border:1px solid var(--ndk-border);border-radius:10px;background:var(--ndk-s1);padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.nde-slot.lost{border-color:rgba(248,113,113,.55)}
.nde-slot-h{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ndk-muted)}
.nde-slot-h b{color:var(--ndk-text);font-weight:600}
.nde-slot-b{display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;background:var(--ndk-s2);border:1px solid var(--ndk-border);cursor:pointer;color:var(--ndk-text)}
.nde-slot-b:hover{border-color:var(--ndk-accent)}
.nde-slot-b.empty{color:var(--ndk-faint)}
.nde-slot-b span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nde-pgrp{padding:6px 12px 2px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ndk-faint)}
.nde-themes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.nde-theme{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--ndk-border);border-radius:10px;background:var(--ndk-s1);cursor:pointer;text-align:left;color:var(--ndk-text)}
.nde-theme:hover{border-color:var(--ndk-border-strong)}
.nde-theme.on{border-color:var(--ndk-accent);box-shadow:0 0 0 2px var(--ndk-accent-ring)}
.nde-theme .sw{display:flex;height:22px;border-radius:6px;overflow:hidden}
.nde-theme .sw i{flex:1}
.nde-theme span{font-size:12px;font-weight:500}
.nde-crumbs{position:absolute;left:14px;top:12px;z-index:6;display:flex;align-items:center;gap:6px;padding:5px 8px 5px 5px;border:1px solid var(--ndk-border-strong);border-radius:99px;background:rgba(14,16,22,.82);color:var(--ndk-muted);font-size:12.5px}
.nde-crumbs i{font-style:normal;opacity:.6}
.nde-crumbs .crumb{border:0;background:transparent;color:var(--ndk-muted);font:inherit;padding:2px 4px;border-radius:6px;cursor:pointer}
.nde-crumbs .crumb:hover{color:var(--ndk-text);background:var(--ndk-accent-soft)}
.nde-crumbs .crumb.last{color:var(--ndk-text);font-weight:600;cursor:default}
.nde-layer.drop-in{outline:2px solid var(--ndk-accent);background:var(--ndk-accent-soft)}
.nde-layer .chev{display:inline-flex;width:16px;justify-content:center;color:var(--ndk-muted);cursor:pointer}
.nde-layer .drophint{position:absolute;right:8px;font-size:11px;color:var(--ndk-accent);pointer-events:none}
.nde-pgrp.drop-out{outline:2px solid var(--ndk-accent);border-radius:8px}
.nde-hint{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:2147483200;display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:#161920;border:2px solid var(--ndk-accent,#7757fa);box-shadow:0 0 0 5px rgba(119,87,250,.28),0 12px 40px rgba(0,0,0,.55);color:#e8eaf0;font:13px Inter,system-ui,sans-serif}
.nde-hl{position:fixed;z-index:2147483100;pointer-events:none;border:2px solid #7757fa;border-radius:6px;background:rgba(124,92,255,.14);box-shadow:0 0 0 4px rgba(124,92,255,.2)}
.nde-confirm{position:absolute;inset:0;z-index:100010;display:flex;align-items:center;justify-content:center;background:rgba(5,6,9,.66)}
.nde-confirm>div{display:flex;flex-direction:column;gap:14px;width:min(440px,calc(100% - 32px));box-sizing:border-box;padding:20px;border-radius:14px;background:#161920;border:1px solid var(--ndk-border-strong);box-shadow:0 20px 60px rgba(0,0,0,.6)}
.nde-confirm .acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.nde-confirm .acts .nde-btn{flex:0 1 auto;max-width:100%}
.nde-empty{padding:28px 14px;text-align:center;color:var(--ndk-faint);line-height:1.5}
.ndk-edit .ndk-wi{pointer-events:none}
.ndk-edit .ndk-w{cursor:default;pointer-events:none}
.nde-modelist{display:flex;flex-direction:column;gap:4px;max-height:140px;overflow:auto;padding:6px 8px;border:1px solid var(--nde-border,#2a2f3b);border-radius:8px}
.nde-modeitem{display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer}
.nde-pbwrap{position:relative;height:56px;border:1px solid var(--ndk-border);border-radius:8px;background:var(--ndk-s1);overflow:hidden;flex:1}
.nde-pbsample.ndk-pbar{left:0;right:0}
.nde-pbsample .ndk-pb-text{top:calc(var(--pb-h,6px) + 6px) !important;bottom:auto !important}
.nde-rtabs{padding:6px 8px}
.nde-tpl-h{margin:14px 2px 8px;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ndk-muted)}
.nde-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:10px}
.nde-tpl{display:flex;flex-direction:column;gap:6px;min-width:0}
.nde-tpl-pic{position:relative;display:flex;align-items:center;justify-content:center;height:104px;border-radius:10px;background:#0c0e13;border:1px solid var(--ndk-border);overflow:hidden;cursor:default}
.nde-tpl-pic.big{height:150px;cursor:default}
.nde-tpl:hover .nde-tpl-pic{border-color:var(--ndk-accent)}
.nde-tpl-act{position:absolute;right:4px;top:4px;display:flex;gap:3px;opacity:0;transition:opacity .12s}
.nde-tpl:hover .nde-tpl-act,.nde-tpl-act:focus-within{opacity:1}
.nde-tpl-act .nde-ibtn{background:rgba(14,16,22,.85);border:1px solid var(--ndk-border-strong)}
.nde-tpl-meta{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.nde-tpl-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.nde-tpl-badge{flex:0 0 auto;font-size:10px;padding:1px 6px;border-radius:99px;background:var(--ndk-s3);color:var(--ndk-muted)}
.nde-tmenu{position:absolute;right:4px;top:34px;z-index:20;display:flex;flex-direction:column;gap:2px;padding:4px;border-radius:10px;background:#1a1d26;border:1px solid var(--ndk-border-strong);box-shadow:0 10px 30px rgba(0,0,0,.5);min-width:150px}
.nde-tmenu .nde-btn{justify-content:flex-start;width:100%}
.nde-wgrp{position:absolute;box-sizing:border-box;border:1.5px dashed var(--ndk-accent);border-radius:8px;pointer-events:none;opacity:.9}
.nde-wgrp.in{border-style:solid;opacity:.55}
.nde-wgrp .tag{position:absolute;left:0;top:-20px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 8px;border-radius:6px 6px 0 0;background:var(--ndk-accent);color:var(--ndk-on-accent,#fff);font:600 11px/16px system-ui,sans-serif}
.nde-layer.grp .nm{font-weight:600}
.nde-layer.in-grp{border-left:2px solid var(--ndk-accent-soft)}
.nde-layer.drop-above{box-shadow:inset 0 2px 0 var(--ndk-accent)}
.nde-layer.drop-below{box-shadow:inset 0 -2px 0 var(--ndk-accent)}
.nde-layer.drop-in{background:var(--ndk-accent-soft);outline:1px dashed var(--ndk-accent)}
`;
