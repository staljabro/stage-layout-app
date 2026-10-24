# Accounts and collaboration

Requires Node 24. The API uses built-in SQLite and salted scrypt password hashes; no external database or identity provider is required.

## First startup

1. Persist `account-data/` alongside the existing equipment-library and stage-library volumes. Both Compose files include the new mount.
2. Start the API and both apps (`npm run dev:all` locally). The initial JSON libraries are imported once into `account-data/stageplot.sqlite`; source JSON is left unchanged. All future library edits, accounts, approvals, projects and revision history live in SQLite.
3. Read `account-data/setup-token` on the server. Open Sign in, enter that token, your name/email and a password of at least 12 characters to create the first Owner. Setup is disabled once any account exists. You can alternatively set `STAGEPLOT_SETUP_TOKEN` for the initial bootstrap. Never put the token in a public URL.
4. Use the account button, then **Manage users**, to create accounts with an initial password and role. Share credentials with each person privately. They can change their password in their account panel. Owner can reset passwords and disable accounts; resetting passwords, changing roles and disabling an account revoke that account's sessions. The last active Owner cannot be disabled or demoted.

There is no anonymous account registration, email delivery or email-based password recovery. Owner handles account provisioning and recovery.

## Shared login and deployment

Host the two apps on the same hostname (different ports are supported), or route them under one origin. A host-only HttpOnly session cookie works across ports. The two Vite apps proxy `/api` to the local API, so `localhost:5173` and `localhost:5174` share login without cross-site cookies. Use the same hostname consistently; `localhost` and `127.0.0.1` are different hosts. Unrelated hostnames do not share login.

Use HTTPS for remote accounts. Set `STAGEPLOT_SECURE_COOKIE=true` when TLS terminates at a reverse proxy. The Nginx configs preserve Host including the port and forward requests to the API. Do not expose the API port directly. The API requires a custom request header on mutations; cross-origin requests must match the explicit comma-separated `STAGEPLOT_ALLOWED_ORIGINS` list. No wildcard credentialed CORS is allowed. Same-origin deployments need no CORS configuration. Login is rate limited and sessions expire after seven days.

Both frontends may be exposed for collaborators once HTTPS and accounts are configured; Studio requires Owner, Admin or Contributor login. Hiding controls is only a usability measure: authorization is enforced on the API itself.

## Roles

| Role | Planner | Studio | Shared library | Accounts |
| --- | --- | --- | --- | --- |
| Owner | Use, save and share own projects | Full | Add, edit, approve, delete and recover | Create accounts, assign roles, disable, reset passwords |
| Admin | Use, save and share own projects | Full for shared assets and own drafts | Add, edit, approve, delete and recover | Own password |
| Contributor | Use shared assets and own drafts immediately | Create and edit own assets; copy published designs | Submit fixed revisions for approval | Own password |
| Editor | Use published assets, save and share own projects | None | Read published assets | Own password |

Projects are private to their creator, including against Owner/Admin account access. Admin cannot browse another user's personal drafts. Owner can manage all library assets for recovery/administration. Submission reviewers can inspect the exact submitted snapshot without access to the creator's other drafts.

## Personal assets and approvals

Contributor saves automatically create personal assets. They appear immediately in that user's planner; personal stock is never tracked. Opening a shared design for editing creates a personal copy with a proposed replacement reference. The original stays unchanged. Personal designs can request profile membership, but only approval makes them shared. Shared stock quantities are preserved when approving a proposed replacement.

**Submit for approval** captures the saved revision. The contributor can continue editing and using the personal draft while it is pending. **Submissions & recovery** shows status, reviewer notes and the submitted snapshot. Admin/Owner can preview it in the canvas, approve it, or return it with a note. Approval publishes a separate shared asset or updates the proposed shared target; the creator keeps their personal draft. Approval never silently uses a newer private edit. If a replacement target changed after submission, approval fails and a new proposal is required. There can be one pending submission per personal asset.

**History** restores an earlier asset revision as a new revision. Delete moves assets to recoverable storage. **Submissions & recovery** restores deleted assets. The API does not expose permanent deletion. Restoring a link-only stage generates a new token.

## Projects and client sharing

Anonymous users can plan, download and open project files. Logged-in users also get **My projects**: create a new private account save, update the current account project, open it, view history, delete and restore. Saves include only the stage and equipment definitions used by that project, without Studio editor data or stage share tokens. Updating an account project checks its revision to prevent overwriting another tab's save.

New files and account projects pin artwork revisions. Library edits and deletions do not change saved geometry. **Refresh items** deliberately adopts current accessible equipment artwork. Stock availability remains live. Reference-only files from older releases still resolve against accessible library data.

**Create/reset share link** grants anyone holding the URL access to the saved project, its stage and its included equipment revisions. It does not expose other projects or private library assets. Clients can adjust the layout locally and download their own copy; they cannot overwrite the source account project. **Disable share**, saving a new account revision, restoring or deleting the project invalidates its previous link.

For a stage-only workflow, set a personal stage to **Link only**, choose which personal equipment is included, and copy the External or Empire stage link. The server grants only those selected assets. Unrelated personal equipment remains private. Resetting the stage link or switching it to Draft revokes client access. A contributor's personal stage never appears in the anonymous stage picker; approval creates a separate shared stage.

## Persistence and backups

Mount `/data/account-data` permanently in the API container. Source JSON folders are one-time import inputs, not the live database. Do not delete the database to refresh library files: doing so would remove accounts, projects and history. Application image updates do not modify the mounted data.

For a consistent running backup:

```powershell
node tools/backup-data.mjs account-data/stageplot.sqlite B:/Backups/stageplot-backup.sqlite
```

Use paths appropriate to the server. The same script is included in the API image. Alternatively stop the API and copy the entire account-data directory, including any SQLite WAL files. Restore while the API is stopped. Database backups contain password hashes, private artwork and projects and must remain private. Account data and SQLite files are excluded from Git.
