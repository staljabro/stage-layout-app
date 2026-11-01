# Import, restore and stage templates

[Guide home](README.md) · [Equipment](EQUIPMENT.md) · [Backups](DEPLOYMENT.md#backups-and-restoration)

These tools are restricted to the **app Owner**. App Admins, regular Users and organisation Owners cannot import JSON, restore archives or use a stage as a template. They can still create equipment and stages normally, create layouts on accessible stages, and make private copies of accessible equipment.

## Restore an archived stage

1. Sign in as the app Owner and open **Import & restore**.
2. Under **Archived stages**, find the stage and choose **Use as template**.
3. Name the new stage and optionally select organisations to share it with.
4. Choose **Continue** to create it and open the stage editor.

The new stage has a fresh ID, belongs to your account and starts at version 1. Its outline, zones, text, curtains, installed equipment, available-equipment snapshots and editor artwork are preserved. Older stage folders are recognised. Existing stage sharing, public/generic status, invitations and layout history are not copied. The archived original remains unchanged.

The archive lists retained shared stages and your own older stages. The app Owner does not gain access to another user's private originals through this tool.

## Use a current stage as a template

As the app Owner, choose **Use as template** on a stage card in Stages, Public stages or the generic-stage list. Enter the new name and optional organisations. This creates an independent stage for further stage editing.

The original must be accessible to you. To arrange equipment on a source stage without creating another stage, use **Create layout** instead.

## Import stage JSON

Choose **Import stage JSON** from Stages or Import & restore. Select a compatible `stageplot-stage@1` file, name the new stage and continue. Files from the old `stage-library` folder use this format.

Available equipment must be resolvable from accessible library records, retained shared equipment or embedded snapshots. If an import reports missing equipment, restore its equipment record first or provide its compatible snapshot. The original file is not modified.

## Restore or import equipment

Under **Archived equipment**, choose **Restore private copy** to create a new editable item. Compatible `stageplot-item@3` files can be selected with **Import equipment JSON** from Equipment or Import & restore. Artwork, image layers, collisions, components and adjustable controls are retained.

Imports create private items owned by your account. Share with organisations or submit for public review separately. Ordinary **Make private copy** remains available to signed-in users for equipment they can access.

Legacy files tagged as custom shapes are normalised to placeable equipment when imported here. The source preset/file is preserved. Already-imported private equipment with this older tag can be corrected from **Equipment → Recover saved equipment → Show in equipment library**, preserving its ID and artwork. Saving the affected item again in the equipment editor also corrects the tag.

## Where records are stored

Current records and archived originals live in `account-data/stageplot.sqlite`. On a Compose host this is `${LIBRARY_DATA_PATH}/account-data/stageplot.sqlite`; inside the API container it is `/data/account-data/stageplot.sqlite`.

The old `equipment-library/*.stageplot-item.json` and `stage-library/*.stageplot-stage.json` files are initial import inputs. The first database startup copies their records and the equipment groups into SQLite, then records completion. Later edits and restoration use SQLite. Adding or editing files in those folders afterwards does not trigger another automatic import; use the Owner's import controls.

## Can I delete the old JSON files?

**Yes, after verifying their contents are in SQLite and taking a database backup.** Confirm the stages appear in Import & restore and check the equipment in its library/archive. Import any files that were added or changed after the initial startup before removing those copies.

Once imported, removing source JSON does not delete the stored originals, current assets, layouts or history. Restoration continues to work from SQLite. Keep the mounted library directories for your Compose configuration, and keep `account-data` and your database backups. An archive of the old files is useful if you later initialise a completely empty database.

Follow the [SQLite backup procedure](DEPLOYMENT.md#backups-and-restoration). Source JSON is not a backup of changes made since the migration. The app does not delete your original files automatically.
