# Stage Layout App

Stage Layout App is a two-part React/Vite system for designing accurate top-down theatre band and equipment layouts.

- **Stageplot** is the client-facing planner. Users choose an approved stage, arrange current library equipment at real-world scale, validate collisions, save editable projects and export PDFs.
- **Shape Studio** is the administrative editor. Theatre staff create vector equipment, collision footprints, articulated controls, reusable shapes and custom stages.
- **Library API** stores the shared equipment, groups and stages as JSON. Stageplot receives read-only access; Shape Studio receives full library access.

Both interfaces include a **Help** button with workflow-specific instructions.

Current release: **Version 0.1.1 (Alpha)**. Update the single user-facing release value in `src/version.js` when preparing a new version; npm-compatible package versions are stored in the two `package.json` files.

## Main capabilities

### Stageplot

- Choose a saved custom stage or create a rectangular space.
- Use stage-locked links such as `?stage=<stable-stage-id>` for client-specific workflows.
- Click or drag real-scale vector equipment from a grouped library.
- Move against and slide along accurate equipment, stage and solid-zone collision geometry.
- Temporarily disable equipment collision, stage/zone collision or 30 cm corner snapping.
- Disable equipment collision on an individual placement, such as a deck that must sit below other equipment.
- Rotate whole items and independently configured articulated parts.
- Show or hide artwork parts marked toggleable in Shape Studio.
- Marquee-select objects or Shift-click layers for additive selection.
- Organise the draw stack with collapsible, reorderable layer folders.
- Hide individual layers or folders without changing their physical collision behaviour.
- Automatically place equipment in the `Staging` group behind other layers.
- Recover unsaved work after an accidental refresh in the same browser tab.
- Save reference-based `.stageplot` project files and open legacy `.stageplot.json`/JSON projects.
- Warn before saving enabled collision objects that overlap, intersect solid zones or leave the usable stage.
- Export the complete canvas, automatically fitted to one landscape A3 page with the project/show name as its header and a versioned creation footer.

### Shape Studio

- Create equipment in centimetres and stages in metres.
- Work in a CAD-style viewport with pointer-centred zoom, middle-button panning and marquee selection.
- Use standard 10 cm snapping, advanced 1 cm snapping or no grid snapping.
- Build artwork from rectangles, rounded rectangles, circles, ellipses, triangles, lines, text, tripods, arcs, polygons, trapezoids, chairs and custom vectors.
- Convert basic shapes into editable vector paths.
- Group layers, draw open or closed paths and configure Point on Arc, Smooth and Bezier curves.
- Mark exact layers as physical collision geometry.
- Mark layers as toggleable so each Stageplot placement can show or hide them.
- Enable optional four-corner Stageplot snapping for rectangular equipment such as stage decks.
- Add independent rotation parts with configurable pivots and angle limits.
- Build curved or angled stage boundaries by editing nodes and segment modes.
- Add aesthetic, solid-collision and outside-stage label zones.
- Add draggable stage text and multiple reorderable, lockable, crop-capable background images.
- Save new assets, update stable asset IDs, save copies and maintain equipment groups.
- Rename or delete library equipment and stages. Stage IDs remain stable across renames.
- Maintain Studio-only custom shapes separately from published client equipment.

## Typical workflow

1. Open Shape Studio and create or edit an equipment item.
2. Set its real-world canvas dimensions and build its top-down vector artwork.
3. Mark the layers that define its collision footprint.
4. Optionally configure corner snapping, toggleable artwork or additional rotation controls.
5. Assign an equipment group, save the item and publish it to Stageplot.
6. Create a stage boundary and any visual, solid or label zones, then save the stage.
7. Open Stageplot, choose the stage and arrange equipment.
8. Save the editable `.stageplot` project and export a PDF for distribution.

## Stageplot usage

### Canvas navigation

- Scroll to zoom toward the pointer.
- Middle-drag to pan.
- Left-drag empty canvas to select fully enclosed equipment.
- Drag equipment to move it; collision-constrained movement stops at the nearest valid position and slides along obstacles.
- Drag the lower handle to rotate an item. Additional handles control articulated parts.
- Press **Delete** or **Backspace** to remove the current selection.

### Layers and folders

The top Layers row renders in front. Drag layers to reorder them. Use **New folder** to create an organisational folder, then drag layers onto it. Children can be reordered inside the folder, and the complete folder can be moved through the stack.

Folders are created immediately with an automatic name; double-click the name to rename it inline. Click a folder name to select all its contents. Shift-click layers or folders to add/remove them from the current selection. Dragging any member of a multi-selection onto a folder moves the complete selection. Eye controls hide layers or folders from the canvas and PDF but deliberately retain collision.

When multiple items are selected, the inspector exposes settings shared by the selection, including label display, equipment collision, visibility and compatible toggleable parts. A mixed checkbox displays an X; clicking it enables the setting for every selected item before normal on/off toggling resumes.

