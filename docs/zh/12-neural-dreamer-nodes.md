# Neural Dreamer Nodes

ComfyUI ND UI Builder 可单独使用。配套插件 **Neural Dreamer Nodes** 提供在面板中有原生控件的节点。请从 [github.com/neural-dreamer/ComfyUI-NeuralDreamer-Nodes](https://github.com/neural-dreamer/ComfyUI-NeuralDreamer-Nodes) 安装 **1.3.1 或更高版本**。

| 节点 | 面板中的控件 |
|---|---|
| ND Load Images | Images Input |
| ND Load Video | 视频输入 |
| ND Load Audio | 音频输入 |
| ND LoRA Stack、ND LoRA Stack H3 Temporal | LoRA 堆栈（时间设置：Nodes 1.4.0 或更新版本） |
| ND Show Any As Text | Show Any As Text |
| ND Variant Preview Selector | 变体预览 |
| ND Slider、ND Resolution | 滑块、分辨率（作为虚拟参数） |

如果某个控件需要的节点缺失，它会提示应安装哪个插件。

## 变体预览

**ND Variant Preview Selector** 显示一批图片，让你挑选其中一张，并用按钮启动放大分支。**变体预览**控件把它带入面板：缩略图、多选开关、**Upscale** 按钮、实时画面以及前后对比。它通过一个小型公开接口（`node.ndApi`）与节点通信，因此节点和面板彼此独立。
