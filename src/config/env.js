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
    throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
  }
};
