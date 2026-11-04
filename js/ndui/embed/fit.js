// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — fitting a panel into a frame. The panel sits in a box inside a scroll area:
//   natural  the size the panel asks for (the area scrolls)        width  as wide as the frame, the height it asks for
//   fill     the panel gets the whole frame                          scale  the panel in its own size, shrunk or grown as a whole
// `zoom` (CSS zoom, not transform: the panels measure themselves with getBoundingClientRect) does the scaling. The properties of the element
// that fit changes are remembered and given back, so what the pack set itself is never overwritten.

const PX = /^(-?\d+(?:\.\d+)?)px$/;

// the size a panel asks for: the profile, the widget's own answer, the inline size of the element, a guess
export function prefSize(node, d, profile) {
    if (profile?.pref) return { w: profile.pref[0], h: profile.pref[1], from: "profile" };
    const w = d?.widget, el = d?.element;
    let pw = 0, ph = 0;
    try {
        const l = w?.computeLayoutSize?.(node);
        if (l) { pw = Number(l.minWidth) || 0; ph = Number(l.minHeight) || 0; }
    } catch {}
    if (!pw || !ph) {
        try {
            const s = w?.computeSize?.(node?.size?.[0] || 300);
            if (Array.isArray(s)) { pw = pw || Number(s[0]) || 0; ph = ph || Number(s[1]) || 0; }
        } catch {}
    }
    if (el) {
        const mh = PX.exec(el.style.height || ""), mw = PX.exec(el.style.width || "");
        if (!ph && mh) ph = +mh[1];
        if (!pw && mw) pw = +mw[1];
    }
    if (profile?.min) { pw = Math.max(pw, profile.min[0]); ph = Math.max(ph, profile.min[1]); }
    return { w: pw || 320, h: ph || 240, from: pw && ph ? "widget" : "guess" };
}

export class Fitter {
    constructor(area, box) {
        this.area = area; this.box = box;
        this.saved = new Map();    // element -> {prop: old value}
        this.k = 1;
    }
    // remember a style property of the element before changing it
    setStyle(el, prop, value) {
        let m = this.saved.get(el);
        if (!m) { m = {}; this.saved.set(el, m); }
        if (!(prop in m)) m[prop] = el.style.getPropertyValue(prop);
        el.style.setProperty(prop, value);
    }
    restore(el) {
        const m = this.saved.get(el);
        if (!m) return;
        for (const [p, v] of Object.entries(m)) { if (v) el.style.setProperty(p, v); else el.style.removeProperty(p); }
        this.saved.delete(el);
    }
    // fw, fh: the size of the frame in its own pixels
    apply(el, pref, fw, fh, { fit = "fill", zoom = 100 } = {}) {
        const area = this.area.style, box = this.box.style;
        const z = Math.max(0.25, Math.min(4, (Number(zoom) || 100) / 100));
        let k = z, bw, bh, hid = false;
        if (fit === "scale") {
            k = Math.min(fw / pref.w, fh / pref.h) * z;
            if (!(k > 0)) k = z;
            bw = pref.w; bh = pref.h; hid = z <= 1;
        } else if (fit === "natural") {
            bw = pref.w; bh = pref.h;
        } else if (fit === "width") {
            bw = Math.max(40, fw / k); bh = pref.h;
        } else {
            bw = Math.max(40, fw / k); bh = Math.max(40, fh / k); hid = true;
        }
        this.k = k;
        box.width = `${bw}px`; box.height = `${bh}px`;
        box.zoom = k === 1 ? "" : String(k);
        area.overflow = hid ? "hidden" : "auto";
        // a panel with a fixed height in pixels (Media Loader, RefMod Stack) is released when it must fill the frame
        if (el) {
            if (fit === "fill") {
                if (PX.test(el.style.height || "") || el.style.minHeight) { this.setStyle(el, "height", "100%"); this.setStyle(el, "min-height", "0"); }
                if (PX.test(el.style.width || "")) this.setStyle(el, "width", "100%");
            } else this.restore(el);
        }
        return { k, bw, bh };
    }
    reset(el) {
        if (el) this.restore(el);
        this.box.style.width = ""; this.box.style.height = ""; this.box.style.zoom = "";
    }
}
