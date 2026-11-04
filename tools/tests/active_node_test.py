# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI Active node: a BOOLEAN out that follows the `active` input the browser writes.
import sys
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
import importlib.util, types
spec = importlib.util.spec_from_file_location("active_node", (sys.argv[1] if len(sys.argv) > 1 else ".") + "/ndui_py/active_node.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
bad = []
def chk(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n, "" if c else x)
    if not c: bad.append(n)
N = m.NDUIActive
chk("a node of the ND UI category with a BOOLEAN output", N.CATEGORY == "Neural Dreamer/UI" and N.RETURN_TYPES == ("BOOLEAN",))
chk("it is registered under NDUIActive with the name ND UI Active", m.NODE_CLASS_MAPPINGS == {"NDUIActive": N} and m.NODE_DISPLAY_NAME_MAPPINGS["NDUIActive"] == "ND UI Active")
chk("the `active` input is optional and false by default", N.INPUT_TYPES()["optional"]["active"][1]["default"] is False and "required" not in N.INPUT_TYPES())
chk("false -> False, true -> True", N().run(False) == (False,) and N().run(True) == (True,) and N().run() == (False,))
chk("IS_CHANGED follows the input, so the nodes after it run again when the mode changes", N.IS_CHANGED(True) != N.IS_CHANGED(False))
sys.exit(1 if bad else 0)
