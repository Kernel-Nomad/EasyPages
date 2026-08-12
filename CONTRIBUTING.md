# Contributing to EasyPages

Thanks for your interest in improving EasyPages. This guide covers how to set up your environment, coding conventions, and how to propose changes.

You can open issues for bugs or ideas, and pull requests for fixes or features.

## Before you start

- **Primary audience / production operators:** most people **never clone** this repo. They download [`docker-compose.yml`](./docker-compose.yml) and [`.env.example`](./.env.example) from the README raw URLs, create `.env`, and run `docker compose up` against the **GHCR image**. Documentation and boot-time messages are optimized for that path.
- **End-user install** (no clone): follow the Docker section in [`README.md`](./README.md)—same flow as above.
- **Contributor / development setup**: clone the repository and follow **Local setup** below (`pnpm install`, two terminals, tests). Do not confuse the two: you need the full tree and Node tooling to change code or run the test suite.
- Skim [`README.md`](./README.md) for what the app does, environment variables, and Cloudflare token requirements.
- Prefer **small, focused changes** that match the existing layout and style of the files you touch.

## Local setup

1. Use **Node.js 24+** (`engines` in [`package.json`](./package.json), [`.nvmrc`](./.nvmrc) for `nvm use`).
2. Enable corepack and install: `corepack enable && pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env` and fill in `CF_API_TOKEN` (see README for token scope). `CF_ACCOUNT_ID` is optional — it is inferred from the token on the first Cloudflare call, and only has to be set when the token can reach more than one account. There is nothing to configure for the operator account: the first run shows the setup wizard in the browser.
4. For day-to-day work you usually run **two terminals**:
   - Backend: `pnpm run dev` (watches `src/index.js`).
   - Frontend: `pnpm run dev:ui` (Vite against the API).

`pnpm start` and `pnpm run dev` use `src/index.js` as the canonical server entrypoint. Keep `server.js` as a compatibility shim for root-level tooling and external invocations.

**Do not use npm.** The lockfile is `pnpm-lock.yaml` and `package-lock.json` is gitignored, so a stray `npm install` produces a second, diverging lockfile that nothing else reads. The pnpm version is pinned in `packageManager`, which corepack resolves automatically — the same version CI and the Docker image use.

Two settings in [`pnpm-workspace.yaml`](./pnpm-workspace.yaml) are deliberate:

- `allowBuilds` — pnpm blocks dependency install scripts by default, the classic supply-chain vector. They are allowed one at a time; only `esbuild` needs one, and only at build time. Since scrypt replaced bcrypt there is no native code in the production tree at all.
- `minimumReleaseAge: 10080` — a version must be 7 days old before a fresh resolution will pick it, which is the window in which malicious publishes get caught. It does not affect `--frozen-lockfile`, so CI and Docker stay deterministic. Aligned with `cooldown: default-days: 7` in [`dependabot.yml`](./.github/dependabot.yml).

Deleting `./data` (or `make clean-data`) gives you the setup wizard from scratch.

### Useful scripts

| Command | When to use |
|--------|-------------|
| `pnpm run dev` | Backend with watch |
| `pnpm run dev:ui` | Vite dev server for the React app |
| `pnpm run build` | Production UI build into `dist/` |
| `pnpm run preview` | Preview the Vite build locally |
| `pnpm run lint` | ESLint over the whole tree |
| `pnpm test` | Both suites: `test:server` then `test:web` |
| `pnpm run test:server` | Backend only (`node:test`, `tests/**/*.test.js`) |
| `pnpm run test:web` | Frontend only (Vitest + Testing Library, `src/web/**/*.test.jsx`) |
| `pnpm run check` | Syntax check on `src/`, `tests/`, and config entry files |

A [`Makefile`](./Makefile) wraps the same targets (`make setup`, `make dev`, `make lint`, `make test`, `make clean-data`).

## Validation before you open a PR

Run these in order after your changes:

1. `pnpm run lint`
2. `pnpm run build` — required **before** the tests, not only when you touched UI code: the integration suite boots the real app and asserts that the SPA shell and its assets are served, which needs `dist/` to exist.
3. `pnpm test`
4. If you changed the [`Dockerfile`](./Dockerfile), the dependency tree, or the Node/Alpine base image, run `docker build -t easypages-local .` locally to confirm the image still builds (requires Docker).

