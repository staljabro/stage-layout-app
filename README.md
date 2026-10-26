# Stage Layout App

Stage Layout App combines two applications with one shared library and account service:

- **Stageplot** maintains reusable venue spaces, creates theatre productions and festival/eisteddfod events, and gives each client or group its own editable layout and link.
- **Shape Studio** creates equipment artwork and collision footprints. Stage building lives in Stageplot. Contributors work on personal copies; Admins and the Owner can edit shared items and review submissions.
- **Library API** stores accounts, events, stages, band plots, equipment, submissions and revision data in SQLite. GitHub provides sign-in; the API enforces roles, ownership and Empire access.

Current release: **Version 0.2.9 (Alpha)**. The shared version appears beneath both app titles, in help dialogs and in PDF footers. Update the single user-facing release value in `src/version.js` when preparing a new version; npm-compatible package versions are stored in the two `package.json` files.

## Documentation

Start with the [documentation index](docs/README.md) or the [comprehensive user guide](docs/USER_GUIDE.md).

| Guide | Contents |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Stageplot, Studio, projects, equipment, stages, submissions and troubleshooting |
| [Accounts and deployment](ACCOUNT_GUIDE.md) | GitHub OAuth, roles, Empire tags, server configuration, persistence and backups |
| [Studio developer notes](tools/svg-shape-studio/README.md) | Running Studio locally and maintaining shared editor code |

Both apps include **Help** with relevant instructions and a link to the full guide on GitHub.

## Quick start

1. Sign in to Stageplot and create an event. Any approved account can organise events.
2. Add a stage. Edit its **Outline & zones**, then place **House equipment** directly in Stageplot. Save a stage version.
3. Add each band by name and assign its stage. Copy the band's unique edit link and send it yourself.
4. Bands open their link without signing in, add equipment and notes, autosave, submit for review and export PDF.
5. Review the separate plots from the event overview. Approve or request changes, restore saved revisions, or replace/revoke a band's link.

Existing band plots keep their assigned stage version. Preview and apply a newer stage explicitly; band placements remain in place for review. A stage can be copied into another event as a reusable template.

**Quick plot** remains available for an ad hoc drawing. Equipment authors use **Shape Studio**; ordinary event owners do not need Contributor access.

The External equipment library is the default. Empire-tagged owners can choose Empire when creating an event. A band's edit link grants access to its assigned plot and the event's equipment palette. It does not provide account or event-management access.

## Theatre and eisteddfod workflows

Use **Spaces** to maintain regular venue stages independently of events, including fixed equipment and quantities of available movable stock. Use **Productions** to assign a space to a client and automatically create its one layout. Productions retain their own version, notes, reviews and client link.

For an eisteddfod, create one event with one space and choose **Eisteddfod / groups**. Bulk-add group names, optionally copy a common chair/percussion layout, then review and reorder the separate group layouts. Venue quantities apply to each layout, so sequential groups reuse the same stock.

Space updates are applied explicitly to event/production stages, and stage updates are then applied explicitly to individual layouts. The equipment report separates venue requests and client-supplied items.

## Library and collaboration

Shape Studio maintains equipment. Event stages are managed in Stageplot. Admins and the Owner also have **New items** for new submissions. Existing shared items with pending updates are highlighted and offer **Review update**.

All library rows use **Edit**. Contributors save a private working copy using **Save personal copy** or **Update personal copy**. Their active copies are shown alongside shared originals with ** - Personal copy** appended to the display name. Other users cannot browse those drafts. Admins and the Owner edit shared items directly using **Update shape** .

Contributors submit their saved work for review. Resubmitting updates the proposal rather than adding another submission. A reviewer can approve a new item, update the fixed original, or decline. Opening a submission in the editor offers **Save new item**, **Update submitted item (without approving)** and **Approve changes**. Saving without approval updates the contributor's copy and the pending submission, with optional feedback signed by the reviewer's username. Conflict checks protect newer contributor edits.

Empire-tagged users see profile checkboxes and Empire stock quantities. Untagged users see neither; their new equipment and stages default to External. Updating an existing shared item preserves its memberships. Custom shapes remain Studio building blocks.

Event band links keep the same address as bands save new work. Replacing or revoking a link stops guest access while keeping the organiser's saved plot. Stage versions are applied deliberately, with an equipment-conflict preview.

## Local development

