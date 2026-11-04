# The editor

Press **Edit** next to Run to open the editor. It is a full-screen window with three columns.

## Left column

- **Link**: the list of **sources**, the nodes the panel controls. **Pick on canvas** lets you click a node in the graph to add it; **Add selected** adds the nodes you have selected. Each source can be expanded to see its parameters. See [Sources and binding](03-sources-and-binding.md).
- **Widgets**: the library, in four groups (**Inputs**, **Run**, **Results**, **Layout**) and the **Top bar** group for the buttons of the ND UI mode. Click a tile to add a widget to the end of the page, or drag it to the exact place.
- **Layout**: the layers of the current page: every widget and group as a row, with a visibility eye and a lock. Drag rows to reorder, nest into a group, a Panel or a Spoiler. See [Layout](05-layout.md).

## The canvas

The page is drawn at the proportions you chose. Click a widget to select it, drag to move, pull the handles to resize. Shift-click or drag a rectangle to select several. The usual keys work: **Delete**, **Ctrl+Z / Ctrl+Y**, **Ctrl+C / Ctrl+V**, **Ctrl+G** (group), **Ctrl+Shift+G** (ungroup). The **Align** and **Spread** tools in the layout section of the right panel put the selected widgets in a row or a column with equal gaps.

The top bar of the editor has the page tabs (add a page with +), undo and redo, the zoom, **Preview** (try the panel without leaving the editor), **Cancel** and **Save**.

## Right column

Three tabs:

- **Settings**: when nothing is selected, the settings of the whole page: proportions, size, corner radius, background, **Theme**, look of the top panel, the progress bar of the mode, the buttons of the mode (memory buttons, project button, ComfyUI buttons). When a widget is selected, its own settings: what it is bound to (**Values**), the tooltip, the look and the properties listed in [Widgets](04-widgets.md).
- **Templates**: ready-made pages and your own templates. See [Projects and templates](11-projects-templates.md).
- **Editor**: the look of the editor itself (accent colour, side panels, top bar, canvas background). **Back to the usual look** returns the defaults.

## Saving

**Save** writes the panel into the workflow (it travels with the workflow file). **Cancel** discards the changes made in this session of the editor. You can also save the whole panel as a separate **project** file, see [Projects and templates](11-projects-templates.md).
