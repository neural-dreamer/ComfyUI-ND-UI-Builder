// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI embed — who owns a DOM panel right now. One element can sit in one place only, so every view that wants it makes a claim;
// the claim with the highest priority that is visible gets it (run mode 3 > editor preview 2 > panel in the NDUI node 1).
// A claim is {id, prio, want(): bool, grant(), revoke(why)}.

const keys = new Map();   // key -> {claims: Set, owner}
let seq = 0;

export const PRIO = { uimode: 3, editor: 2, node: 1 };

function entry(key) {
    let e = keys.get(key);
    if (!e) { e = { claims: new Set(), owner: null }; keys.set(key, e); }
    return e;
}

export function claim(key, o) {
    const c = { id: ++seq, key, prio: o.prio || 1, boost: false, want: o.want || (() => true), grant: o.grant || (() => {}), revoke: o.revoke || (() => {}) };
    entry(key).claims.add(c);
    reconcile(key);
    return c;
}

export function release(c) {
    const e = keys.get(c.key);
    if (!e) return;
    e.claims.delete(c);
    if (e.owner === c) { e.owner = null; try { c.revoke("released"); } catch {} }
    if (!e.claims.size) keys.delete(c.key); else reconcile(c.key);
}

// the best visible claim wins; a boosted one ("Show here") beats the priorities until it stops being wanted
export function reconcile(key) {
    const e = keys.get(key);
    if (!e) return null;
    let best = null;
    for (const c of e.claims) {
        let want = false;
        try { want = !!c.want(); } catch {}
        if (!want) { c.boost = false; continue; }
        if (!best || (c.boost && !best.boost) || (c.boost === best.boost && (c.prio > best.prio || (c.prio === best.prio && c.id > best.id)))) best = c;
    }
    if (e.owner === best) return best;
    const old = e.owner;
    e.owner = best;
    if (old) { try { old.revoke(best ? "taken" : "hidden"); } catch {} }
    if (best) { try { best.grant(); } catch (err) { console.warn("[ND UI] embed grant failed", err); } }
    return best;
}

export const ownerOf = (key) => keys.get(key)?.owner || null;
export const isOwner = (c) => keys.get(c.key)?.owner === c;
export function boost(c) { c.boost = true; reconcile(c.key); }
export const debugClaims = () => [...keys].map(([k, e]) => ({ key: k, owner: e.owner?.prio ?? null, claims: [...e.claims].map((c) => c.prio) }));
