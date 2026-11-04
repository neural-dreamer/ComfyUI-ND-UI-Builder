# Node Embed

Some nodes have an interface of their own: a preview, a mask editor, a canvas, a custom widget. **Node Embed** shows that interface inside the panel, so you do not have to go back to the graph.

## Use

1. Add the **Node Embed** widget (group *Inputs*).
2. Bind its slot to the node.
3. The widget shows the live interface of the node. Edits you make in the panel are written into the node.

## Look

*Recolour to the theme* repaints the grey or dark native interface of the node in the colours of the current theme. It works with the translucent Frost and Glass themes too.

## Limits

- Only what the node draws in its own widgets can be shown. Panels of other packs that live outside the node cannot.
- Some nodes size themselves; resize the widget on the page to give them room.
- The embedded interface is the real one: a node that is slow or heavy stays slow in the panel.
