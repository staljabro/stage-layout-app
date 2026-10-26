# Stageplot user guide

Stageplot is the workspace for reusable venue spaces, theatre productions, festivals and group layouts. Shape Studio is the equipment artwork editor.

## Accounts and access

Sign in through GitHub. Once your account is approved, any account role can create and manage its own events. Contributor, Admin and Owner permissions are only needed for equipment authoring and library publishing.

Events and their band plots belong to their organiser. Another account cannot browse them. Band members can edit their assigned plot without an account using its unique edit link. Anyone holding that link can edit that one plot, so send it privately. Links are not sent automatically.

External is the standard equipment library. Owners with Empire access can choose Empire when creating an event. Invited band members use the palette assigned to that event through their link.

## Stageplot

### Reusable venue spaces

Use the **Spaces** tab for the three to five spaces your venue uses repeatedly. Create the main auditorium, studio theatre, forecourt or other space independently of any event. Add a venue name to identify and search related spaces.

Each space has three equipment categories:

| Category | How it works |
| --- | --- |
| Fixed equipment | Installed in the space and locked in client/group layouts. |
| Available venue equipment | Movable equipment the venue can provide, with quantities per layout. |
| Client supplied | Equipment the visiting client or group brings. |

Use **Outline & zones**, **Fixed equipment**, and **Available equipment** to prepare the space. Enter available chairs, music stands, percussion and other stock through the available-equipment editor. In a client layout, selecting a listed asset defaults to venue supply; its inspector can change the source to client supplied. Equipment outside the venue list is client supplied.

The left panel shows requested versus available venue quantities and highlights excess demand. Equipment lists and CSV/PDF reports separate venue requests from client-supplied items. Quantities apply per layout, rather than reserving or summing stock across successive groups or clients.

### Theatre productions

Open **Productions** and create a production with its name, client/company, start and optional end date, notes and reusable space. Stageplot creates one client layout automatically. You can open that layout directly, copy the client edit link and review the client's work without adding bands or creating another stage from scratch.

Different productions can use the same space. Their layouts, equipment, notes, revisions and access links remain independent.

### Eisteddfods: one event, one stage, many groups

1. Prepare the reusable venue space and its available equipment.
2. Create an event with type **Eisteddfod / groups**, selecting that space.
3. Choose **Add group** and prepare the first chair/percussion layout.
4. Choose **Add groups**, enter the remaining names one per line, and choose the first group as the starting layout if appropriate. Up to 100 layouts can be created in one operation.
5. Give each group its own edit link. Copies of a starting layout can be edited independently.
6. Use **Group details** to label a session or performance time, and **Move earlier / Move later** to arrange the running order. Search by name or session and filter by status when reviewing many groups.

For twenty groups sharing forty chairs, the stock is forty chairs available to each layout. A later group's layout does not consume another group's allocation. The running-order labels describe your event; this is not a booking or equipment reservation calendar.

### Space and stage versions

A reusable space, an event/production stage, and an individual client/group layout have separate versions. Updating the space never silently rearranges existing layouts.

When a newer space version is available, use **Preview space update** on the event or production stage. Applying it replaces that local stage's outline, zones and venue equipment; local customisations are replaced. Individual layouts then offer their usual stage-update preview, which identifies conflicts while retaining equipment positions.

Existing event-specific stages can be added to the catalogue through **Save to Spaces**.

### Create an event

The workspace provides **Events**, **Productions** and **Spaces** tabs. The Events tab opens to **My events**. Choose **Create event** and enter a name, date, event type and organiser notes. A festival uses band terminology; an eisteddfod uses group terminology. Open the event to see its stages and line-up. Organiser event notes are separate from the notes included with each band plot.

### Build a stage

Choose **Add stage**. Enter a name and dimensions, or copy the latest version of a stage from another one of your events. Copies are independent.

**Outline & zones** opens the stage editor within Stageplot:

- Edit the main boundary by dragging nodes. Shift-click an edge to insert a node; Ctrl-click a straight edge to convert it into a curve.
- Use rectangular zones for a quick layout. Their inspector provides width, length and top-left or centre origin controls. Convert a rectangle into a normal zone to edit individual nodes.
- Zones can be aesthetic, solid collision obstacles, or outside-stage labels. They retain colour, stripe, opacity, line and optional-part controls.
- Add stage text, Studio-only dimension lines, and reference images. Dimensions and reference images help author the stage and are not published as band equipment.
- Press M to move whole assets, and Escape to leave Move mode. Shift-select assets to group them; folders organise complex stages.
- Use the inspector for exact metre coordinates. Scroll to zoom; middle-drag to pan.

Choose **Save stage version**, then return to the event.

**House equipment** opens the equipment placement canvas. Click or drag existing library equipment onto the stage. Move, rotate and adjust it using the inspector. Every item placed in this setup becomes fixed equipment for bands. Use this for a house drum kit, truss, treads and permanent staging. Turn off stage/zone collision while positioning items outside the stage boundary or intentionally overlapping scenery. Save when ready.

House equipment can be repositioned or removed by reopening this setup. Bands cannot move, rotate, duplicate or delete it.

### Invite each band

Choose **Add band**, enter its name, select a stage and add any initial notes. Stageplot creates an independent plot using that stage version.

