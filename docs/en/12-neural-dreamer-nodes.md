# Neural Dreamer Nodes

ComfyUI ND UI Builder works on its own. The companion pack **Neural Dreamer Nodes** adds nodes that have a native widget in the panel. Install version **1.3.1 or newer** from [github.com/neural-dreamer/ComfyUI-NeuralDreamer-Nodes](https://github.com/neural-dreamer/ComfyUI-NeuralDreamer-Nodes).

| Node | Widget in the panel |
|---|---|
| ND Load Images | Images Input |
| ND Load Video | Video Input |
| ND Load Audio | Audio Input |
| ND LoRA Stack | LoRA Stack |
| ND Show Any As Text | Show Any As Text |
| ND Variant Preview Selector | Variant Preview |
| ND Slider, ND Resolution | Slider, Resolution (as virtual parameters) |

If a widget needs a node that is missing, it shows which pack to install.

## Variant Preview

The **ND Variant Preview Selector** shows a batch of images, lets you pick one and starts an upscale branch with a button. The **Variant Preview** widget brings it into the panel: thumbnails, a switch for several variants, the **Upscale** button, live frames and a before / after compare. It talks to the node through a small public interface (`node.ndApi`), so the node and the panel stay independent.
