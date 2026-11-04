# 实时预览

实时预览让你在采样器仍在工作时，就在面板中看到图片（或视频）。

## 查看器

**查看器**控件显示节点已完成的图片、运行中的实时画面、可缩放视图以及 **A / B 对比**滑块。在设置中按需开启 *live*、*results* 或 *compare*。在还没有画面时，它可以显示动画图标 *While it works*。

## ND UI Live Bridge

**ND UI Live Bridge** 节点（类别 *Neural Dreamer/UI*）监视采样器，并把它的中间图像交给面板。把它放在**模型连线**上：模型加载器（或最后一个模型补丁）→ **ND UI Live Bridge** → 采样器。它原样传递模型，只观察步骤。设置如下：

| 输入 | 作用 |
|---|---|
| `tiny_vae` | latent 转成图像的方式：`auto`、`latent2rgb`，或 `vae_approx` 中的 `taesd` 文件 |
| `size` | 实时图像的长边像素数（默认 384） |
| `preview` | `first frame` 或 `animated`（由视频所有帧组成的短片段） |
| `fps` | 动画预览的帧率 |
| `interval` | 两次预览之间的秒数；最后一步总会显示 |
| `max_frames` | 最长片段的帧数 |
| `audio_vae` | 可选：解码音视频模型的声音，使预览带声音 |

只有当面板中的某个控件（或 **ND UI Live Preview** 节点）正在查看时，桥接才会耗时。关闭的眼睛或隐藏的控件不会请求任何内容。预览占用的时间不会超过一步的大约四分之一。

声音：只有桥接带有 `audio_vae` 时才会出现喇叭按钮和音量滑块。声音默认关闭。

## ND UI Live Preview

**ND UI Live Preview** 节点直接在节点图上显示同样的实时画面。它有一个输入（`live`，即 Live Bridge 的第二个输出），没有设置。眼睛、喇叭和音量都保存在节点中。

## 视频播放器与音频播放器

**视频播放器**播放节点的视频，并在运行时显示实时画面。**音频播放器**播放节点的声音。见 [控件](04-widgets.md)。

## 变体预览

配合 Neural Dreamer Nodes 1.3.1 或更高版本，**变体预览**控件把 **ND Variant Preview Selector** 的各个变体直接带入面板，并带有实时画面和 Upscale 按钮。见 [Neural Dreamer Nodes](12-neural-dreamer-nodes.md)。
