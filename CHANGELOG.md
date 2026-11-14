# Changelog

All notable Stageplot changes from 0.4.0 onward are recorded here, with the newest changes first. Versions follow the value published from `src/version.js`.

## [0.6.0-alpha.0] - 2026-11-14

### Changed

- Consolidated layout saving around **Save now**, with **Save version** and **Submit for review** in the adjacent header dropdown.
- Replaced the separate saved indicator and full-width validation strip with one coloured header status. It reports saving, saved, changed, failed and warning states, previews details on hover and opens a persistent details dialog on click.
- Moved editor back-navigation beside the Stageplot brand in layout, stage and equipment editors.
- Consolidated keyboard shortcuts into **Help**, with a link to the full GitHub guide; `?` opens the same dialog.
- Moved editable installed-stage-asset controls into the Stage/Overhead asset list. Assets remain locked by default, authored groups remain intact, and selected or all moved assets can be reset.

## [0.5.7-alpha.0] - 2026-11-14

### Added

- Added explicit layout editing for installed equipment marked **Editable in Stageplot**, while keeping installed assets non-deletable and authored groups intact.
- Listed editable installed Stage and Overhead assets with default, moved and hidden state, plus selected/all reset actions.
- Added multi-selection alignment for every edge and centre, and horizontal/vertical distribution using equal physical gaps while preserving groups.
- Added live layout validation for boundaries, collisions, stock shortages, moved installed assets, hidden stage parts and outdated source stages.
- Added unsaved-change summaries covering equipment, installed assets, visibility and performance notes.
- Added labelled layout milestones, revision change summaries, current-revision markers and restore previews.
- Added Owner-only permanent deletion of obsolete archived equipment from **Import & restore**.
- Added mode-aware keyboard shortcut help and `?` activation.

### Changed

- Optimised dense-layout validation by rejecting non-overlapping rotated bounds before detailed polygon collision checks.
- Improved tablet-width containment, dialog focus restoration, visible focus treatment, toolbar labels and live save announcements.
- Hardened container publishing by copying all API runtime dependencies and verifying the application before image publication.
- Expanded browser coverage for installed-asset editing, layout arrangement, revisions, shortcuts and responsive layouts.

## [0.5.6-alpha.0] - 2026-11-14

### Added

- Added the underlying per-layout placement controls for editable installed equipment and reset logic that preserves articulated-part overrides.
- Added grouped selection behavior for editable installed equipment.
- Added decimal stage-deck dimensions and matching snap points.

### Fixed

- Corrected equipment artwork and adjustable-part rendering and control behavior.
- Improved installed-stage-part visibility and placement persistence.
- Updated Docker and GitHub image-build dependencies and regression coverage.

## [0.5.5-alpha.0]

- No standalone release was published; development continued into 0.5.6.

## [0.5.4-alpha.0] - 2026-11-12

### Added

- Added safe SVG import alongside PNG, JPEG, WebP, GIF and AVIF graphics, including sanitisation and size validation.
- Added drag-and-drop graphic import for stage and equipment artwork.
- Expanded equipment components with categories, quantities, placement ordering and references to other equipment items.
- Added per-placement component supply choices and retained component notes in layouts and reports.

### Changed

- Reworked component hydration, inventory reporting, project persistence and nested equipment artwork.
- Updated stage thumbnails, sharing and invitation data to preserve richer equipment/component definitions.

## [0.5.3-alpha.0] - 2026-11-05

### Fixed

- Corrected GitHub Actions container builds and browser-launch cleanup.
- Improved browser-test process shutdown so retained child streams do not stall CI.

## [0.5.2-alpha.0] - 2026-11-04

### Fixed

- Improved Chromium discovery, launch diagnostics and cleanup for automated browser tests.
- Stabilised event, popup and workspace browser checks.

## [0.5.1-alpha.0] - 2026-11-04

### Fixed

- Corrected equipment artwork rendering and placement behavior.
- Added browser coverage for the affected rendering paths.

## [0.5.0-alpha.0] - 2026-11-04

### Changed

- Refined the equipment-library presentation and editor styling for the unified workspace.

## [0.4.9-alpha.0] - 2026-11-04

### Fixed

- Stabilised the full user-workspace browser workflow after the 0.4.8 editor changes.

## [0.4.8-alpha.0] - 2026-11-04

### Added

- Added separate **Overhead Layers** for flown equipment, truss and other artwork that must render above layout equipment.
- Added grouped-selection keyboard support and `Ctrl`/`Cmd`+`G` grouping.
- Added layout autosave, best-effort save on exit and labelled save checkpoints.
- Added independent folders, group visibility and richer layer-list controls across stage and equipment content.

### Changed

