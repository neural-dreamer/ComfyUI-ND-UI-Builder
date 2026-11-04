# Bench: the real ComfyUI frontend against a mock backend

There is no real ComfyUI in the dev container (no torch, no GPU), so the browser side of the pack is tried on the
**real frontend** (ComfyUI_frontend 1.55.18, the version of the author's ComfyUI 0.42.5) with a mock backend written in Node.
Nothing is executed: `/api/prompt` only records the queued prompt in `last_prompt.json`. Real generation is always checked by the person.

Set up (the data folder is not part of the repo):

1. `mkdir bench && cd bench`
2. Frontend: download `dist.zip` from the GitHub release `v1.55.18` of `Comfy-Org/ComfyUI_frontend`, unpack it to `web/`.
3. `object_info.json`: the author's export, `http://127.0.0.1:8188/api/object_info` saved as a file (all core and third-party nodes).
   Nodes of our packs are laid over it: `python3 gen_nd_info.py <repo> ndui_py ComfyUI-NeuralDreamer-UI > nd_info_ui.json`
   (and, for the compatibility tests, `python3 gen_nd_info.py <nodes repo> nd_nodes ComfyUI-NeuralDreamer-Nodes > nd_info_nodes.json`), then
   `python3 merge_object_info.py exported.json object_info.json nd_info_ui.json [nd_info_nodes.json]`.
4. `ext/<pack>/` = a copy of the pack's `js/` folder. `BENCH_DATA=<bench folder> [NODES_REPO=<nodes clone>] tools/bench/sync.sh` does it for both packs (run it after every change).
5. `BENCH_DATA=<bench folder> node tools/bench/server.cjs` (needs the `ws` package) and open `http://127.0.0.1:8188/`.

Extras for tests: `POST /bench/ws` sends any websocket message, `POST /bench/wsbin` a binary preview (type 4 with metadata),
`GET /bench/prompts` lists the recorded prompts, `GET /bench/unknown` the requests the mock did not know.
`boot.py` loads the page and prints the console errors.

## Stage 2 additions
- `/view` answers with a small generated PNG (colour from the file name); `/ndui/models/{folder}` and `/ndui/models/preview` list and show fake models; `/upload/image` echoes the file name.
- Push events with `POST /bench/ws` (executed, progress_state, status, execution_*), binary previews with `POST /bench/wsbin`.
- Tests: `ndui_bench5.py` (events -> widgets), `ndui_bench5b.py` (modes, full view, presets, templates), `ndui_bench5c.py` (editor).
