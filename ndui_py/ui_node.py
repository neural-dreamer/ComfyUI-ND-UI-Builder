# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — the NDUI node

A control panel for the graph. The node has no pins and is never executed: the browser marks it as a
virtual node, so it is not part of the prompt. The interface (see js/ndui_node.js) takes parameters of
other nodes of the graph, puts stylish widgets for them on a page and writes the values back to those nodes.
"""

CATEGORY = "Neural Dreamer/UI"


class NDUI:
    DESCRIPTION = (
        "A control panel for your graph. Mark nodes with a tag in the title, e.g. [prompt], or pick them on the canvas, "
        "bind their parameters to ready-made widgets and arrange the widgets on a page. "
        "The node has no pins and does not run: it only shows and changes the parameters of the nodes it is linked to."
    )
    CATEGORY = CATEGORY
    FUNCTION = "noop"
    RETURN_TYPES = ()
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    def noop(self):
        return ()


NODE_CLASS_MAPPINGS = {"NDUI": NDUI}
NODE_DISPLAY_NAME_MAPPINGS = {"NDUI": "ND UI"}