- Split stage quicksaves from labelled stage versions and removed internal revision counters from normal cards.
- Hid locked source layers from layout-editing lists while retaining Stage-part visibility controls.
- Refined colour editing, stock inspection, stage thumbnails, sharing and fixed-equipment handling.

### Fixed

- Corrected grouped stage-equipment and optional-part visibility behavior.
- Fixed folder deletion, inline naming and layer ordering edge cases.

## [0.4.7-alpha.0] - 2026-11-02

### Fixed

- Corrected stock-inspector and equipment-placement editor behavior.
- Improved editor styling and related browser coverage.

## [0.4.6-alpha.0] - 2026-11-02

### Changed

- Changed saved image processing to target resolution from the artwork's placed physical size.
- Improved image-resolution feedback and tests for crop, scaling and saved output.

## [0.4.5-alpha.0] - 2026-11-02

### Added

- Added normal image layers to stage and equipment editing, with aspect locking, resizing, rotation, opacity and crop controls.
- Added image preparation that bakes crop geometry, clips artwork to its canvas and preserves transparency.

### Fixed

- Corrected image bounds, transformed selection, stage-part visibility and thumbnail rendering.
- Expanded legacy import and workspace tests for image-backed equipment.

## [0.4.4-alpha.0] - 2026-11-02

### Added

- Added independently adjustable installed-equipment part rotations in layouts.
- Added persistence and validation for articulated equipment controls and toggleable stage parts.

### Fixed

- Corrected placement selection, project snapshots, stage thumbnails and shared-layout controls.
- Improved stage/equipment ownership and sharing route behavior.

## [0.4.3-alpha.0] - 2026-11-01

### Changed

- Consolidated stage building, equipment placement and shared inspection in the unified canvas.
- Improved stage boundary, zone, fixed-equipment and Stage-part editing workflows.
- Expanded project serialization and recovery for stage-linked layouts.

### Fixed

- Corrected stage-builder selection, inspector and save behavior.
- Fixed fixed-equipment snapshots, optional visibility and layout-stage restoration.
- Updated the production container and end-to-end workspace coverage.

## [0.4.2-alpha.0] - 2026-11-01

### Fixed

- Corrected imported equipment profile and custom-shape membership flags.
- Improved recovery of older saved equipment without exposing internal building blocks in the equipment library.
- Updated legacy-import diagnostics, documentation and browser coverage.

## [0.4.1-alpha.0] - 2026-11-01

### Added

- Added Owner-only discovery and import of legacy stage and equipment JSON.
- Added archived-item restoration and stage-template creation while keeping originals independent.
- Added recovery tooling for saved equipment incorrectly tagged as custom artwork.

### Changed

- Expanded import, recovery, account and equipment documentation.
- Added regression coverage for legacy records and imported workspace assets.

## [0.4.0-alpha.0] - 2026-11-01

### Added

- Introduced the unified Stageplot workspace and shared stage/equipment editor, replacing the separate large editor implementations.
- Added immediate GitHub User signup, personal workspaces, organisations, private libraries and independent app/team roles.
- Added reusable stages, versioned layouts, client invitations, private edit links and revision-safe collaboration.
- Added stage boundaries, curved segments, zones, curtains, text, dimensions, images, folders, groups, locks and visibility controls.
- Added installed equipment, available equipment, organisation stock, supply-source tracking and equipment/component reports.
- Added equipment artwork authoring with shapes, vectors, cut/merge tools, collision geometry, custom shapes and articulated parts.
- Added public equipment/stage submissions, review workflows, personal copies and administrator publishing controls.
- Added PDF/CSV exports, organisation branding, local draft recovery and project snapshot handling.
- Added central release versioning, extensive unit/API/browser coverage and a reorganised documentation set.

### Changed

- Reworked the frontend, API routes, SQLite workspace model, navigation and deployment around the unified application.
- Replaced the former event/production-centric entry flow with direct stages, layouts, equipment and organisations.
- Consolidated shared editor code and removed obsolete project-shelf and venue-equipment implementations.

[0.6.0-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.6.0-alpha.0
[0.5.7-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.7-alpha.0
[0.5.6-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.6-alpha.0
[0.5.4-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.4-alpha.0
[0.5.3-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.3-alpha.0
[0.5.2-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.2-alpha.0
[0.5.1-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.1-alpha.0
[0.5.0-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.5.0-alpha.0
[0.4.9-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.9-alpha.0
[0.4.8-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.8-alpha.0
[0.4.7-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.7-alpha.0
[0.4.6-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.6-alpha.0
[0.4.5-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.5-alpha.0
[0.4.4-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.4-alpha.0
[0.4.3-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.3-alpha.0
[0.4.2-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.2-alpha.0
[0.4.1-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.1-alpha.0
[0.4.0-alpha.0]: https://github.com/staljabro/stage-layout-app/releases/tag/v0.4.0-alpha.0
