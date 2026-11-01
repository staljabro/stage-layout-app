# Accounts, roles and ownership

[Guide home](README.md) · [Server configuration](../ACCOUNT_GUIDE.md)

## GitHub sign-in

Stageplot uses GitHub sign-in. Choose **Continue with GitHub**, authorise access to your profile and email, and return to the app.

A new verified GitHub identity automatically receives a **User** account and session. There is no normal signup approval queue. The first person to sign in does not automatically become Owner; the server's configured numeric GitHub Owner ID determines that identity.

Stageplot does not store GitHub passwords or retain the OAuth access token after sign-in. GitHub manages password recovery and GitHub security settings.

## App roles

| Capability | User | Admin | Owner |
| --- | --- | --- | --- |
| Create private stages, equipment and layouts | Yes | Yes | Yes |
| Create organisations and invite a team | Yes | Yes | Yes |
| Use accessible public/private/team assets | Yes | Yes | Yes |
| Submit stages/equipment for public review | Yes | Yes | Yes |
| Review public submissions | No | Yes | Yes |
| Withdraw public equipment and return it to reviews | No | Yes | Yes |
| Edit public equipment and public stages | No | Yes | Yes |
| Edit supplied generic stages | No | No | Yes |
| Delete public equipment | No | No | Yes |
| Import stage/equipment JSON, restore archives and use stage templates | No | No | Yes |
| Manage app accounts, roles and disabled status | No | No | Yes |

Admin status is not blanket access to everyone's private originals. Reviewers see submitted snapshots. Private collaboration still depends on ownership, organisation membership or an explicit share.

## Organisation roles

Organisation roles use the same names but apply only to one team:

- **User:** use shared equipment/stages, create layouts in that workspace and collaborate on accessible team layouts.
- **Admin:** also maintain shared team assets, stock, branding, invitations and team layout review.
- **Owner:** also manage administrators, rename the organisation and transfer organisation ownership.

An organisation Admin is not automatically an app Admin. Creating an organisation makes you its Owner without changing your app role.

## Who owns what?

Equipment and stages you create belong to your app account. Sharing them with an organisation gives team access; it does not make them public or transfer their creator's ownership.

A layout you create directly belongs to you, including on someone else's stage. You can optionally share it with the stage owner. Organisation membership can provide additional layout access.

A layout created through a client invitation belongs to the organiser. Signing in as the client gives account access to the same layout; it does not transfer the organiser's ownership.

Guests can create equipment layouts on generic or invited stages. They cannot edit source stage geometry or author equipment library items.

## Existing accounts

Existing app Editor/Contributor roles migrate to **User**. Existing organisation Member roles migrate to **User**. IDs, ownership, disabled state and saved work are preserved. Sessions for changed app roles are revoked; those people sign in with GitHub again.

An identity already linked to GitHub returns to its existing account. A GitHub username change does not create a new account because the numeric identity remains the same.

If a verified GitHub email matches an older account that is not linked to that identity, automatic ownership transfer is blocked. Ask the app Owner to use **Manage users & account linking** and select the correct existing account. Matching email alone never links accounts. This exception protects retained work; ordinary new signups remain automatic.

## Managing app accounts

Only the app Owner sees account management. Open the account menu and choose **Manage users & account linking**.

The Owner can assign User/Admin, disable or re-enable an account, and set a friendly display name. Role/disabled changes revoke that account's current sessions. Disabled linked identities cannot bypass the block by signing up again.

The app Owner identity is configured on the server and cannot be reassigned through the ordinary role dropdown. Organisation ownership transfer is a separate in-app action.
