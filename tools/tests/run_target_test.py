# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
import sys
sys.path.insert(0, sys.argv[1])
from ndui_py import run_target as R
import ndui_py as pack
ok = True
def chk(n, c):
    global ok; print(("PASS " if c else "FAIL ") + n); ok = ok and c
N = R.NDUIRunTarget
chk("registered", R.NODE_CLASS_MAPPINGS.get("NDUIRunTarget") is N and "run_target" in pack.MODULES)
chk("an output node with no outputs", N.OUTPUT_NODE is True and tuple(N.RETURN_TYPES) == ())
chk("takes anything on one input", N.INPUT_TYPES() == {"required": {"source": ("*",)}})
chk("does nothing", N().run(object()) == ())
chk("hidden from the node search", N.DEPRECATED is True)
chk("id used by the browser", R.NODE_ID == "ndui_run_target")
sys.exit(0 if ok else 1)
