// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the styles of the Viewer widget (added to the kit's style sheet).
export const VIEWER_CSS = `
.ndk-viewer.right{flex-direction:row}
.ndk-vw-layer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.ndk-vw-layer>img{max-width:100%;max-height:100%}
.ndk-media-main video.ndk-vw-live{position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;background:transparent}
.ndk-vw-tools .ndk-vw-vol{width:84px;height:18px;margin:0 4px;align-self:center;accent-color:var(--ndk-accent);opacity:0;transition:opacity .25s;pointer-events:none}
.ndk-media-main:hover .ndk-vw-tools .ndk-vw-vol{opacity:1;pointer-events:auto}
.ndk-media-main img.ndk-vw-live{position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;cursor:zoom-in}
.ndk-viewer .ndk-live-badge{top:auto;bottom:14px}
.ndk-vw-step{position:absolute;right:8px;bottom:12px;padding:2px 9px;border-radius:99px;background:rgba(10,12,18,.62);color:#fff;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ndk-vw-hint{position:absolute;left:8px;right:8px;bottom:36px;padding:6px 10px;border-radius:var(--ndk-rs);background:rgba(10,12,18,.72);color:#fff;font-size:11.5px;line-height:1.35;text-align:center;pointer-events:none}
.ndk-vw-tabs{position:absolute;left:8px;top:8px;display:flex;gap:2px;padding:2px;border-radius:var(--ndk-rs);background:rgba(10,12,18,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ndk-vw-tabs button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:24px;border:0;border-radius:calc(var(--ndk-rs) - 2px);background:transparent;color:rgba(255,255,255,.7);cursor:pointer}
.ndk-vw-tabs button.on{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-media-tools.ndk-vw-tools{opacity:1}
.ndk-vw-tools button{opacity:0;transition:opacity .25s}
.ndk-media-main:hover .ndk-vw-tools button{opacity:1}
.ndk-vw-tools.keep button.eye{opacity:1;background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-viewer .ndk-media-strip .cell{position:relative;flex:0 0 auto;height:54px;aspect-ratio:1}
.ndk-viewer .ndk-media-strip .cell button{width:100%;height:100%}
.ndk-viewer .ndk-media-strip .cell.on button{opacity:1;border-color:var(--ndk-accent)}
.ndk-viewer.right .ndk-media-strip{flex-direction:column;overflow-x:hidden;overflow-y:auto;padding:1px 4px 1px 2px}
.ndk-viewer .ndk-media-strip .ab{position:absolute;right:2px;bottom:2px;display:flex;gap:2px}
.ndk-viewer .ndk-media-strip .ab i{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:rgba(10,12,18,.72);color:#fff;font:700 10px/1 sans-serif;font-style:normal;cursor:pointer}
.ndk-viewer .ndk-media-strip .ab i.on{background:var(--ndk-accent);color:var(--ndk-on-accent)}
.ndk-vw-side{display:grid;grid-template-columns:1fr 1fr;gap:4px;width:100%;height:100%;padding:4px}
.ndk-vw-side .cell{position:relative;min-width:0;min-height:0}
.ndk-vw-side .cell img{width:100%;height:100%;object-fit:contain;display:block;cursor:zoom-in}
.ndk-vw-side .tag{position:absolute;left:6px;top:6px;padding:2px 9px;border-radius:99px;background:rgba(10,12,18,.62);color:#fff;font-size:11px;font-weight:600;pointer-events:none}
.ndk-media-main.ndk-pwl{position:absolute;inset:0;z-index:2;border:0;border-radius:0;background:#000}
.ndk-pwl-tools{position:absolute;inset:0;z-index:3;pointer-events:none}
.ndk-lpn:hover .ndk-vw-tools button{opacity:1}
.ndk-lpn:hover .ndk-vw-tools .ndk-vw-vol{opacity:1;pointer-events:auto}
.ndk-lpn .ndk-media-tools{opacity:1}
.ndk-lpn{position:relative;width:100%;height:100%;min-height:150px;background:#000;border-radius:8px;overflow:hidden}
.ndk-lpn-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;color:var(--ndk-muted,#8b94a7);font:12px/1.4 system-ui,sans-serif}
.ndk-pwl-tools .ndk-media-tools{pointer-events:auto}
.ndk-pl:hover .ndk-vw-tools button{opacity:1}
.ndk-pl:hover .ndk-vw-tools .ndk-vw-vol{opacity:1;pointer-events:auto}
.ndk-pl .ndk-act.layer{z-index:2}
`;
