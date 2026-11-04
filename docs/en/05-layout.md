# Layout

## Pages and size

A panel has one or more **pages**; the page names appear as tabs along the top of the mode. In the page settings you set the **proportions** (16:9, 4:3, free, and so on), the **width and height** in the editor, the **corner radius** and the **length**: a length larger than the window makes the page scroll, **0 (auto)** fits the content.

**In the window** chooses how the page behaves in the ND UI mode:

- **Proportions**: the page keeps its proportions and is scaled to fit.
- **Fill the window**: the page is stretched to the window.
- **Adapt to the window**: the page keeps the size of its widgets and spreads the free space between them; big areas (Viewer, Prompt, Panel, images, video, Node Embed) grow to use the width and the height of the window.

**Background fills the window** paints the page background (theme gradient, colour, picture) over the whole window, so there is no visible frame around the page.

## Containers

- **Panel**: a frame. Widgets placed on it move with it.
- **Spoiler**: a frame that folds and unfolds. Good for advanced settings.
- **Tab panel**: a frame with tabs, each with its own widgets.
- **Tabs**: the page tabs placed wherever you want.
- **Heading**, **Text block**, **Divider**, **Image**: decoration.

Drag a widget onto a container to put it inside, or move it in the **Layout** column of the editor: the upper third of a row means *above*, the lower third *below*, the middle means *inside* a Panel, a Spoiler or a group.

## Groups

Select several widgets and press **Ctrl+G** to group them. A group moves, copies and deletes as one. Double-click a group to work with its widgets one by one; **Alt+click** picks a single widget. **Ctrl+Shift+G** ungroups. A group has an eye and a lock in the layers list. A group sits on one page and one level (no group inside a group).

## Align and Spread

With two or more widgets selected, the layout section of the settings offers **Align** (left, centre, right, top, middle, bottom) and **Spread** (equal gaps in a row or a column, with margins and a gap you set). The values are remembered between sessions.

## UI Scale

Place a **UI Scale** widget to let the person scale the page up or down at any moment (for a small screen or a TV).
