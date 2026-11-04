# Media and LoRAs

## Images

- **Simple Load Image**: one image. Drop a file, paste from the clipboard or choose from the input folder. Works with the stock Load Image node.
- **Images Input**: one or many images with previews, order and mask. Needs the **ND Load Images** node of Neural Dreamer Nodes.

## Video and sound

- **Video Input** and **Audio Input** load a video or a sound with a player and a trim bar. They need the **ND Load Video** and **ND Load Audio** nodes.
- **Video Player** and **Audio Player** play results. With the Live Bridge the Video Player also shows frames while the sampler runs.

## Text

**Text Output** shows a text result of a node. **Show Any As Text** is the native look of the **ND Show Any As Text** node: the *Preview* tab with the value of the last run and your own notes in further tabs.

## Models

**Model Picker** is a model chooser with folders and search, for any parameter that lists model files (checkpoints, diffusion models, VAEs).

## LoRAs

- **LoRA Stack** works with the **ND LoRA Stack** node of Neural Dreamer Nodes: a gallery of previews (images or videos), strengths, trigger words and an NSFW filter for the previews.
- **LoRA Picker** controls one LoRA of a stock **LoRA Loader** node: the file with a preview and the two strengths.

## Node Embed

See [Node Embed](10-node-embed.md).