Requirements: Node.js 24 or a compatible current Node release, plus npm.

Install both frontend dependency sets:

```powershell
npm.cmd run setup
```

Run setup again after pulling dependency changes. The shared stage editor uses `polygon-clipping` and `fit-curve`. Setup installs the dependency sets for both applications.

Run Stageplot, Shape Studio and the library API together:

```powershell
npm.cmd run dev:all
```

- Stageplot: `http://localhost:5173`
- Shape Studio: `http://localhost:5174`
- Library API: `http://localhost:8787`

Run verification:

```powershell
npm.cmd run lint
node --test --test-isolation=none src/*.test.js tools/*.test.mjs tools/svg-shape-studio/src/*.test.js
npm.cmd run build
npm.cmd run build --prefix tools/svg-shape-studio
```

## Local production build

The default Compose file builds all three images from local source:

```powershell
docker compose up -d --build
```

- Stageplot: `http://localhost:8088`
- Shape Studio: `http://localhost:8089`

For local persistent library data, set this in `.env`:

```env
LIBRARY_DATA_PATH=.
```

Use Docker for production-style testing because the Nginx frontends proxy `/api` to the internal library service.

## Production and Unraid

Pushing `main` runs `.github/workflows/publish-containers.yml`, verifies the code and publishes:

```text
ghcr.io/staljabro/stage-layout-app-stageplot:latest
ghcr.io/staljabro/stage-layout-app-studio:latest
ghcr.io/staljabro/stage-layout-app-library-api:latest
```

`docker-compose.prod.yml` pulls these completed images. A typical Unraid `.env` is:

```env
STAGEPLOT_PORT=8088
STUDIO_BIND=0.0.0.0
STUDIO_PORT=8089
LIBRARY_DATA_PATH=/mnt/user/appdata/stage-layout-app-data
IMAGE_PREFIX=ghcr.io/staljabro/stage-layout-app
IMAGE_TAG=latest
```

Deploy or update from the checked-out repository:

```bash
sh deploy-unraid.sh
```

The script fast-forwards Git, pulls current images, recreates changed containers and displays their status. It does not modify library data.

The same stack can be managed through Unraid Compose Manager. For individual WebGUI containers, place all three on one custom Docker network, name the API container `library-api`, map Stageplot `8088:80`, Studio `8089:80`, and mount:

```text
/mnt/user/appdata/stage-layout-app-data/equipment-library -> /data/equipment-library
/mnt/user/appdata/stage-layout-app-data/stage-library     -> /data/stage-library
/mnt/user/appdata/stage-layout-app-data/account-data      -> /data/account-data
```

## Data persistence and backups

Production images exclude library and account data. On first API startup the mounted JSON libraries are imported into `account-data/stageplot.sqlite`. SQLite becomes authoritative: subsequent saves do not rewrite the source JSON files. Persist the new account-data volume before replacing a container. See [Accounts and collaboration](ACCOUNT_GUIDE.md) for setup and backup instructions.

Retain the import source folders and back up the SQLite database regularly:

```text
equipment-library/
stage-library/
account-data/
```

Do not copy only the live SQLite file while it is running: use `node tools/backup-data.mjs account-data/stageplot.sqlite /path/to/backup.sqlite`, or stop the API before copying the entire account-data directory. Backups contain private account and project information; keep them out of Git and container images.

## Branding and release metadata

Stageplot and Shape Studio share a floor-plan icon. Studio adds an orange **S** badge so browser tabs remain distinguishable. Their SVG favicons live in `public/favicon.svg` and `tools/svg-shape-studio/public/favicon.svg`; the reusable header mark is `src/app-mark.jsx`.

Change `APP_VERSION` in `src/version.js` for a user-facing release. That value is reused by both app headers, both help dialogs and Stageplot’s PDF footer.

## Security notes

- Both frontends proxy account and library requests. The API checks authentication, role and ownership for every protected operation; proxy headers do not grant privileges.
- Use HTTPS when exposing either app. Set STAGEPLOT_SECURE_COOKIE=true behind an HTTPS reverse proxy. Owner approves GitHub access requests; signing in with GitHub alone does not grant private access. Keep the Library API unexposed.
- Listed stage IDs restrict the workflow. Private stage and project sharing require unguessable, revocable tokens. Removing a token from the URL does not reveal private assets.
- Public GHCR images contain application code only, not the mounted equipment or stage library.
