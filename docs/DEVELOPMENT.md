# Development and releases

[Guide home](README.md) · [Architecture](APP_FLOW_REVIEW.md) · [Deployment](DEPLOYMENT.md)

## Local setup

Use Node 24 and npm. From the repository root:

```powershell
npm run setup
npm run dev:all
```

The frontend is http://localhost:5173 and the API is port 8787. Vite proxies /api. Create a private .env from [.env.example](../.env.example) and configure GitHub OAuth using [the account guide](../ACCOUNT_GUIDE.md).

The working app is src/workbench with the shared canvas in src/editor. Equipment creation, stage authoring and client layouts are part of the same application.

## Verification

```powershell
npm run lint
node --test --test-isolation=none src/*.test.js tools/*.test.mjs tools/svg-shape-studio/src/*.test.js
npm run build
npm run build --prefix tools/svg-shape-studio
```

Browser tests use an isolated temporary database and headless Chrome/Edge/Chromium when available. STAGEPLOT_TEST_BROWSER selects an executable. STAGEPLOT_CAPTURE_UI=1 saves selected test screenshots in the system temporary directory.

Fixtures cover OAuth/signup, role migrations, cookie/proxy behaviour, private sharing, public approvals, source-versioned layouts, stock, images/components, app dialogs, canvas geometry and source-data retention.

## Release version

`RELEASE_VERSION` in `src/version.js` is authoritative. The UI derives its display string there; container tags, OCI labels and GitHub releases read that same value. Package manifests and lockfiles are generated mirrors. Set the source and sync all mirrors together:

```powershell
npm run release:version -- 0.2.8-alpha.0
node tools/release-version.mjs
```

Alternatively edit `src/version.js` directly and run `npm run release:version` without an argument to sync the mirrors. Both entry points run this sync automatically before builds, including Docker builds. CI reads the source directly, so stale mirrors cannot select a different release. Stable versions such as 1.0.0 and alpha/beta/rc numbered prereleases are supported. Commit generated metadata when available; direct source edits alone also work with the normal build/publish workflow.

The GitHub workflow verifies metadata, lint, build and tests, publishes both main images, then creates a matching GitHub release for a new version. Existing releases/versioned image tags are preserved; main still updates latest and SHA tags. The release job needs contents:write, while publishing needs packages:write.

Stage curtains live in the top-level `curtains` array of `stageplot-stage@1`, alongside zones and text. Each line stores its anchor, length, rotation, colour (black by default), physical thickness (metres), opacity, collisionEnabled (true by default) and layer metadata. `src/stage-curtain.js` supplies the fixed 5 cm amplitude / 40 cm wavelength geometry and line editing helpers. `stageLineAssets` combines curtains and editor measurement lines for shared editor interactions; only measurement lines remain editor-only. Top-level curtains survive snapshots and pinned source versions. Visible curtains with collision enabled contribute straight centre-line segments to equipment collision checks and sliding; selected authoring curtains show an editor-only dotted guide on that line.

## Persistent data and compatibility

Equipment uses stageplot-item@3. Geometry is metres; equipment fields display centimetres. Image layers, collision shapes, rotation parts, components, grouping and folders remain part of the saved item definition.

The live data source is SQLite. Keep source JSON as import/retention inputs; do not overwrite or delete the database to re-import them. Legacy event/production records remain stored separately from the current workspace.

Existing app Editor/Contributor roles and organisation Member roles migrate to User without changing ownership. Test fixtures for historical migration intentionally retain old role names; current application role values are user/admin/owner.

## Printing, app dialogs and guide maintenance

Canvas printing lives in `src/editor/stageplot-print.js` and `.jsx`, with page fitting in the shared editor print CSS. Keep `@page` size automatic, the header and SVG in one fixed page grid, and editor controls hidden. Before/after-print handlers temporarily fit the SVG viewBox to visible artwork and restore it afterwards. Browser checks inspect PDF page counts and media sizes across A4, A3, Letter and A5.

Organisation renaming uses `PUT /api/workspace/organisations/:id` with `{name,revision}`. Only the organisation Owner can rename it; recheck ownership after reading the body and reject stale revisions. The organisation ID and all related references remain unchanged.

Use the shared appConfirm, appPrompt, appAlert and appPreview helpers. Do not introduce browser alert/confirm/prompt/open calls; lint guards these. Canvas shortcuts are suspended while an app popup is active.

The guide lives in this repository under docs. Update the relevant chapter, guide index and in-app help when behaviour changes. GitHub renders these as a wiki-style linked guide; this does not require a separately published GitHub Wiki.