### Collision and snapping

Global movement controls appear in the canvas inspector when nothing is selected:

- **Equipment collision** prevents enabled equipment from overlapping.
- **Stage and zone collision** keeps equipment inside the main boundary and outside solid zones.
- **Corner snapping** joins configured equipment snap points within 0.30 m.

Each selected placement also has an **Equipment collision** override. Turning it off allows intentional overlap with that item while keeping stage and zone collision active. Saving always validates the layout, but intentional overlaps involving a placement-level disabled item are ignored.

### Project files

`.stageplot` files contain stable stage/equipment IDs, placement transforms, layer folders, visibility and control settings. They do not embed library artwork. Opening a project therefore uses the newest asset versions; missing assets are dropped safely.

**New project** clears the selected stage and equipment. **Clear stage** removes equipment and folders but retains the selected stage. Browser session recovery is convenient but is not a replacement for downloading a project file.

## Shape Studio usage

Use **New item** to choose equipment or stage mode. The right inspector shows canvas settings when nothing is selected and selected-layer properties otherwise.

For equipment, keep the canvas tightly fitted to the physical item. Collision and four-corner snapping use these real-world coordinates. Clear layer names are important because toggleable layer names are shown directly to Stageplot users.

For stages, Shift-click a segment to insert a node and Ctrl-click a straight segment to convert it to a Point on Arc curve. Background images can extend beyond the stage and are editing references only. The main stage boundary clips normal stage assets in Stageplot; Label zones may render outside it, while Solid zones block equipment.

The Library dialog opens saved equipment and stages for editing. Updating an asset retains its stable ID; saving as new creates a new ID. Renaming a stage does not break its stage-locked URL.

## Local development

Requirements: Node.js 24 or a compatible current Node release, plus npm.

Install both frontend dependency sets:

```powershell
npm.cmd install
npm.cmd install --prefix tools/svg-shape-studio
```

Run Stageplot, Shape Studio and the library API together:

```powershell
npm.cmd run dev:all
```

- Stageplot: `http://localhost:5173`
- Shape Studio: `http://localhost:5174`
- Library API: `http://localhost:8787`

Run verification:

```powershell
npm.cmd run lint
node --test --test-isolation=none src/*.test.js tools/svg-shape-studio/src/*.test.js
npm.cmd run build
npm.cmd run build --prefix tools/svg-shape-studio
```

## Local production build

The default Compose file builds all three images from local source:

```powershell
docker compose up -d --build
```

- Stageplot: `http://localhost:8088`
- Shape Studio: `http://localhost:8089`

For local repository-backed library data, set this in `.env`:

```env
LIBRARY_DATA_PATH=.
```

Use Docker for production-style testing because the Nginx frontends proxy `/api` to the internal library service.

## Production and Unraid

Pushing `main` runs `.github/workflows/publish-containers.yml`, verifies the code and publishes:

```text
ghcr.io/staljabro/stage-layout-app-stageplot:latest
ghcr.io/staljabro/stage-layout-app-studio:latest
ghcr.io/staljabro/stage-layout-app-library-api:latest
```

`docker-compose.prod.yml` pulls these completed images. A typical Unraid `.env` is:

```env
STAGEPLOT_PORT=8088
STUDIO_BIND=0.0.0.0
STUDIO_PORT=8089
LIBRARY_DATA_PATH=/mnt/user/appdata/stage-layout-app-data
IMAGE_PREFIX=ghcr.io/staljabro/stage-layout-app
IMAGE_TAG=latest
```

Deploy or update from the checked-out repository:

```bash
sh deploy-unraid.sh
```

The script fast-forwards Git, pulls current images, recreates changed containers and displays their status. It does not modify library data.

The same stack can be managed through Unraid Compose Manager. For individual WebGUI containers, place all three on one custom Docker network, name the API container `library-api`, map Stageplot `8088:80`, Studio `8089:80`, and mount:

```text
/mnt/user/appdata/stage-layout-app-data/equipment-library -> /data/equipment-library
/mnt/user/appdata/stage-layout-app-data/stage-library     -> /data/stage-library
```

## Data persistence and backups

Production images deliberately exclude `equipment-library/` and `stage-library/`. Live data resides in `LIBRARY_DATA_PATH`, outside the application checkout, so Git pulls and container replacements cannot overwrite it.

Back up these directories regularly:

```text
equipment-library/
stage-library/
```

A separate private Git repository is suitable for manual data backups. Do not routinely pull into the live data directory unless intentionally restoring a backup.

## Security notes

- Stageplot exposes only approved read-only library endpoints through its Nginx proxy.
- Shape Studio can create, update and delete library data. Keep port 8089 private or protect it with authenticated HTTPS access.
- A stage-locked query parameter is a workflow restriction, not an authorization boundary; a user can remove it from the URL.
- Public GHCR images contain application code only, not the mounted equipment or stage library.
