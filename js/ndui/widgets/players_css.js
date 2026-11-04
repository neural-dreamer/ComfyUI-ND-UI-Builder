// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the styles of the players (added to the kit's style sheet).
export const PLAYER_CSS = `
.ndk-pw{position:relative;display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-height:0}
.ndk-pw>.ndk-media-empty{flex:1 1 auto;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border)}
.ndk-pl{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border-radius:var(--ndk-rl);background:var(--ndk-field-bg);border:1px solid var(--ndk-field-border);overflow:hidden;outline:none}
.ndk-pl:focus-visible{box-shadow:0 0 0 2px var(--ndk-accent)}
.ndk-pl .stage{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.22)}
.ndk-pl.video .stage{background:#000}
.ndk-pl video{width:100%;height:100%;display:block;cursor:pointer}
.ndk-pl canvas.wave{position:absolute;inset:0;width:100%;height:100%;cursor:pointer}
.ndk-pl .big{position:absolute;display:flex;align-items:center;justify-content:center;width:58px;height:58px;border:0;border-radius:50%;background:rgba(10,12,18,.62);color:#fff;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ndk-pl.audio .big{display:none !important}
.ndk-pl .msg{position:absolute;left:10px;right:10px;bottom:10px;padding:6px 10px;border-radius:var(--ndk-rs);background:rgba(10,12,18,.78);color:#fff;font-size:12px;text-align:center}
.ndk-pl .bar{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--ndk-s2)}
.ndk-pl .bar button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:28px;height:28px;padding:0 4px;border:0;border-radius:var(--ndk-rs);background:transparent;color:var(--ndk-muted);cursor:pointer;font:600 11.5px/1 inherit}
.ndk-pl .bar button:hover{background:var(--ndk-accent-soft);color:var(--ndk-accent)}
.ndk-pl .bar button.on{color:var(--ndk-accent)}
.ndk-pl .bar button.play{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-pl .bar button.grip{cursor:grab}
.ndk-pl .time{flex:0 0 auto;font-size:11.5px;color:var(--ndk-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.ndk-pl .track{position:relative;flex:1 1 60px;min-width:40px;height:18px;cursor:pointer;touch-action:none}
.ndk-pl .track::before{content:"";position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;border-radius:99px;background:var(--ndk-field-border)}
.ndk-pl .track .fill{position:absolute;left:0;top:50%;height:4px;margin-top:-2px;border-radius:99px;background:var(--ndk-accent);width:0}
.ndk-pl .track .knob{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.5);left:0}
.ndk-pl .track .tip{position:absolute;bottom:20px;transform:translateX(-50%);padding:1px 6px;border-radius:5px;background:rgba(10,12,18,.85);color:#fff;font-size:10.5px;opacity:0;pointer-events:none}
.ndk-pl .track:hover .tip{opacity:1}
.ndk-pl input.vol{flex:0 0 64px;width:64px;accent-color:var(--ndk-accent)}
.ndk-pw-list{flex:0 0 auto;display:flex;gap:6px;overflow:auto;padding:1px 1px 4px}
.ndk-pw-list.audio{flex-direction:column;max-height:96px}
.ndk-pw-list button{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:4px 8px;border:2px solid transparent;border-radius:calc(var(--ndk-rm) * .7);background:var(--ndk-s2);color:var(--ndk-muted);cursor:pointer;font-size:12px;opacity:.75;text-align:left}
.ndk-pw-list button:hover{opacity:1}
.ndk-pw-list button.on{opacity:1;border-color:var(--ndk-accent)}
.ndk-pw-list.video button{padding:0;height:54px;aspect-ratio:16/10;overflow:hidden}
.ndk-pw-list.video video{width:100%;height:100%;object-fit:cover;pointer-events:none}
.ndk-pw-list button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
