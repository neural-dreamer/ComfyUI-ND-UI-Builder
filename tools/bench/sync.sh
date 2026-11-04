#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Copies the js/ folders of the packs into the bench data folder (ext/<pack>/), flat, as ComfyUI serves them.
# Needs BENCH_DATA; UI_REPO defaults to the repo this file is in; NODES_REPO (optional) is a Neural Dreamer Nodes clone.
set -e
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
UI_REPO="${UI_REPO:-$HERE}"
: "${BENCH_DATA:?set BENCH_DATA to the bench data folder}"
rm -rf "$BENCH_DATA/ext/ComfyUI-NeuralDreamer-UI"; mkdir -p "$BENCH_DATA/ext/ComfyUI-NeuralDreamer-UI"
cp -r "$UI_REPO/js/." "$BENCH_DATA/ext/ComfyUI-NeuralDreamer-UI/"
if [ -n "$NODES_REPO" ]; then
  rm -rf "$BENCH_DATA/ext/ComfyUI-NeuralDreamer-Nodes"; mkdir -p "$BENCH_DATA/ext/ComfyUI-NeuralDreamer-Nodes"
  cp -r "$NODES_REPO/js/." "$BENCH_DATA/ext/ComfyUI-NeuralDreamer-Nodes/"
fi
