# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""Builds object_info.json for the bench: the person's own export (core + third-party nodes) with the nodes of our packs
(from gen_nd_info.py) laid over it.   python3 merge_object_info.py <exported object_info.json> <out> <nd_info.json> [<nd_info.json> ...]"""
import json, sys
base = json.load(open(sys.argv[1], encoding="utf-8"))
for f in sys.argv[3:]:
    base.update(json.load(open(f, encoding="utf-8")))
json.dump(base, open(sys.argv[2], "w", encoding="utf-8"))
print(len(base), "nodes")
