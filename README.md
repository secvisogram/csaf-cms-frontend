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

The image builds its production frontend and installs the exact editor version in a multi-stage Docker build. The GitHub Packages token is needed only for editor installation. After logging in as described above, pass npm's user config to BuildKit as a secret:

```sh
docker buildx build --load \
  --secret id=github_npmrc,src="$HOME/.npmrc" \
  -f edge/Dockerfile -t csaf-cms-edge:local .
```

Run the helper to start the image with `docker run` and execute the static edge smoke suite. It extracts the expected editor-asset inventory from the image before checking that every file is served:

```sh
npm ci
npx playwright install chromium
scripts/smoke-edge-image.sh csaf-cms-edge:local
```

`test:smoke` defaults to `http://localhost:8080`. The static checks in `edge.spec.ts` need no private services. `private-services.spec.ts` is for a running backend/auth/validator stack and is not run by the image CI job.

### Release image publishing

Same-repository pull requests build the production image and run the static edge smoke suite. Fork pull requests still run the regular test workflow, but skip the image build because they cannot access the private editor package token. Publishing runs only for a GitHub Release's `published` event: CI builds and smoke-tests the image, then publishes that tested image to `ghcr.io/secvisogram/csaf-cms-frontend` under the release tag and `sha-<full source commit SHA>`. Stable releases also update `latest`; prereleases do not. The workflow summary includes the immutable image digest and the editor version from `/secvisogram-editor/VERSION`.

After the first release publish, a maintainer must make the GHCR package public once in the package's GitHub settings. Deployment and runtime secrets are managed separately and are not part of image publishing.

### Edge in front of the development Compose stack

The edge also proxies the private services: `/api/` and `/oauth2/` to oauth2-proxy, `/realms/csaf/` and `/resources/` to Keycloak (the browser is redirected to Keycloak on the public origin), and `/validate/api/v1/tests` and `/validate/api/v1/validate` to the validator (prefix stripped). Other realms (such as `master`) and `/admin/` return 404. Upstreams default to the Compose service names and can be set with `EDGE_UPSTREAM_OAUTH2_PROXY`, `EDGE_UPSTREAM_KEYCLOAK` and `EDGE_UPSTREAM_VALIDATOR` (`scheme://host:port`). Upstream names are re-resolved per request (resolver from `EDGE_RESOLVER`, default the container's DNS server), so restarting a private service does not require restarting the edge. Host and forwarded headers are derived from `EDGE_ORIGIN`.

[`edge/compose.local.yaml`](edge/compose.local.yaml) is an overlay for the `csaf-cms-backend` development Compose stack of its PostgreSQL branch (`feat/couchdb-to-postgres-migration`). It disables the stack's `reverse-proxy`, pins the published backend image by digest and adds the edge on host port 80, because the stack's realm, Keycloak hostname and oauth2-proxy login URL are fixed to `http://localhost`.

```sh
# in csaf-cms-backend (PostgreSQL branch): follow docker/README.md to create .env and docker/.env,
# including CSAF_COOKIE_SECRET. Stop any other stack that uses port 80.
npm ci --prefix vendor/secvisogram-editor
npm run build:prod  # provides the expected asset inventory for the Compose smoke suite
docker buildx build --load --secret id=github_npmrc,src="$HOME/.npmrc" \
  -f edge/Dockerfile -t csaf-cms-edge:local .
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

This proxies `/api` and `/oauth2` to the backend and serves the backend's app-config with its `userInfoUrl` made same-origin (the stack publishes absolute `http://localhost/...` URLs, which the dev server's origin cannot call without CORS); everything else (including the embedded `<secvisogram-editor>`) still uses `secvisogram-mock`.

## Related repos

- [`secvisogram`](https://github.com/secvisogram/secvisogram) — the embedded CSAF editor, developed and released independently by design (backend-free)
- [`csaf-cms-backend`](https://github.com/secvisogram/csaf-cms-backend) — external, backend this frontend talks to over its REST API (not part of this workspace)
