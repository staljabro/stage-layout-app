# Organisations, branding and stock

[Guide home](README.md) · [Permissions](ACCOUNTS.md) · [Sharing](SHARING.md)

## Create a private team

Any signed-in User can create an organisation from **Organisations**. Its creator becomes the organisation Owner. Select the organisation in the workspace selector to work with its stages, equipment and layouts.

An organisation does not automatically make all its members' personal work shared. Add the team in equipment save options or stage sharing. Public publishing is a separate choice.

## Invite and manage people

Open the organisation and choose **Create invitation**. Leave email blank for a reusable team link, or enter an email for a targeted invitation. The recipient signs in and chooses **Join organisation**.

Invitations offer User or Admin. Only the organisation Owner can invite administrators or change administrator/Owner roles. Organisation Admins can manage ordinary team users and invitations within their permission limits.

The Owner can transfer organisation ownership to another member. A confirmation must be accepted. Transfer ownership before leaving. Removing a person ends organisation-only access without deleting work they created; other explicit shares or edit links remain separate.

Organisation roles are User, Admin and Owner. App and organisation administration are independent.

## Share team equipment and stages

Share private equipment from its save dialog. Share stages from **Share stage**. Team users can use these assets; team Admins/Owner can edit shared originals.

The source creator continues to control which organisations receive access. Public equipment can be used in a team library without copying it or making it private.

## Rename an organisation

Open the organisation settings as its **Owner**, edit **Organisation name** and choose **Save organisation name**. Names can contain up to 200 characters. Organisation Admins and Users cannot rename the team.

Renaming keeps the same organisation ID, members, stock, assets and invitation links. Existing links and layouts display the new name when reopened. If another owner setting changed while the form was open, reload before saving again.

## Organisation logo

The organisation settings page includes **Organisation logo**. The organisation Owner/Admin can upload, replace or remove it.

The app resizes uploads to at most 512 pixels on the longest side and preserves transparency. Use PNG, JPEG, WebP, GIF or AVIF, preferably a clear logo that reads well on white.

Branding appears on:

- the team's joining invitation;
- stage client invitations assigned to the organisation;
- the resulting layout and its private edit link;
- stage/layout canvas PDF exports in that organisation context;
- the equipment-list PDF preview and exported report.

Existing links use the current logo when reopened. Removing the logo leaves the organisation name. A personal layout does not inherit a team logo solely because its user belongs to a team.

Canvas and equipment-list PDF headers place the logo on the left, with organisation name, layout name and stage name beside it. Missing fields are omitted. Canvas exports fit a single page using the paper size and orientation selected in the print dialog.

## Enter stock quantities

In an organisation workspace, equipment cards show inline quantity fields. Organisation Owners/Admins can edit them. In a personal workspace, **Organisation stock** opens a team chooser.

| Value | Meaning |
| --- | --- |
| Blank | Untracked; no numeric stock limit is applied. |
| 0 | No units in stock. |
| Positive whole number | Units available from that organisation. |

Quantities are independent per organisation and work for public equipment too. Share private equipment with the organisation before allocating stock.

## How stock is allocated

Create a layout in the organisation workspace or assign a client invitation to that organisation. Installed/locked equipment is counted first. Remaining quantities are allocated to movable placements in stable insertion order; rearranging layers does not reshuffle stock.

Automatic sourcing uses venue stock before client supply. **Equipment source** can override an item to Venue supplied or Client supplied. A client-supplied override frees venue stock for another placement.

Explicit stage quantities take precedence over team quantities. Stock is calculated per layout, including hidden equipment. It does not reserve inventory across simultaneous events or dates.

Green equipment tiles/selection indicate available stock, orange indicates external sourcing and neutral/blue indicates untracked items. Equipment list separates stock/venue quantities from external or client-supplied requirements.
