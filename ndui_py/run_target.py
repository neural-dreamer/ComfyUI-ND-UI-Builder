# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — the helper node of the "Run to node" widget (internal).

ComfyUI can run a workflow only up to an OUTPUT node (Save Image, Preview...). To stop at any node (a sampler, a VAE Decode...), the
browser adds this node to the prompt it sends, wires it to the chosen node and asks ComfyUI to run only up to this helper. The helper
does nothing itself. It is never part of a saved workflow: it exists only in the prompt of that one run.
"""

NODE_ID = "ndui_run_target"


class NDUIRunTarget:
    CATEGORY = "Neural Dreamer/UI"
    DESCRIPTION = "Internal helper of the Run to node widget of ND UI. Not for the graph."
    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    DEPRECATED = True  # keeps it out of the node search: it is only added to prompts by ND UI

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"source": ("*",)}}

    def run(self, source=None):
        return ()


NODE_CLASS_MAPPINGS = {"NDUIRunTarget": NDUIRunTarget}
NODE_DISPLAY_NAME_MAPPINGS = {"NDUIRunTarget": "ND UI Run Target (internal)"}
