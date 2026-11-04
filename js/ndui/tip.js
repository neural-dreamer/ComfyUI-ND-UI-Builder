// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — custom tooltips: a widget with a text in props.tip shows it after a short hover (never in the editor).
let box = null, timer = 0, cur = null;
const DELAY = 400;

function hide() { clearTimeout(timer); timer = 0; cur = null; if (box) box.style.display = "none"; }
function show(frame) {
    const text = frame.dataset.ndtip;
    if (!text) return;
    if (!box) { box = document.createElement("div"); box.className = "ndk-tip"; document.body.append(box); }
    const cs = getComputedStyle(frame), v = (n, d) => cs.getPropertyValue(n).trim() || d;
    box.style.cssText = `display:block;background:${v("--ndk-s3", "#222")};color:${v("--ndk-text", "#eee")};border:1px solid ${v("--ndk-border-strong", v("--ndk-border", "#444"))}`;
    box.textContent = text;
    const r = frame.getBoundingClientRect(), b = box.getBoundingClientRect();
    let x = r.left + r.width / 2 - b.width / 2, y = r.bottom + 8;
    if (y + b.height > innerHeight - 6) y = r.top - b.height - 8;
    x = Math.max(6, Math.min(innerWidth - b.width - 6, x));
    box.style.left = `${Math.round(x)}px`; box.style.top = `${Math.round(Math.max(6, y))}px`;
}

let installed = false;
export function installTips() {
    if (installed) return;
    installed = true;
    document.addEventListener("pointerover", (e) => {
        const f = e.target?.closest?.("[data-ndtip]");
        if (f === cur) return;
        hide();
        if (!f) return;
        cur = f;
        timer = setTimeout(() => { if (cur === f && f.isConnected) show(f); }, DELAY);
    }, true);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("wheel", hide, { capture: true, passive: true });
    window.addEventListener("blur", hide);
}
