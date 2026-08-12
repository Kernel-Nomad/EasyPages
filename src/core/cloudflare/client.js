import axios from 'axios';

const CF_API_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_TIMEOUT_MS = 15000;

const mergeHeaders = (defaultHeaders, config = {}) => ({
  ...config,
  headers: {
    ...defaultHeaders,
    ...(config.headers || {}),
  },
});

const extractCloudflareMessage = (payload) => {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const messages = errors
    .map((entry) => entry?.message)
    .filter(Boolean);

  if (messages.length > 0) {
    return messages.join(' ');
  }

  if (typeof payload?.message === 'string' && payload.message) {
    return payload.message;
  }

  return null;
};

const MAX_DETAIL_MESSAGE_LEN = 2000;

/**
 * Keeps only `code` and `message` (Cloudflare API v4) so arbitrary objects are never
 * forwarded to the client.
 * @param {unknown} raw
 * @returns {Array<{ code?: number, message: string }> | undefined}
 */
export const sanitizeCloudflareErrorDetails = (raw) => {
  if (raw == null) {
    return undefined;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }
    return [{ message: trimmed.slice(0, MAX_DETAIL_MESSAGE_LEN) }];
  }

  if (!Array.isArray(raw)) {
    return undefined;
  }

  const out = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const t = entry.trim();
      if (t) {
        out.push({ message: t.slice(0, MAX_DETAIL_MESSAGE_LEN) });
      }
      continue;
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const message =
      typeof entry.message === 'string' ? entry.message.trim().slice(0, MAX_DETAIL_MESSAGE_LEN) : '';
    if (!message) {
      continue;
    }

    const row = { message };
    const code = entry.code;
    if (typeof code === 'number' && Number.isFinite(code)) {
      row.code = code;
    }
    out.push(row);
  }

  return out.length > 0 ? out : undefined;
};

const normalizeCloudflareError = (error, fallbackMessage) => {
  if (error.response) {
    const normalizedError = new Error(
      extractCloudflareMessage(error.response.data) || fallbackMessage,
    );
    normalizedError.status = error.response.status;
    const rawDetails = error.response.data?.errors ?? error.response.data?.messages;
    normalizedError.details = sanitizeCloudflareErrorDetails(rawDetails);
    return normalizedError;
  }

  if (error.code === 'ECONNABORTED') {
    return Object.assign(new Error('Timed out connecting to Cloudflare'), { status: 504 });
  }

  if (error.request) {
    return Object.assign(new Error('Could not connect to Cloudflare'), { status: 502 });
  }

  return error;
};

/** `expose` lets the error handler forward message and code on a 5xx, where both are
 * normally masked. Used only where the message IS the remediation. */
const configurationError = (message, code) =>
  Object.assign(new Error(message), { code, expose: true, status: 500 });

/**
 * Resolve which Cloudflare account to operate on.
 *
 * `CF_ACCOUNT_ID` is optional and inferred from the token, as Cloudflare's own SDK and
 * Wrangler do; it is only required when the token sees more than one account. Resolution is
 * lazy so a host that reboots without internet still starts and reports a clear error.
 *
 * @param {{ explicitAccountId?: string, listAccounts: () => Promise<Array<{id: string, name?: string}>>, log?: (message: string) => void }} deps
 */
export const createAccountIdResolver = ({ explicitAccountId, listAccounts, log = console.log }) => {
  const explicit = typeof explicitAccountId === 'string' ? explicitAccountId.trim() : '';
  let resolved = explicit || null;
  // Only successes are cached, and only one lookup runs at a time: a transient network
  // failure must not be remembered, and a cold start must not fan out identical lookups.
  let inFlight = null;

  return async () => {
    if (resolved) {
      return resolved;
    }
    if (inFlight) {
      return inFlight;
    }

    inFlight = (async () => {
      const accounts = await listAccounts();

      if (accounts.length === 0) {
        throw configurationError(
          'The Cloudflare token does not grant access to any account. Check that it has the '
          + 'Account → Cloudflare Pages → Edit permission, or set CF_ACCOUNT_ID in .env.',
          'cf_account_not_found',
        );
      }

      if (accounts.length > 1) {
        // The IDs go to the log, not to the response: the operator reading the logs is the
        // one who has to choose.
        log(
          `[EasyPages] The Cloudflare token sees ${accounts.length} accounts: `
          + `${accounts.map((account) => `${account.name ?? '?'} (${account.id})`).join(', ')}`,
        );
        throw configurationError(
          'The Cloudflare token has access to several accounts and none can be picked. '
          + 'Set CF_ACCOUNT_ID in .env (the IDs are in the server logs).',
          'cf_account_ambiguous',
        );
      }

      const [account] = accounts;
      log(`[EasyPages] Cloudflare account detected: ${account.name ?? account.id} (${account.id})`);
      resolved = account.id;
      return resolved;
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
};

export const createCloudflareClient = ({ apiToken, accountId }) => {
  const defaultHeaders = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  // Rooted at the API, not the account: that segment is added per request because it may
  // not be known until the first call.
  const client = axios.create({
    baseURL: CF_API_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: defaultHeaders,
  });

  const resolveAccountId = createAccountIdResolver({
    explicitAccountId: accountId,
    listAccounts: async () => {
      const response = await client
        .get('/accounts', mergeHeaders(defaultHeaders))
        .catch((error) => {
          throw normalizeCloudflareError(
            error,
            'Could not look up the Cloudflare account for this token',
          );
        });
      const result = response?.data?.result;
      return Array.isArray(result) ? result : [];
    },
  });

  const accountPath = async (resourcePath) => `/accounts/${await resolveAccountId()}${resourcePath}`;

  return {
    resolveAccountId,
    get: async (resourcePath, config) =>
      client.get(await accountPath(resourcePath), mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error connecting to Cloudflare');
      }),
    post: async (resourcePath, data, config) =>
      client.post(await accountPath(resourcePath), data, mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error sending data to Cloudflare');
      }),
    patch: async (resourcePath, data, config) =>
      client.patch(await accountPath(resourcePath), data, mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error updating data in Cloudflare');
      }),
    delete: async (resourcePath, config) =>
      client.delete(await accountPath(resourcePath), mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error deleting a resource in Cloudflare');
      }),
    uploadAssets: (filesToUpload, jwt) =>
      axios.post(`${CF_API_URL}/pages/assets/upload`, filesToUpload, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        timeout: DEFAULT_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }).catch((error) => {
        throw normalizeCloudflareError(error, 'Error uploading assets to Cloudflare');
      }),
  };
};
