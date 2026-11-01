# Troubleshooting

[Guide home](README.md) · [Deployment](DEPLOYMENT.md) · [GitHub setup](../ACCOUNT_GUIDE.md)

## GitHub sign-in is unavailable

The server needs a GitHub OAuth client ID, secret and exact callback URL. Check the API environment and restart/recreate the API container after configuration changes.

Use the same hostname consistently. Production should use HTTPS with secure cookies. For a single frontend/API proxy, leave COOKIE_DOMAIN blank unless you deliberately share sessions across trusted sibling subdomains.

## Signup asks for an existing-account link

Normal new GitHub accounts immediately become Users. A link-required message means an older app account already uses that email and is not linked to the current identity.

Ask the app Owner to verify the identity and use Manage users & account linking. Do not delete the old account or database to resolve this; that would affect ownership/history.

A disabled linked identity stays disabled. Ask the Owner about re-enabling it. A missing verified GitHub email is resolved in GitHub's email settings.

## Old accounts show User or need to sign in again

Old Editor/Contributor app roles migrate to User. Old organisation Member roles also become User. Their IDs, assets and disabled state are retained. Changed app roles revoke old sessions, so sign in again.

Admin and Owner accounts retain their roles. Organisation administration remains separate from app administration.

## I cannot edit a stage or equipment item

You may have Can use access, which permits layouts rather than editing the original stage. Ask the creator for Can edit, or make a private equipment copy.

Layout editing locks source stage geometry and installed equipment by design. Open the stage's Edit stage action when authorised.

Private assets shared with a team require current membership. App Admin status alone does not reveal everyone's private originals.

## Equipment is missing from a client library

Check Available equipment on the saved source stage. An empty selection defaults to all public equipment; an explicit selection restricts the client palette and can deliberately include private equipment.

Save a stage version after changing availability. Existing layouts keep their source version until an authorised update is applied.

## Images stretch or crop looks unexpected

Equipment width/height describe the full image. Crop percentages trim edges and do not resize the remaining picture into the full frame.

Changing width and height independently changes the image's proportions. Saving lowers resolution to one pixel per centimetre; very small input images cannot gain detail by being enlarged.

Use the Image tool for equipment artwork. Background/reference images are stage-authoring tools.

## Components or notes are missing from a report

Components start enabled on placement. A disabled component is excluded from reports; hiding equipment artwork does not remove the item.

Select the placement to check its component boxes and notes. Different placements can have different notes. Reordering base component definitions keeps stable IDs, but deleting a definition removes it from future known component controls.

## Stock appears wrong

Confirm the workspace/linked invitation belongs to the intended organisation. Blank is untracked, zero means none, and stage-specific quantities override team quantities.

Installed equipment is counted first. Hidden equipment still counts. Client-supplied overrides free venue stock. Counts are per layout rather than cross-event reservations.

## Dragging or snapping prevents a placement

Inspect collision checks, solid zones, curtains, installed equipment and the stage boundary. Try moving the pointer to a clear fitting position; dragging can slide along collisions. A curtain with collision enabled blocks at its straight centre line; selecting it in stage authoring shows a dotted guide. Untick **Curtain collision** in its inspector to leave it visible without blocking equipment. You can also hide the curtain or its group/folder to disable that collision, or use the collision controls for intentional overlaps. The wave is fixed at 10 cm peak to trough; changing length adds or trims folds rather than resizing them.

Turn off snapping or collision checks for intentional placement, then restore them as appropriate. Decks start with item collision off while global checks start on.

## PDF size or branding looks wrong

Use **Export PDF** from the canvas and choose the intended paper size and orientation in the print dialog. The stageplot and header fit one page, including visible artwork outside the stage boundary. Editor zoom and pan are ignored. Equipment-list reports can span pages.

Organisation branding comes from the layout's organisation context. Reopen the layout after its team name/logo changes. The header places the logo beside the organisation, layout and stage names; missing organisation details are omitted. To change a team name, its Owner uses **Organisation name** in organisation settings.

## I removed a shared item

Open Removed items in Stages or Layouts and restore it. Personal removal does not revoke access or delete the source. If the owner revoked your actual access, ask them to share it again.

## A save failed or says it changed elsewhere

Wait for the save indicator, check connectivity and keep the current tab open. Reopen the saved version and inspect Restore local work if offered. Another user's newer revision is not overwritten automatically.

Local recovery may be unavailable if browser storage is full or disabled. Confirm important work with Save now and consider PDF/CSV records.

## The updated app still looks old

Wait for both Actions image builds. In Compose, pull and recreate both services; restarting existing containers alone does not select a newer image.

Check IMAGE_TAG: latest follows main; an explicit version remains pinned until changed. Confirm the two running services use the intended image digests. Hard-refresh the browser after the new containers are running.

A commit without a version bump can update latest while the displayed version remains the same. Use Actions/SHA image tags when identifying such a build.

`RELEASE_VERSION` in `src/version.js` controls all release numbers. Editing package.json alone does not change the app or release version; builds overwrite package mirrors from the source. After a direct source edit, run `npm run release:version` to sync metadata before committing, or let the build sync it automatically.

## Import retained stages and equipment

The **app Owner** can open **Import & restore** for archived stages and equipment. Choose **Use as template** for a stage or **Restore private copy** for equipment. Stage cards also offer Owner-only templates for accessible current stages.

Only the app Owner can import compatible `stageplot-stage@1` or `stageplot-item@3` JSON files. App Admin and organisation Owner roles do not grant these tools. Restored copies are private, and originals remain stored. After verifying import and making a SQLite backup, old source JSON can be archived or deleted. See [import, restoration and safe cleanup](IMPORTS.md).
