# Stageplot

A lightweight React/Vite app for creating top-down band layouts.

## Client stage links and project files

A fresh Stageplot session starts without a stage and opens a stage picker. **New project** confirms before clearing equipment and the selected stage, then reopens that picker. Refreshing the same browser tab still recovers its current project.

Select a saved stage and click **Copy stage-locked link** in the inspector. A link such as `http://localhost:5173/?stage=test-stage-1` loads only the stage with that library ID, hides other stage choices and custom dimensions, and rejects project files for other stages. New projects from that link can only choose its designated stage. An invalid or deleted stage does not fall back to a different space. Equipment groups do not affect stage choices.

The URL restriction is a workflow convenience, not authorization: a user can remove the query parameter. Use server-side permissions if stage access needs to be enforced securely.

**Save** downloads a `.stageplot.json` project containing stage/equipment library IDs, positions, rotations and label settings—not the asset artwork. **Open** retrieves the latest library versions. Missing equipment is dropped; a missing stage returns to the stage picker. A custom rectangle stores its dimensions because it has no library asset. Older project files are supported where their equipment IDs and stage names can be matched to current library entries.

Localhost links only work on your computer. To send usable links to external clients, host the Stageplot frontend and a publicly reachable **read-only** library API. The frontend API base can be set at build time with `VITE_LIBRARY_API_URL` (for example `/api` behind a same-origin server). The default is the local development library at `http://127.0.0.1:8787/api`. Do not expose the Studio's unauthenticated write/delete API publicly; keep administration private or add authentication before deploying it.

## Run locally

```bash
npm install
npm run dev
```

Use **Save** to download an editable `.stageplot.json` file, **Open** to restore one, and **Export PDF** to open the browser's print dialog (choose “Save as PDF”).

## Shape Studio

The companion Shape Studio lives in `tools/svg-shape-studio`. It publishes `stageplot-item@3` JSON vectors whose canvas, artwork coordinates, dimensions, and collision shapes are all measured in metres. Stageplot renders these vectors directly; SVG is available only as a convenience export.

The Studio Library lists stages separately from equipment groups. Use the pencil button to rename a stage or the delete button to permanently remove it (confirmation required). Renaming preserves its stage-locked link, `?stage=<id>`. Deleting makes that link unavailable; projects referencing a deleted stage need another stage selected.

New equipment and stages receive name-independent UUID identifiers. Existing identifiers are retained for compatibility. Updating names or artwork preserves the identifier; saving equipment as a new item creates a separate identifier. Project files reference these IDs and load current library artwork rather than embedded copies.

Run both apps and the repository-backed equipment library together:

```powershell
npm.cmd run dev:all
```

- Stageplot: http://localhost:5173
- Shape Studio: http://localhost:5174
- Equipment files: `equipment-library/*.stageplot-item.json`

To reuse your own artwork, build it in Shape Studio and click **Save as custom shape** in the toolbar. Saved designs appear under **Custom shapes** and return when you reopen Shape Studio. Clicking a preset inserts a fresh group of layers; **Ungroup layers** lets you edit individual shapes and vector points. Reference images stay with the saved design for editing and are not inserted with the artwork.

Drag the round rotation handle above an object or selected group to rotate it. Hold **Shift** for 15-degree steps. Use **Manage custom shapes** beneath the custom palette to remove entries from the pool; placed copies and saved equipment artwork remain available.

Custom shapes stay in Shape Studio until you explicitly click **Add item to Stageplot**. **Manage Stageplot items** lists published equipment and lets you remove entries from the Stageplot pool while keeping saved designs and custom presets. Use **Load existing** to reopen an unpublished design and publish it again. After updating the library server code, restart `npm run dev:all` to enable the updated library API.
