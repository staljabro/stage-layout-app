# Stageplot guide

Welcome to the Stageplot documentation. Use this as a wiki: start with a task, then follow the linked chapters for details.

## Start here

- **[Create your first stage and layout](USER_GUIDE.md)** — the complete everyday workflow.
- **[Accounts and permissions](ACCOUNTS.md)** — GitHub signup, User/Admin/Owner roles, privacy and ownership.
- **[Stage and layout editor](CANVAS.md)** — boundary editing, equipment placement, layers, snapping, collisions and keyboard controls.
- **[Equipment creation](EQUIPMENT.md)** — artwork, images, crop, components and public submissions.
- **[Organisations, branding and stock](ORGANISATIONS.md)** — private team libraries, membership, logos and quantities.
- **[Sharing and client invitations](SHARING.md)** — individual access, festival registration and collaborative links.
- **[Review, exports and recovery](EXPORTS_AND_RECOVERY.md)** — approvals, CSV/PDF, source updates, revisions and local drafts.
- **[Troubleshooting](TROUBLESHOOTING.md)** — sign-in, saving, images, stock, sharing and updates.

## Running your own instance

- **[Deployment and updates](DEPLOYMENT.md)** — the current push-to-main and Compose workflow, image tags, persistent data and backups.
- **[GitHub OAuth and account administration](../ACCOUNT_GUIDE.md)** — server settings, Owner setup and older-account linking.
- **[Development](DEVELOPMENT.md)** — local setup, tests, builds and release versioning.
- **[Import, restore and templates](IMPORTS.md)** — app Owner tools, retained stages/equipment and safe JSON cleanup.
- **[Architecture](APP_FLOW_REVIEW.md)** — data model, permissions, API and migration boundaries.
- **[Repository home](../README.md)**.

## Current release

- **[0.5.7-alpha.0 release notes](RELEASE_NOTES_0.5.7-alpha.0.md)** — editable installed assets, validation, revision previews and deployment hardening.

## What Stageplot calls things

| Term | Meaning |
| --- | --- |
| Stage | A saved venue boundary, stage layers and installed equipment. |
| Layout / stageplot | An equipment arrangement referencing a particular stage version. |
| Curtain | A stage line with fixed 10 cm peak-to-trough folds, adjustable length and styling. See [curtains](CANVAS.md#curtains). |
| Installed equipment | Equipment placed by the stage author. It stays locked unless the author marks it editable and the layout user enables **Edit stage assets**; it cannot be deleted. |
| Available equipment | The movable equipment offered to layout users. |
| Component | A named requirement attached to equipment, with a per-placement checkbox and note. |
| Organisation | A private team library, its members, branding and stock. |
| Client invitation | One reusable link that creates a separate layout for each registration. |
| Edit link | A private link for collaborating on one existing layout. |

The current application uses one workspace and canvas. App roles and organisation roles are explained separately in [Accounts](ACCOUNTS.md); ordinary GitHub signups do not require approval.
