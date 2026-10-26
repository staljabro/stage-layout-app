# Accounts and collaboration

Requires Node 24. GitHub is the only sign-in provider. Stageplot stores app roles, events, band plots, projects and library data in SQLite; it does not store GitHub passwords or retain GitHub access tokens. MFA is not required by this app.

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

A new person signs in with GitHub and receives a pending-approval message. They do not receive an app session or access to private data until approved. They can still use the anonymous public planner. In **Manage users & access requests**, Owner can approve them as Editor, Contributor or Admin, or deny the request. The person signs in again after approval. Existing users can be disabled or have their roles changed; either action revokes their app sessions. The configured Owner cannot be disabled or demoted. There is no automatic account linking by email or username and no automated invitation email.

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
| Owner | Use, save and share own projects | Full | Add, edit, approve, delete and recover | Approve GitHub access, link existing accounts, assign non-Owner roles, disable non-Owners |
| Admin | Use, save and share own projects | Full for shared assets and own drafts | Add, edit, approve, delete and recover | Own GitHub account |
| Contributor | Use shared assets and own drafts immediately | Create and edit own assets; copy published designs | Submit and update proposals for approval | Own GitHub account |
| Editor | Manage own events, stages and band plots; use published equipment | None | Read published assets | Own GitHub account |

Projects are private to their creator, including against Owner/Admin account access. Admin cannot browse another user's personal drafts. Personal working copies are private to their creator, including against Owner access. Submission reviewers can inspect the exact submitted snapshot without access to the creator's other drafts.

## Event ownership and guest editing

Every approved account role can create reusable spaces, theatre productions, events and event stages in Stageplot. Spaces and productions are owned by the account, with the same private ownership rules as events. Equipment authoring still requires Contributor, Admin or Owner access. Events and band plots are private to their owner, including against other Admin and Owner accounts.

Each band receives a unique, high-entropy edit token. It grants access to that plot, its pinned stage, and the event's published equipment palette. Guests cannot browse the organiser's account, other bands or unrelated personal drafts. Event invitations explicitly grant their event palette; ordinary Empire library access still requires an Empire tag. Guest writes cannot replace the server-owned stage or provide arbitrary library artwork.

Band links remain stable across saves. Replace or revoke a link to end access. Revocation is checked again before committing a guest write. Plot revisions use optimistic concurrency; stale saves return a conflict. Submissions, reviews, stage updates and restoration create revisions. New stage versions do not alter plots until deliberately applied.

The API creates the event tables automatically at startup. Reusable spaces, space versions, productions, events, stage versions, client/group layouts and their revisions live in the existing SQLite database and are included in its normal backup. No separate storage service or mail sender is required. Organisers copy and send invitations themselves.

## Personal assets and approvals

Contributor saves automatically create personal assets. They appear immediately in that user's planner; personal stock is never tracked. Contributors opening a shared design for editing create a personal copy with a proposed replacement reference. All library rows use **Edit**. Contributors editing a shared item save through **Save personal copy**; an existing personal copy uses **Update personal copy**. A private copy is created on save, not on opening the editor. Admins and Owners use **Edit** to update the shared item directly. The original stays unchanged. Personal designs can request profile membership, but only approval makes them shared. Shared stock quantities are preserved when approving a proposed replacement.

**Submit for review** captures the latest saved draft. **Update proposal** replaces the snapshot in the same submission, including after changes were requested or an earlier proposal was published. Matching uses the draft identity, proposed shared target, or a matching name within the same user's equipment or stage proposals. Different users and asset types keep separate proposals. Renaming the same draft does not create another proposal.

The workflow labels are **Draft**, **Pending review**, **Declined** and **Published**. Saving does not change the submitted snapshot: submit again to send the latest edits. Personal drafts stay usable immediately. Revision data remains stored for recovery, but version history is not shown in the library or review interface.

Shape Studio maintains equipment. Event stages are built and versioned directly in Stageplot. Admins and Owners also see **New items**, containing new equipment and stages awaiting review. Pending updates highlight the existing shared item in amber, with **Review update** on the same row. Personal working copies use a flat blue background. Rows remain one line high; narrow windows scroll horizontally. Stage link controls are available through **Sharing**.

**Review submission** and **Review update** show the submitted design and three decisions: **Approve as new item**, **Approve item update**, or **Decline**. Updates are locked to the original shared item. The current library artwork and submitted artwork are shown together in the review window. Updating preserves its identity and stock quantity; creating a new item leaves the original unchanged. Optional feedback accompanies a decline. Review messages appear under **View feedback** beside the contributor's draft, including approval and decline messages. Contributors can read the message and resubmit. A **Submit saved draft** button is also available while editing a personal design. Save before submitting. Revisions and JSON details are not part of the review interface.

The configured Owner is fixed. Owner is absent from role choices, and the Owner account has no role or disable controls. The API also rejects attempts to assign Owner or modify or disable the existing Owner. Initial Owner setup still uses the configured GitHub identity.


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

Approved working copies do not appear as duplicate library rows. Contributors see the shared original and their own active working copies together. Personal rows append ** - Personal copy** to the display name without changing the stored name. Personal edits made after submission are kept visible until submitted and approved.

For Admins and Owners, an existing shared item uses **Update shape** or **Update stage**. Opening a submission in the editor retains its submission context. Saving opens three choices: **Save new item** creates a separate shared asset and leaves the submission pending; **Update submitted item (without approving)** updates the proposal snapshot and the contributor's personal copy, while keeping the submission pending; **Approve changes** publishes the edited proposal to its fixed target. Reviewer messages are visible through **View feedback** beside the contributor's personal copy. Reviewer saves preserve ownership, private stage links and equipment grants. If the contributor has saved newer changes since submitting, reviewer updates are blocked until they resubmit. Studio refreshes library data when its window regains focus; an already open editor keeps its local work and checks for conflicts when saving.

Stageplot groups PDF export, local project saving/loading and New project in **Save / Load**. The **Shape Studio** and **Stageplot** toolbar buttons link between the apps for Contributors, Admins and Owners, using the configured frontend URLs. In **My projects**, first delete a project, then choose **Delete permanently** to remove it and all revisions. This action is restricted to the project owner and cannot be undone; the API rejects stale project revisions or projects that have not been deleted first.

## Empire access

In **Manage users & access requests**, the Owner can toggle **Empire** beside any account. This tag is independent of role. Existing and newly configured Owners start with Empire access; other accounts start without it. Untagged users and anonymous visitors cannot access the Empire profile or Empire-only equipment/stages, including through direct asset URLs, Studio listings, submissions or share links. Items tagged both Empire and External remain available externally.

For tagged users, Studio's **Stageplot** button opens an **External Stageplot / Empire Stageplot** chooser. Untagged users go straight to External Stageplot. Access is checked on every API request, so changing the tag does not require recreating the account or logging out. Existing data is migrated automatically; keep the existing account-data volume.

Untagged Studio users do not see Empire/External membership controls or Empire quantities. New equipment and stages are assigned External automatically. Editing a shared item preserves its existing profiles and stock; approving an update also preserves the shared target's membership.

For everyday workflows and screenshots-independent instructions, see the [comprehensive user guide](docs/USER_GUIDE.md).

### Friendly names

The Owner can set **Friendly name** beside any account in user management, including their own. Leave the field or press Enter to save; clear it to fall back to the GitHub username. Submission author labels use the current friendly name when present. New or edited feedback uses it in the reviewer signature; existing saved feedback retains its recorded signature. This changes display names only, not GitHub identity, roles or ownership.