`make lint && make test` does 1–3 in the right order.

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
- `src/index.js`: canonical server entrypoint used by `pnpm start` / `pnpm run dev`.
- `src/api/`: HTTP interface, route adapters, middleware, browser API client (`src/api/client/easyPagesApi.js`).
- `src/core/`: domain logic, Cloudflare integration, error factories, runtime bootstrapping (`src/core/server/startServer.js`).
- `src/core/cloudflare/`: shared Cloudflare API client.
- `src/core/projects/`: project validation, mapping and use cases.
- `src/core/deployments/`: deployment pagination, batch deletion and ZIP upload orchestration.
- `src/config/`: `.env` loading, runtime paths (`dist/`, `uploads/`, optional `EASYPAGES_DATA_DIR`) and upload limits.
- `src/utils/`: pure helpers for files, ZIP handling and generic validation.
- `src/web/main.jsx`: React/Vite bootstrap.
- `src/web/app/`: shell, top-level hooks and layout orchestration.
- `src/web/features/`: feature views and project-specific components.
- `src/web/shared/`: i18n, layout, styles and generic UI.
- `public/`: static assets copied into the UI build.
- `tests/unit/`: unit suites by layer (`api/`, `core/`, `utils/`).
- `src/core/auth/`: credential lifecycle — scrypt hashing, the JSON credential store, the auth-state cache and the service that ties them together.
- `src/shared/authPolicy.js`: username and password bounds, imported by **both** the server and the React bundle. The server is the source of truth; the client only avoids a round trip.
- `tests/integration/`: HTTP tests against `createApp` (setup wizard, sessions, CSRF, rate limiting, SPA fallback, mocked Cloudflare). Shared plumbing lives in `tests/integration/helpers/appHarness.js`.
- `scripts/`: `run-tests.mjs`, `syntax-check.mjs`, and other automation.
- `.github/workflows/ci.yml`: the merge gate — lint, build, both test suites, a Docker build and a cold-start smoke test, on every push and pull request to `main`.
- `.github/workflows/ghcr-publish.yml`: publishes the root Docker image to GHCR on release publication.
- `.github/workflows/security-audit.yml`: weekly `pnpm audit`. Deliberately not on push: a vulnerability published today is not a reason to block an unrelated commit.

### Architectural boundaries

Keep these rules intact:

- `src/core/`, `src/config/` and `src/utils/` must not depend on `src/web/`.
- `src/config/` and `src/utils/` should stay free of HTTP-layer concerns from `src/api/`.
- The React UI should call the backend through `src/api/client/easyPagesApi.js`, not ad hoc `fetch` from views or components.

### Sensitive areas

Changes here need extra care and matching tests:

- **Auth, session, CSRF**: `src/api/server/app.js` (middleware order matters — `/api/auth` is mounted *above* the `app.use('/api', requireAuth, ...)` wall), `src/api/server/routes/auth/router.js`, `src/core/auth/`, and how the client sends `CSRF-Token` (see `easyPagesApi.js`). See [SECURITY.md](./SECURITY.md) for the model.
- **The error `code` contract**: every auth response carries a stable machine-readable `code`; the SPA maps it to an i18n key in `src/web/shared/i18n/authErrors.js`. The Spanish `error` text is for curl and logs. Change the code and you break the UI silently — change both, with tests.
- **ZIP / Direct Upload**: deployment upload routes and core upload logic; preserve path traversal and Zip Slip protections.
- **Public internal contracts**: if you change URLs, methods, headers, or payloads in `easyPagesApi.js`, update the server and its tests together.

## Guidelines

- Keep changes small and aligned with the current architecture.
- Put new backend business logic in `src/core/` and keep `src/api/` focused on HTTP adaptation.
- Do not change public HTTP contracts unless backend, frontend and tests are updated together.
- User-visible strings in React belong in `src/web/shared/i18n/index.js` — add keys for **both** `es` and `en`. Since login and setup moved into the SPA there is no server-rendered page left outside i18n.
- Keep runtime paths and environment contracts stable unless the task explicitly changes deployment behavior.
- Avoid introducing new tooling when the current stack is sufficient.
- Add or adjust tests in `tests/` when you change validation, file/ZIP utilities, or `fetch`/API client behavior.

## Dependency and dev-server security

- `.github/workflows/security-audit.yml` runs `pnpm audit --prod --audit-level high` weekly, blocking, plus a non-blocking full-tree pass. Production advisories (e.g. `adm-zip`) must be fixed promptly. Dev-only reports (Vite / Vitest / esbuild) concern `pnpm run dev:ui` or the Vitest UI, not the static UI Express serves in production. Do not expose the Vite dev server to untrusted networks.

## Pull requests

- Describe **what** changed and **why** in plain language.
- Mention any README or operational impact if commands, env vars, or deployment behavior change.

## Releases, Docker image, and Compose

