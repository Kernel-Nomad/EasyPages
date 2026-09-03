# Security

## Reporting a vulnerability

Open a [private security advisory](https://github.com/KN990x/EasyPages/security/advisories/new).
Please do not open a public issue for anything exploitable.

## What EasyPages is

A single-operator control panel for Cloudflare Pages, meant to run on your own machine or
homelab. There is one account, no roles and no multi-tenancy. Anyone who signs in can
create, deploy and delete Pages projects and domains with your Cloudflare API token, so
**treat access to EasyPages as equivalent to access to that token.**

## Authentication model

- **One local account.** Created by the setup wizard on first run. There is no environment
  variable that can create, replace or bypass it — `AUTH_USER` and `AUTH_PASS` were removed
  in the release that introduced the wizard.
- **Password hashing:** scrypt from the Node standard library (N=2¹⁴, r=8, p=1, 32-byte
  digest), stored as `scrypt$N$r$p$salt$hash`. The parameters live inside the hash, so they
  can be raised later without invalidating what is stored.
- **Sessions:** a signed, HttpOnly, SameSite=Lax cookie (`easypages_sid`), 24 hours. The
  cookie is signed, not encrypted — it carries a username and a token version, no secrets.
- **Server-side invalidation:** every credential change bumps `token_version`, which
  invalidates every cookie issued before it. That is how "sign out all other devices"
  works with a stateless cookie.
- **CSRF:** an opaque per-session token, required on every unsafe method. Accepted via the
  `CSRF-Token` header (preferred), also `Csrf-Token`, `X-CSRF-Token`, or a `_csrf` body
  field. Combined with `SameSite=Lax` and JSON-only endpoints.
- **Rate limiting:** failed credential checks are limited per reported IP (15 per 5 min)
  and per socket peer (60 per 5 min). The second bucket exists because `X-Forwarded-For`
  is sent by the client: without it, rotating a forged value gives a fresh quota on every
  request. Only 401s consume the budget, so a mistyped password in the wizard cannot lock
  you out of your own fresh install.

## The setup window

Between the first start and completing the wizard, **anyone who can reach the port can
claim the instance.** There is no time limit and no pre-shared token — the same trade-off
Portainer and Home Assistant make.

Mitigation: complete the wizard immediately, and do not publish the port before you have.

## Where secrets live

Everything persistent is in `EASYPAGES_DATA_DIR` (`/data` in the Docker image):

| File | Contents | Mode |
| --- | --- | --- |
| `credentials.json` | username, scrypt hash, token version | `0600` |
| `.easypages-session-secret` | key used to sign session cookies | `0600` |

`CF_API_TOKEN` comes from the environment and is never written to disk by EasyPages, never
sent to the browser, and never included in an error response. `CF_ACCOUNT_ID` is optional and
inferred from the token; when the token reaches several accounts, the candidate IDs are
written to the server log and not to the HTTP response.

## Recovering a lost password

There is no reset email and no recovery code. Running this already requires host access,
which is strictly more than the account grants:

```bash
rm ./easypages-data/credentials.json
```

Within a few seconds the in-process auth cache notices the file is gone: `/api/auth/status`
returns `setup_complete: false`, and authenticated API calls start answering
`setup_required`. The setup wizard comes back. The session secret is untouched, so nothing
else is disturbed. A container restart is not required, but still works if you prefer a
clean process.

## Legacy `/logout`

`POST /logout` (without `/api`) clears the session cookie and redirects to `/` for old
healthchecks and bookmarks. It does not require a CSRF token: the cookie is `SameSite=Lax`,
so a cross-site POST from another origin does not carry it. The SPA uses
`POST /api/auth/logout`, which does enforce CSRF.

## Hardening checklist

- Put EasyPages behind a reverse proxy with TLS and set `SESSION_COOKIE_SECURE=true` in
  `.env`. Compose interpolates that file (`${SESSION_COOKIE_SECURE:-false}`): editing only
  the YAML is not required. Direct HTTP installs (including the CI smoke test) must keep
  `SESSION_COOKIE_SECURE=false`, or browsers and curl will refuse to send the session cookie.
- Exposed directly, with no proxy in front, keep `TRUST_PROXY=false` (Compose's default)
  so the rate limiter keys on the real socket rather than a header the client controls.
  Behind a trusted reverse proxy set `TRUST_PROXY=1` in `.env`.
- Scope the Cloudflare API token to *Account → Cloudflare Pages → Edit* and nothing else.
- Keep the port off the public internet unless you have a reason to publish it.
- Ensure the data directory is writable by uid 1000 (`chown -R 1000:1000 ./easypages-data`)
  — the container does not run as root, and an unwritable volume makes the wizard fail.

## Known limits

- The session cookie is signed, not encrypted.
- Rate-limit state is per process and in memory: it resets on restart, and the app is
  designed to run as a single process.
- There are no roles. Authenticated means full access.
- The bundle (`dist/`) is served without authentication so the SPA can draw its own login
  screen. It contains no secrets — there is no build-time environment injection — but it
  does reveal that this is EasyPages and what its API surface looks like.
- Dev-only tooling (Vite, Vitest, esbuild) is not shipped in the image. Advisories that
  only affect `pnpm run dev:ui` or the Vitest UI do not reach production; still upgrade
  them when convenient.
