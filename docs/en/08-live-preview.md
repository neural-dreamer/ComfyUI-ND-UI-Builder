# Live preview

Live preview shows the picture (or the video) while the sampler is still working, inside your panel.

## Viewer

The **Viewer** widget shows the finished images of a node, the live frames of the run, a zoomable view and an **A / B compare** slider. In the settings turn on *live*, *results* or *compare* as you need. While no frame comes, it can show an animated *While it works* mark.

## ND UI Live Bridge

The node **ND UI Live Bridge** (category *Neural Dreamer/UI*) watches the sampler and hands its intermediate picture to the panel. Put it on the **model wire**: model loader (or the last model patch) → **ND UI Live Bridge** → sampler. It passes the model through unchanged and only watches the steps. Its settings:

| Input | What it does |
|---|---|
| `tiny_vae` | how the latent is turned into a picture: `auto`, `latent2rgb`, or a `taesd` file from `vae_approx` |
| `size` | longer side of the live picture, in pixels (default 384) |
| `preview` | `first frame` or `animated` (a short clip of all the frames of a video) |
| `fps` | frame rate of the animated preview |
| `interval` | seconds between two previews; the last step is always shown |
| `max_frames` | the longest clip |
| `audio_vae` | optional: decode the sound of an audio-video model so the preview has sound |

The bridge costs time only while something in the panel (or an **ND UI Live Preview** node) is looking at it. A closed eye or a hidden widget asks for nothing. The preview never takes more than about a quarter of a step.

Sound: the speaker button and the volume slider appear only when the bridge has an `audio_vae`. The sound is off by default.

## ND UI Live Preview

The node **ND UI Live Preview** shows the same live picture on the graph itself. It has one input (`live`, the second output of the Live Bridge) and no settings. The eye, the speaker and the volume are kept in the node.

## Video Player and Audio Player

**Video Player** plays the video of a node and shows the live frames during the run. **Audio Player** plays the sound of a node. See [Widgets](04-widgets.md).

## Variant Preview

With Neural Dreamer Nodes 1.3.1 or newer the **Variant Preview** widget gives you the variants of **ND Variant Preview Selector** right in the panel, with live frames and the Upscale button. See [Neural Dreamer Nodes](12-neural-dreamer-nodes.md).
