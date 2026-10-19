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
- `scripts/` - build helpers (`build:prod`)
- `edge/` - NGINX edge image (frontend, editor tree, app config, security headers)
- `vendor/secvisogram-editor/` - pinned `@secvisogram/editor` install, kept out of the main `npm ci`
- `secvisogram-mock/` - dev-only stub of the `<secvisogram-editor>` custom element, loaded only in `npm run dev` so the app is runnable without the real `secvisogram-editor.js` bundle present

## Getting started

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev           # start the Vite dev server
npm run build         # production build (static assets under build/client), no editor
npm run build:prod    # build + real editor tree in build/client/secvisogram-editor (see below)
npm run typecheck     # generate route types and run tsc
npm run lint          # oxlint
npm run format:check  # oxfmt --check
```

## Real editor in production builds

`npm run build:prod` loads the real editor, a `-demo.N` prerelease of `@secvisogram/editor` from the GitHub Packages npm registry. It is installed separately from the main dependencies, so `npm ci` and `npm run build` need no token.

Log in once to GitHub Packages. Use your GitHub username and a personal access token (classic) with `read:packages` as the password; npm stores the token in `~/.npmrc`, outside the repository:

```sh
npm login --registry https://npm.pkg.github.com
```

Then install the editor and build:

```sh
cd vendor/secvisogram-editor && npm ci && cd ../..
npm run build:prod
```

`build:prod` fails before building if the editor is not installed. It copies the package's `dist/` to `build/client/secvisogram-editor/` (the served version is in its `VERSION` file) and writes `build/csp-script-hashes.txt`, the CSP hashes of the app shell's inline scripts for the edge.

## Edge container and smoke checks

`edge/` holds an NGINX image that serves the `build:prod` output from one origin: the app with SPA fallback, the editor asset tree at `/secvisogram-editor/` and the app-config document, with HSTS, no-framing and a CSP suited to a public origin. `EDGE_ORIGIN` is the public origin used in the app config and is required at container start.

```sh
npm run build:prod
docker build -f edge/Dockerfile -t csaf-cms-edge .
docker run --rm -p 8080:8080 -e EDGE_ORIGIN=http://localhost:8080 csaf-cms-edge
SMOKE_BASE_URL=http://localhost:8080 npm run test:smoke
```

`test:smoke` runs the checks in `tests/smoke` against any base URL (default `http://localhost:8080`). It reads the editor file list from `build/client/secvisogram-editor`, so run it from a checkout with `build:prod` output. The checks in `private-services.spec.ts` need the private services behind the edge and fail when they are down; against the bare edge above, run only `edge.spec.ts`.

### Edge in front of the development Compose stack

The edge also proxies the private services: `/api/` and `/oauth2/` to oauth2-proxy, `/realms/csaf/` and `/resources/` to Keycloak (the browser is redirected to Keycloak on the public origin), and `/validate/api/v1/tests` and `/validate/api/v1/validate` to the validator (prefix stripped). Other realms (such as `master`) and `/admin/` return 404. Upstreams default to the Compose service names and can be set with `EDGE_UPSTREAM_OAUTH2_PROXY`, `EDGE_UPSTREAM_KEYCLOAK` and `EDGE_UPSTREAM_VALIDATOR` (`scheme://host:port`). Upstream names are re-resolved per request (resolver from `EDGE_RESOLVER`, default the container's DNS server), so restarting a private service does not require restarting the edge. Host and forwarded headers are derived from `EDGE_ORIGIN`.

[`edge/compose.local.yaml`](edge/compose.local.yaml) is an overlay for the `csaf-cms-backend` development Compose stack of its PostgreSQL branch (`feat/couchdb-to-postgres-migration`). It disables the stack's `reverse-proxy`, pins the published backend image by digest and adds the edge on host port 80, because the stack's realm, Keycloak hostname and oauth2-proxy login URL are fixed to `http://localhost`.

```sh
# in csaf-cms-backend (PostgreSQL branch): follow docker/README.md to create .env and docker/.env,
# including CSAF_COOKIE_SECRET. Stop any other stack that uses port 80.
npm run build:prod && docker build -f edge/Dockerfile -t csaf-cms-edge .
docker compose -f ../csaf-cms-backend/docker/compose.yaml -f edge/compose.local.yaml up -d edge backend-cms
SMOKE_BASE_URL=http://localhost npm run test:smoke
```

Replace `../csaf-cms-backend` with a checkout of the PostgreSQL branch; on `main` (CouchDB) Compose stops with `depends on undefined service "cms-db"`. To keep another checkout untouched, use a worktree: `git worktree add ../csaf-cms-backend-pg origin/feat/couchdb-to-postgres-migration`. Its untracked `.env` and `docker/.env` must be created there (copy the `.env.example` files). Stop any other stack on the same ports and container names first (such as the CouchDB one).

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
