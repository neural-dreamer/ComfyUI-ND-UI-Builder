// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — what a LoRA changes in a MiniMax H3 model (the block under the info of a LoRA in the stack of the ND LoRA Stack H3 Temporal node).
// The numbers come from GET /nd/loras/h3info of Neural Dreamer Nodes 1.4.0 (the header of the file is read, nothing else).
import { el } from "../widgets/util.js";
import { api } from "../../../../scripts/api.js";

const GROUP_NAMES = { attn: "Attention", mlp: "Feed-forward", patch_proj: "Input projection", final: "Output", adaln: "Time modulation", refiner: "Text refiner", other: "Other" };
const FIXED_GROUPS = new Set(["adaln", "refiner"]);

// adds the block to `box` (an element of the info popup); it fills itself when the answer comes, and stays empty when there is none
export function h3Block(box, name, tr) {
    const sec = el("div", "ndk-li-sec ndk-h3"); sec.style.display = "none";
    sec.append(el("div", "ndk-li-lab", tr("In MiniMax H3")));
    const body = el("div", "ndk-h3-body"); sec.append(body);
    box.append(sec);
    let gone = false;
    (async () => {
        let i = null;
        try { const r = await api.fetchApi(`/nd/loras/h3info?name=${encodeURIComponent(name)}`); i = r.ok ? await r.json() : null; } catch {}
        if (gone || !i || i.format !== "safetensors") return;
        const kv = el("div", "ndk-h3-kv");
        const item = (k, v) => { const r = el("div"); r.append(el("span", "", `${k}: `), document.createTextNode(String(v))); kv.append(r); };
        item(tr("Layers changed"), i.modules);
        if (i.rank) item(tr("Rank"), i.rank[0] === i.rank[1] ? i.rank[0] : `${i.rank[0]}\u2013${i.rank[1]}`);
        item(tr("Can work in time"), i.timeable);
        item(tr("Always on the whole video"), i.fixed);
        body.append(kv);
        const chips = el("div", "ndk-h3-chips");
        for (const [g, n] of Object.entries(i.groups || {})) chips.append(el("span", `ndk-h3-chip${FIXED_GROUPS.has(g) ? " fixed" : ""}`, `${tr(GROUP_NAMES[g] || g)} \u00b7 ${n}`));
        body.append(chips);
        if (i.match < 50) body.append(el("div", "ndk-h3-warn", tr("This LoRA does not look like a MiniMax H3 LoRA: most of its layers are not in the model.")));
        else if (i.fixed && i.fixed >= i.modules / 2) body.append(el("div", "ndk-h3-warn", tr("Most layers of this LoRA cannot be placed in time, so ranges will change it only a little.")));
        if (i.clip) body.append(el("div", "ndk-h3-note", tr("It also has parts for the text encoder; they work on the whole video.")));
        sec.style.display = "";
    })();
    return () => { gone = true; };
}
