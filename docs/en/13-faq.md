# FAQ

**I do not see the ND UI and Edit buttons.** Reload the page with Ctrl+F5. Check the setting *ComfyUI ND UI Builder → Buttons → Action bar → Show the ND UI and Edit buttons next to Run*.

**A widget says it is not bound.** The node or its tag was not found. Open the editor, **Link** tab, and bind it again.

**The Viewer shows no live frames.** Put an **ND UI Live Bridge** after the sampler, and make sure the Viewer has *live* on and the eye is open. Ordinary previews of ComfyUI do not go to the panel.

**There is no speaker button.** The bridge needs an `audio_vae`. Without it the sound is off.

**A widget says to install Neural Dreamer Nodes.** See [Neural Dreamer Nodes](12-neural-dreamer-nodes.md). Version 1.3.1 or newer is needed for Variant Preview.

**Hotkeys of ComfyUI do not work in the mode.** That is on purpose. Allow commands in the ComfyUI settings, *ComfyUI ND UI Builder → ND UI mode*.

**The page is blurry or slow on a weak machine.** Choose a theme without blur (Midnight, Studio, ComfyUI), or turn *Use blur* off.

**Which ComfyUI do I need?** The pack was tried on the frontend 1.55 and 1.57. Older frontends may lack some features.

**The workflow does not run when I press Generate.** Generate queues the workflow exactly as the graph is. Check that the graph itself has no errors (leave the mode and look at the red nodes).

**Where is the panel stored?** In the workflow file, so it is shared with the workflow. Use a project file (`.ndui`) to keep a panel with its workflow as one file.

**License.** Free and open source under the GNU AGPL-3.0, see [LICENSE](../../LICENSE) and [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md). License questions: ivan.kvento@gmail.com.
