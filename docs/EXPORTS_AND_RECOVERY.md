# Review, exports and recovery

[Guide home](README.md) · [Equipment](EQUIPMENT.md) · [Sharing](SHARING.md)

## Save indicators

Stage and equipment editors use explicit saves. Layouts autosave once per minute while changes are pending, make a best-effort save when the editor closes, and also offer **Save now**. Use **Save with note** for an optional named checkpoint. Wait for **Saved** before leaving after important changes.

**Unsaved changes**, **Saving...** or **Save failed** mean the latest edits are not yet confirmed on the server. Do not assume an open canvas alone means the changes were saved.

## Browser recovery and conflicts

The editor keeps a local session draft. If it differs from the saved server version after reopening, **Restore local work** lets you resume it.

A version/revision conflict means someone else saved a newer server version. The app does not silently overwrite it. Reload/reopen the saved document, inspect the recovery draft and reconcile the intended changes.

Local recovery belongs to that browser session. It is not a server backup and may be unavailable if browser storage is full or disabled.

## Review a client layout

Clients use **Submit for review** when ready. The organiser opens Details & sharing to approve or request changes with feedback. Opening the layout shows its current review state and feedback.

Later edits can change the review state. Review does not transfer layout ownership or unlock stage geometry for clients.

## Public library review

Users submit saved private equipment or stages for app Admin/Owner review. **Public reviews** separates equipment and stage proposals.

Review in the editor, adjust the submitted design if needed, and save review edits to keep it pending. Approve to create/update the separate public record, or decline with feedback. The creator's private original is preserved.

App Admins and the Owner can maintain published equipment/stages. The Owner additionally maintains generic stages and can delete public equipment.

For public equipment, **Return to reviews** removes the current published item from the catalogue and creates a pending review of that published version. The action is available to app Admins and the Owner. The creator's private original and separate pending submissions are preserved, and existing layouts keep their saved snapshots.

Open the returned review to edit, save review edits, approve again or decline. Saving edits keeps the item withdrawn. Reapproval restores its original public ID; declining leaves it out of the public catalogue. Generic equipment can also be returned and reapproved. If a newer version is approved through a separate submission, an older returned review is marked superseded.

## Canvas PDF

Choose **Export PDF** in the stage/layout editor. The browser's print system provides PDF saving and paper/printer settings. Editor panels, selection controls and handles are excluded by the print styles.

The stageplot fits **one page**, including its header. Choose the paper size and portrait/landscape orientation in the print dialog; the canvas scales to the available space while keeping its proportions. There is no fixed A3 requirement. Editor zoom and pan do not affect the export, and visible artwork extending beyond the stage boundary is included.

Curtains retain their wave spacing, colour, physical thickness and opacity in canvas PDFs. Their dotted collision guides and endpoint handles are editor-only. Curtains are stage artwork and do not appear as equipment-list requirements.

The header shows the logo on the left and organisation name (when available), layout name and stage name on separate lines beside it. Without a logo, those details use the header space directly. Stage-only exports omit the layout name. Reopen a layout after an organisation name or logo change to load the current branding.

## Equipment list, CSV and PDF

Open **Equipment list** from the equipment drawer. The report includes hidden equipment because hiding artwork does not cancel a requirement.

Enabled components appear directly beneath the parent equipment, with their placement notes. Disabled components are omitted. Parent equipment totals exclude component rows.

Export CSV for a spreadsheet, or **Export PDF** for the in-app report preview. From the preview choose **Print / save PDF**. Organisation branding is included. Equipment notes and names are treated as text in reports.

The report uses the same logo-and-details header. Equipment lists can continue over multiple pages to keep long requirements readable; the single-page fit applies to canvas exports.

Stock/source columns reflect the current layout's allocations. Untracked quantities are not zero, and explicit source overrides are retained.

## History and stage versions

Details & sharing shows saved layout revisions. Restoring one creates another current revision rather than deleting history.

A source-stage update changes which stage version the layout references. It does not replace the layout's equipment positions. Review fit after applying an update.

## Delete versus remove

**Delete layout** is available to its owner and invalidates its private edit link. The source stage remains.

**Remove from my library** hides a shared document only for your account. Restore it from Removed items.

Owner deletion of public equipment removes it from new catalogue use. Saved layouts retain their pinned artwork, protecting existing arrangements.

## Server backups

Only the deployment administrator can back up or restore the full database. Follow [the backup procedure](DEPLOYMENT.md#backups-and-restoration). PDF/CSV exports are useful records but are not complete database backups.
