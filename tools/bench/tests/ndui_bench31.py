# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# ND UI bench 31 (pre-release, step 6a): adapt.js — the pure functions of the page that adapts to the width of the window
# (the geometry, the shares of the gaps, stretch / proportional / fixed, the panels and spoilers, 300 random layouts).
import os
from lib import *
p, br, pg, errs = start(1200, 800)
BASE = "/extensions/ComfyUI-NeuralDreamer-UI/ndui/"
src = open(os.path.join(os.path.dirname(__file__), "ndui_bench31.js")).read()
r = pg.evaluate("""async()=>{ const M=await import('%smodel.js'); const A=await import('%sadapt.js'); const f=%s; return f(M,A); }""" % (BASE, BASE, src))
print(r.get("random"))
for f in r["fails"]: check(f, False)
check("all the cases of adapt.js hold", not r["fails"], "; ".join(r["fails"][:5]))
finish(p, br, errs)
