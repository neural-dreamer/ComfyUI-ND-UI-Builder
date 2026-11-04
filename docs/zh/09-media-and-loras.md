# 媒体与 LoRA

## 图片

- **Simple Load Image**：单张图片。拖入文件、从剪贴板粘贴，或从 input 文件夹选择。可配合原版 Load Image 节点使用。
- **Images Input**：一张或多张图片，带预览、顺序和遮罩。需要 Neural Dreamer Nodes 中的 **ND Load Images** 节点。

## 视频与声音

- **视频输入**和**音频输入**加载视频或声音，带播放器和裁剪条。它们需要 **ND Load Video** 和 **ND Load Audio** 节点。
- **视频播放器**和**音频播放器**播放结果。配合 Live Bridge，视频播放器还会在采样器运行时显示画面。

## 文本

**文本输出**显示节点的文本结果。**Show Any As Text** 是 **ND Show Any As Text** 节点的原生外观：*Preview* 标签显示上一次运行的值，其后的标签存放你自己的笔记。

## 模型

**模型选择器**带文件夹和搜索，适用于任何列出模型文件的参数（checkpoint、diffusion model、VAE）。

## LoRA

- **LoRA 堆栈**配合 Neural Dreamer Nodes 的 **ND LoRA Stack** 节点：预览图库（图片或视频）、强度、触发词以及预览的 NSFW 过滤。
- **LoRA 选择器**控制原版 **LoRA Loader** 节点的单个 LoRA：带预览的文件和两个强度。

## 嵌入节点

见 [嵌入节点](10-node-embed.md)。
