// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the memory buttons of the top panel: the same two commands ComfyUI has ("Unload Models", "Unload Models and Execution Cache").
// They ask the server to free the memory (POST /free), the way the ComfyUI buttons do.
import { api } from "../../../scripts/api.js";

/** withCache: also free the execution cache. -> true when the server answered */
export async function freeMemory(withCache) {
    const body = JSON.stringify({ unload_models: true, free_memory: !!withCache });
    const r = await api.fetchApi("/free", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    return !!r && r.ok !== false;
}
