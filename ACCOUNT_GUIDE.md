# GitHub sign-in and account administration

[Guide home](docs/README.md) · [User roles](docs/ACCOUNTS.md) · [Deployment and updates](docs/DEPLOYMENT.md)

Stageplot uses GitHub sign-in and Node 24. New accounts immediately become **Users**; they do not need approval. App **Admins** manage public review, and the configured app **Owner** also manages accounts.

## Configure GitHub OAuth

1. Create an OAuth App in [GitHub Developer settings](https://github.com/settings/developers). Use the public Stageplot URL as its homepage and the same site's /api/auth/github/callback endpoint as its callback. Follow [GitHub's OAuth App instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).
2. Set STAGEPLOT_GITHUB_CLIENT_ID and STAGEPLOT_GITHUB_CLIENT_SECRET in the API server's private environment. Never place the secret in frontend code or a VITE_ variable.
3. Set STAGEPLOT_GITHUB_CALLBACK_URL to the exact registered callback. Set STAGEPLOT_APP_URL to the public app address, including its intended hostname.
4. Set STAGEPLOT_GITHUB_OWNER_ID to the permanent numeric GitHub account ID from the id field at https://api.github.com/users/YOUR_USERNAME. Use neither the username nor node_id.
5. Start/recreate the stack and sign in with that configured identity. It becomes Owner on a new installation. Other new identities become Users.
6. GitHub must supply a verified email address. The scopes are read:user and user:email; repository access is not requested.

Use a separate OAuth App for local development when its callback differs. The usual development callback is http://localhost:5173/api/auth/github/callback. The production callback must use the actual public HTTPS address.

## Environment reference

| Variable | Purpose |
| --- | --- |
| STAGEPLOT_GITHUB_CLIENT_ID | OAuth App client ID. |
| STAGEPLOT_GITHUB_CLIENT_SECRET | Server-only OAuth secret. |
| STAGEPLOT_GITHUB_CALLBACK_URL | Exact callback registered with GitHub. |
| STAGEPLOT_APP_URL | Main public frontend/return address. |
| STAGEPLOT_GITHUB_OWNER_ID | Numeric GitHub identity reserved for Owner bootstrap. |
| STAGEPLOT_OWNER_USER_ID | Optional existing app Owner ID when multiple active older Owners exist. |
| STAGEPLOT_SECURE_COOKIE | Set true for HTTPS production, including HTTPS terminated by a reverse proxy. |
| STAGEPLOT_COOKIE_DOMAIN | Optional shared parent domain for deliberately trusted sibling frontends; otherwise blank. |
| STAGEPLOT_STUDIO_URL | Optional additional trusted frontend; not needed for the normal single-app deployment. |
| STAGEPLOT_ALLOWED_ORIGINS | Optional exact origins for a separately hosted frontend; blank for the same-origin proxy. |

Changing environment values requires container recreation. Use one consistent hostname; localhost and 127.0.0.1 have different cookie scopes.

## Automatic signup

GitHub OAuth verifies the identity, and Stageplot creates a User account and session immediately. The first arbitrary visitor is never made Owner. Signup works even before an Owner identity is configured, but account administration needs an Owner.

Once linked, the permanent numeric GitHub ID selects the existing app account. Username changes update the login label rather than creating a new identity. Disabled linked accounts remain disabled. Configure the intended Owner identity before its first sign-in: bootstrap applies to unlinked identities and does not silently reassign already linked accounts. Existing-identity recovery requires the server administrator.

Old pending/rejected requests are no longer a normal signup gate. A new identity with a free verified email can sign in as User.

## Preserve older accounts

Existing app Editor/Contributor roles migrate to User. Existing organisation Member roles migrate to User. The migration preserves IDs, ownership, private data and disabled state. Sessions belonging to changed app roles are revoked; those users sign in again. Admin/Owner roles remain.

For an unlinked configured Owner identity, one active existing Owner is reused. If multiple active Owners exist, set STAGEPLOT_OWNER_USER_ID explicitly to the one to retain. Bootstrap does not override later account role assignments for an identity that is already linked.

If another verified GitHub identity has an email already used by an existing app account, sign-in returns link-required. It does not attach ownership based solely on that matching email.

As Owner, open **Manage users & account linking**, verify the person, select the correct existing unlinked app account, choose User/Admin, and link it. The user then signs in again. Linking preserves the original app user ID and saved work. A GitHub identity and an app account each have at most one identity link.

## Account management

The app Owner can assign User/Admin, disable/re-enable accounts and set friendly display names. Role/disabled changes revoke current sessions. The reserved Owner cannot be disabled or demoted through the normal dropdown.

Organisation User/Admin/Owner permissions are separate. An organisation Owner can transfer that team's ownership in the app; it does not transfer the global Owner role.

Only the global app Owner can import equipment/stage JSON, restore archived records or use stage templates. App Admins and organisation Owners do not receive these tools. Normal equipment copies and layout creation remain available according to asset access. See [import and restoration](docs/IMPORTS.md).

Stageplot stores neither GitHub passwords nor retained GitHub access tokens. GitHub handles credentials and account recovery.

## Data and backups

Keep account-data mounted persistently. The database holds users, identities, private assets, share tokens, organisation logos/stock and document history. Initial JSON libraries are imported without changing their source files.

Do not delete the database to refresh assets or migrate roles. Follow [backup and restoration](docs/DEPLOYMENT.md#backups-and-restoration). Database backups contain private data and must remain private.

## Further reading

- [Accounts, permissions and ownership](docs/ACCOUNTS.md)
- [Organisation libraries and stock](docs/ORGANISATIONS.md)
- [Stage and client sharing](docs/SHARING.md)
- [Production update workflow](docs/DEPLOYMENT.md)
- [Architecture](docs/APP_FLOW_REVIEW.md)
