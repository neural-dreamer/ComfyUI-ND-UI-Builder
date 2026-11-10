# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — a control-panel builder for ComfyUI.
https://github.com/neural-dreamer/ComfyUI-NeuralDreamer-UI-Builder
"""

import os

from .ndui_py import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__version__ = "1.1.2"

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]


def _warn_old_nodes_copy():
    # An old test build of Neural Dreamer Nodes carried its own ND UI: two copies would register the NDUI node twice.
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        other = os.path.join(os.path.dirname(here), "ComfyUI-NeuralDreamer-Nodes", "js", "nd_ui.js")
        if os.path.exists(other):
            print("\033[33m[ComfyUI ND UI Builder]\033[0m an old Neural Dreamer Nodes build with its own ND UI is installed "
                  "(js/nd_ui.js): remove that folder and install the current Neural Dreamer Nodes, "
                  "otherwise the NDUI node is registered twice.")
    except Exception:  # noqa: BLE001
        pass


_warn_old_nodes_copy()
print(f"\033[36m[ComfyUI ND UI Builder]\033[0m v{__version__} — loaded {len(NODE_CLASS_MAPPINGS)} node(s)")
