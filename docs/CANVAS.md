# Stage and layout editor

[Guide home](README.md) · [Equipment creation](EQUIPMENT.md) · [Sharing](SHARING.md)

## Build a stage

Open **Edit stage** on a stage you own or have Can edit access to. Work between stage geometry and equipment placement without changing editors.

The main boundary defines the stage. Add zones for scenery or collision obstacles, curtains, stage text, measurement dimensions and background images. A rectangular zone can be resized and converted to a normal editable zone for detailed geometry.

Select a zone or boundary node to edit it in the inspector. Shift-click an edge to insert a node. Curved segments offer their applicable curve controls. Closed boundaries retain at least three nodes. The stage Move tool moves whole assets while hiding geometry handles.

Use the boundary lock, stage layer locks and eyes to protect or hide stage artwork. The boundary uses the same lock icon as other stage layers.

**Save stage version** records a new source version. Existing layouts keep their previous source version until someone with permission deliberately applies an update.

The app Owner can choose **Use as template** on an accessible stage card, or restore an archived stage through **Import & restore**, to create an independent editable stage. The source remains unchanged and its sharing is not copied. [Stage templates and JSON imports](IMPORTS.md).

## Curtains

Choose **Curtain** in the stage toolbar. Drag the line to position it, or select it and drag either endpoint to change its length and direction. The inspector also provides anchor coordinates, line length in metres and whole-degree rotation.

Curtains draw as sine waves with a fixed **10 cm peak-to-trough height** and **40 cm wavelength**. Extending a line adds folds; shortening it trims them, including partial folds. Neither operation stretches the pattern.

New curtains default to black with **20 mm thickness**. Use **Colour**, the **Thickness** slider and **Opacity** in the inspector to style them. The slider runs from 1 to 200 mm in whole-millimetre steps and shows the current value; saved thickness is rounded to the nearest millimetre. Thickness is a physical measurement, so its appearance scales consistently with the stage and PDF. Curtains support the normal stage layer stack, locks, eyes, groups, folders, copy/paste and undo.

**Curtain collision** in the inspector starts enabled. Turn it off to keep the artwork visible while letting equipment pass through. Selecting an enabled curtain shows a dotted centre line along its collision boundary. Equipment collides with that straight line, rather than the decorative wave, and can slide along it. Hiding a curtain or its group/folder also removes its collision; opacity alone does not. Global collision checks and per-item collision overrides still apply. The guide and endpoint handles are excluded from PDFs and client editing.

Enable **Toggleable in Stageplot** on a curtain, zone or text label to let layout users show or hide it. A stage group can instead expose one named toggle for its zones, text, curtains and images. In a layout, these controls appear in the inspector under **Stage parts**, even with no equipment selected. Choices save with that layout, affect previews and PDF exports, and leave the source stage and other layouts unchanged. Hidden zones and curtains stop blocking equipment. Stage-author visibility, group eyes and folder eyes still apply.

Curtains belong to the source stage. They appear in stage/layout previews, client layouts and canvas PDF exports. Visitors can use the visibility choices enabled by the stage author; their geometry and styles stay locked. They do not consume equipment stock or add equipment-list rows.

## Stage images

Choose **Image** in the stage toolbar. Images use the same placement, crop, rotation, opacity and default-on aspect lock as equipment images. The dashed frame stays at the full image border while you preview crop changes. Move images outside the canvas freely; they do not participate in collision blocking. Saving trims crop settings and anything outside the rectangular canvas, then scales the remaining bitmap to one pixel per centimetre without enlarging small sources.

Stage images participate in layers, groups, folders, eyes and locks. Mark an image **Toggleable in Stageplot** to offer a per-layout visibility control. Saved stage images appear in library previews, shared/client layouts and PDFs; their geometry stays locked for layout users. Existing stage backgrounds load through the same image controls.

## Installed and movable equipment

Equipment placed in stage authoring becomes installed equipment. Clients see it as part of the stage and cannot move it.

**Available equipment** configures the movable equipment offered to layout users. It is a category-grouped checklist of public and saved equipment with Check all/Uncheck all. No selected items means all public equipment. An explicit list can include deliberately shared private equipment. Create and save the private item, tick it in **Available equipment**, save the stage version, then send the invitation. Clients can place those items without access to the rest of your private library. The drawer separates **Public equipment** from **Private and shared equipment**. Existing layouts use their pinned available-equipment list until you apply a source-stage update.

