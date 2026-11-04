#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
"""Translations of the interface of ND UI (js/i18n/<lang>.json, section "ui": {"English text": "translation"}).

  python3 tools/i18n_tool.py keys                 how many strings the interface has
  python3 tools/i18n_tool.py check                every string translated, same {placeholders}, nothing stale
  python3 tools/i18n_tool.py todo <lang> [file]   write what is missing as JSON {"English": ""} (stdout or a file)
  python3 tools/i18n_tool.py merge <lang> <file>  put the translations of such a file into js/i18n/<lang>.json

The English strings are the ones of the code (tools/i18n_keys.cjs reads js/ndui with acorn).
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, "js", "i18n")
LANGS = ("ru", "zh")
PLACEHOLDER = re.compile(r"\{(\w+)\}")
LETTERS = re.compile(r"[^\W\d_]", re.U)
KEEP = {"ND", "LoRA", "VAE", "CFG", "RAM", "px", "fps", "W", "H", "X", "Y", "UI", "LIVE", "A", "B", "CLIP", "ComfyUI", "ControlNet", "English", "Flux / SD3 · 1024", "SD 1.5 · 512", "SDXL · 1024", "Images Input", "Inter", "UI Scale", "Simple Load Image", "LoRA", "Seed"}  # may stay as they are


def english():
    out = subprocess.run(["node", os.path.join(ROOT, "tools", "i18n_keys.cjs")], capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr)
    return json.loads(out.stdout)["ui"]


def load(lang):
    p = os.path.join(I18N, f"{lang}.json")
    try:
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
    except FileNotFoundError:
        d = {}
    d.setdefault("ui", {})
    return d


def save(lang, d):
    d["ui"] = dict(sorted(d["ui"].items()))
    with open(os.path.join(I18N, f"{lang}.json"), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write("\n")


def check():
    en = english()
    bad = 0
    for lang in LANGS:
        ui = load(lang)["ui"]
        miss = [s for s in en if s not in ui and s not in KEEP]
        stale = [s for s in ui if s not in en]
        hold = [s for s in en if s in ui and set(PLACEHOLDER.findall(s)) != set(PLACEHOLDER.findall(ui[s]))]
        same = [s for s in en if s in ui and ui[s] == s and len(s) > 3 and s not in KEEP and LETTERS.search(s)]
        for name, lst in (("missing", miss), ("stale", stale), ("placeholders differ", hold), ("not translated", same)):
            if lst:
                bad += len(lst) if name != "stale" else 0
                print(f"[{lang}] {name}: {len(lst)}")
                for s in lst[:8]:
                    print("   ", s[:110])
    print("OK" if not bad else f"{bad} problem(s)")
    return 1 if bad else 0


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "keys":
        print(len(english()))
    elif cmd == "check":
        sys.exit(check())
    elif cmd == "todo":
        lang = sys.argv[2]
        ui = load(lang)["ui"]
        todo = {s: "" for s in english() if s not in ui and s not in KEEP}
        text = json.dumps(todo, ensure_ascii=False, indent=1)
        if len(sys.argv) > 3:
            open(sys.argv[3], "w", encoding="utf-8").write(text)
            print(len(todo), "to translate ->", sys.argv[3])
        else:
            print(text)
    elif cmd == "merge":
        lang, path = sys.argv[2], sys.argv[3]
        add = json.load(open(path, encoding="utf-8"))
        d = load(lang)
        n = 0
        for k, v in add.items():
            if isinstance(v, str) and v.strip():
                d["ui"][k] = v; n += 1
        save(lang, d)
        print(n, "merged into", lang)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
