# Sources and binding

## Sources

A **source** is a node of the graph that the panel can read and change. There are two ways to make one:

- **A tag in the title.** Name the node `Something [tag]`. The tag is the stable name of the node for the panel. It survives copying the workflow to another file, so a template or a project finds its nodes again by the tag.
- **From the editor.** In the **Link** tab press **Pick on canvas** and click a node, or select nodes in the graph and press **Add selected**. The editor adds the tag for you.

Several nodes may share one panel. Reordering or renaming the nodes in the graph does not break the panel.

## Binding

A widget has **slots**. A slot is a place for one parameter, for example the **Prompt** widget has the slot *Value*, the **Resolution** widget has *Width* and *Height*. Choose a slot in the **Values** section of the settings, then pick the source and the parameter, or use **Pick on canvas** and click the parameter on the node.

The widget shows the real value of the parameter and writes your changes back into the node, so the graph and the panel always agree. A slot marked with an asterisk in [Widgets](04-widgets.md) has to be bound; without a binding the widget shows a hint.

Slots of other kinds do not take a number or text, but the **result** of a node: images, frames of a live run, text, a video. They list only the nodes that can provide it.

## Virtual parameters

The nodes **ND Slider** and **ND Resolution** of Neural Dreamer Nodes keep their numbers inside one hidden field. The panel shows them as ordinary parameters: a slider gets *value*, a resolution gets *width* and *height*. **Pick on canvas** on an ND Resolution node gives you one **Resolution** widget.

## Tooltips

Every widget with bindings has a **Tooltip** field. The text appears in the ND UI mode after the pointer rests on the widget for a moment.

## Missing nodes

If a node is deleted or its tag is not found, the widget shows that it is not bound. Bind it again; nothing else breaks.
