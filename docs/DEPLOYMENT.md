# Deployment, updates and releases

[Guide home](README.md) · [GitHub OAuth setup](../ACCOUNT_GUIDE.md) · [Development](DEVELOPMENT.md)

## Does the normal update workflow change?

**No, when your existing stack follows latest.** Keep this flow:

1. Commit and push to main.
2. Wait for GitHub Actions verification and both image-publishing jobs to succeed.
3. Check for updates in your Compose manager.
4. Pull and recreate/update both services together.
5. Open the app and confirm sign-in, saved stages/layouts and the expected build.

The current production stack uses **stageplot** and **library-api**. Equipment creation is included in stageplot. If an older stack still depends on a separate Studio image, synchronise its Compose definition with the current production file once; the normal publishing workflow now builds the two main services.

Image updates do not automatically change a manually maintained Compose definition or its environment. Bring across relevant configuration changes when adopting a new stack definition.

## Latest versus pinned versions

| IMAGE_TAG | Behaviour |
| --- | --- |
| latest, or the production default | Receives the next successful main build through your normal update checks. |
| A version such as 0.2.7-alpha.0 | Remains on that release until you explicitly change the tag. |
| A published sha-… tag | Selects a specific build, useful for diagnosis or controlled rollout. |

A commit without a version bump still updates latest and the SHA tag. It does not replace an already published version tag or release. The displayed version may therefore stay unchanged across such commits.

To create a new numbered release, run this **before committing and pushing**:

```powershell
npm run release:version -- 0.2.8-alpha.0
```

The command updates `RELEASE_VERSION` in `src/version.js` and syncs both packages and lockfiles. That source file drives the UI, container tags/labels and GitHub releases. You can also edit it directly; builds automatically sync the package mirrors, or run `npm run release:version` with no argument to sync them before committing. After verification and both image builds, a new version receives image tags such as :0.2.8-alpha.0 and a GitHub release v0.2.8-alpha.0. Alpha/beta/rc versions become prereleases.

The release workflow is configured in the repository. A local build does not publish an image or release.

## Choose the correct Compose file

- [docker-compose.prod.yml](../docker-compose.prod.yml) pulls published GHCR images. Use it for the normal image-update workflow.
- [docker-compose.yml](../docker-compose.yml) builds images from the local checkout. Use it when deliberately building from source.

Production service images are:

```text
ghcr.io/staljabro/stage-layout-app-stageplot:<tag>
ghcr.io/staljabro/stage-layout-app-library-api:<tag>
```

IMAGE_PREFIX can point to a different repository namespace. IMAGE_TAG defaults to latest.

## First production setup

1. Put the current production Compose definition in your stack manager or server directory.
2. Configure the private environment using [.env.example](../.env.example).
3. Set LIBRARY_DATA_PATH to a persistent absolute host directory, for example /mnt/user/appdata/stage-layout-app-data on Unraid.
4. Keep account-data, equipment-library and stage-library mounted at the configured paths.
5. Configure GitHub OAuth and the numeric Owner identity using [ACCOUNT_GUIDE.md](../ACCOUNT_GUIDE.md).
6. Put HTTPS in front of the frontend, set STAGEPLOT_APP_URL to its public address and STAGEPLOT_SECURE_COOKIE=true.
7. Start both services, sign in as the configured Owner, and test a normal GitHub signup.

The API stays on the internal Compose network. The frontend proxies /api; a same-origin setup does not need a separate CORS list. Do not publish the API port directly for this deployment.

## Command-line update

Run from the directory containing the production file and private environment:

```powershell
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

In a Compose UI, use its equivalent pull/check-for-updates and recreate/update operation for the whole stack. A simple restart uses the existing container image and does not install an updated image.

Docker documents that up recreates containers when their image or configuration changes while preserving mounted volumes: [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/).

## This roles update

No new service or environment variable is required for automatic User signup. The API migrates stored Editor/Contributor app roles and organisation Member roles to User on startup. IDs, ownership and disabled states remain intact.

People whose app role changed sign in again because old sessions are revoked. Existing app Admin/Owner roles stay unchanged. The normal new-user approval queue is replaced by automatic signup; exceptional older-account linking remains explicit.

Keep the same persistent database mount. Do not start a fresh account-data directory to perform this migration.

## Persistent data

The live database is account-data/stageplot.sqlite under LIBRARY_DATA_PATH. It stores GitHub identity links, app/team roles, equipment, stages and versions, layouts and history, stock, branding and private share tokens.

The JSON equipment/stage folders are initial import inputs. Later edits live in SQLite. Pulling newer images does not refresh library data from JSON or require deleting the database.

Avoid removing volumes or changing the data path during routine updates.

## Backups and restoration

For a consistent running database backup, use the included Node 24 backup utility. The destination directory must already exist.

Local example:

```powershell
node tools/backup-data.mjs account-data/stageplot.sqlite B:/Backups/stageplot-backup.sqlite
```

Production example writing into the already mounted account-data directory:

```powershell
docker compose -f docker-compose.prod.yml exec library-api node tools/backup-data.mjs /data/account-data/stageplot.sqlite /data/account-data/stageplot-backup.sqlite
```

Move the backup to your protected backup storage. Treat it as private: it contains identities, private artwork, layouts and edit links.

For an offline copy, stop the API and copy the entire account-data directory, including any SQLite WAL files. Restore only while the API is stopped.

Before a major update, keep a database backup and note the current image tags/digests. An older image may not understand a newer schema; rolling back code does not roll back the database.

## Check a failed update

- Read both Actions build results; the release is created only after both images publish successfully.
- Check that the stack follows the intended tag and that both services were recreated.
- Inspect API logs for OAuth configuration or database errors.
- Check the persistent path and file permissions.
- Hard-refresh the frontend after the updated stack is running.
- A GitHub release failure can occur after images have already published. Check job results separately before deciding whether an image update is available.

See [Troubleshooting](TROUBLESHOOTING.md) and GitHub's [container publishing documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
