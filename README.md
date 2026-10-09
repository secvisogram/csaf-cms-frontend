# csaf-cms-frontend

Web-based CMS shell for creating, editing, and reviewing CSAF security advisories.

> **[!HEADS UP]**
> This project is under construction and not yet usable.

## Overview

`csaf-cms-frontend` is a single-page application that owns all authentication, session, and backend REST communication (dashboard, advisory CRUD,workflow-state, templates) against the external `csaf-cms-backend`. It embeds the [`secvisogram`](https://github.com/secvisogram/secvisogram) editor as a self-contained, backend-free `<secvisogram-editor>` custom element (Shadow DOM) for form- and source-based CSAF editing.

See [docs/spec.md](docs/spec.md) for the full architecture documentation (context & scope, runtime views, crosscutting concepts, ADRs), and [docs/embedding-contract.md](docs/embedding-contract.md) for the properties and events of `<secvisogram-editor>`, and [docs/backend-api.md](docs/backend-api.md) for the CMS feature list and the backend API it consumes.

## Tech stack

- React 19
- React Router 8 (SPA mode)
- Tailwind CSS 4
- Vite 8
- TypeScript

## Project structure

- `app/` - application code
- `docs/` - architecture documentation (`spec.md`)
- `secvisogram-mock/` - dev-only stub of the `<secvisogram-editor>` custom element, loaded only in `npm run dev` so the app is runnable without the real `secvisogram-editor.js` bundle present

## Getting started

```sh
npm install
npm run dev         # start the Vite dev server
npm run build       # production build (static assets under build/client)
npm run typecheck   # generate route types and run tsc
```

## Related repos

- [`secvisogram`](https://github.com/secvisogram/secvisogram) — the embedded CSAF editor, developed and released independently by design (backend-free)
- [`csaf-cms-backend`](https://github.com/secvisogram/csaf-cms-backend) — external, backend this frontend talks to over its REST API (not part of this workspace)
