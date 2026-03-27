import dotenv from 'dotenv';
import { repoEnvPath } from './paths.js';
import { trimEnv } from './trimEnv.js';

const dotenvResult = dotenv.config({ path: repoEnvPath });
if (dotenvResult.error) {
  dotenv.config();
}

export const PORT = process.env.PORT || 8002;
export const CF_API_TOKEN = trimEnv(process.env.CF_API_TOKEN);
export const CF_ACCOUNT_ID = trimEnv(process.env.CF_ACCOUNT_ID);
export const AUTH_USER = trimEnv(process.env.AUTH_USER);
export const AUTH_PASS = trimEnv(process.env.AUTH_PASS);
export const SESSION_SECRET = trimEnv(process.env.SESSION_SECRET);

/**
 * Cookie de sesión `Secure`: booleano explícito.
 * `SESSION_COOKIE_SECURE=true|false` tiene prioridad; si no se define, en `NODE_ENV=production` es `true` (HTTPS detrás de proxy con trust proxy).
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

export const missingRequiredServerEnvKeys = ({
  cfApiToken,
  cfAccountId,
  authUser,
  authPass,
}) => {
  const missing = [];
  if (!cfApiToken) {
    missing.push('CF_API_TOKEN');
  }
  if (!cfAccountId) {
    missing.push('CF_ACCOUNT_ID');
  }
  if (!authUser) {
    missing.push('AUTH_USER');
  }
  if (!authPass) {
    missing.push('AUTH_PASS');
  }
  return missing;
};

export const assertRequiredServerEnv = () => {
  const missing = missingRequiredServerEnvKeys({
    cfApiToken: CF_API_TOKEN,
    cfAccountId: CF_ACCOUNT_ID,
    authUser: AUTH_USER,
    authPass: AUTH_PASS,
  });

  if (missing.length > 0) {
    const ordered = ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'AUTH_USER', 'AUTH_PASS'].filter((name) =>
      missing.includes(name),
    );
    const bullets = ordered.map((name) => `  - ${name}`).join('\n');
    let msg =
      'EasyPages: faltan variables obligatorias en .env (en la misma carpeta que docker-compose.yml):\n' +
      `${bullets}\n` +
      'Copia .env.example a .env, rellénalas en ese orden y reinicia (p. ej. docker compose up -d).';
    const dataDir = process.env.EASYPAGES_DATA_DIR?.trim();
    if (dataDir) {
      msg += `\nDocker: env_file debe cargar ese .env; datos persistentes en el volumen montado en ${dataDir}.`;
    }
    throw new Error(msg);
  }
};
