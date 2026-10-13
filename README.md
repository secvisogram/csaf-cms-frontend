# csaf-cms-frontend

Web-based CMS shell for creating, editing, and reviewing CSAF security advisories.

> **[!HEADS UP]**
> This project is under construction and not yet usable.

## Overview

`csaf-cms-frontend` is a single-page application that owns all authentication, session, and backend REST communication (dashboard, advisory CRUD,workflow-state, templates) against the external `csaf-cms-backend`. It embeds the [`secvisogram`](https://github.com/secvisogram/secvisogram) editor as a self-contained, backend-free `<secvisogram-editor>` custom element (Shadow DOM) for form- and source-based CSAF editing.

See [docs/spec.md](docs/spec.md) for the full architecture documentation (context & scope, runtime views, crosscutting concepts, ADRs), and [docs/embedding-contract.md](docs/embedding-contract.md) for the properties and events of `<secvisogram-editor>`, [docs/features.md](docs/features.md) for the CMS feature list, and [docs/backend-api.md](docs/backend-api.md) for the backend API it consumes.

## Tech stack

- React 19
- React Router 8 (SPA mode)
- Tailwind CSS 4
- Vite 8
- TypeScript
- Vitest 5 (node and Browser Mode projects) and Playwright for testing
- oxlint and oxfmt for linting and formatting

## Project structure

- `app/` - application code
- `docs/` - architecture documentation (`spec.md`)
- `secvisogram-mock/` - dev-only stub of the `<secvisogram-editor>` custom element, loaded only in `npm run dev` so the app is runnable without the real `secvisogram-editor.js` bundle present

## Getting started

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev           # start the Vite dev server
npm run build         # production build (static assets under build/client)
npm run typecheck     # generate route types and run tsc
npm run lint          # oxlint
npm run format:check  # oxfmt --check
```

## Testing

```sh
npx playwright install chromium  # once; browser for Browser Mode and E2E
npm run test          # Vitest node project (loaders, actions, API client)
npm run test:browser  # Vitest Browser Mode project (rendered components)
npm run test:e2e      # Playwright E2E specs in tests/e2e (backend mocked via page.route())
```

Pass `--reporter=list` to `npm run test:e2e --` for terminal output instead of the HTML report.

## Developing against a real backend

By default `npm run dev` has no backend behind it. To point it at a real
`csaf-cms-backend` instead:

1. Start the backend's local docker compose stack — see [`csaf-cms-backend/docker/README.md`](https://github.com/secvisogram/csaf-cms-backend/blob/main/docker/README.md). Its reverse-proxy serves the whole stack from `http://localhost` (port 80).
2. Copy `.env.example` to `.env.local` and set:
   ```
   CSAF_DEV_BACKEND_URL=http://localhost
   ```
3. Run `npm run dev` and log in with one of the stack's default users (e.g. `author`/`author`).

This proxies `/api`, `/oauth2`, and the well-known app-config endpoint to the backend; everything else (including the embedded `<secvisogram-editor>`) still uses `secvisogram-mock`.

## Related repos

- [`secvisogram`](https://github.com/secvisogram/secvisogram) — the embedded CSAF editor, developed and released independently by design (backend-free)
- [`csaf-cms-backend`](https://github.com/secvisogram/csaf-cms-backend) — external, backend this frontend talks to over its REST API (not part of this workspace)
