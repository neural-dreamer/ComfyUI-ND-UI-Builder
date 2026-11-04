// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the styles of the Tab panel and of the Show Any As Text widget (added to the kit's style sheet).
export const TABS_CSS = `
.ndk-ts{display:flex;align-items:flex-end;gap:4px;flex:0 0 auto;min-width:0;position:relative;z-index:2}
.ndk-ts-strip{display:flex;align-items:flex-end;gap:2px;overflow-x:auto;overflow-y:hidden;min-width:0;flex:0 1 auto;scrollbar-width:none}
.ndk-ts-strip::-webkit-scrollbar{display:none}
.ndk-ts-tab{display:flex;align-items:center;gap:5px;flex:0 0 auto;box-sizing:border-box;height:30px;padding:0 12px;border:1px solid transparent;border-bottom:none;border-radius:var(--ndk-rs) var(--ndk-rs) 0 0;cursor:pointer;color:var(--ndk-muted);font-size:12.5px;font-weight:500;user-select:none;white-space:nowrap;transition:color .12s,background-color .12s}
.ndk-ts-tab:hover{color:var(--ndk-text);background:color-mix(in srgb,var(--ndk-text) 7%,transparent)}
.ndk-ts-tab.on{color:var(--ndk-text);background:var(--ndk-ts-bg,var(--ndk-s2));border-color:var(--ndk-cbd,var(--ndk-border));box-shadow:inset 0 2px 0 var(--ndk-accent);cursor:default;font-weight:600}
.ndk-ts-tab.pin .ndk-ts-l{font-weight:600}
.ndk-ts-strip.sorting .ndk-ts-tab:not(.dragging){transition:transform .12s}
.ndk-ts-tab.dragging{position:relative;z-index:3;cursor:grabbing;box-shadow:0 4px 12px rgba(0,0,0,.45)}
.ndk-ts-l{max-width:160px;overflow:hidden;text-overflow:ellipsis}
.ndk-ts-x{display:inline-flex;align-items:center;justify-content:center;height:16px;min-width:16px;padding:0 3px;border:0;border-radius:3px;background:transparent;color:inherit;font-size:13px;line-height:1;cursor:pointer;opacity:.6}
.ndk-ts-x:hover{opacity:1;background:color-mix(in srgb,var(--ndk-text) 14%,transparent)}
.ndk-ts-x.armed{opacity:1;background:var(--ndk-danger,#c0392b);color:#fff;font-size:10px;padding:0 5px}
.ndk-ts-rename{width:110px;height:18px;box-sizing:border-box;border:1px solid var(--ndk-accent);border-radius:3px;background:var(--ndk-s2);color:var(--ndk-text);font-size:12px;padding:0 4px}
.ndk-ts-nav,.ndk-ts-add{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:22px;height:22px;margin-bottom:4px;padding:0;border:1px solid var(--ndk-cbd,var(--ndk-border));border-radius:var(--ndk-rs);background:var(--ndk-s2);color:var(--ndk-muted);cursor:pointer;line-height:0}
.ndk-ts-nav:hover:not(:disabled),.ndk-ts-add:hover{border-color:var(--ndk-accent);color:var(--ndk-accent)}
.ndk-ts-nav:disabled{opacity:.3;cursor:default}
.ndk-ts-nav svg,.ndk-ts-add svg{pointer-events:none}
.ndk-tbx{position:absolute;inset:0;display:flex;flex-direction:column}
.ndk-tbx>.ndk-ts{padding:6px 10px 0;border-bottom:1px solid var(--ndk-cbd,var(--ndk-border));margin-bottom:0}
.ndk-tbx .ndk-ts-tab{margin-bottom:-1px}
.ndk-tbx.noshadow{box-shadow:none}
`;

export const SHOWANY_CSS = `
.ndk-sa{position:absolute;inset:0;display:flex;flex-direction:column;box-sizing:border-box;padding:2px}
.ndk-sa-body{position:relative;z-index:1;flex:1 1 auto;min-height:40px;display:flex;margin-top:-1px}
.ndk-sa-text{flex:1 1 auto;width:100%;height:100%;box-sizing:border-box;resize:none;margin:0;padding:8px 10px;border:1px solid var(--ndk-cbd,var(--ndk-border));border-radius:var(--ndk-rs);background:var(--ndk-field-bg,var(--ndk-s2));color:var(--ndk-text);font:inherit;font-size:12.5px;line-height:1.5;outline:none}
.ndk-sa-text:focus{border-color:var(--ndk-accent)}
.ndk-sa-text.pv{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;color:var(--ndk-muted);cursor:text}
.ndk-sa.first .ndk-sa-text{border-top-left-radius:0}
.ndk-sa .ndk-ts-tab.on{background:var(--ndk-field-bg,var(--ndk-s2))}
.ndk-sa-copy{position:absolute;top:8px;right:14px;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:1px solid var(--ndk-border-strong);border-radius:var(--ndk-rs);background:color-mix(in srgb,var(--ndk-bg) 70%,transparent);color:var(--ndk-text);cursor:pointer;line-height:0;opacity:0;pointer-events:none;transition:opacity .12s}
.ndk-sa-body:hover .ndk-sa-copy,.ndk-sa-copy.done{opacity:.7;pointer-events:auto}
.ndk-sa-body:hover .ndk-sa-copy:hover{opacity:1;border-color:var(--ndk-accent)}
.ndk-sa-copy.done{border-color:var(--ndk-success,#3fb950);color:var(--ndk-success,#3fb950);opacity:1}
`;
