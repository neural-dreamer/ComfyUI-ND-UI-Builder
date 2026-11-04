# Widgets

Every widget of the library, by group. The names are the ones you see in the editor. **Slots** are the parameters (or the node results) the widget is bound to; a slot marked * has to be bound. **Properties** are the settings in the inspector.

## Inputs

### Number

A number field for an INT or FLOAT parameter, with step buttons and optional unit.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Min |  | Narrows the range of the parameter; it cannot go beyond what the node allows. |
| Max |  | Narrows the range of the parameter; it cannot go beyond what the node allows. |
| Step |  | Step of the arrows, the keys and the slider. |
| Decimals |  | Digits after the point. Empty: as the step says. |
| Unit |  | A short text after the value, e.g. px or %. |
| Arrow buttons | on |  |

### Slider

A slider with a value box for INT and FLOAT parameters. Range and step come from the node.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Min |  | Narrows the range of the parameter; it cannot go beyond what the node allows. |
| Max |  | Narrows the range of the parameter; it cannot go beyond what the node allows. |
| Step |  | Step of the arrows, the keys and the slider. |
| Decimals |  | Digits after the point. Empty: as the step says. |
| Unit |  | A short text after the value, e.g. px or %. |
| Show the value | on |  |
| Reset to |  | The value a double click on the slider goes back to. |

### Knob

A round knob for INT and FLOAT parameters.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Min |  | Narrows the range of the parameter; it cannot go beyond what the node allows. |
| Max |  | Narrows the range of the parameter; it cannot go beyond what the node allows. |
| Step |  | Step of the arrows, the keys and the slider. |
| Decimals |  | Digits after the point. Empty: as the step says. |
| Unit |  | A short text after the value, e.g. px or %. |

### Seed

The seed with the Random button and the dice, bound together with the node's "control after generate" parameter.

**Slots:** Seed \*, Control after generate

*no own settings*

### Text

A single-line text field for a STRING parameter.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Placeholder |  | Shown while the field is empty. |
| Clear button | on |  |
| Check spelling | on | The spelling check of the browser. |
| Ctrl+Up / Down changes the weight | on | Select a word or a phrase (or put the cursor in it) and press Ctrl+Up or Ctrl+Down: (word:1.05), as in the text fields of ComfyUI. |

### Prompt

A multi-line text box for prompts: character counter, spell check, and Ctrl+Up / Ctrl+Down to change the weight of the selected words.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Placeholder |  | Shown while the field is empty. |
| Monospace font | off |  |
| Character counter | on |  |
| Check spelling | on | The spelling check of the browser. |
| Ctrl+Up / Down changes the weight | on | Select a word or a phrase (or put the cursor in it) and press Ctrl+Up or Ctrl+Down: (word:1.05), as in the text fields of ComfyUI. |

### Dropdown

A drop-down list for a COMBO parameter (a sampler, a scheduler, a file).

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Placeholder |  | Shown when nothing is chosen. |
| Search | on | A search field above long lists. |

### Segmented

A row of buttons for a COMBO parameter with a few values.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Off text |  | For a true/false parameter. |
| On text |  | For a true/false parameter. |

### Toggle

A switch for a BOOLEAN parameter, or a free switch with its own text.

**Slots:** Value \*

**Properties:**

| | default | |
|---|---|---|
| Text |  | The text next to the switch. Empty: the name of the parameter. |
| Description |  | A small line under the text. |

### Simple Load Image

Loads one image: drop a file, paste or pick from the input folder. Works with a stock Load Image node.

**Slots:** Image \*

**Properties:**

| | default | |
|---|---|---|
| Picture | contain |  |
| File name | on |  |
| List of files | on |  |

### Images Input

Loads one or many images with previews, mask and ordering. Needs the ND Load Images node.

**Slots:** ND Load Images node \*

**Properties:**

| | default | |
|---|---|---|
| Layout | grid |  |
| Mask, crop and settings buttons | on |  |
| Button to add an image | on |  |
| Button to reset the image | on | Back to example.png, without mask, rotation and crop. |
| Button to remove the image | off | Takes the image slot out of the node. |

### Video Input

Loads a video with a player and a trim bar. Needs the ND Load Video node.

**Slots:** ND Load Video node \*

**Properties:**

| | default | |
|---|---|---|
| Controls under a spoiler | on |  |
| Spoiler title |  | Empty: Trim, crop and settings. |

### Audio Input

Loads a sound with a player and a trim bar. Needs the ND Load Audio node.

**Slots:** ND Load Audio node \*

**Properties:**

| | default | |
|---|---|---|
| Controls under a spoiler | on |  |
| Spoiler title |  | Empty: Trim, crop and settings. |

### Node Embed

Shows the own interface of a node (a preview, a mask editor, a custom widget) inside the panel.

**Slots:** Node \*

**Properties:**

