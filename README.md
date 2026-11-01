# Stageplot

Build a stage, create your equipment, arrange a layout and share it with a client or a whole festival. Stageplot combines stage design and equipment placement in one canvas, with private libraries, organisation stock, reusable stages and PDF exports.

**[Open the Stageplot user guide](docs/README.md)** · [First layout](docs/USER_GUIDE.md) · [Accounts and roles](docs/ACCOUNTS.md) · [Deployment and updates](docs/DEPLOYMENT.md)

## How it works

1. Sign in with GitHub. Your account becomes a **User** automatically.
2. Create a stage or use a stage you can access. Add zones, curtains and installed equipment if needed.
3. Create your own equipment, including image layers and component requirements, or use public/team equipment.
4. Create a layout for yourself, or send one stage invitation to many clients. Each client receives a separate layout.
5. Arrange equipment, add component notes, check venue stock and export a single-page canvas that fits your chosen paper size, or an equipment list.

Stages are versioned sources. Layouts reference a stage version and keep their own equipment, notes and revision history. Clients can add equipment and toggle optional stage parts without editing the source stage. Shared inspector controls remain available for multi-selection, with differing values shown as **Mixed**.

## Accounts and privacy

The app roles are **User**, **Admin** and **Owner**. Users create equipment, stages, layouts and organisations. Admins review and maintain public libraries. The Owner also manages app accounts, generic stages and public-equipment deletion.

Equipment starts private. Share it with a team, or submit it for public review. Organisations also have User/Admin/Owner roles; these apply to that team, independently of app-wide roles. Guests can use generic stages or client invitations without an account.

Organisation owners can rename their team in its settings. PDF headers show the organisation logo beside the organisation, layout and stage names when available.

The **app Owner** has **Import & restore** for archived stages/equipment, stage/equipment JSON files and **Use as template** on stage cards. These create private copies and preserve originals. See [imports, templates and safe cleanup of old JSON](docs/IMPORTS.md).

App Admins and the Owner can **Return to reviews** to withdraw public equipment, edit its published version and approve it again. Existing layouts retain their saved equipment, and reapproval keeps the same public item ID.

See [accounts and permissions](docs/ACCOUNTS.md), [organisation libraries](docs/ORGANISATIONS.md) and [sharing](docs/SHARING.md).

## Run locally

Requires Node 24 and npm:

```powershell
npm run setup
npm run dev:all
```

Open http://localhost:5173. The API uses port 8787; Vite proxies `/api`. Copy [.env.example](.env.example) to your private `.env` and follow the [GitHub sign-in setup](ACCOUNT_GUIDE.md). Equipment authoring is included in the main app.

## Deploy and update

Production uses the `stageplot` frontend and `library-api` service from [docker-compose.prod.yml](docker-compose.prod.yml). Both images are published to GHCR after a successful push to `main`.

**Your existing latest-image workflow stays the same:** push to main, wait for both Actions image builds, check the Compose stack for updates, then update both services together. Leave `IMAGE_TAG=latest` to follow main. Image updates preserve the mounted database.

All app, container and release versions come from `RELEASE_VERSION` in [src/version.js](src/version.js). Edit it directly, or update it and the generated package metadata together before committing and pushing:

```powershell
npm run release:version -- 0.2.8-alpha.0
```

Builds automatically sync both packages and lockfiles from `src/version.js`; `npm run release:version` also syncs them after a direct edit. CI reads the same source to create matching versioned image tags and a GitHub release when that version is new. Existing version tags stay fixed; later commits still update `latest` and SHA tags. A stack pinned to a version must change `IMAGE_TAG` explicitly.

Read [deployment, Unraid/Compose updates and backups](docs/DEPLOYMENT.md) before the first production deployment.

## Verify changes

```powershell
npm run lint
node --test --test-isolation=none src/*.test.js tools/*.test.mjs tools/svg-shape-studio/src/*.test.js
npm run build
```

Tests cover accounts, migrations, privacy, sharing, public review, inventory, geometry and browser workflows. Browser tests require Chrome, Edge or Chromium; `STAGEPLOT_TEST_BROWSER` can specify its executable.

## Documentation

Start at the [guide home](docs/README.md) for the full chapter index. Developers can use [development notes](docs/DEVELOPMENT.md) and the [architecture reference](docs/APP_FLOW_REVIEW.md). Existing `stageplot-item@3` equipment remains supported; retained older records are covered by [import and recovery](docs/TROUBLESHOOTING.md).
