# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
import sys, importlib
sys.path.insert(0, sys.argv[1])
from ndui_py import ui_node as nd_ui
import ndui_py as nd_nodes
ok = True
def chk(n, c):
    global ok; print(("PASS " if c else "FAIL ") + n); ok = ok and c
N = nd_ui.NDUI
chk("registered in the module", nd_ui.NODE_CLASS_MAPPINGS.get("NDUI") is N)
chk("module is loaded by the pack", "ui_node" in nd_nodes.MODULES)
chk("no inputs", N.INPUT_TYPES() == {"required": {}})
chk("no outputs", tuple(N.RETURN_TYPES) == ())
chk("noop runs", getattr(N(), N.FUNCTION)() in (None, {}, ()))
chk("category", N.CATEGORY.startswith("Neural Dreamer"))
chk("display name", nd_ui.NODE_DISPLAY_NAME_MAPPINGS.get("NDUI") == "ND UI")
sys.exit(0 if ok else 1)
