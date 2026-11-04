# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""object_info entries of a pack (torch, folder_paths, comfy stubbed: only INPUT_TYPES etc. are read).
   python3 gen_nd_info.py <repo folder> <python package folder, e.g. ndui_py or nd_nodes> <pack folder name, e.g. ComfyUI-NeuralDreamer-UI>"""
import sys, types, json, importlib
R, PYDIR, PACK = sys.argv[1], sys.argv[2], sys.argv[3]
class Any(types.ModuleType):
    def __getattr__(self, k):
        if k.startswith("__"): raise AttributeError(k)
        return Any(k)
    def __call__(self, *a, **k): return Any("x")
for m in ["torch", "torch.nn", "torch.nn.functional", "folder_paths", "comfy", "comfy.utils", "comfy.model_management", "server", "node_helpers", "nodes", "comfy_execution", "comfy_execution.graph_utils", "comfy_execution.graph", "latent_preview"]:
    sys.modules[m] = Any(m)
sys.modules["folder_paths"].get_input_directory = lambda: "/tmp"
sys.modules["folder_paths"].get_temp_directory = lambda: "/tmp"
sys.modules["folder_paths"].get_output_directory = lambda: "/tmp"
sys.path.insert(0, R)
pkg = types.ModuleType("ndpkg"); pkg.__path__ = [R + "/" + PYDIR]; sys.modules["ndpkg"] = pkg
out = {}
mods = importlib.import_module("ndpkg").__path__
import os
for f in sorted(os.listdir(R + "/" + PYDIR)):
    if not f.endswith(".py") or f.startswith("__"): continue
    try:
        m = importlib.import_module("ndpkg." + f[:-3])
    except Exception as e:
        print("skip", f, e, file=sys.stderr); continue
    names = getattr(m, "NODE_DISPLAY_NAME_MAPPINGS", {})
    for k, c in getattr(m, "NODE_CLASS_MAPPINGS", {}).items():
        try:
            it = c.INPUT_TYPES()
        except Exception as e:
            print("skip node", k, e, file=sys.stderr); continue
        def clean(d):
            return {n: [str(v[0]) if not isinstance(v[0], list) else v[0], v[1] if len(v) > 1 and isinstance(v[1], dict) else {}] for n, v in (d or {}).items()}
        req, opt = clean(it.get("required")), clean(it.get("optional"))
        rt = [str(x) for x in getattr(c, "RETURN_TYPES", ())]
        out[k] = {"input": {"required": req, **({"optional": opt} if opt else {})}, "input_order": {"required": list(req), **({"optional": list(opt)} if opt else {})},
                  "output": rt, "output_is_list": [False] * len(rt), "output_name": list(getattr(c, "RETURN_NAMES", rt)),
                  "name": k, "display_name": names.get(k, k), "description": getattr(c, "DESCRIPTION", ""), "python_module": "custom_nodes." + PACK,
                  "category": getattr(c, "CATEGORY", ""), "output_node": bool(getattr(c, "OUTPUT_NODE", False))}
json.dump(out, sys.stdout)
