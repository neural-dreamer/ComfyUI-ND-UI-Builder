// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — styles of the image inputs (Simple Load Image, Image Input).
export const IMGIN_CSS = `
.ndk-si{position:relative;display:flex;flex-direction:column;gap:6px;width:100%;height:100%;min-height:0;outline:none}
.ndk-si .stage{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);overflow:hidden;cursor:pointer}
.ndk-si.off .stage{cursor:default;opacity:.7}
.ndk-si:focus-visible .stage{box-shadow:0 0 0 2px var(--ndk-accent)}
.ndk-si.drop .stage{border-color:var(--ndk-accent);background:var(--ndk-accent-soft)}
.ndk-si img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}
.ndk-si .empty{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:86%;padding:10px;color:var(--ndk-faint);text-align:center;font-size:12px;line-height:1.35}
.ndk-si .empty.warn{color:var(--ndk-danger,#f87171)}
.ndk-si .busy{position:absolute;left:8px;bottom:8px;padding:3px 10px;border-radius:99px;background:rgba(10,12,18,.78);color:#fff;font-size:11.5px}
.ndk-si .bar{flex:0 0 auto;display:flex;align-items:center;gap:6px}
.ndk-si .fname{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ndk-muted);font-size:12px}
.ndk-si .btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;min-width:28px;height:28px;padding:0 8px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-muted);cursor:pointer;font:600 12px/1 inherit}
.ndk-si .btn:hover{color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-us{display:flex;align-items:center;gap:10px;width:100%}
.ndk-us input[type=range]{flex:1 1 auto;min-width:40px;accent-color:var(--ndk-accent)}
.ndk-us .num{flex:0 0 58px;width:58px;height:28px;padding:0 6px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-value);font:inherit;font-size:12px;text-align:right;outline:0;font-variant-numeric:tabular-nums}
.ndk-us .num:focus{border-color:var(--ndk-accent)}
.ndk-us .rst{flex:0 0 auto;height:28px;padding:0 8px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-muted);cursor:pointer;font:600 11.5px/1 inherit}
.ndk-us .rst:hover{color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-ii{display:flex;flex-direction:column;gap:6px;width:100%;height:100%;min-height:0;outline:none}
.ndk-ii .cards{flex:1 1 auto;min-height:0;display:grid;gap:6px;grid-auto-rows:minmax(0,1fr)}
.ndk-ii .card{position:relative;display:flex;flex-direction:column;gap:5px;min-width:0;min-height:0;padding:6px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rl);background:var(--ndk-field-bg)}
.ndk-ii.tabs>.card{flex:1 1 auto}
.ndk-ii .card.drop{border-color:var(--ndk-accent);background:var(--ndk-accent-soft)}
.ndk-ii .card.off>:not(.head){opacity:.4}
.ndk-ii .head{display:flex;align-items:center;gap:4px;flex:0 0 auto;height:26px}
.ndk-ii .title{font-weight:600;font-size:12px;color:var(--ndk-value);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ndk-ii .sp{flex:1 1 auto}
.ndk-ii .dot{flex:0 0 auto;width:14px;height:14px;margin:0 3px;padding:0;border-radius:50%;border:2px solid var(--ndk-muted);background:transparent;cursor:pointer}
.ndk-ii .dot.on{background:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-ii .ibtn{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:var(--ndk-rs);background:transparent;color:var(--ndk-muted);cursor:pointer}
.ndk-ii .ibtn:hover,.ndk-ii .ibtn.has,.ndk-ii .ibtn.on{color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-ii .ibtn.reset{opacity:.5}
.ndk-ii .ibtn.reset.dirty{opacity:1}
.ndk-ii .view{position:relative;flex:1 1 auto;min-height:30px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--ndk-rs);background:rgba(0,0,0,.25);cursor:pointer}
.ndk-ii .view canvas{display:block}
.ndk-ii .view .eye{position:absolute;top:4px;left:4px;background:rgba(0,0,0,.55);color:#fff}
.ndk-ii .missing{position:absolute;inset:auto 6px;text-align:center;font-size:11px;color:var(--ndk-faint)}
.ndk-ii .fname{position:absolute;left:4px;bottom:4px;max-width:calc(100% - 8px);padding:1px 6px;border-radius:3px;background:#000a;color:#fff;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;pointer-events:none;transition:opacity .12s}
.ndk-ii .view:hover .fname{opacity:1}
.ndk-ii .keep{flex:0 0 auto;height:26px;padding:0 4px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-value);font-size:12px}
.ndk-ii .addcard{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px dashed var(--ndk-field-border);border-radius:var(--ndk-rl);background:transparent;color:var(--ndk-faint);cursor:pointer;font-size:12px}
.ndk-ii .addcard:hover{color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-ii .strip{display:flex;gap:4px;flex:0 0 auto;flex-wrap:wrap}
.ndk-ii .tabbtn,.ndk-ii .plus{min-width:30px;height:28px;padding:0 8px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-muted);cursor:pointer;font:600 12px/1 inherit;display:inline-flex;align-items:center;justify-content:center}
.ndk-ii .tabbtn.act{background:var(--ndk-accent);border-color:var(--ndk-accent);color:#fff}
.ndk-ii .tabbtn.off{opacity:.5}
.ndk-ii .plus:hover{color:var(--ndk-accent);border-color:var(--ndk-accent)}
`;
