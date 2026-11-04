#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Copies the web folders of the third-party packs that Node Embed is tried on into the bench data folder (ext/tp-*).
# Needs BENCH_DATA and RECON (a folder with the clones: comfyui-obvpm, comfyui-obvpm-timeline, ComfyUI-Fantastic-MiniMaxH3-PromptBuilder).
# Kept apart from the normal bench: the packs add global listeners, so only ndui_bench20 uses a data folder that has them.
set -e
: "${BENCH_DATA:?set BENCH_DATA to the bench data folder}"
RECON="${RECON:-$HOME/recon}"
for pair in tp-obvpm:comfyui-obvpm tp-timeline:comfyui-obvpm-timeline tp-fantastic:ComfyUI-Fantastic-MiniMaxH3-PromptBuilder; do
  dst="${pair%%:*}"; src="${pair##*:}"
  rm -rf "$BENCH_DATA/ext/$dst"; mkdir -p "$BENCH_DATA/ext/$dst"
  cp -r "$RECON/$src/web/." "$BENCH_DATA/ext/$dst/"
done
echo staged
