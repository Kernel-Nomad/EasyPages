# Contributing

## Local Setup

1. Install dependencies with `npm install`.
2. Create `.env` from `.env.example`.
3. Run `npm run dev` for the server and `npm run dev:ui` for the Vite UI when developing locally.

`npm run start` and `npm run dev` use `src/index.js` as the canonical server entrypoint. Keep `server.js` as a compatibility shim for root-level tooling and external invocations.

## Validation

- Run `npm test`.
- Run `npm run check`.
- Run `npm run build` when you change UI code, static assets or build configuration.

## Repository Layout

- `src/api/`: HTTP server interface, middleware, route adapters and browser API client.
- `src/core/`: domain logic, Cloudflare integration, error helpers and server bootstrap.
- `src/config/`: environment and runtime path configuration.
- `src/utils/`: shared pure helpers.
- `src/web/`: React application, bootstrapped from `src/web/main.jsx`.
- `tests/unit/` and `tests/integration/`: automated test suites.

Keep the current architectural boundaries intact:

- `src/core/`, `src/config/` and `src/utils/` must not depend on `src/web/`.
- `src/config/` and `src/utils/` should stay free of HTTP-layer concerns from `src/api/`.
- The React UI should call the backend through `src/api/client/easyPagesApi.js`, not ad hoc `fetch` calls from views or components.

## Guidelines

- Keep changes small and aligned with the current architecture.
- Put new backend business logic in `src/core/` and keep `src/api/` focused on HTTP adaptation.
- Do not change public HTTP contracts unless backend, frontend and tests are updated together.
- Keep runtime paths and environment contracts stable unless the task explicitly changes deployment behavior.
- Avoid introducing new tooling when the current stack is sufficient.
