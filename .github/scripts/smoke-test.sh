#!/usr/bin/env bash
# Cold-start smoke: one fake CF token, no credentials, HTTP (not HTTPS).
# Expects an image already tagged as easypages:ci (or SMOKE_IMAGE).
set -euo pipefail

IMAGE="${SMOKE_IMAGE:-easypages:ci}"
NAME="${SMOKE_CONTAINER:-easypages-ci}"
PORT="${SMOKE_PORT:-8002}"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# SESSION_COOKIE_SECURE=false: the image sets NODE_ENV=production, which would otherwise
# mark the session cookie Secure. This smoke talks plain HTTP, and curl then refuses to
# send that cookie back — every CSRF-protected POST becomes 403.
docker run -d --name "$NAME" -p "${PORT}:8002" \
  -e CF_API_TOKEN=ci-fake-token \
  -e SESSION_COOKIE_SECURE=false \
  "$IMAGE"

for _ in $(seq 1 30); do
  if curl -fsS -o /tmp/health.json "${BASE}/api/health"; then
    break
  fi
  sleep 2
done
if ! [ -s /tmp/health.json ]; then
  echo "::error::Container did not respond within 60s"
  docker logs "$NAME"
  exit 1
fi

expect_code() {
  actual=$(curl -s -o /tmp/expect_body.txt -w "%{http_code}" "${@:3}")
  if [ "$actual" != "$2" ]; then
    echo "::error::$1 expected $2, got $actual; body=$(cat /tmp/expect_body.txt)"
    docker logs "$NAME"
    exit 1
  fi
}

# 1. Bootstrap: public, always 200, and it plants the session cookie plus the
#    CSRF token the wizard needs. Without that this whole flow 403s.
curl -fsS -c /tmp/jar.txt -o /tmp/status.json "${BASE}/api/auth/status"
echo "auth status: $(cat /tmp/status.json)"
grep -q '"setup_complete":false' /tmp/status.json
csrf=$(sed -n 's/.*"csrf_token":"\([^"]*\)".*/\1/p' /tmp/status.json)
[ -n "$csrf" ] || { echo "::error::/api/auth/status returned no csrf_token"; exit 1; }

# 2. The API stays closed until the wizard is done, and says why.
curl -s -o /tmp/closed.json "${BASE}/api/projects"
grep -q '"code":"setup_required"' /tmp/closed.json \
  || { echo "::error::expected setup_required, got $(cat /tmp/closed.json)"; exit 1; }
expect_code "/api/projects before setup" 401 "${BASE}/api/projects"

# 3. The bundle, unlike the API, is public: login is drawn by the SPA, so an
#    anonymous visitor must be able to load it.
expect_code "SPA shell" 200 "${BASE}/"

# 4. The wizard.
expect_code "setup" 201 -X POST \
  -H 'Content-Type: application/json' \
  -H "CSRF-Token: $csrf" \
  -d '{"username":"ciadmin","password":"ci-only-password"}' \
  -b /tmp/jar.txt -c /tmp/jar.txt "${BASE}/api/auth/setup"

# 5. Login with the same credentials must also succeed (covers the post-setup path).
curl -fsS -b /tmp/jar.txt -c /tmp/jar.txt -o /tmp/status_login.json \
  "${BASE}/api/auth/status"
csrf_login=$(sed -n 's/.*"csrf_token":"\([^"]*\)".*/\1/p' /tmp/status_login.json)
[ -n "$csrf_login" ] || { echo "::error::post-setup status returned no csrf_token"; exit 1; }
expect_code "login" 200 -X POST \
  -H 'Content-Type: application/json' \
  -H "CSRF-Token: $csrf_login" \
  -d '{"username":"ciadmin","password":"ci-only-password"}' \
  -b /tmp/jar.txt -c /tmp/jar.txt "${BASE}/api/auth/login"

# 6. Replaying setup is 409 for good: the claim window closes.
curl -fsS -b /tmp/jar.txt -c /tmp/jar.txt -o /tmp/status2.json \
  "${BASE}/api/auth/status"
csrf2=$(sed -n 's/.*"csrf_token":"\([^"]*\)".*/\1/p' /tmp/status2.json)
expect_code "setup replay" 409 -X POST \
  -H 'Content-Type: application/json' \
  -H "CSRF-Token: $csrf2" \
  -d '{"username":"intruso","password":"otra-contrasena"}' \
  -b /tmp/jar.txt "${BASE}/api/auth/setup"

# 7. The session now passes the auth wall. Asserted on the error code rather
#    than the status: behind the wall the request reaches Cloudflare, which
#    rejects the fake token with a status of its own choosing.
curl -s -b /tmp/jar.txt -o /tmp/projects.json "${BASE}/api/projects"
if grep -qE '"code":"(setup_required|session_expired)"' /tmp/projects.json; then
  echo "::error::session did not pass the auth wall: $(cat /tmp/projects.json)"
  exit 1
fi

# 8. The SPA fallback must not swallow API 404s, and must not answer a stale
#    hashed asset with the shell — that shows up as a blank page.
#    The CSRF token is required: it is checked before routing, so without it this
#    would be a 403 and would never reach the question being asked.
curl -s -o /tmp/notfound.json -X DELETE \
  -H "CSRF-Token: $csrf2" -b /tmp/jar.txt "${BASE}/api/no-existe"
grep -q '"code":"not_found"' /tmp/notfound.json \
  || { echo "::error::unknown API route returned $(cat /tmp/notfound.json)"; exit 1; }
expect_code "unknown API route" 404 -X DELETE \
  -H "CSRF-Token: $csrf2" -b /tmp/jar.txt "${BASE}/api/no-existe"
expect_code "missing asset" 404 "${BASE}/assets/index-deadbeef.js"
# ...but a navigation route does have to get the shell.
expect_code "navigation route" 200 "${BASE}/projects"

# 9. The legacy /login redirect keeps an old curl'd docker-compose.yml healthy:
#    its probe follows redirects and must still land on a 200.
expect_code "legacy /login (followed)" 200 -L "${BASE}/login"

# 10. The credential file must not be group- or world-readable.
mode=$(docker exec "$NAME" stat -c '%a' /data/credentials.json)
[ "$mode" = "600" ] || { echo "::error::credentials.json is $mode, expected 600"; exit 1; }

# 11. The image's own healthcheck has to agree.
for _ in $(seq 1 20); do
  health=$(docker inspect -f '{{.State.Health.Status}}' "$NAME")
  [ "$health" = "starting" ] || break
  sleep 3
done
[ "$health" = "healthy" ] || { echo "::error::container health is $health"; exit 1; }

echo "Cold start, setup wizard, login, session, SPA fallback and healthcheck all OK"
