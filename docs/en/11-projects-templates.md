# Projects and templates

## Projects

A **project** is the whole workflow together with its panel, saved as one file (default type `.ndui`). Files of inputs are kept as references and are not copied into it.

- The floppy button in the top corner of the mode saves (**Save**) and has a small menu: **Save as**, **Open**.
- In Chromium-based browsers the first Save asks where to put the file, later saves write into the same file.
- The setting **ND UI Builder → Project files → Open a project** chooses whether a project opens **in a new tab** (default) or **replaces the current workflow**.
- The corner of the button, its visibility and the file type are set in the *View* section of the page settings.

## Templates

In the editor, the **Templates** tab of the right panel has:

- **Ready-made pages**: four built-in layouts with thumbnails. Press **+** or double-click to add one as a new page.
- **My templates**: your own pages and whole panels. Hover a tile for **+** (apply) and **⋯** (rename, new picture, export, delete).
- **Save as a template**: choose *This page only* or *The whole panel with all its pages*, and the page for the thumbnail.

A template binds to nodes by their `[tag]`, so it works in another workflow that has nodes with the same tags. Nodes that are not found are listed in a message. Applying a whole panel asks for confirmation and can be undone with **Ctrl+Z**. Templates live in the ComfyUI user folder (`user/default/ndui-templates`). **Export** and **Import** move a panel as a `.ndui.json` file.

## Workflow switcher

With several workflows open, press **Alt+Q** (hold Alt, tap Q to step, release Alt to switch; Shift goes back). The cards show a miniature of each ND UI panel or a map of the nodes. A button next to the logo opens the same switcher.

## Run to node

The **Run to node** widget runs the workflow only up to the chosen node. Use it to try the first half of a long workflow.
