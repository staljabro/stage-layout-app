# Equipment creation

Stage **Curtain** lines belong to stage authoring, with their own colour, thickness and opacity controls. They default to black, use fixed 10 cm peak-to-trough folds, and optionally block equipment along the dotted centre line shown when selected. The inspector collision checkbox starts enabled and can be switched off while retaining the artwork. They are not reusable equipment or stock entries. See [curtains](CANVAS.md#curtains).

[Guide home](README.md) · [Canvas controls](CANVAS.md) · [Public review](EXPORTS_AND_RECOVERY.md#public-library-review)

## Create and size an item

Choose **Create equipment** in Equipment or the stage/layout drawer. Set its name, category and real-world canvas width/depth. Equipment fields show centimetres; geometry is stored in metres.

Canvas dimensions describe the equipment footprint. Changing the canvas size does not scale existing artwork. Select artwork layers to change their own size or position.

## Artwork layers

Insert basic shapes, vectors, lines, text or images. Each layer can be moved, rotated, resized, renamed and arranged in the stack. Use groups and folders for complex artwork, with independent container and layer visibility.

Supported shapes can become editable vectors. Closed vector selections support cutting and merging where the resulting geometry is supported. Cut actions distinguish consuming the cutter from retaining it. Unsupported holes/disconnected merge results are rejected rather than silently losing geometry.

Save useful artwork as a custom shape for later reuse.

## Image layers

Choose **Image** and upload PNG, JPEG, WebP, GIF or AVIF. Equipment images are normal artwork layers; there is no separate equipment reference-image tool. Stage backgrounds remain part of stage authoring.

Set image position, full width/height, rotation and opacity. Crop Left/Right/Top/Bottom are percentages of the full image. Crop trims the visible edges inward, retaining the image's original scale and position. Selection bounds and resize handles follow the cropped edges. Opposing crop values are limited to keep a visible area.

On save, embedded images are reduced to **one pixel per centimetre of their full placed size**. A 500 × 500 image placed at 1 m × 1 m becomes 100 × 100. Cropping half its width leaves 50 visible pixels at the same scale. Smaller sources are not enlarged; transparency is preserved. Both editor data and exported equipment artwork store the resized image.

Images must be smaller than 12 MB on upload. Use a clear static image or vector artwork for the best printed result.

## Components

With no artwork selected, open **Components** in the base item inspector. Add a value such as Cello mic, rename it, reorder it with the arrows or delete it. Component names have stable identities so reordering does not move placement notes to another requirement.

Every new placement starts with its components enabled. Select equipment in a stage/layout to:

- untick a component that is not required;
- enter a note, for example DPA4099;
- keep a note while turning that component off.

These are per-placement choices. They do not change the base equipment definition. Enabled components appear under their parent item in Equipment list, CSV and PDF. Notes identify the requirement; components do not independently consume organisation stock.

## Collision, snapping and adjustable parts

New artwork defaults to physical collision off. Enable it only for layers that define the real footprint, or add a dedicated **Collision Shape**. Dedicated collision-only artwork is omitted from the published appearance but contributes collision geometry.

**Corner snapping in Stageplot** adds snap points at the equipment canvas corners. It is off by default.

Toggleable artwork exposes named show/hide controls on each placed item. Articulated rotation parts expose independent whole-degree controls. Compatible shared controls appear for multiple selected items, including different values marked **Mixed**. Edit once to apply a value to every selected item; this also works for artwork layers, components and named adjustable parts. Hiding a visual part does not rewrite collision geometry.

## Private saves and team sharing

**Save equipment** saves a private original. Choose organisations in the save dialog to share it privately with those teams. The creator controls sharing; organisation administrators can maintain team-shared equipment.

Use **Make private copy** when you can use an item but do not have permission to edit its original. The **app Owner** can use **Import equipment JSON** for compatible `stageplot-item@3` files, including existing artwork, collisions and rotation controls. File import and archive restoration are Owner-only; normal private copies remain available to signed-in users. See [import and restoration](IMPORTS.md).

Equipment saves/imports treat the result as placeable equipment, including files that carried an old custom-shape tag. If a previously saved item is missing, **Recover saved equipment** on Equipment offers **Show in equipment library** to repair its classification while retaining the same ID and artwork. Reusable artwork saved with **Save as custom shape** remains separate.

## Public submissions and maintenance

Select **Submit to the public library** when saving a private item. Reviewers can edit the submitted snapshot, keep it pending, approve it or decline it with feedback. Approval creates or updates a separate public record and preserves the creator's private original.

Saving later changes to the private item does not automatically publish them; submit another proposal. App Admins and the Owner maintain public equipment directly. Only the app Owner deletes public equipment. Saved layouts retain their pinned artwork after a catalogue item is deleted.

App Admins and the Owner can choose **Return to reviews** on a public equipment card. Confirming removes it from the public catalogue and opens Public reviews, where it is labelled **Returned from public library**. Reviewers can edit that published version, save review edits, approve it again or decline it. Reapproval restores the same public item ID; declining leaves it withdrawn. Generic equipment supports this workflow too.

The creator's private original and any separate pending submission stay unchanged. Existing layouts retain saved equipment snapshots. Newer approval of the creator's separate submission supersedes an older returned review to prevent it overwriting a newer public version. The Owner also retains the separate Delete action for library cleanup.
