// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — styles of the loaders (the view with the trim bar, in the node and in the Video Input / Audio Input widgets).
export const TRIM_CSS = `
.ndk-tvw{width:100%;flex:1 1 auto;min-height:0;overflow:auto;align-self:stretch}
.ndk-w .ndk-body:has(>.ndk-tvw){justify-content:flex-start}
.ndk-tv{position:relative;display:flex;flex-direction:column;gap:8px;width:100%;color:var(--ndk-text);font-size:12px}
.ndk-tv.drop::after{content:"";position:absolute;inset:0;border:2px dashed var(--ndk-accent);border-radius:var(--ndk-rl);background:var(--ndk-accent-soft);pointer-events:none;opacity:.7}
.ndk-tv .ndk-pl{flex:0 0 auto;height:230px}
.ndk-tv.audio .ndk-pl{height:120px}
.ndk-tv.compact .ndk-pl{height:170px}
.ndk-tv.compact.audio .ndk-pl{height:96px}
.ndk-tv-body{display:flex;flex-direction:column;gap:8px}
.ndk-tv-spoiler{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-muted);cursor:pointer;font:inherit;font-size:12px;text-align:left}
.ndk-tv-spoiler:hover{color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-tv-spoiler svg{transition:transform .15s;transform:rotate(-90deg)}
.ndk-tv-spoiler.open svg{transform:none}
.ndk-tv-spoiler b{font-weight:600;color:var(--ndk-text)}
.ndk-tv-spoiler .sum{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
.ndk-tv-spoiler.warn .sum{color:var(--ndk-danger,#f87171)}
.ndk-tv-file{display:flex;gap:6px;align-items:center}
.ndk-tv-sel,.ndk-tv select{min-width:0;height:28px;padding:0 6px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-value);font:inherit;font-size:12px;outline:0}
.ndk-tv-sel{flex:1 1 auto}
.ndk-tv select:focus,.ndk-tv input:focus{border-color:var(--ndk-accent)}
.ndk-tv-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;min-width:28px;height:28px;padding:0 8px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-muted);cursor:pointer;font:600 12px/1 inherit}
.ndk-tv-btn:hover{color:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-tv-btn.on{background:var(--ndk-accent);border-color:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-tv-btn.mark{padding:0;min-width:24px;font-family:ui-monospace,monospace;font-size:14px}
.ndk-tv-note{padding:6px 10px;border-radius:var(--ndk-rs);background:var(--ndk-s2);color:var(--ndk-muted);text-align:center}
.ndk-tv-note.warn{color:var(--ndk-danger,#f87171)}
.ndk-tv-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ndk-tv-f{display:inline-flex;align-items:center;gap:6px;color:var(--ndk-muted)}
.ndk-tv-f input[type=text]{height:26px;padding:0 6px;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:var(--ndk-field-bg);color:var(--ndk-value);font:inherit;font-size:12px;outline:0;text-align:right;font-variant-numeric:tabular-nums}
.ndk-tv-f.chk{cursor:pointer}
.ndk-tv-f.chk input{accent-color:var(--ndk-accent);margin:0}
.ndk-tv-color{width:30px;height:26px;padding:0;border:1px solid var(--ndk-field-border);border-radius:var(--ndk-rs);background:transparent;cursor:pointer}
.ndk-tv-pic{position:absolute;display:none;pointer-events:none;overflow:hidden;touch-action:none}
.ndk-tv-pic.on{pointer-events:auto;cursor:crosshair;outline:1px dashed rgba(255,255,255,.6)}
.ndk-tv-crop{position:absolute;box-shadow:0 0 0 9999px rgba(0,0,0,.55);border:1.5px solid var(--ndk-accent);cursor:move}
.ndk-tv-pic:not(.on) .ndk-tv-crop{cursor:default;pointer-events:none}
.ndk-tv-pic:not(.on) .hd{display:none}
.ndk-tv-crop .hd{position:absolute;width:11px;height:11px;margin:-6px 0 0 -6px;border-radius:3px;background:#fff;border:1.5px solid var(--ndk-accent)}
.ndk-tv-crop .nw{left:0;top:0;cursor:nwse-resize}.ndk-tv-crop .n{left:50%;top:0;cursor:ns-resize}.ndk-tv-crop .ne{left:100%;top:0;cursor:nesw-resize}
.ndk-tv-crop .e{left:100%;top:50%;cursor:ew-resize}.ndk-tv-crop .se{left:100%;top:100%;cursor:nwse-resize}.ndk-tv-crop .s{left:50%;top:100%;cursor:ns-resize}
.ndk-tv-crop .sw{left:0;top:100%;cursor:nesw-resize}.ndk-tv-crop .w{left:0;top:50%;cursor:ew-resize}
.ndk-tv-strip{position:relative;height:44px;border-radius:var(--ndk-rs);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);overflow:hidden;cursor:pointer;touch-action:none;user-select:none}
.ndk-tv.audio .ndk-tv-strip{height:52px}
.ndk-tv-strip canvas.bg{position:absolute;inset:0;width:100%;height:100%}
.ndk-tv-strip .dim{position:absolute;top:0;bottom:0;background:rgba(0,0,0,.58);pointer-events:none}
.ndk-tv-strip .dim.l{left:0}
.ndk-tv-strip .seg{position:absolute;top:0;bottom:0;border-top:2px solid var(--ndk-accent);border-bottom:2px solid var(--ndk-accent);cursor:grab;box-sizing:border-box}
.ndk-tv-strip .seg .hd{position:absolute;top:0;bottom:0;width:8px;background:var(--ndk-accent);cursor:ew-resize;opacity:.95}
.ndk-tv-strip .seg .hd.l{left:0;border-radius:3px 0 0 3px}
.ndk-tv-strip .seg .hd.r{right:0;border-radius:0 3px 3px 0}
.ndk-tv-strip .head{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.7);pointer-events:none}
.ndk-tv-seg{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ndk-tv-len{color:var(--ndk-faint);font-variant-numeric:tabular-nums;margin-left:auto}
.ndk-tv-set{display:flex;gap:6px 12px;align-items:center;flex-wrap:wrap}
.ndk-tv-info{color:var(--ndk-muted);font-variant-numeric:tabular-nums;min-height:16px}
.ndk-tv-info.warn{color:var(--ndk-danger,#f87171)}
`;
