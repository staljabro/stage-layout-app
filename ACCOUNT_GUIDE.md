# Accounts and collaboration

Requires Node 24. GitHub is the only sign-in provider. Stageplot stores app roles, projects and library data in SQLite; it does not store GitHub passwords or retain GitHub access tokens. MFA is not required by this app.

## Configure GitHub sign-in

1. Create an OAuth App in [GitHub Developer settings](https://github.com/settings/developers). Follow [GitHub's OAuth App instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app). Use the public planner URL as the homepage and its `/api/auth/github/callback` endpoint as the authorization callback URL. Use a separate OAuth App for local development if production has a different callback address.
2. Copy `.env.example` to your server's private `.env` if needed. Set `STAGEPLOT_GITHUB_CLIENT_ID`, `STAGEPLOT_GITHUB_CLIENT_SECRET` and `STAGEPLOT_GITHUB_CALLBACK_URL`. Keep the secret on the API server; never prefix it with VITE_ or put it into frontend code. The registered callback must match the configured URL exactly.
3. Set `STAGEPLOT_APP_URL` and `STAGEPLOT_STUDIO_URL` to the two frontend addresses. These origins are the only permitted destinations after sign-in. For development use `http://localhost:5173/`, `http://localhost:5174/` and callback `http://localhost:5173/api/auth/github/callback`. Use the same hostname consistently. Outside localhost the configured addresses must use HTTPS.
4. Find your permanent numeric GitHub account ID: open `https://api.github.com/users/YOUR_USERNAME` and use the `id` field, not `node_id` or your username. Put it in `STAGEPLOT_GITHUB_OWNER_ID`. The app does not make the first visitor Owner.
5. Persist `account-data/` alongside the source equipment and stage libraries. Both Compose files pass the OAuth settings to the API and mount the database directory. Start or restart the stack. For development, `npm run dev:all` and `npm run library` load the root .env file.
6. Choose **Sign in**, then **Continue with GitHub**. Your configured numeric identity becomes Owner on a new installation. GitHub must have at least one verified email address. The requested scopes are only `read:user` and `user:email`; no repository access is requested. GitHub handles credentials and account recovery; no email-delivery service is needed in Stageplot.

The initial JSON libraries are imported once into `account-data/stageplot.sqlite`, leaving source JSON unchanged. Future library edits, approvals, accounts and projects live in SQLite.

## Link existing accounts without losing work

The first startup of this release revokes password-era sessions and removes their stored password hashes. Password sign-in, password reset, setup-token bootstrap and direct account creation endpoints are removed. The old setup-token file is no longer used.

If there is exactly one active existing Owner, the configured GitHub Owner identity is linked to that same app account. Its app user ID, projects, personal artwork and history stay unchanged. If there are multiple Owners, set `STAGEPLOT_OWNER_USER_ID` to the existing Owner's app user ID; the app refuses to guess. This optional ID can be read from the users table by the server administrator. It must refer to an active Owner.

Other existing users sign in through GitHub to create an access request. As Owner, open **Manage users & access requests**, select the user's existing unlinked app account, choose the appropriate role, and approve. Matching emails never link accounts automatically. Linking preserves the original user ID and ownership. A GitHub identity and app account each have at most one link. Username changes update the display name without changing the permanent identity. Owner bootstrap configuration is used only for an unlinked identity; it does not override roles assigned later.

## New users and approval

A new person signs in with GitHub and receives a pending-approval message. They do not receive an app session or access to private data until approved. They can still use the anonymous public planner. In **Manage users & access requests**, Owner can approve them as Editor, Contributor, Admin or Owner, or deny the request. The person signs in again after approval. Existing users can be disabled or have their roles changed; either action revokes their app sessions. The last active Owner cannot be disabled or demoted. There is no automatic account linking by email or username and no automated invitation email.

## Shared login and deployment

Leave `STAGEPLOT_COOKIE_DOMAIN` blank when both apps use one hostname (different ports are supported). A host-only HttpOnly session cookie works across ports. The two Vite apps proxy `/api` to the local API, so `localhost:5173` and `localhost:5174` share login. Use the same hostname consistently; `localhost` and `127.0.0.1` are different hosts.

For your sibling subdomains, set the following production values in the server's private `.env`:

```dotenv
STAGEPLOT_COOKIE_DOMAIN=braithwaite.work
STAGEPLOT_APP_URL=https://stageplot.braithwaite.work/
STAGEPLOT_STUDIO_URL=https://stageplotstudio.braithwaite.work/
STAGEPLOT_GITHUB_CALLBACK_URL=https://stageplot.braithwaite.work/api/auth/github/callback
STAGEPLOT_SECURE_COOKIE=true
```

Set the GitHub OAuth App's authorization callback to the same callback URL. Both Compose files pass the cookie domain to the API. Deploy the updated image (or rebuild for source deployments) and recreate the API container after changing `.env`; restarting an existing container alone does not apply new environment variables. Keep the existing HTTPS reverse-proxy routes for both frontends. Each frontend proxies its own `/api` requests, so no extra CORS configuration is needed.

The domain setting applies to login, session creation, callback cleanup and logout. Shared-domain cookies always use Secure and require HTTPS. They are sent to the parent domain and all its subdomains, so use this only when those services are trusted. All configured frontend and callback hostnames must belong to that domain. Unrelated domains cannot share this cookie. After switching from host-only cookies, clear old site cookies for both app addresses once to avoid duplicate cookie names; subsequent sign-in and logout use the configured shared scope. Leave the domain blank for localhost development.

Use HTTPS for remote accounts. Set `STAGEPLOT_SECURE_COOKIE=true` when TLS terminates at a reverse proxy. The Nginx configs preserve Host including the port and forward requests to the API. Do not expose the API port directly. The API requires a custom request header on mutations; cross-origin requests must match the explicit comma-separated `STAGEPLOT_ALLOWED_ORIGINS` list. No wildcard credentialed CORS is allowed. Same-origin deployments need no CORS configuration. Sign-in initiation is rate limited and app sessions expire after seven days. GitHub callbacks use single-use, browser-bound state and PKCE. GitHub tokens remain on the server only for the identity/email lookup and are not stored or sent to the browser.

Both frontends may be exposed for collaborators once HTTPS and accounts are configured; Studio requires Owner, Admin or Contributor login. Hiding controls is only a usability measure: authorization is enforced on the API itself.

## Roles

| Role | Planner | Studio | Shared library | Accounts |
| --- | --- | --- | --- | --- |
| Owner | Use, save and share own projects | Full | Add, edit, approve, delete and recover | Approve GitHub access, link existing accounts, assign roles, disable |
| Admin | Use, save and share own projects | Full for shared assets and own drafts | Add, edit, approve, delete and recover | Own GitHub account |
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

Use paths appropriate to the server. The same script is included in the API image. Alternatively stop the API and copy the entire account-data directory, including any SQLite WAL files. Restore while the API is stopped. Database backups contain account identity links, private artwork, projects and share tokens and must remain private. Account data and SQLite files are excluded from Git.
