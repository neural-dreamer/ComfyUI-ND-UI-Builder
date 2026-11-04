# 常见问题

**看不到 ND UI 和 Edit 按钮。** 用 Ctrl+F5 刷新页面。检查设置 *ComfyUI ND UI Builder → Buttons → Action bar → Show the ND UI and Edit buttons next to Run*。

**控件提示未绑定。** 节点或其标签找不到。打开编辑器的**关联**标签，重新绑定。

**查看器没有实时画面。** 在采样器前的模型连线上放一个 **ND UI Live Bridge**，并确认查看器开启了 *live* 且眼睛是睁开的。ComfyUI 的普通预览不会进入面板。

**没有喇叭按钮。** 桥接需要 `audio_vae`，没有它声音是关闭的。

**控件提示要安装 Neural Dreamer Nodes。** 见 [Neural Dreamer Nodes](12-neural-dreamer-nodes.md)。变体预览需要 1.3.1 或更高版本。

**模式中 ComfyUI 的快捷键不起作用。** 这是有意为之。请在 ComfyUI 设置 *ComfyUI ND UI Builder → ND UI mode* 中放行相应命令。

**在配置较低的电脑上页面卡顿。** 选择没有模糊的主题（午夜、工作室、ComfyUI），或关闭*使用模糊*。

**需要哪个版本的 ComfyUI？** 本插件已在前端 1.55 和 1.57 上测试。更旧的前端可能缺少部分功能。

**点击 Generate 后工作流没有运行。** Generate 会按节点图的原样把工作流加入队列。请检查节点图本身是否有错误（退出模式，看看有无红色节点）。

**面板存放在哪里？** 在工作流文件中，随工作流一起共享。用项目文件（`.ndui`）可把面板与工作流保存为一个文件。

**许可证。** 自由开源软件，采用 GNU AGPL-3.0，见 [LICENSE](../../LICENSE) 和 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。许可证问题：ivan.kvento@gmail.com。