- Publishing a **GitHub Release** triggers `.github/workflows/ghcr-publish.yml` and pushes a versioned image to GHCR. The `validate-release` job installs Node from [`.nvmrc`](./.nvmrc) (currently **24**) and pnpm from `packageManager`, then runs lint, build and both test suites; `build-and-push` builds the image from the root [`Dockerfile`](./Dockerfile) (`node:24-alpine`). Keep the `image:` tag in [`docker-compose.yml`](./docker-compose.yml) aligned with the release you want users to run by default (same version as the app when you cut a release).
- **`SESSION_SECRET`** in `.env` is optional. If set, it signs session cookies. If omitted and **`EASYPAGES_DATA_DIR`** is set (e.g. `/data` in Compose), the server creates or reuses **`.easypages-session-secret`** in that directory so sessions survive restarts without extra configuration. `EASYPAGES_DATA_DIR` now always resolves — it falls back to `./data` — because the credential lives there too and would otherwise be recreated on every restart, leaving the instance claimable by whoever reached it first. Horizontal scaling still requires every instance to share the same signing material (shared data volume or identical `SESSION_SECRET`).
- Building your own image from the [`Dockerfile`](./Dockerfile) and pointing `image:` at your registry follows the same rules as the README Notes on `NODE_ENV=production` and session cookies.

### Runtime notes (dist, sessions, scaling)

- The server serves the UI from `dist/`, so `pnpm run build` is required before `pnpm start` when running from source — and before `pnpm test`, since the integration suite asserts the shell is served.
- **Login session** data (username, credential token version, CSRF token) lives in the signed cookie `easypages_sid` (`cookie-session`). The signing key comes from **`SESSION_SECRET`** if set, otherwise from **`.easypages-session-secret`** under **`EASYPAGES_DATA_DIR`**, otherwise a one-off random key (dev). The cookie payload is signed but not encrypted: rely on **HttpOnly**, **HTTPS**, **CSP**, and avoiding XSS. There is no server-side session store, but sessions *can* be invalidated server-side: every credential change bumps `token_version` in `credentials.json`, and the auth middleware rejects any cookie carrying an older one. It compares the username too — deleting the credential and re-running the wizard restarts `token_version` at 1, which is exactly what the previous account's cookie already carried. The GHCR image sets `NODE_ENV=production`.
- Session cookies: default `Secure` in production unless you set `SESSION_COOKIE_SECURE` (the shipped `.env.example` sets `false` for HTTP installs).
- **Multiple replicas:** all instances must share the **same signing key** (same **`SESSION_SECRET`** or the same **`.easypages-session-secret`** on a shared volume); no sticky sessions are required for login state.
- `EASYPAGES_DATA_DIR` (`/data` in Compose, `./data` from source) holds **`credentials.json`** (mode `0600`) and, unless `SESSION_SECRET` is set, the **`.easypages-session-secret`** file used to sign cookies. It is probed for writability at boot: an unwritable bind mount used to surface as the setup wizard returning 500 with nothing in the logs.
- Static UI files under `dist/` are served **without authentication**, because the SPA draws its own login screen and gating the bundle would leave an anonymous visitor with nothing to load. The bundle carries no secrets: there is no `import.meta.env`, no `VITE_*` and no `define` in `vite.config.js`. Everything sensitive comes over `/api`, which stays closed.
- `index.html` is served with `Cache-Control: no-cache` from both `express.static` and the SPA fallback. It used to be uncacheable by accident, because it always came back with a `Set-Cookie`; public and cached, a stale shell points at hashed asset names that no longer exist after a redeploy.
- The SPA fallback only answers GET/HEAD on paths whose last segment has no dot, so a missing `/assets/index-<hash>.js` 404s instead of returning the shell with status 200 — which shows up in a browser as a blank page rather than a missing script.
- `GET /login` and `POST /logout` are kept as 302 redirects to `/`. They cost nothing and they keep bookmarks, open tabs on the previous bundle, and any healthcheck copied from an older `docker-compose.yml` working, since `fetch` follows redirects.
- **Reverse proxy and rate limiting:** the server sets Express `trust proxy` from **`TRUST_PROXY`** (default **`1`**, i.e. one trusted hop). In production, terminate TLS and set `X-Forwarded-For` only on a **trusted** proxy so clients cannot spoof IPs and weaken **express-rate-limit**. If the Node process is exposed **directly** to the internet without such a proxy, set **`TRUST_PROXY=false`** (or `0` / `no`) so limits use the TCP peer address.
- **Docker image user:** the published image runs as the **`node`** user (uid **1000**). If uploads or `EASYPAGES_DATA_DIR` fail with permission errors, ensure the mounted host directory is writable (e.g. `chown -R 1000:1000 ./easypages-data` on Linux).

