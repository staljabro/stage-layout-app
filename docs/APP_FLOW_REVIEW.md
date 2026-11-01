# Application architecture and workflow

[Guide home](README.md) · [User workflow](USER_GUIDE.md) · [Development](DEVELOPMENT.md)

This document describes the implemented workspace architecture, rather than an outstanding redesign proposal.

## Application structure

| Area | Responsibility |
| --- | --- |
| src/workbench | Workspace, libraries, organisations, sharing and editor adapters. |
| src/editor | Shared stage/equipment canvas, inspector, layers and placement interactions. |
| tools/user-workspace.mjs | Current authenticated/guest workspace routes. |
| tools/workspace-model.mjs | Permissions, schema migration, source versions, layouts and publication data. |
| tools/account-store.mjs | SQLite accounts, assets and role migration. |
| tools/github-auth.mjs | GitHub identity linking, automatic signup, sessions and older-account linking. |
| tools/stage-library-routes.mjs | Public stage proposals and maintenance. |
| docs | Linked user guide, deployment and developer reference. |

The default deployment has one frontend and API. The optional old Studio build entry mounts the same app; compatibility modules remain for retained geometry tests.

## Domain model

A **stage** owns geometry, zones, curtains, stage text, installed equipment, available equipment and immutable saved source versions. Curtains are top-level source artwork: 10 cm peak to trough, 40 cm wavelength, with anchor/length/rotation and colour/thickness/opacity controls, plus a collision checkbox (enabled by default) and dotted centre guide while editing. Length changes append or trim the wave. Shared line interactions provide movement, endpoint editing, grouping, folders and visibility while preserving client source locks.

A **layout** references a stage ID/version and stores equipment placements, components/notes, review state, current revision and revision history. The server materialises its pinned stage version when opening it. Applying a new source version is an explicit action.

An **equipment definition** stores editable artwork and exported shapes, collision geometry, dimensions, components, snap points and articulated parts. Per-placement states are excluded from reusable library snapshots.

An **organisation** supplies private asset sharing, membership, branding and stock quantities. It does not own every personal asset created by its users.

## Identity and permissions

Current app roles are user/admin/owner. New verified GitHub identities become User immediately, except an email collision with an older account requires explicit identity linking. The configured numeric GitHub Owner identity controls Owner bootstrap.

Historical Editor/Contributor roles migrate to User while preserving user IDs and ownership. Changed-role sessions are revoked. Organisation Member roles migrate to User; organisation permissions remain independent of app permissions.

Private stage access is ownership, organisation sharing or an explicit Can use/Can edit grant. Can use creates layouts referencing the stage. App-wide administration maintains public libraries; it does not grant unrestricted private-original access.

## Layout ownership

| Creation path | Owner/access |
| --- | --- |
| Signed-in Create layout | Creator owns it; optional stage-owner collaboration. |
| Client stage invitation | Organiser owns it; client account can retain access. |
| Anonymous generic layout | Guest edit link initially; later eligible account claim. |
| Organisation context | Membership can additionally provide team access. |

Layout owners can delete their layouts. Receiving an optional stage-owner share does not grant ownership, deletion or private-link management.

Shared-library removal is stored per user and item kind/ID. It changes personal listings, not source geometry, permission grants or other accounts' listings. Removed items can be restored.

## Public review and snapshots

Equipment and stage proposals contain submitted snapshots. Reviewer edits affect the proposal. Approval creates or updates a separate stable public record, preserving private originals. Public stage versions and pinned layout equipment protect old arrangements from silent catalogue replacement.

App Admins/Owner maintain public stages and equipment. Generic stages and public-equipment deletion are Owner-only. Deleted public equipment remains pinned in saved layouts.

## Canvas, components and images

Stage and equipment edits share a canvas and undo history. Layout visitors see locked source stage layers and installed equipment, with editable placed equipment.

Component IDs remain stable on rename/reorder. Components default on; explicit false values and notes survive serialization. Enabled requirements are reported under their parent without consuming separate inventory stock.

Image crops inset visible bounds without stretching. Image save preparation downsizes full images to one pixel per centimetre, including effective compound scaling, and replaces data in both artwork and editor copies.

Groups/folders have independent collapse and visibility overrides. Hidden equipment remains in inventory calculations and reports.

## Stock and branding

Installed/locked equipment is allocated first; remaining venue units are assigned in stable placement order. Explicit stage quantities override organisation quantities. Automatic sourcing prefers venue stock, with placement overrides for venue/client.

Stock is evaluated per layout, not reserved across events. Blank quantities are untracked.

Organisation branding is stored separately and read from the organisation attached to an invitation/layout, so client links and PDF exports use the sending team's current name and logo. Organisation Owners can rename the team with a revision-checked update; membership, stock, assets and link IDs remain attached to the same organisation.

Canvas printing uses a fixed printable-page grid with a logo/details header and a proportionally fitted SVG. The print dialog determines paper size and orientation. Before printing, visible artwork bounds expand the viewBox to include content outside the stage; after printing, the editor viewBox is restored. The logo sits beside organisation, layout and stage names. Equipment-list reports share that header format and retain normal pagination for long lists.

## Retention and deployment

SQLite is authoritative. Source JSON and older event/production data are retained; they are not destructively converted or republished. Existing compatible equipment can be imported/restored as described in the guide.

`RELEASE_VERSION` in `src/version.js` is the single source for UI, container and GitHub release versions. Build hooks and the version command sync package manifests and lockfiles from it. latest and SHA tags continue to support routine main-branch Compose updates. See [deployment](DEPLOYMENT.md) for operational steps and backups.
