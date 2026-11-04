# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — ND UI Active: a node that says whether the ND UI mode is on.

The browser knows it (the ND UI mode is a layer over ComfyUI); the server does not. So the browser writes the state into the `active` input of this
node in every prompt it sends (js/ndui/live_mark.js). The input is part of the node, so when the mode is turned on or off the nodes after it run again.
Run from outside the browser (the API), the input keeps the value it has in the saved workflow, off by default.
"""


class NDUIActive:
    CATEGORY = "Neural Dreamer/UI"
    DESCRIPTION = ("True while the ND UI mode is on in the browser, False otherwise. The value is set by the browser at every run (the widget of the node "
                   "shows the state and is not for editing).")
    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("active",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {"optional": {"active": ("BOOLEAN", {"default": False, "label_on": "ND UI on", "label_off": "ND UI off",
                                                       "tooltip": "Set by the browser at every run."})}}

    @classmethod
    def IS_CHANGED(cls, active=False, **kwargs):
        return bool(active)

    def run(self, active=False):
        return (bool(active),)


NODE_CLASS_MAPPINGS = {"NDUIActive": NDUIActive}
NODE_DISPLAY_NAME_MAPPINGS = {"NDUIActive": "ND UI Active"}
