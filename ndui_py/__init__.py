# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""
ComfyUI ND UI Builder — module registry.

Each module lives in ndui_py/<module>.py and may define NODE_CLASS_MAPPINGS and NODE_DISPLAY_NAME_MAPPINGS.
If a module fails to import, the rest of the pack keeps working.
"""

import importlib
import logging

MODULES = [
    "ui_node",
    "models_api",
    "live_bridge",
    "run_target",
    "active_node",
    "media_load",
]

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

for _name in MODULES:
    try:
        _mod = importlib.import_module(f".{_name}", __name__)
        NODE_CLASS_MAPPINGS.update(getattr(_mod, "NODE_CLASS_MAPPINGS", {}))
        NODE_DISPLAY_NAME_MAPPINGS.update(getattr(_mod, "NODE_DISPLAY_NAME_MAPPINGS", {}))
    except Exception:  # noqa: BLE001
        logging.getLogger(__name__).exception("[ComfyUI ND UI Builder] module %r failed to load", _name)
