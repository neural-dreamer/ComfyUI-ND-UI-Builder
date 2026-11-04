// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
export const EMBED_CSS = `
.ndk-emb{position:absolute;inset:0;overflow:auto;border-radius:inherit;scrollbar-width:thin;scrollbar-color:var(--ndk-s3) transparent}
.ndk-emb-box{position:relative;transform-origin:0 0}
.ndk-emb-box>*{max-width:none}
.ndk-emb.noint .ndk-emb-box,.ndk-emb.noint .ndk-emb-mir{pointer-events:none}
.ndk-emb-mir{position:absolute;inset:0;overflow:hidden}
.ndk-emb-layer{position:absolute;inset:0;pointer-events:none;z-index:2}
.ndk-emb-hbox{position:absolute;pointer-events:auto;transform-origin:0 0}
.ndk-emb-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:12px;color:var(--ndk-muted);background:var(--ndk-s1);border:1px dashed var(--ndk-borderStrong,var(--ndk-border));border-radius:inherit;overflow:hidden}
.ndk-emb-card .t{font-size:13px;font-weight:700;color:var(--ndk-text)}
.ndk-emb-card .s{font-size:11px;line-height:1.35;max-width:90%}
.ndk-emb-card svg{color:var(--ndk-accent)}
.ndk-emb-other{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;text-align:center;color:var(--ndk-muted);font-size:12px;background:var(--ndk-s1);border-radius:inherit}
.ndk-emb-other button{font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border-radius:8px;border:1px solid var(--ndk-border);background:var(--ndk-s2);color:var(--ndk-text);cursor:pointer}
.ndk-emb-other button:hover{border-color:var(--ndk-accent);color:var(--ndk-accent)}
.ndk-emb-away{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:24px;font:600 11px system-ui,sans-serif;letter-spacing:.08em;color:#8a93a3;opacity:.7}
`;
