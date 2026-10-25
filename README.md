# Stage Layout App

Stage Layout App combines two applications with one shared library and account service:

- **Stageplot** arranges equipment on real-scale stages, saves private shows, shares client links and exports PDFs and equipment lists.
- **Shape Studio** creates equipment artwork, collision footprints and stages. Contributors work on personal copies; Admins and the Owner can edit shared items and review submissions.
- **Library API** stores accounts, assets, submissions, projects and revision data in SQLite. GitHub provides sign-in; the API enforces roles, ownership and Empire access.

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

1. Open Stageplot and choose a listed stage or enter a rectangular space.
2. Click or drag equipment into the layout. Move, rotate, group and arrange it using Layers and Inspector.
3. Open **Save / Load** to update or save a cloud project, start a new project, load/download a project file, or export PDF.
4. Signed-in users can open **My projects** to recall, share, restore or delete account projects.
5. Contributors, Admins and the Owner can use the **Stageplot Studio** toolbar button to create equipment and stages.

The External planner is the normal URL. Empire access is an independent user tag assigned by the Owner. Tagged users can choose External or Empire when leaving Studio; Empire-only assets and the Empire planner require that access. External events do not track stock.

## Library and collaboration

Studio has **Equipment** and **Stages** tabs. Admins and the Owner also have **New items** for new submissions. Existing shared items with pending updates are highlighted and offer **Review update**.

All library rows use **Edit**. Contributors save a private working copy using **Save personal copy** or **Update personal copy**. Their active copies are shown alongside shared originals with ** - Personal copy** appended to the display name. Other users cannot browse those drafts. Admins and the Owner edit shared items directly using **Update shape** or **Update stage**.

Contributors submit their saved work for review. Resubmitting updates the proposal rather than adding another submission. A reviewer can approve a new item, update the fixed original, or decline. Opening a submission in the editor offers **Save new item**, **Update submitted item (without approving)** and **Approve changes**. Saving without approval updates the contributor's copy and the pending submission, with optional feedback signed by the reviewer's username. Conflict checks protect newer contributor edits.

Empire-tagged users see profile checkboxes and Empire stock quantities. Untagged users see neither; their new equipment and stages default to External. Updating an existing shared item preserves its memberships. Custom shapes remain Studio building blocks.

Stage **Sharing** settings offer Listed, Link only and Draft visibility. Stage links point to the fixed public planner at https://stageplot.braithwaite.work/. Share tokens grant access to specific stages or saved projects, subject to Empire access. See the [user guide](docs/USER_GUIDE.md) before sharing private artwork with clients.

## Local development

Requirements: Node.js 24 or a compatible current Node release, plus npm.

Install both frontend dependency sets:

```powershell
npm.cmd run setup
```

Run setup again after pulling dependency changes. Shape Studio has its own dependency set, including `polygon-clipping` and `fit-curve`; installing only at the repository root does not install these.

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