Use **Copy band link** and send the link to the act. Each band has a separate token, plot, notes and saved revisions. Renaming a band keeps its link working.

### Work as a band

The link opens the band's plot directly. House equipment appears separately from the editable equipment layers. Add only the equipment the band needs on top of the provided stage.

- Click equipment to place it near the viewport centre, or drag it from the library.
- Drag equipment to move it. Rotation handles and articulated controls adjust its orientation. Shift snaps rotations to 15 degrees.
- Use exact position and rotation fields in the inspector.
- Shift-click to select several items. Layers can be reordered and organised into folders.
- Ctrl/Cmd+C and Ctrl/Cmd+V duplicate equipment. Alt-drag duplicates while positioning. Delete removes selected band equipment.
- Arrow keys nudge by 1 cm; Shift-arrow nudges by 10 cm.
- Collision-aware movement stops at boundaries and obstacles. The equipment collision setting and stage/zone collision setting are separate. Fixed house equipment follows stage/zone collision.
- The Custom tab provides project-only staging and text tools.
- Add performance requirements in **Band notes**.

Changes autosave after a short pause. Watch for **Saved** before closing the page. **Save now** performs an immediate save. **Submit for review** tells the organiser the plot is ready. Return using the same link to edit the latest saved plot.

### Review as the organiser

Open the event to see every band, its assigned stage, last save and status:

| Status | Meaning |
| --- | --- |
| Awaiting band | The initial plot has not been saved by a collaborator. |
| In progress | Work has been saved but not submitted. |
| Submitted | The plot is ready for organiser review. |
| Changed since submission | A previously submitted or approved plot has been edited. |
| Changes requested | The organiser requested a revision or applied a stage update. |
| Approved | The organiser approved the plot. |

Use **Refresh** to fetch current statuses. Open a plot to inspect it and its equipment list. Choose **Review** to approve or request changes, with a message the band sees when it opens its link. The organiser can also edit and save the plot directly.

### Update a stage

Each band plot is pinned to a stage version. Saving a new stage version does not silently alter existing band plots.

When an update is available, open **Manage** on a band row and choose **Preview stage update**. The preview lists equipment that may conflict with the new boundary, solid zones or fixed equipment. Apply the update deliberately. Band equipment keeps its existing coordinates and the plot is marked for review.

### Manage links and recover work

A band's **Manage** menu provides:

- **Rename band**.
- **Replace link**, which immediately stops the old link.
- **Revoke link**, which disables guest access but preserves the plot in the organiser's account.
- **Saved revisions**, with restoration as a new revision.
- **Preview stage update**, when a newer stage version exists.

Stageplot checks revisions before writing. If another window saves first, your save is rejected rather than overwriting their work. Download your local copy before reloading the latest plot. After an interrupted session, the recovery notice can restore unsaved local equipment and notes against the current stage.

This is save-based collaboration: refresh or reopen to see another person's latest work. It is not simultaneous live co-editing.

## Saving, loading and sharing

### Event plots

Event plots autosave to the organiser's account. The band link always opens the latest saved version. Submitting and exporting do not change the link.

**Export PDF** opens the browser print dialog with a landscape A3 layout. Choose Save as PDF. The drawing includes the house equipment and the band's additional equipment. **Equipment list** reports the band's additional requirements and supports CSV/PDF export. House equipment is already supplied by the stage and is shown separately on the canvas.

### Quick plots

Use **Quick plot** from the event header for an ad hoc layout. Choose a library stage or a rectangular space. Its **Save / Load** menu supports private account projects, local Stageplot files and PDF export. Quick plots use the standalone project workflow; use an event when inviting bands to edit organiser-owned plots.

## Shape Studio

Shape Studio is reserved for equipment. Stage building happens inside Stageplot.

Equipment fields display centimetres; geometry is stored in metres. Add basic shapes, advanced shapes or editable vectors. Each layer can have independent position, size, rotation and style. Separate artwork from physical collision geometry so transparent corners do not block other equipment.

Group related artwork, define independently rotatable parts, and expose optional layers through Toggleable in Stageplot. Custom shapes are reusable authoring building blocks and do not appear as equipment in the planner.

The equipment library supports grouping, personal copies, publishing and stock configuration. Empire quantities apply to Empire plots; External plots report requirements without stock tracking. Stock counts are per plot, not reservations across the festival.

## Collaboration and submissions

Contributors save personal equipment copies and submit them for review. Admins and the Owner can edit shared equipment directly and review proposals. Updates are tied to the original equipment item. Feedback appears beside the contributor's draft.

Event owners do not need this publishing process to build stages or invite bands. Their event stages remain private to their account and the plots they invite bands to edit.

## Administration and troubleshooting

- An unavailable band link may have been revoked or replaced. Ask the organiser for its current link.
- A save conflict means a newer revision exists. Download local work before reloading.
- A stage update can introduce overlaps. Preview it, then review affected band placements.
- House equipment is edited through the event's House equipment setup, not in a band plot.
- If the equipment library fails to load, check the Library API and account access.
- The application requires a modern desktop browser for canvas editing and print-to-PDF.

For GitHub setup, deployment and database backups, see [Accounts and deployment](../ACCOUNT_GUIDE.md). Events, stage versions and band revisions live in the same SQLite database as accounts and equipment.
