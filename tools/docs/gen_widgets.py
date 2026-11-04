# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
# Generates docs/<lang>/04-widgets.md from the widget definitions (the real code) and the interface dictionaries.
# Run on the stand:  python3 tools/docs/gen_widgets.py <repo>/docs
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "bench", "tests"))
sys.path.insert(0, os.path.dirname(__file__))
from lib import start
from widget_texts import T

REPO = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "docs")

p, br, pg, errs = start(1200, 800)
W = pg.evaluate("""async()=>{const M=await import('/extensions/ComfyUI-NeuralDreamer-UI/ndui/widgets/index.js');
 return {groups:M.GROUPS, list:M.WIDGET_LIST.map(w=>({type:w.type,label:w.label,group:w.group,slots:(w.slots||[]).map(s=>({label:s.label,required:!!s.required})),
 props:(w.props||[]).map(q=>({label:q.label,kind:q.kind,def:q.def===undefined?null:q.def,hint:q.hint||''}))}))}}""")
br.close(); p.stop()

def dic(lang):
    if lang == "en": return {}
    return json.load(open(os.path.join(REPO, "js", "i18n", lang + ".json"), encoding="utf-8"))["ui"]

HEAD = {
 "en": ("Widgets", "Every widget of the library, by group. The names are the ones you see in the editor. **Slots** are the parameters (or the node results) the widget is bound to; a slot marked * has to be bound. **Properties** are the settings in the inspector.", ["Inputs", "Run", "Results", "Layout"], {"Inputs": "Inputs", "Run": "Run", "Results": "Results", "Layout": "Layout"}, "Slots", "Properties", "no own settings", "default"),
 "ru": ("Виджеты", "Все виджеты библиотеки по группам. Названия такие же, как в редакторе. **Слоты** — параметры (или результаты ноды), к которым привязан виджет; слот со звёздочкой * привязать нужно. **Свойства** — настройки в инспекторе.", ["Inputs", "Run", "Results", "Layout"], {"Inputs": "Ввод", "Run": "Запуск", "Results": "Результаты", "Layout": "Оформление"}, "Слоты", "Свойства", "собственных настроек нет", "по умолчанию"),
 "zh": ("控件", "控件库中的所有控件，按分组排列。名称与编辑器中显示的一致。**插槽** 是控件所绑定的参数（或节点结果），带 * 的插槽必须绑定。**属性** 是检查器中的设置。", ["Inputs", "Run", "Results", "Layout"], {"Inputs": "输入", "Run": "运行", "Results": "结果", "Layout": "布局"}, "插槽", "属性", "没有单独的设置", "默认"),
}
LI = {"en": 0, "ru": 1, "zh": 2}

for lang in ["en", "ru", "zh"]:
    d = dic(lang); tr = lambda s: d.get(s, s) if s else ""
    title, intro, groups, gname, sl, pr, none, dflt = HEAD[lang]
    out = [f"# {title}\n", intro + "\n"]
    for g in groups:
        out.append(f"## {gname[g]}\n")
        for w in [x for x in W["list"] if x["group"] == g]:
            out.append(f"### {tr(w['label'])}\n")
            out.append(T[w["type"]][LI[lang]] + "\n")
            if w["slots"]:
                out.append(f"**{sl}:** " + ", ".join(tr(s["label"]) + (" \\*" if s["required"] else "") for s in w["slots"]) + "\n")
            if w["props"]:
                rows = []
                for q in w["props"]:
                    v = q["def"]
                    dv = "" if v is None or v == "" else ("on" if v is True else "off" if v is False else str(v))
                    if lang == "ru": dv = dv.replace("on", "вкл").replace("off", "выкл") if dv in ("on", "off") else dv
                    if lang == "zh": dv = {"on": "开", "off": "关"}.get(dv, dv)
                    rows.append(f"| {tr(q['label'])} | {dv} | {tr(q['hint']) if q['hint'] else ''} |")
                out.append(f"**{pr}:**\n\n| | {dflt} | |\n|---|---|---|\n" + "\n".join(rows) + "\n")
            else:
                out.append(f"*{none}*\n")
    os.makedirs(os.path.join(OUT, lang), exist_ok=True)
    open(os.path.join(OUT, lang, "04-widgets.md"), "w", encoding="utf-8").write("\n".join(out))
    print(lang, "ok")
