# Neural Dreamer Nodes

ComfyUI ND UI Builder работает и сам по себе. Парный пак **Neural Dreamer Nodes** добавляет ноды, у которых есть родной виджет в панели. Установите версию **1.3.1 или новее** с [github.com/neural-dreamer/ComfyUI-NeuralDreamer-Nodes](https://github.com/neural-dreamer/ComfyUI-NeuralDreamer-Nodes).

| Нода | Виджет в панели |
|---|---|
| ND Load Images | Images Input |
| ND Load Video | Ввод видео |
| ND Load Audio | Ввод аудио |
| ND LoRA Stack | Стек LoRA |
| ND Show Any As Text | Show Any As Text |
| ND Variant Preview Selector | Превью вариантов |
| ND Slider, ND Resolution | Ползунок, Разрешение (как виртуальные параметры) |

Если виджету нужна нода, которой нет, он подскажет, какой пак поставить.

## Превью вариантов

**ND Variant Preview Selector** показывает пачку картинок, даёт выбрать одну и запускает ветку апскейла кнопкой. Виджет **Превью вариантов** приносит это в панель: миниатюры, переключатель «несколько вариантов», кнопка **Upscale**, живые кадры и сравнение до / после. С нодой он общается через небольшой открытый интерфейс (`node.ndApi`), поэтому нода и панель остаются независимыми.
