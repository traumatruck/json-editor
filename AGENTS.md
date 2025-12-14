# Repository Guidelines

## Project Structure & Key Files
- `src/` holds the React + TypeScript app (`main.tsx` entry, `App.tsx`, `App.css`/`index.css`, `assets/` for images/icons).
- `public/` contains static assets served as-is by Vite.
- `docs/` includes product context (`SPECIFICATION.md`, `USER-STORIES.md`); keep feature work aligned with these.
- Root configs: `vite.config.ts`, `tsconfig*.json`, and `eslint.config.js`. Avoid editing `node_modules/`; committed output goes to `dist/` after builds.

## MCP Usage
- Use `browser-mcp` to view and interact with the running app whenever UI context is needed.
- If `browser-mcp` is unavailable, not running, or failing, stop before doing any work and notify the user.

## Setup, Build, and Local Development
- `npm install` to fetch deps (Node 18+ recommended for Vite 7).
- `npm run dev` launches Vite dev server with HMR.
- `npm run build` runs `tsc -b` for type-checking then builds production assets.
- `npm run preview` serves the built app locally to validate production output.
- `npm run lint` executes ESLint with the shared flat config.

## Coding Style & Naming Conventions
- TypeScript in strict mode; prefer typed props and return values over `any`.
- Functional React components with hooks; keep component files PascalCase (e.g., `JsonTree.tsx`). Use camelCase for functions/variables, UPPER_SNAKE_CASE for constants.
- Two-space indentation; single quotes in TSX/TS files; keep imports ordered: external libs, aliases, relative paths.
- ESLint defaults (JS + TypeScript + React Hooks + React Refresh) are the source of truth; resolve lint warnings before pushing.

## Testing Guidelines
- No automated tests yet. When adding, prefer Vitest + React Testing Library; co-locate as `*.test.tsx` beside components or `__tests__/` near logic.
- Cover JSON parsing/validation, tree editing operations, and UI controls from the specification. Aim for deterministic tests (no network, no timers without fakes).

## Commit & Pull Request Guidelines
- Git history uses short, imperative messages (e.g., "Create react project"); follow that pattern and keep scope focused.
- PRs should include: concise summary, linked issue/user story, screenshots or GIFs for UI changes, and notes on testing done (including manual steps).
- Keep branches small and aligned to a user story; prefer separate commits for refactors vs feature code.

## Architecture & Safety Notes
- The app is client-only; avoid adding server calls unless explicitly required.
- Do not commit secrets or `.env` values. Vite exposes `import.meta.env.VITE_*` to the client—treat anything added there as public.
- Persist user data locally (per spec) and guard against invalid JSON states before rendering updates.

## Current Implementation Status
- Completed: raw JSON parse/format/minify with error banners; normalized document model; tree view with expand/collapse, inline key/primitive editing, add/delete nodes, key uniqueness + number validation; search with match navigation/ancestor expansion; undo/redo (50 depth); pretty/minified live output with copy/download; file import; key sorting; autosave last doc; local snippets stored in LocalStorage; clear-local-data control; styled three-pane layout.
- Outstanding: array reordering; search filter-only mode; keyboard shortcuts + ARIA/keyboard tree navigation; virtualization or large-JSON warnings; IndexedDB storage for snippet content; performance/accessibility polish; automated tests (unit/ui); optional drag/drop and additional toolbar utilities per spec.
