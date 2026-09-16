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
