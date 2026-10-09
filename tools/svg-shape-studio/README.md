# Stageplot Shape Studio

An independent React/Vite editor for composing top-down equipment from vector primitives and publishing them to Stageplot's repository-backed library.

From the repository root, install both apps and start the complete development stack:

```powershell
npm.cmd run setup
npm.cmd run dev:all
```

Run setup again after pulling dependency changes. Shape Studio has a separate dependency set, including `polygon-clipping` and `fit-curve`. To run only Studio from this directory, use `npm.cmd install` followed by `npm.cmd run dev`; shared-library operations also require the Library API.

Use `npm.cmd run dev:all` from the repository root to start Shape Studio, Stageplot, and the shared library service. Items are stored as `stageplot-item@3` JSON vectors, with all coordinates and dimensions measured in metres. Each layer can independently participate in collision, so compound and irregular equipment is not constrained by a rectangular artwork box. Groups are created and assigned here, then consumed by the client-facing Stageplot app.

Scroll to zoom toward the pointer in equipment and stage modes; middle-drag to pan. Dedicated **Collision shape** layers appear at 50% opacity so artwork underneath remains visible. They always contribute collision but are omitted from published artwork.

Select equipment layers and choose **Group selected layers**, then name the group and enable **Toggleable in Stageplot** for one visibility control. Save/publish the item and use **Refresh items** in Stageplot to update existing placements. Toggles with the same name are combined; names shared by all selected placements appear in Stageplot's multi-selection inspector. Hiding equipment artwork does not change its collision.

In the stage editor, Shift-select zones and choose **Group selected zones**. Name the group and enable **Toggleable in Stageplot** to control every member with one toggle. Hiding grouped solid zones also disables their collision. Group members select together for movement, copying and deletion, while individual geometry remains editable. **Ungroup zones** restores independent selection and each zone's own toggle setting. Save the stage and reopen it in Stageplot to receive these controls.

Set **Stock quantity** in the **Library** popup, then press Enter or leave the field to save. Blank means untracked stock; zero means external supply only. Stageplot allocates stock to the earliest-added placements within each project. Extra placements remain allowed and are marked external. **Use external** excludes a placement from stock usage, freeing stock for the next eligible placement. Hidden equipment still counts; layer reordering does not change allocation.

Stageplot shows exhausted library tiles and external Layers rows in amber. On hover or selection, external equipment uses an orange canvas outline and non-collision equipment uses blue; orange takes priority if both apply. Its **Equipment list** popup separates stock and external quantities and exports CSV or PDF through the browser's print dialog. Closing or refreshing an unsaved Stageplot project triggers the browser's standard warning; equipment-list exports do not save the editable project.

See the [main README](../../README.md) for full workflows, project-file behaviour, verification commands and deployment instructions. Both apps also include a **Help** button.
