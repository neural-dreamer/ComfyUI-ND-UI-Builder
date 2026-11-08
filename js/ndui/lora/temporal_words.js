// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Ivan Ovchinnikov (Neural Dreamer)
// ND UI — the words that the time editor of Neural Dreamer Nodes (window.ndLoraTemporal.temporalEditor) asks this panel to translate, and the names of the
// groups of layers in the H3 block (h3_view.js picks them by a key, so the scanner of translations does not see them there). The function is never called:
// it only lists the English texts so that tools/i18n_tool.py knows them and keeps their translations.
export const TEMPORAL_WORDS = (tr) => [
    tr("Range"),
    tr("Drag a bar or its edges. Double-click an empty place to add a range. Shift: snap to the frames of the model."),
    tr("Timed"),
    tr("Off: the LoRA works on the whole video, as in the plain stack"),
    tr("Audio"),
    tr("The same curve is applied to the sound of the video. Off: the LoRA does not touch the audio"),
    tr("Shared layers"),
    tr("Text, reference images and the modulation layers cannot be placed in time. On: they keep the full strength (the LoRA understands its trigger words, but leaks a little). Off: they stay without the LoRA (stricter, weaker)"),
    tr("Share of the strength outside of the ranges (0 to 1)"),
    tr("Outside"),
    tr("Start"),
    tr("Seconds from the start of the video"),
    tr("End"),
    tr("Seconds from the start of the video; empty: to the end"),
    tr("end"),
    tr("Fade in"),
    tr("Seconds the LoRA needs to reach its full strength; 0: a hard edge"),
    tr("Fade out"),
    tr("Seconds the LoRA needs to fade away; 0: a hard edge"),
    tr("Weight"),
    tr("Strength of this range as a multiplier (0 to 2)"),
    tr("Remove the range"),
    tr("Attention"),
    tr("Feed-forward"),
    tr("Input projection"),
    tr("Output"),
    tr("Time modulation"),
    tr("Text refiner"),
    tr("Other"),
];
