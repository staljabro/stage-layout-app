# Shared canvas development entry

The working editor is [src/editor](../../src/editor) and the current application is [src/workbench](../../src/workbench). Stage authoring and client layouts use the embeddedStage adapter; equipment authoring/public review use embeddedEquipment.

Run normal development from the repository root with npm run dev:all and open http://localhost:5173. The optional entry in this directory mounts the same current app; it is not a separate user workflow or a required production service.

All signed-in Users can create stages and equipment. App roles are User/Admin/Owner. New GitHub accounts become Users automatically; no separate authoring role or normal signup approval is required.

## Compatibility

Modules in this directory re-export shared canvas utilities for existing geometry tests. Equipment remains stageplot-item@3, stored in metres with equipment fields displayed in centimetres.

Artwork, image crop, collision geometry, components, named part controls, whole-degree rotation, snapping, folders and groups are covered by the shared tests. Equipment images replace the old equipment reference-image tool; stage backgrounds remain supported.

## Build and test

From the repository root:

```powershell
npm run lint
node --test --test-isolation=none src/*.test.js tools/*.test.mjs tools/svg-shape-studio/src/*.test.js
npm run build
npm run build --prefix tools/svg-shape-studio
```

`RELEASE_VERSION` in `src/version.js` is the version source for both entries and all releases. Use `npm run release:version -- VERSION` from the root to update it and sync package mirrors, or edit the source directly. Both builds sync packages and lockfiles automatically; `npm run release:version` without an argument also syncs them.

Stage authoring includes **Curtain** lines with fixed 10 cm peak-to-trough waves and 40 cm wavelength. New curtains start black with collision enabled; untick the inspector collision checkbox for decorative curtains. The dotted editing guide shows the enabled centre-line collision. Line length trims or extends folds. Stage layer interactions, endpoint handles and colour/thickness/opacity and collision controls are shared with the main canvas. See the [stage editor guide](../../docs/CANVAS.md#curtains).

## Documentation

- [Guide home](../../docs/README.md)
- [Equipment creation](../../docs/EQUIPMENT.md)
- [Canvas reference](../../docs/CANVAS.md)
- [Development and release workflow](../../docs/DEVELOPMENT.md)
- [Architecture](../../docs/APP_FLOW_REVIEW.md)
