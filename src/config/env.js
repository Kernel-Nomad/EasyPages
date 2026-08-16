import dotenv from 'dotenv';
import { defaultDataDir, repoEnvPath } from './paths.js';
import { trimEnv } from './trimEnv.js';

const dotenvResult = dotenv.config({ path: repoEnvPath });
if (dotenvResult.error) {
  dotenv.config();
}

export const PORT = trimEnv(process.env.PORT) || 8002;
export const CF_API_TOKEN = trimEnv(process.env.CF_API_TOKEN);

/** Optional: inferred from the token unless the token reaches more than one account. */
export const CF_ACCOUNT_ID = trimEnv(process.env.CF_ACCOUNT_ID);

export const SESSION_SECRET = trimEnv(process.env.SESSION_SECRET);

/**
 * Where the session secret and the operator credential live. Always resolves to a real
 * path: without one the credential would not survive a restart.
 */
export const EASYPAGES_DATA_DIR =
  trimEnv(process.env.EASYPAGES_DATA_DIR) ?? defaultDataDir;

/**
 * `Secure` flag on the session cookie. `SESSION_COOKIE_SECURE=true|false` wins; otherwise
 * it follows `NODE_ENV=production`.
 */
let explicitSessionCookieSecure = null;
const sessionCookieSecureRaw = process.env.SESSION_COOKIE_SECURE;
if (sessionCookieSecureRaw !== undefined && sessionCookieSecureRaw !== '') {
  const v = String(sessionCookieSecureRaw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') {
    explicitSessionCookieSecure = true;
  } else if (v === 'false' || v === '0' || v === 'no') {
    explicitSessionCookieSecure = false;
  }
}
export const SESSION_COOKIE_SECURE =
  explicitSessionCookieSecure !== null
    ? explicitSessionCookieSecure
    : process.env.NODE_ENV === 'production';

/**
 * Value for Express `trust proxy`. Defaults to one trusted hop. `TRUST_PROXY=false|0|no`
 * stops trusting `X-Forwarded-*`, so rate limits key on the socket address instead.
 */
const parseTrustProxy = () => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === '') {
    return 1;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') {
    return false;
  }
  if (v === 'true' || v === 'yes') {
    return 1;
  }
  const n = Number.parseInt(v, 10);
  if (!Number.isNaN(n) && n >= 0) {
    return n;
  }
  return 1;
};

export const TRUST_PROXY = parseTrustProxy();

/**
 * `CF_API_TOKEN` is the only thing that has to be configured: the account id is inferred
 * from it, and the credentials are created by the setup wizard.
 */
export const missingRequiredServerEnvKeys = ({ cfApiToken }) => {
  const missing = [];
  if (!cfApiToken) {
    missing.push('CF_API_TOKEN');
  }
  return missing;
};

export const assertRequiredServerEnv = () => {
  const missing = missingRequiredServerEnvKeys({ cfApiToken: CF_API_TOKEN });

  if (missing.length > 0) {
    const bullets = missing.map((name) => `  - ${name}`).join('\n');
    // First thing an operator sees on a failed boot, so it says what to do.
    let msg =
      'EasyPages: missing required variables in .env (next to docker-compose.yml):\n' +
      `${bullets}\n` +
      'Copy .env.example to .env, fill them in and restart (e.g. docker compose up -d).\n' +
      'CF_ACCOUNT_ID is not needed: it is inferred from the token, and only has to be set if '
      + 'the token grants access to several accounts.\n' +
      'The username and password do not go in .env either: you create them in the browser '
      + 'the first time you open EasyPages.';
    const dataDir = process.env.EASYPAGES_DATA_DIR?.trim();
    if (dataDir) {
      msg += `\nDocker: env_file must load that .env; persistent data lives in the volume mounted at ${dataDir}.`;
    }
    throw new Error(msg);
  }
};
