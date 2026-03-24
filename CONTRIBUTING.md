# Contributing to EasyPages

Thanks for your interest in improving EasyPages. This guide covers how to set up your environment, coding conventions, and how to propose changes.

You can open issues for bugs or ideas, and pull requests for fixes or features.

## Before you start

- **Primary audience / production operators:** most people **never clone** this repo. They download [`docker-compose.yml`](./docker-compose.yml) and [`.env.example`](./.env.example) from the README raw URLs, create `.env`, and run `docker compose up` against the **GHCR image**. Documentation and boot-time messages are optimized for that path.
- **End-user install** (no clone): follow the Docker section in [`README.md`](./README.md)—same flow as above.
- **Contributor / development setup**: clone the repository and follow **Local setup** below (`npm install`, two terminals, tests). Do not confuse the two: you need the full tree and Node tooling to change code or run the test suite.
- Skim [`README.md`](./README.md) for what the app does, environment variables, and Cloudflare token requirements.
- Prefer **small, focused changes** that match the existing layout and style of the files you touch.

## Local setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and fill in values (see README for token scope).
3. For day-to-day work you usually run **two terminals**:
   - Backend: `npm run dev` (watches `src/index.js`).
   - Frontend: `npm run dev:ui` (Vite against the API).

`npm run start` and `npm run dev` use `src/index.js` as the canonical server entrypoint. Keep `server.js` as a compatibility shim for root-level tooling and external invocations.

### Useful scripts

| Command | When to use |
|--------|-------------|
| `npm run dev` | Backend with watch |
| `npm run dev:ui` | Vite dev server for the React app |
| `npm run build` | Production UI build into `dist/` |
| `npm run preview` | Preview the Vite build locally |
| `npm test` | All tests (`tests/**/*.test.js`) |
| `npm run check` | Syntax check on `src/`, `tests/`, and config entry files |

## Validation before you open a PR

Run these in order after your changes:

1. `npm test`
2. `npm run check`
3. `npm run build` **if** you changed UI code, files under `public/`, or anything that affects the Vite/Tailwind build.

Fix any failures before requesting review.

## Repository layout

High level:

- `src/api/`: HTTP server interface, middleware, route adapters and browser API client.
- `src/core/`: domain logic, Cloudflare integration, error helpers.
- `src/config/`: environment and runtime path configuration.
- `src/utils/`: shared pure helpers.
- `src/web/`: React application, bootstrapped from `src/web/main.jsx`.
- `tests/unit/` and `tests/integration/`: automated test suites (files named `*.test.js`). Integration tests boot the Express app with test env vars and mocks (see `tests/integration/api/server/`).

Detailed tree (for navigation and PRs):

- `server.js`: public compatibility shim for root-level tooling and external entrypoint expectations.
- `src/index.js`: canonical server entrypoint used by `npm run start` / `npm run dev`.
- `src/api/`: HTTP interface, route adapters, middleware, browser API client (`src/api/client/easyPagesApi.js`).
- `src/core/`: domain logic, Cloudflare integration, error factories, runtime bootstrapping (`src/core/server/startServer.js`).
- `src/core/cloudflare/`: shared Cloudflare API client.
- `src/core/projects/`: project validation, mapping and use cases.
- `src/core/deployments/`: deployment pagination, batch deletion and ZIP upload orchestration.
- `src/config/`: `.env` loading, runtime paths (`dist/`, `uploads/`, `sessions/`, `.session_secret`, optional `EASYPAGES_DATA_DIR`) and upload limits.
- `src/utils/`: pure helpers for files, ZIP handling and generic validation.
- `src/web/main.jsx`: React/Vite bootstrap.
- `src/web/app/`: shell, top-level hooks and layout orchestration.
- `src/web/features/`: feature views and project-specific components.
- `src/web/shared/`: i18n, layout, styles and generic UI.
- `public/`: static assets copied into the UI build.
- `tests/unit/`: unit suites by layer (`api/`, `core/`, `utils/`).
- `tests/integration/`: HTTP tests against `createApp` (login, CSRF, mocked Cloudflare).
- `scripts/`: `run-tests.mjs`, `syntax-check.mjs`, and other automation.
- `.github/workflows/ghcr-publish.yml`: publishes the root Docker image to GHCR on release publication.

### Architectural boundaries

Keep these rules intact:

- `src/core/`, `src/config/` and `src/utils/` must not depend on `src/web/`.
- `src/config/` and `src/utils/` should stay free of HTTP-layer concerns from `src/api/`.
- The React UI should call the backend through `src/api/client/easyPagesApi.js`, not ad hoc `fetch` from views or components.

### Sensitive areas

Changes here need extra care and matching tests:

- **Auth, session, CSRF**: `src/api/server/app.js`, auth routes, and how the client sends `CSRF-Token` (see `easyPagesApi.js`).
- **ZIP / Direct Upload**: deployment upload routes and core upload logic; preserve path traversal and Zip Slip protections.
- **Public internal contracts**: if you change URLs, methods, headers, or payloads in `easyPagesApi.js`, update the server and its tests together.

## Guidelines

- Keep changes small and aligned with the current architecture.
- Put new backend business logic in `src/core/` and keep `src/api/` focused on HTTP adaptation.
- Do not change public HTTP contracts unless backend, frontend and tests are updated together.
- User-visible strings in React belong in `src/web/shared/i18n/index.js` — add keys for **both** `es` and `en`. The server-rendered login page copy lives in `src/api/server/views/login.html` and is not covered by that i18n file.
- Keep runtime paths and environment contracts stable unless the task explicitly changes deployment behavior.
- Avoid introducing new tooling when the current stack is sufficient.
- Add or adjust tests in `tests/` when you change validation, file/ZIP utilities, or `fetch`/API client behavior.

## Pull requests

- Describe **what** changed and **why** in plain language.
- Mention any README or operational impact if commands, env vars, or deployment behavior change.

## Releases, Docker image, and Compose

- Publishing a **GitHub Release** triggers `.github/workflows/ghcr-publish.yml` and pushes a versioned image to GHCR. Keep the `image:` tag in [`docker-compose.yml`](./docker-compose.yml) aligned with the release you want users to run by default (same version as the app when you cut a release).
- Current images support persisting session material under `EASYPAGES_DATA_DIR` (e.g. `/data` in Compose) so **`SESSION_SECRET` is optional** when that volume is mounted as documented in the README.
- **Older image tags** may still require `SESSION_SECRET` in `.env` if they predate that behavior; operators on legacy tags should set it explicitly. Building your own image from the [`Dockerfile`](./Dockerfile) and pointing `image:` at your registry follows the same rules as the README Notes on `NODE_ENV=production` and session storage.

