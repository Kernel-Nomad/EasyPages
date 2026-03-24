import dotenv from 'dotenv';
import { repoEnvPath } from './paths.js';

const dotenvResult = dotenv.config({ path: repoEnvPath });
if (dotenvResult.error) {
  dotenv.config();
}

export const PORT = process.env.PORT || 8002;
export const CF_API_TOKEN = process.env.CF_API_TOKEN;
export const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
export const AUTH_USER = process.env.AUTH_USER;
export const AUTH_PASS = process.env.AUTH_PASS;
export const SESSION_SECRET = process.env.SESSION_SECRET;

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

export const assertRequiredServerEnv = () => {
  const missing = [];

  if (!CF_API_TOKEN) {
    missing.push('CF_API_TOKEN');
  }

  if (!CF_ACCOUNT_ID) {
    missing.push('CF_ACCOUNT_ID');
  }

  if (!AUTH_USER) {
    missing.push('AUTH_USER');
  }

  if (!AUTH_PASS) {
    missing.push('AUTH_PASS');
  }

  if (missing.length > 0) {
    const list = missing.join(', ');
    let msg =
      `EasyPages: faltan variables de entorno obligatorias (${list}). ` +
      'Crea un archivo .env junto a docker-compose.yml (por ejemplo: cp .env.example .env), rellena esas claves y vuelve a arrancar; o pásalas al contenedor.';
    if (process.env.EASYPAGES_DATA_DIR) {
      msg +=
        ` En Docker, comprueba que env_file apunte a ese .env y que el volumen persista ${process.env.EASYPAGES_DATA_DIR} como indica el README.`;
    }
    throw new Error(msg);
  }
};
