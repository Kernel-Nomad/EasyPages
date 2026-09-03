import axios from 'axios';

const CF_API_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_TIMEOUT_MS = 15000;
/** Direct Upload batches are JSON of base64 files; 15s is enough for a GET, not for 8 MiB. */
const UPLOAD_ASSETS_TIMEOUT_MS = 120000;

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

/**
 * Map Cloudflare HTTP statuses onto EasyPages statuses. Never forward 401/403/429: the SPA
 * treats those as session/CSRF/rate-limit of *this* app, and a stale CF token would kick the
 * operator to the login screen or swallow the error as a silent SECURITY_ERROR.
 *
 * `expose` lets the stable `code` (and a sanitized message) through on a 5xx so the SPA can
 * translate `cf_*` without treating the response as a bare internal error.
 */
const mapCloudflareStatus = (cfStatus) => {
  if (cfStatus === 401) {
    return { status: 502, code: 'cf_unauthorized', expose: true };
  }
  if (cfStatus === 403) {
    return { status: 502, code: 'cf_forbidden', expose: true };
  }
  if (cfStatus === 429) {
    return { status: 503, code: 'cf_rate_limited', expose: true };
  }
  if (cfStatus >= 500) {
    return { status: 502, code: 'cf_upstream', expose: true };
  }
  return { status: cfStatus, code: undefined, expose: false };
};

export const normalizeCloudflareError = (error, fallbackMessage) => {
  if (error.response) {
    const mapped = mapCloudflareStatus(error.response.status);
    const normalizedError = new Error(
      extractCloudflareMessage(error.response.data) || fallbackMessage,
    );
    normalizedError.status = mapped.status;
    if (mapped.code) {
      normalizedError.code = mapped.code;
    }
    if (mapped.expose) {
      normalizedError.expose = true;
    }
    const rawDetails = error.response.data?.errors ?? error.response.data?.messages;
    normalizedError.details = sanitizeCloudflareErrorDetails(rawDetails);
    return normalizedError;
  }

  if (error.code === 'ECONNABORTED') {
    return Object.assign(new Error('Timed out connecting to Cloudflare'), {
      status: 504,
      code: 'cf_timeout',
      expose: true,
    });
  }

  if (error.request) {
    return Object.assign(new Error('Could not connect to Cloudflare'), {
      status: 502,
      code: 'cf_unreachable',
      expose: true,
    });
  }

  return error;
};

/**
 * Walk Cloudflare list endpoints that use page/per_page until the list is complete.
 *
 * Do not treat "fewer items than we asked for" as the last page: the v4 API often clamps
 * `per_page` (commonly to 50) and a short first page would silently drop the rest.
 * Prefer `result_info`; without it, keep going until a page is empty.
 *
 * @param {{ get: (path: string) => Promise<{ data?: { result?: unknown, result_info?: { per_page?: number, total_count?: number, total_pages?: number } } }> }} cloudflare
 * @param {string} resourcePath Path under the account, without query string.
 * @param {{ perPage?: number, maxPages?: number }} [options]
 * @returns {Promise<unknown[]>}
 */
export const listAllPages = async (cloudflare, resourcePath, { perPage = 100, maxPages = 100 } = {}) => {
  const separator = resourcePath.includes('?') ? '&' : '?';
  const all = [];
  let page = 1;

  for (;;) {
    const response = await cloudflare.get(
      `${resourcePath}${separator}per_page=${perPage}&page=${page}`,
    );
    const result = response?.data?.result;
    const batch = Array.isArray(result) ? result : [];
    const info = response?.data?.result_info;

    if (batch.length === 0) {
      break;
    }
    all.push(...batch);

    const reportedPerPage = typeof info?.per_page === 'number' && info.per_page > 0
      ? info.per_page
      : null;
    const totalCount = typeof info?.total_count === 'number' ? info.total_count : null;
    const totalPages = typeof info?.total_pages === 'number' ? info.total_pages : null;

    const reachedEnd = totalPages != null
      ? page >= totalPages
      : totalCount != null
        ? all.length >= totalCount
        : reportedPerPage != null
          ? batch.length < reportedPerPage
          : false;

    if (reachedEnd || page >= maxPages) {
      break;
    }
    page += 1;
  }

  return all;
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
      // /accounts is not under /accounts/:id, so call axios directly and paginate.
      const all = [];
      let page = 1;
      const perPage = 50;
      for (;;) {
        const response = await client
          .get(`/accounts?per_page=${perPage}&page=${page}`, mergeHeaders(defaultHeaders))
          .catch((error) => {
            throw normalizeCloudflareError(
              error,
              'Could not look up the Cloudflare account for this token',
            );
          });
        const result = response?.data?.result;
        const batch = Array.isArray(result) ? result : [];
        all.push(...batch);
        if (batch.length < perPage) {
          break;
        }
        page += 1;
      }
      return all;
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
        timeout: UPLOAD_ASSETS_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }).catch((error) => {
        throw normalizeCloudflareError(error, 'Error uploading assets to Cloudflare');
      }),
  };
};
