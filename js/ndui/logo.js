// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the logo (same style as the ND-ComfyUI-Launcher one): a rounded tile with a gradient rim and "ND".
export const LOGO_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='6' y1='6' x2='58' y2='58' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='#22d3ff'/><stop offset='.5' stop-color='#8b7cf0'/><stop offset='1' stop-color='#f43fd2'/></linearGradient></defs><rect x='5' y='5' width='54' height='54' rx='15' fill='#0a0b12' stroke='url(#g)' stroke-width='4.5'/><path fill='url(#g)' fill-rule='evenodd' d='M13 43V21h5.6l10.2 13.6V21h5.4v22h-5.4L18.4 29.4V43zM37 21h7.2c6.8 0 10.8 4 10.8 11s-4 11-10.8 11H37zM42.4 26v12h1.6c3.6 0 5.5-2.2 5.5-6s-1.9-6-5.5-6z'/></svg>";
export const LOGO_URI = "data:image/svg+xml;utf8," + encodeURIComponent(LOGO_SVG);