| | default | |
|---|---|---|
| Fit | auto |  |
| Zoom, % |  |  |
| Show the node title (mirror) | off |  |
| Colours | comfy |  |
| Own CSS (works only inside this frame) |  |  |
| Check spelling | on | The spelling check of the browser in the text fields of the panel. |
| Ctrl+Up / Down changes the weight | on | In the text fields of the panel: select a word or a phrase and press Ctrl+Up or Ctrl+Down, as in the text fields of ComfyUI. |
| Can be used | on |  |
| Mark the empty place in the node | on |  |

## Run

### Generate

The Run button of the page: queues the workflow, shows the batch count and the Stop button.

**Properties:**

| | default | |
|---|---|---|
| Button text | Generate |  |
| Batch field | on | How many times to queue the workflow with one click. |
| Stop button | on |  |

### Run to node

Runs the workflow only up to the chosen node (like Run to this node in ComfyUI).

**Slots:** Target node \*

**Properties:**

| | default | |
|---|---|---|
| Button text | Run to node |  |
| Show the node name | on |  |
| Batch field | off | How many times to run up to the node with one click. |

### Progress

A progress bar of the run, optionally of one chosen node.

**Slots:** Node

**Properties:**

| | default | |
|---|---|---|
| Show the node name | on |  |
| Show the step count | on |  |

### Queue

The queue counter with the button that clears it.

**Properties:**

| | default | |
|---|---|---|
| Clear button | on |  |

### Resolution

Width and height together: ratio buttons, swap, lock, size presets and the megapixel counter.

**Slots:** Width \*, Height \*

**Properties:**

| | default | |
|---|---|---|
| Size of the model | sdxl | The area that the aspect-ratio buttons aim at. |
| Multiple of | 64 | Sizes are rounded to this number (never below what the node needs). |
| Show the size of the model | on | Off: the button is hidden; the chosen size of the model is still used by the ratio buttons. |
| Show «Multiple of» | on | Off: the button is hidden; the chosen multiple is still used when sizes are rounded. |
| Keep the ratio | off | Changing one side changes the other. |

### Model Picker

A model chooser with folders and search for any COMBO parameter that lists model files.

**Slots:** Model \*

**Properties:**

| | default | |
|---|---|---|
| Folder of models | auto | Where to look for the pictures. Automatic: from the name of the parameter. |

### LoRA Stack

The LoRA stack of Neural Dreamer Nodes with a gallery of previews. Needs the ND LoRA Stack node.

**Slots:** ND LoRA Stack node \*

**Properties:**

| | default | |
|---|---|---|
| Show the CLIP slider | off | Off: the CLIP strength follows the model strength (as long as they are linked). |
| Slider minimum | -1.5 | The same for the model and the CLIP strength. A number typed by hand is never limited. |
| Slider maximum | 1.5 | The same for the model and the CLIP strength. A number typed by hand is never limited. |
| Arrows ◀ ▶ for the strength | on | Step 0.05; hold Shift for a bigger step (0.25). Hold the arrow to repeat. |
| Video previews | hover | For LoRAs whose preview is a video (Neural Dreamer Nodes). Always muted; the first frame stands while it does not play. |

### LoRA Picker

One LoRA of a stock LoRA Loader node: the file with a preview and the two strengths.

**Slots:** LoRA \*, Model strength \*, CLIP strength

*no own settings*

### UI Scale

Scales the whole page up or down while you work.

**Properties:**

| | default | |
|---|---|---|
| Scale, % |  | Empty: the scale of the style (Look → Scale). A page without its own UI Scale uses the first UI Scale of another page. |
| Step | 5 |  |

### Activity

An animated "ND is working" indicator: an icon with an animation, the progress and the step counter. It can show only while ComfyUI works or always.

**Properties:**

| | default | |
|---|---|---|
| Icon | nd |  |
| Text in the icon | ND | Up to 20 characters; Enter starts a new line. |
| Animation | pulse |  |
| Shows | run |  |
| Progress | on |  |
| Step counter | on |  |

## Results

### Viewer

The main result window: shows the finished images, the live frames of the run, a zoomable view and an A / B compare slider.

**Slots:** Frames of, Results of, Picture A, File of picture A, Picture B, File of picture B

**Properties:**

| | default | |
|---|---|---|
| Live preview | off | Shows the frames of the sampler while it works. The eye on the widget turns them off. |
| Results | on |  |
| Compare | off |  |
| Progress | line |  |
| Sound of the live preview | off | Plays the sound of the live clip. The bridge needs preview "animated" and an audio VAE. The speaker button on the widget turns it on and off. |
| Volume, % | 70 |  |
| Silence the preview of ComfyUI | off | While this viewer shows frames of an ND UI Live Bridge, the sampler's own preview (on the node) is switched off for the run. |
| Thumbnails | bottom |  |
| Save button | on | Downloads the picture. A picture can also be pulled out of the page onto the desktop or an image input. |
| Buttons on the picture | on |  |
| While it works (no live frame) | off | An animation over the widget while ComfyUI works and no live picture comes (the live preview is off or not available). |
| Icon | nd |  |
| Text in the icon | ND | Up to 20 characters; Enter starts a new line. |
| Animation | pulse |  |
| Progress | on |  |
| Step counter | on |  |
| Comparison | wipe |  |
| Picture A comes from | previous |  |
| Picture B comes from | result |  |
| Name of A | A |  |
| Name of B | B |  |