Optional quantities are blank for untracked, zero for none, or positive whole numbers. Stage-specific quantities take precedence over organisation quantities when supplied.

## Arrange a layout

Open a saved layout or choose **Create layout** on a stage card. Layout editing locks stage geometry and installed equipment. Stage layers starts collapsed; expand it to inspect source contents.

Click equipment in the bottom drawer or drag it onto the stage. Drag placed equipment to move it. The inspector provides coordinates, rotation, labels, named parts, components and supply source. Multiple selected items expose compatible shared controls even when their values differ.

Equipment with articulated parts shows a separate **Part rotation** section in the inspector. For installed equipment, click the item on the canvas or its **(installed parts)** entry in the expanded Stage layers list. Its position and overall rotation stay locked. Part choices save with the layout and appear in previews and PDF exports; the source stage stays unchanged.

Rotation handles follow the item's orientation. Rotation fields and gestures use whole degrees. Shift gives a coarser 15-degree gesture.

## Edit multiple items

Shift-click layers or canvas items, or drag a selection box. In equipment design, stage building and layout editing, the inspector shows the controls shared by every selected item. Different values show **Mixed** rather than hiding the control: text and number fields are blank, checkboxes are indeterminate, and colours, sliders and menus identify the mixed state. Changing a control applies that value to the whole selection; untouched properties keep their individual values. Numeric edits commit on Enter or when you leave the field.

Groups also expose their members' shared properties. Named adjustable equipment parts and components can be edited together across equipment assets with different internal identifiers. Type-specific controls appear when all selected items support them. Unlock selected layers before changing their properties; locking and visibility remain available.

## Decks, text and labels

**Stage deck** and **Text annotation** have previews in the equipment drawer and can be added like equipment.

A stage deck supports width/depth in **0.1 m increments** (including 2 m and 2.4 m decks), height, Show deck height, fill/line/text colours and separate opacity controls. Deck dimensions and collision footprints retain tenths of a metre. Snap points include the metre grid and fractional deck edges. Deck collision starts off. The global Collision checks switch starts on.

Text annotations grow to fit their contents and line breaks. Equipment labels are separate: enable Show label and move Label position above, over or below the item. Zero places the label over the item.

## Snapping and collisions

The toolbar Snap setting chooses the grid, including 10 cm, Advanced 1 cm or off. Equipment snapping also uses saved snap points.

Collision movement stops at contact and slides along obstacles. If your pointer reaches a position where the equipment fits, it catches up. Turn off Collision checks for intentional overlaps, or change an item's Equipment collision setting.

Physical collision shapes are separate from visible artwork. Hiding an optional artwork part does not change its collision footprint. A hidden solid stage zone no longer acts as a visible collision obstacle.

## Layers, groups and folders

Stage layers and Equipment layers collapse independently. Drag rows to reorder the drawing stack. Group equipment that should move together; use folders to organise a larger list.

Choose **Add Folder**, type its name and press Enter or click away. Folders can be empty. Drop layers or groups into a folder, or use the outside-folders drop area to move them back to the root.

Individual eyes toggle item visibility. A group/folder eye overrides its contents without changing the children's own eyes. Showing the container restores those individual settings. Visibility does not remove equipment from quantities or equipment reports.

## Export the stageplot

**Export PDF** fits the stageplot and its logo/details header onto one page. Choose paper size and orientation in the print window; the drawing scales proportionally and ignores editor zoom/pan. See [PDF exports](EXPORTS_AND_RECOVERY.md#canvas-pdf).

## Keyboard and mouse reference

| Action | Control |
| --- | --- |
| Select an item/layer | Click |
| Add/remove selection | Shift-click |
| Select enclosed items | Drag empty canvas |
| Move selected artwork/equipment | Drag |
| Duplicate and move | Alt-drag |
| Zoom toward pointer | Mouse wheel |
| Pan | Middle-drag |
| Copy / paste | Ctrl/Cmd+C / Ctrl/Cmd+V |
| Duplicate placed equipment | Ctrl/Cmd+D |
| Delete selected items | Delete / Backspace |
| Nudge placed equipment | Arrow keys: 1 cm; Shift+arrow: 10 cm |
| Insert stage boundary point | Shift-click edge |
| Move whole stage assets | Stage Move tool / M |
| Finish/cancel the active tool | Escape |
| Rotate in coarse steps | Shift while dragging rotation |

Undo/redo controls cover stage and equipment changes in the same canvas. App dialogs take focus and suspend canvas shortcuts until closed.
