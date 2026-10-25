# Stageplot and Shape Studio user guide

[Documentation home](README.md) · [Project README](../README.md) · [Account and deployment guide](../ACCOUNT_GUIDE.md)

Stageplot builds show layouts from real-scale equipment and stages. Shape Studio creates that equipment and those stages. They share one account service and library, so a published design becomes available to planners without maintaining a separate application.

## Contents

1. [Accounts and access](#accounts-and-access)
2. [Stageplot](#stageplot)
3. [Saving, loading and sharing](#saving-loading-and-sharing)
4. [Shape Studio](#shape-studio)
5. [Collaboration and submissions](#collaboration-and-submissions)
6. [Administration and troubleshooting](#administration-and-troubleshooting)

## Accounts and access

The public External planner can be used without signing in. Sign in with GitHub to save cloud projects or request collaborator access. Stageplot does not manage your GitHub password or account recovery.

1. Choose **Sign in** in Stageplot's toolbar or opening stage window.
2. Continue with GitHub using an account with a verified email address.
3. New users wait for the Owner to approve their request and assign a role.
4. Sign in again after approval. Until then, the anonymous planner remains available.

| Role | Stageplot | Studio and shared library | Accounts |
| --- | --- | --- | --- |
| Editor | Plan and manage own cloud projects | No Studio access | Own account |
| Contributor | Plan with shared assets and own saved copies | Create personal designs and submit proposals | Own account |
| Admin | Plan and manage own projects | Edit shared items directly and review submissions | Own account |
| Owner | Plan and manage own projects | Edit shared items directly and review submissions | Approve users, assign non-Owner roles, disable users, assign Empire access |

Projects and personal working copies are private to their creator. Reviewers receive a submitted snapshot, not access to all of the contributor's drafts. The configured Owner cannot be disabled or assigned another role in the interface. Owner is not an assignable role.

### External and Empire

External is the default planner. Empire access is a separate user tag, independent of role. Even an Admin needs the tag to view Empire-only assets.

- Untagged users see External items and items assigned to both profiles. They cannot access Empire-only assets or the Empire planner.
- Tagged users can open `?profile=empire` and use its stock tracking. Empire-only sharing also requires the recipient to have Empire access.
- Untagged Studio users do not see Empire/External checkboxes or Empire quantities. Their new equipment and stages automatically use External.
- Tagged users see profile controls. Equipment may belong to either or both profiles; quantities apply only to Empire.

Contributors, Admins and the Owner have a **Stageplot Studio** button in Stageplot and a **Stageplot** button in Studio. Tagged users clicking Studio's Stageplot button choose **External Stageplot** or **Empire Stageplot**. Untagged users go directly to External. Both profiles receive the same app improvements.

## Stageplot

### First show walkthrough

1. Open Stageplot and choose a stage from **Choose your stage**, or supply the width and depth of a custom rectangular space.
2. Give the project a recognisable show name in the toolbar.
3. Click equipment in the lower library to add it, or drag it to a location on the canvas.
4. Move and rotate equipment into place. Use Inspector for precise values and Layers to organise the drawing.
5. Check collisions, boundaries and the equipment list.
6. Open **Save / Load**, save a cloud project or download a project file, then export PDF if required.

A stage-locked link offers only its designated stage. It does not allow switching to another stage or a custom rectangle. A shared project opens a saved show for client use rather than granting editing access to the owner's cloud project.

### Canvas navigation and selection

| Action | Control |
| --- | --- |
| Zoom toward pointer | Mouse wheel |
| Pan | Middle-button drag |
| Select one item | Click it or its Layers row |
| Select enclosed items | Left-drag an empty area |
| Add/remove from selection | Shift-click canvas items or Layers rows |
| Move equipment | Drag selected equipment |
| Duplicate and move | Hold Alt when starting a drag |
| Rotate | Drag the lower rotation handle |
| Snap rotation to 15 degrees | Hold Shift while rotating |
| Keep articulated parts facing their current direction | Ctrl-drag the main rotation handle |
| Nudge | Arrow keys: 1 cm; Shift-arrow: 10 cm |
| Copy/paste selection | Ctrl/Cmd+C and Ctrl/Cmd+V |
| Undo | Ctrl/Cmd+Z |
| Redo | Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y |
| Delete selection | Delete or Backspace |
| Cancel custom staging | Escape |

Typing in a text field uses normal text editing controls. Different coloured arms operate independent rotation parts such as stand tops. Hovering a handle identifies its part.

### Layers and Inspector

The top Layers row draws in front. Drag rows to reorder them. **New folder** creates a folder; double-click its name to rename it, then drag items onto it. Clicking a folder selects its contents, and Shift-click adds or removes them from the selection. Folders can collapse and move as a unit.

Eye controls hide equipment or folders from the drawing and PDF. Hidden equipment still participates in collision and stock allocation. Removing a folder does not delete its equipment.

Select equipment to edit position, rotation, label display, artwork toggles, collision and articulated parts. Multi-selection exposes common settings and alignment/distribution tools. An X in a checkbox means values differ; clicking enables the setting for all selected items.

With nothing selected, Inspector shows stage and canvas controls, fitting, global collision settings and available stage-part toggles. Inspector sections remember their collapsed state. Drag panel dividers to resize Layers and Inspector, or use panel buttons to hide them.

### Collision and snapping

Equipment collision uses configured physical footprints, not necessarily the artwork's rectangular bounds. Dragging stops at valid positions and can slide along obstacles. Solid stage zones block equipment; aesthetic zones do not.

The canvas inspector can independently disable equipment collision, stage/zone collision and corner snapping. Placement-level collision can be disabled for an item such as a deck that must sit under other equipment. Staging-group equipment and custom staging begin behind other items with placement collision disabled.

Corner snapping requires snap points in the equipment definition. Matching points snap within 30 cm. Hiding equipment artwork does not remove its footprint; hiding a toggleable solid stage zone does remove that zone's collision.

Saving warns when enabled collision objects overlap, intersect solid zones or leave the usable stage. Review the layout before continuing; the warning does not automatically correct it.

### Custom items

The library's **Custom** tab creates project-only items, without publishing equipment:

- **Custom staging - Prostage** draws decks in whole-metre increments. Inspector controls dimensions, height annotation, fill, borders, grid and text. Metre-grid intersections provide snap points.
- **Custom Text** adds annotations with text, size, bold, italic, colour and rotation controls.

Custom items are retained in project saves. Text annotations are excluded from equipment counts.

### Empire stock and equipment reports

External events do not track inventory. In Empire, equipment with a configured quantity shows remaining stock; blank means untracked and zero means no stock is available.

Stock is allocated to the earliest-added placements, regardless of layer order. Hidden equipment still consumes stock. Exhausted tiles and overflow placements are amber; extra placements are allowed for external sourcing. **Use external** excludes a placement from stock allocation, freeing stock for another placement. Allocation is per project, not a reservation across concurrent shows.

On hover/selection, externally sourced items have orange outlines and collision-disabled items have blue outlines; orange takes priority. These guides do not print.

**Equipment list** counts equipment, hidden placements and custom staging dimensions. Empire reports separate Stock and External quantities. External reports show requirements without sourcing columns. Export CSV for a spreadsheet or PDF through the browser's print dialog.

## Saving, loading and sharing

### Save / Load

Actions appear in this order:

| Button | Availability and result |
| --- | --- |
| Update cloud project | Signed-in users; enabled only when the current show is an existing account project |
| Save cloud project | Signed-in users; creates a new private account project |
| New Project | Starts another layout; unavailable where a shared-project workflow restricts it |
| Load Project File | Opens a local Stageplot project file |
| Download Project File | Downloads the editable `.stageplot` project |
| Export PDF | Requires a stage; prints the full drawing fitted to landscape A3 |

Cloud saving and downloading are independent. Downloading does not update the cloud project. PDF and equipment-list exports do not save an editable project. Choose **Save as PDF** in the browser print dialog to create a PDF file.

Saved projects pin artwork revisions. Library changes do not silently replace existing placements. **Refresh items** beside the canvas dimensions deliberately adopts current accessible equipment artwork while preserving placement settings. Older reference-only files resolve accessible current assets instead.

Closing or refreshing with unsaved work triggers the browser warning. Tab recovery helps after an accidental refresh, but use a cloud save or downloaded file as the durable copy.

### My projects

Signed-in users can list, open and update their own cloud projects through **My projects**. Saves check revisions to avoid overwriting another tab's newer save. If a conflict appears, reopen the latest project before updating.

- **History** lists saved project revisions; restoring one creates a new current revision.
- **Delete** moves a project to deleted projects and disables its share link.
- **Restore** offers revisions of a deleted project.
- **Delete permanently** is available after deletion. It removes the project and every saved revision, requires confirmation and cannot be undone through the app.

Permanent deletion is restricted to the project's owner, including against Admin/Owner access. A locally open copy is not erased from the browser; save it as a new cloud project if needed.

### Project share links

**Create/reset share link** copies a link to the saved project and the equipment/stage definitions it uses. Clients can adjust their local layout and download a file, but cannot overwrite the sender's cloud project. Other projects and personal assets are not exposed.

Saving a new cloud revision, restoring, deleting or disabling sharing invalidates the old link. Generate a new link after changing a saved project. A link containing Empire-only artwork also requires Empire access; an External-compatible show is the appropriate client-facing option for untagged recipients.

## Shape Studio

### Starting a design

Sign in with Contributor, Admin or Owner access. Choose **New item** and select equipment or stage. Equipment fields display centimetres and stages display metres; stored geometry uses metres. Canvas size describes the real-world footprint and does not scale existing artwork.

Use the wheel to zoom, middle-drag to pan and an empty-area drag to select fully enclosed assets. Shift-click adds/removes selections. Standard snapping uses 10 cm increments, Advanced uses 1 cm, and snapping can be disabled.

### Equipment artwork

1. Set real dimensions and a descriptive item name.
2. Build the top-down drawing with rectangles, circles, ellipses, lines, text, tripods, arcs, polygons, trapezoids, chairs or custom vectors.
3. Select layers to edit coordinates, dimensions, colours, rotation and geometry.
4. Mark only the layers needed for the physical footprint as collision shapes.
5. Configure optional artwork toggles, corner snapping and rotation parts.
6. Save, then use Library to check its equipment group and review/publication state.

Basic shapes can be converted into editable vectors. Point-by-point vectors can be open or closed; Escape finishes the path. For boolean cutting, put the cutter above the target, select exactly those layers and choose the cut action. You can consume or retain the cutter. Separate results become separate vectors; cuts requiring unsupported holes are rejected. Closed layers can also be merged where supported.

New normal layers start with physical collision off. Dedicated **Collision shape** layers are light-grey editing guides: they contribute collision but are omitted from published artwork. Use a minimal, accurate footprint rather than making all decorative layers physical.

Group layers to move and transform them together. Name a group and enable **Toggleable in Stageplot** to expose one show/hide control. Toggle names shared across equipment are combined in the planner. Hiding equipment artwork does not change collision. Rotation parts define independent pivots and angle limits; tripod parts use the convergence point as their pivot.

Text layers support multiline content, text size, bold, italic, alignment, spacing, colour and rotation. Bounds follow the text. Converting text to a vector changes it into editable outlines rather than a text field.

### Stage editing

Move boundary nodes to define the usable stage. Shift-click a segment to insert a node. Ctrl-click a straight segment to create a Point on Arc curve; curve modes also include Smooth and Bezier. Closed boundaries keep at least three nodes.

Use **Move (M)** to reposition whole stage assets without grabbing geometry handles; Escape or the button exits it. Select a zone to set precise anchor coordinates using its top-left extremity or centre. Dimension lines are Studio-only measurements and do not appear in the published stage.

Zone types have different purposes:

| Zone | Planner behaviour |
| --- | --- |
| Aesthetic | Visual scenery, no collision |
| Solid | Blocks equipment movement |
| Label | Can remain visible outside the stage boundary |

Zones support single fills or two-colour diagonal stripes. Toggleable zones and text can be hidden per project. Group zones to expose a shared visibility control; hiding solid group members disables their collision. Reference images support ordering, cropping and locking. Lock assets to prevent accidental edits.

### Library tabs and profile controls

**Equipment** and **Stages** are separate tabs. Rows remain one line high; scroll horizontally when the window is too narrow. Personal copies have a blue background and ** - Personal copy** in their displayed name. This suffix does not rename the stored design. Admins and the Owner also see **New items** for new submitted equipment and stages. Pending updates highlight their existing shared row and offer **Review update**.

All rows use **Edit**. Contributors save private copies, while Admins and the Owner edit shared items directly. Buttons distinguish **Save personal copy**, **Update personal copy**, **Update shape** and **Update stage**. Simply opening a shared item as a contributor does not save a new copy.

Untagged users create External equipment/stages automatically and do not see profile or stock columns. Empire-tagged users can assign Empire/External membership and set **Empire QTY**. Press Enter or leave the quantity field to save; use a non-negative integer or blank for untracked stock. Editing an existing shared asset preserves memberships, and approving an update preserves the shared target's memberships and stock.

Custom shapes are reusable Studio-only building blocks rather than client equipment. Save them separately from the published equipment library.

### Stage sharing

Open **Sharing** on a stage row. These settings are separate from profile membership:

- **Listed**: shared stage appears in its assigned planner libraries.
- **Link only**: excluded from public listings; a random token grants access.
- **Draft**: no client share link. Personal saved stages remain available to their creator.

Personal stages are not published to the anonymous picker simply by saving them. Submit for review to create or update a shared stage. A personal link-only stage can explicitly include selected personal equipment; unrelated drafts remain private.

Copy the appropriate profile link. Stage links use the fixed public planner address, https://stageplot.braithwaite.work/. Resetting a link invalidates its old token. Switching to Draft revokes access; normal artwork edits preserve an existing token. Empire links require an Empire-tagged recipient.

## Collaboration and submissions

### Contributor walkthrough

1. Create a new design, or **Edit** a shared item.
2. Save the draft. Editing a shared item uses **Save personal copy** the first time and **Update personal copy** thereafter.
3. Use the personal copy immediately in your own Stageplot library. Other users cannot browse it.
4. In Library, choose **Submit**, or use **Submit saved draft** in the editor. Save first: submission sends the saved design, not unsaved canvas edits.
5. Continue working if needed. Saving alone does not change the submitted snapshot; submit again to update the proposal.
6. Read **View feedback** beside the personal copy for reviewer messages, then revise/resubmit as appropriate.

Submissions reuse the existing proposal for the same draft, original target or matching name within the same user's asset type. Another user's proposal is not replaced. A submitted update remains tied to its original library item; renaming does not let it replace an unrelated item.

After approval, incorporated working copies are hidden from normal listings when they have no newer private edits. Their definitions remain available to saved references. Later unsubmitted work is retained.

### Reviewing a proposal

Admins and the Owner find new designs in **New items** and changes to shared designs through **Review update** on the original row. Review shows the current and submitted artwork together, with dimensions and profile information.

| Decision | Result |
| --- | --- |
| Approve as new item | Publishes a separate shared item; leaves the existing original unchanged |
| Approve item update | Updates the fixed original ID; cannot redirect to another item |
| Decline | Leaves the shared library unchanged and lets the contributor revise and resubmit |

Messages to the contributor are shown through **View feedback**. Newly saved messages include **Reviewer: @username**, supplied by the server from the reviewer's GitHub identity.

### Editing a submission together

Choose **Open submission in editor** to refine the submitted design. Saving opens three choices:

| Save choice | Result |
| --- | --- |
| Save new item | Creates a separate shared library item and leaves the submission pending |
| Update submitted item (without approving) | Updates the pending snapshot and contributor's personal copy, without changing the shared original |
| Approve changes | Publishes the edited proposal to its fixed original, or its proposed new shared identity |

Add a message explaining corrections or remaining work. Updating without approval preserves private ownership, stage share tokens and equipment grants. Studio refreshes library data when it regains focus. An already open editor retains its local canvas; it does not silently replace unsaved edits.

If the contributor saved newer changes after submitting, reviewer updates are blocked rather than overwriting them. Ask them to resubmit. If the shared target or proposal changed during review, reload and review the latest version before approving.

## Administration and troubleshooting

### Owner tasks

Use the account button and **Manage users & access requests** to approve GitHub users, assign Editor/Contributor/Admin, disable non-Owner accounts, or toggle Empire access. Role changes and disabling revoke sessions; Empire changes are checked against current account data on API requests. Initial Owner identity is configured on the server rather than awarded to the first visitor.

For deployment and backup commands, use the [account guide](../ACCOUNT_GUIDE.md). Keep `account-data` permanently mounted: accounts, live assets, projects, submissions and history are in SQLite. Updating application images does not replace that data. Source library JSON is imported once, so changing those files does not update the live library.

### Common issues

| Symptom | Check |
| --- | --- |
| GitHub button disabled | Server OAuth client ID, secret and valid callback settings; recreate containers after environment changes |
| GitHub access pending | Owner approval is needed; sign in again afterward |
| Login differs between apps | Consistent hostnames/cookie configuration; use HTTPS remotely |
| Empire library missing | Owner must assign the Empire tag, independently of role |
| No Empire columns in Studio | Expected for untagged users; their new items default to External |
| Library unavailable after startup | API readiness, network and proxy logs; retry after the API is ready |
| Saved item missing from public planner | Personal ownership, profile membership, stage visibility and review state |
| No new cloud update option | Open an existing cloud project; downloading a file does not establish a cloud save |
| Old project share link fails | A save, restore, delete, disable or reset may have revoked it; generate another |
| Collision feels wrong | Physical geometry, visible solid zones, placement/global collision and snapping controls |
| Reviewer cannot save edits | Contributor's personal copy or submission has changed; resubmit/reload first |
| Library edit does not change an existing project | Projects pin artwork revisions; use Refresh items deliberately |

When reporting a problem on GitHub, include the app version, affected app/profile, role, expected behaviour and steps to reproduce. Screenshots and redacted logs help. Do not include OAuth secrets, setup tokens, session cookies, private project links or private account databases.

### Friendly names

The Owner can set **Friendly name** beside any account in user management, including their own. Leave the field or press Enter to save; clear it to fall back to the GitHub username. Submission author labels use the current friendly name when present. New or edited feedback uses it in the reviewer signature; existing saved feedback retains its recorded signature. This changes display names only, not GitHub identity, roles or ownership.
