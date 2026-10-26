# Shape Studio

Shape Studio is Stageplot's equipment artwork editor. The stage editor is reused inside Stageplot's event workspace; standalone Studio is reserved for equipment. The Library API persists live data in SQLite; repository JSON files are first-start import inputs, not the live library.

For end-user instructions, read the [comprehensive user guide](../../docs/USER_GUIDE.md#shape-studio). For GitHub sign-in and deployment, see [Accounts and deployment](../../ACCOUNT_GUIDE.md).

## Development

From the repository root:

```powershell
npm.cmd run setup
npm.cmd run dev:all
```

Node 24 is required. Setup installs both dependency sets, including Studio's polygon-clipping and fit-curve dependencies. Configure GitHub sign-in before using Studio; Contributor, Admin or Owner access is required. Studio normally runs at http://localhost:5174 and Stageplot at http://localhost:5173.

To run only Studio, use npm install and npm run dev from this directory; shared library operations still require the API. Use the same hostname for both local apps so they share the session cookie.

## Editor conventions

Equipment fields display centimetres, stage fields display metres, and stored geometry uses metres. Collision geometry is distinct from artwork. Dedicated collision layers are omitted from published artwork. Custom shapes are reusable Studio-only building blocks.

The shared version comes from src/version.js at the repository root. Version changes are handled by the maintainer when committing.

## Verification

From the repository root:

```powershell
npm.cmd run lint
node --test --test-isolation=none src/*.test.js tools/*.test.mjs tools/svg-shape-studio/src/*.test.js
npm.cmd run build --prefix tools/svg-shape-studio
```

The browser regression test uses installed Chrome/Edge when available and skips when no supported browser is installed. Shared account, project and help components live under the root src directory; styling changes should be checked in both applications.
