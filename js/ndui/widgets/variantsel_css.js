// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — styles of the Variant Preview widget.
export const VARIANTSEL_CSS = `
.ndk-vs{position:relative;display:flex;flex-direction:column;gap:6px;width:100%;height:100%;min-height:0;outline:none}
.ndk-vs .stage{position:relative;flex:1 1 auto;min-height:60px;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);overflow:hidden}
.ndk-vs .stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}
.ndk-vs .cmp{position:absolute;inset:0;display:none;cursor:ew-resize;touch-action:none}
.ndk-vs .cmp-line{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--ndk-accent);pointer-events:none}
.ndk-vs .cmp-line .knob{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ndk-accent);color:var(--ndk-on-accent);font-size:13px}
.ndk-vs .empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px;color:var(--ndk-faint);text-align:center;font-size:12px}
.ndk-vs .badge{position:absolute;left:8px;top:8px;padding:2px 9px;border-radius:99px;background:rgba(10,12,18,.62);color:#fff;font-size:11px;font-weight:600}
.ndk-vs .ndk-live-badge{display:none}
.ndk-vs .tools{position:absolute;right:6px;top:6px;display:flex;gap:4px}
.ndk-vs .tbtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:var(--ndk-rs);background:rgba(10,12,18,.62);color:#fff;cursor:pointer}
.ndk-vs .tbtn:hover,.ndk-vs .tbtn.on{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-vs .tbtn.off{opacity:.7}
.ndk-vs .info{flex:0 0 auto;color:var(--ndk-muted);font-size:11.5px;text-align:center}
.ndk-vs .thumbs{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:2px}
.ndk-vs .th{position:relative;flex:0 0 auto;width:56px;height:56px;border-radius:var(--ndk-rs);overflow:hidden;cursor:pointer;border:2px solid transparent;background:var(--ndk-field-bg)}
.ndk-vs .th img{width:100%;height:100%;object-fit:cover;display:block}
.ndk-vs .th span{position:absolute;left:3px;bottom:2px;padding:0 5px;border-radius:99px;background:rgba(10,12,18,.7);color:#fff;font-size:10px;font-weight:600}
.ndk-vs .th.sel{border-color:var(--ndk-accent)}
.ndk-vs .th.final span{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-vs .bar{flex:0 0 auto;display:flex;align-items:center;gap:8px}
.ndk-vs .sp{flex:1 1 auto}
.ndk-vs .sw{display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:var(--ndk-value);font-size:12.5px}
.ndk-vs .sw input{position:absolute;opacity:0;pointer-events:none}
.ndk-vs .sw .track{position:relative;width:34px;height:18px;border-radius:99px;background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);transition:background .15s}
.ndk-vs .sw .track::after{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--ndk-muted);transition:transform .15s,background .15s}
.ndk-vs .sw input:checked+.track{background:var(--ndk-accent);border-color:var(--ndk-accent)}
.ndk-vs .sw input:checked+.track::after{transform:translateX(16px);background:var(--ndk-on-accent)}
.ndk-vs .up{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 14px;border:0;border-radius:var(--ndk-rs);background:var(--ndk-grad-btn,var(--ndk-accent));color:var(--ndk-on-accent);font:600 12.5px/1 inherit;cursor:pointer}
.ndk-vs .up:disabled{opacity:.45;cursor:default}
.ndk-vs .up.busy{opacity:.7}
`;
