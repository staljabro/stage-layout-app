# Stageplot Shape Studio

An independent React/Vite editor for composing top-down equipment from vector primitives and publishing them to Stageplot's repository-backed library.

```powershell
npm.cmd install
npm.cmd run dev
```

Use `npm.cmd run dev:all` from the repository root to start Shape Studio, Stageplot, and the shared library service. Items are stored as `stageplot-item@3` JSON vectors, with all coordinates and dimensions measured in metres. Each layer can independently participate in collision, so compound and irregular equipment is not constrained by a rectangular artwork box. Groups are created and assigned here, then consumed by the client-facing Stageplot app.