### Audio Player

Plays the sound of a node (an audio output).

**Slots:** Sound of

**Properties:**

| | default | |
|---|---|---|
| Play when a new one comes | off |  |
| Loop | off |  |
| Muted | off |  |
| Wave form | on |  |
| List of runs | on |  |
| Save button | on |  |

### Video Player

Plays the video of a node and shows its frames while the run goes on, with sound if the ND UI Live Bridge is on.

**Slots:** Video of, Frames of

**Properties:**

| | default | |
|---|---|---|
| Play when a new one comes | off |  |
| Loop | on |  |
| Muted | off |  |
| Picture | contain |  |
| Runs below | on |  |
| Save button | on |  |
| Live preview | off | Shows the frames of the sampler while it works. The eye on the widget turns them off. |
| Progress | line |  |
| Sound of the live preview | off | Plays the sound of the live clip. The bridge needs preview "animated" and an audio VAE. The speaker button on the widget turns it on and off. |
| Volume, % | 70 |  |
| While it works (no live frame) | off | An animation over the widget while ComfyUI works and no live picture comes (the live preview is off or not available). |
| Icon | nd |  |
| Text in the icon | ND | Up to 20 characters; Enter starts a new line. |
| Animation | pulse |  |
| Progress | on |  |
| Step counter | on |  |
| Silence the preview of ComfyUI | off | While this widget shows frames of an ND UI Live Bridge, the sampler's own preview (on the node) is switched off for the run. |

### Text Output

Shows a text result of a node.

**Slots:** Text of

**Properties:**

| | default | |
|---|---|---|
| Monospace | off |  |
| Copy button | on |  |

### Show Any As Text

Shows the text of the ND Show Any As Text node. Needs Neural Dreamer Nodes.

**Slots:** ND Show Any As Text node \*

**Properties:**

| | default | |
|---|---|---|
| Tabs can be changed | on | In the ND UI: add, rename, delete and move the note tabs. |
| Copy button | on |  |

### Variant Preview

The variants of ND Variant Preview Selector: thumbnails, a switch to take several at once, the Upscale button, live frames and a before / after compare. Needs Neural Dreamer Nodes 1.3.1 or newer.

**Slots:** ND Variant Preview Selector node \*

**Properties:**

| | default | |
|---|---|---|
| Thumbnails | on |  |
| Multi-Variant switch | on | The name of the switch is the one set in the node. |
| Upscale button | on | Shown only while the Upscale button is on in the node. |
| Live preview | on | Shows the frames of the sampler (or of an ND Live Preview Bridge) while the variants are made. It turns the Live preview of the node on. The eye on the widget hides them. |

## Layout

### Panel

A frame that groups the widgets placed on it; they move together.

**Properties:**

| | default | |
|---|---|---|
| Title |  | Shown at the top of the panel. Empty: no title bar. |
| Shadow | on |  |

### Tab panel

A frame with tabs; every tab holds its own widgets.

**Properties:**

| | default | |
|---|---|---|
| Shadow | on |  |

### Spoiler

A frame that folds and unfolds, for rarely used settings.

**Properties:**

| | default | |
|---|---|---|
| Title | Settings |  |
| Icon |  |  |
| Open at the start | off |  |
| Remember open / closed | on | In this browser, for whoever uses the panel. |
| Header height | 0 | 0: by the density of the kit. Otherwise 24 to 72 px. In the editor you can also drag the bottom edge of the spoiler. |
| Inner padding | 12 |  |
| Maximum height when open | 0 | 0: as tall as the content. Taller content scrolls inside the spoiler. |
| Shadow | off |  |

### Heading

A title for a section of the page.

**Properties:**

| | default | |
|---|---|---|
| Text | Heading |  |
| Size | M |  |
| Align | left |  |

### Text block

A block of plain text: a hint or a note.

**Properties:**

| | default | |
|---|---|---|
| Text | A few words about this panel. | Line breaks are kept. **Bold** is supported. |
| Size | M |  |
| Align | left |  |

### Divider

A thin line between groups of widgets.

**Properties:**

| | default | |
|---|---|---|
| Look | line |  |
| Thickness | 1 |  |

### Image

A picture on the page (a logo, a scheme).

**Properties:**

| | default | |
|---|---|---|
| Image |  | Upload a picture (it is stored in the ComfyUI input folder) or paste an address. |
| Fit | cover |  |

### Tabs

The page tabs of the panel, put where you want them.

*no own settings*
