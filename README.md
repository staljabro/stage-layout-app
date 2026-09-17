# Stageplot

A lightweight React/Vite app for creating top-down band layouts.

## Run locally

```bash
npm install
npm run dev
```

Use **Save** to download an editable `.stageplot.json` file, **Open** to restore one, and **Export PDF** to open the browser's print dialog (choose “Save as PDF”).

## Shape Studio

The companion Shape Studio lives in `tools/svg-shape-studio`. It publishes `stageplot-item@3` JSON vectors whose canvas, artwork coordinates, dimensions, and collision shapes are all measured in metres. Stageplot renders these vectors directly; SVG is available only as a convenience export.

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
