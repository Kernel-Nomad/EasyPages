export class EasyPagesApiError extends Error {
  constructor(message, { code = 'REQUEST_FAILED', details, retryAfter, status } = {}) {
    super(message);
    this.name = 'EasyPagesApiError';
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
    this.status = status;
  }
}

const apiHooks = {
  onForbidden: null,
  onUnauthorized: null,
};

/**
 * Codes that mean "this session is gone", as opposed to "these credentials are wrong".
 * The distinction is the whole reason there is more than one request tier below.
 */
const SESSION_LOST_CODES = new Set(['session_expired', 'setup_required']);

const encodePathSegment = (value) => encodeURIComponent(value);
const projectApiPath = (projectName) => `/api/projects/${encodePathSegment(projectName)}`;

// Centralises the CSRF and JSON headers for dashboard requests.
const easyPagesFetch = (url, options = {}) => {
  const { method = 'GET', csrfToken, json, body, signal } = options;
  const headers = {};
  if (csrfToken !== undefined && csrfToken !== null) {
    headers['CSRF-Token'] = csrfToken;
  }
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const init = { method, headers };
  if (signal !== undefined) {
    init.signal = signal;
  }
  if (json !== undefined) {
    init.body = JSON.stringify(json);
  } else if (body !== undefined) {
    init.body = body;
  }
  return fetch(url, init);
};

export const configureEasyPagesApi = ({ onForbidden, onUnauthorized } = {}) => {
  apiHooks.onForbidden = onForbidden || null;
  apiHooks.onUnauthorized = onUnauthorized || null;
};

export const resetEasyPagesApi = () => {
  apiHooks.onForbidden = null;
  apiHooks.onUnauthorized = null;
};

/**
 * True for a network failure or an aborted request, as opposed to an HTTP error. That is
 * the difference between "the backend is down" and "the backend said no".
 */
export const isBackendUnreachableError = (error) => {
  if (!error) {
    return false;
  }
  if (error instanceof EasyPagesApiError) {
    return false;
  }
  return error instanceof TypeError
    || error.name === 'TimeoutError'
    || error.name === 'AbortError';
};

// --- Auth endpoints -------------------------------------------------------------------

/**
 * SPA bootstrap. Also the only public source of a CSRF token: the protection middleware
 * mints one lazily, so without this call an anonymous visitor has no session cookie and
 * every POST would 403 with no way to recover.
 */
export const fetchAuthStatus = () => fetch('/api/auth/status');

export const setupCredentials = ({ csrfToken, password, username }) =>
  easyPagesFetch('/api/auth/setup', {
    method: 'POST',
    csrfToken,
    json: { password, username },
  });

export const login = ({ csrfToken, password, username }) =>
  easyPagesFetch('/api/auth/login', {
    method: 'POST',
    csrfToken,
    json: { password, username },
  });

export const logout = (csrfToken) =>
  easyPagesFetch('/api/auth/logout', { method: 'POST', csrfToken });

export const changeCredentials = ({ csrfToken, currentPassword, newPassword, username }) =>
  easyPagesFetch('/api/auth/credentials', {
    method: 'POST',
    csrfToken,
    json: {
      current_password: currentPassword,
      ...(username === undefined ? {} : { username }),
      ...(newPassword === undefined ? {} : { new_password: newPassword }),
    },
  });

// --- Dashboard endpoints --------------------------------------------------------------

export const fetchProjects = () => fetch('/api/projects');

export const createProject = ({ csrfToken, name }) =>
  easyPagesFetch('/api/projects', { method: 'POST', csrfToken, json: { name } });

export const fetchDeployments = (projectName, { signal } = {}) =>
  easyPagesFetch(`${projectApiPath(projectName)}/deployments`, { signal });

export const triggerDeployment = ({ projectName, csrfToken }) =>
  easyPagesFetch(`${projectApiPath(projectName)}/deployments`, { method: 'POST', csrfToken });

export const fetchDeploymentDeleteCandidates = (projectName) =>
  fetch(`${projectApiPath(projectName)}/deployments/candidates`);

export const deleteDeployments = ({ projectName, csrfToken, deploymentIds }) =>
  easyPagesFetch(`${projectApiPath(projectName)}/deployments`, {
    method: 'DELETE',
    csrfToken,
    json: { deploymentIds },
  });

export const fetchDomains = (projectName) => fetch(`${projectApiPath(projectName)}/domains`);

export const addDomain = ({ projectName, csrfToken, name }) =>
  easyPagesFetch(`${projectApiPath(projectName)}/domains`, {
    method: 'POST',
    csrfToken,
    json: { name },
  });

export const deleteDomain = ({ projectName, csrfToken, domainName }) =>
  easyPagesFetch(`${projectApiPath(projectName)}/domains/${encodePathSegment(domainName)}`, {
    method: 'DELETE',
    csrfToken,
  });

export const fetchProjectSettings = (projectName) => fetch(`${projectApiPath(projectName)}/env`);

export const updateProjectBuildConfig = ({ projectName, csrfToken, buildConfig }) =>
  easyPagesFetch(projectApiPath(projectName), {
    method: 'PATCH',
    csrfToken,
    json: { build_config: buildConfig },
  });

export const uploadProjectFiles = ({ projectName, csrfToken, formData }) =>
  easyPagesFetch(`${projectApiPath(projectName)}/upload`, {
    method: 'POST',
    csrfToken,
    body: formData,
  });

// --- Response handling ----------------------------------------------------------------

const parseResponsePayload = async (response) => {
  const contentType = response.headers?.get?.('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    return text ? { message: text } : null;
  } catch {
    return null;
  }
};

const buildApiError = async (response, fallbackMessage, fallbackCode = 'REQUEST_FAILED') => {
  const payload = await parseResponsePayload(response);
  const message = payload?.error || payload?.message || fallbackMessage || 'The request failed.';
  return new EasyPagesApiError(message, {
    // The server's stable code wins: it is the contract the UI keys its i18n off, whereas
    // the fallback only describes where the failure was noticed.
    code: payload?.code || fallbackCode,
    details: payload?.details || payload?.errors,
    retryAfter: payload?.retry_after,
    status: response.status,
  });
};

/**
 * Tier 1 — dashboard endpoints. A 401 here can only mean the session went away, so it
 * hands control to `onUnauthorized` and the SPA switches to the login screen.
 */
const requestApi = async (
  requestFactory,
  { fallbackMessage, parse = 'json', retryOnForbidden = false } = {},
) => {
  const executeRequest = async (csrfTokenOverride, hasRetried = false) => {
    const response = await requestFactory(csrfTokenOverride);

    if (response.status === 401) {
      apiHooks.onUnauthorized?.(response);
      throw await buildApiError(response, 'Session expired.', 'AUTH_REQUIRED');
    }

    if (response.status === 403) {
      const refreshedCsrfToken = !hasRetried ? await apiHooks.onForbidden?.(response) : null;

      if (retryOnForbidden && refreshedCsrfToken) {
        return executeRequest(refreshedCsrfToken, true);
      }

      throw await buildApiError(response, 'Security error.', 'SECURITY_ERROR');
    }

    if (!response.ok) {
      throw await buildApiError(response, fallbackMessage);
    }

    if (parse === 'raw') {
      return response;
    }

    if (parse === 'none' || response.status === 204) {
      return null;
    }

    return parseResponsePayload(response);
  };

  return executeRequest();
};

/**
 * Tier 2 — the login and setup forms. A 401 here means *wrong credentials*, so it must
 * stay a form error. Routing it through `onUnauthorized` would ask the SPA to show the
 * login screen it is already showing.
 */
const publicAuthRequest = async (requestFactory, { fallbackMessage } = {}) => {
  const response = await requestFactory();

  if (!response.ok) {
    throw await buildApiError(response, fallbackMessage);
  }

  return parseResponsePayload(response);
};

/**
 * Tier 3 — changing credentials, where a 401 is genuinely ambiguous: it is either "the
 * current password is wrong" (a form error) or "your session expired while the dialog was
 * open" (leave the screen). Only the codes in SESSION_LOST_CODES do the latter; without
 * the distinction the dialog used to sit there saying "session expired" with no way out.
 */
const sessionAwareRequest = async (requestFactory, { fallbackMessage } = {}) => {
  const response = await requestFactory();

  if (!response.ok) {
    const error = await buildApiError(response, fallbackMessage);
    if (response.status === 401 && SESSION_LOST_CODES.has(error.code)) {
      apiHooks.onUnauthorized?.(response);
    }
    throw error;
  }

  return parseResponsePayload(response);
};

export const easyPagesClient = {
  addDomain: ({ csrfToken, name, projectName }) =>
    requestApi((nextCsrfToken) => addDomain({
      csrfToken: nextCsrfToken || csrfToken,
      name,
      projectName,
    }), {
      fallbackMessage: 'Error adding the domain.',
      retryOnForbidden: true,
    }),
  changeCredentials: ({ csrfToken, currentPassword, newPassword, username }) =>
    sessionAwareRequest(() => changeCredentials({
      csrfToken,
      currentPassword,
      newPassword,
      username,
    }), {
      fallbackMessage: 'Could not update the credentials.',
    }),
  createProject: ({ csrfToken, name }) =>
    requestApi((nextCsrfToken) => createProject({
      csrfToken: nextCsrfToken || csrfToken,
      name,
    }), {
      fallbackMessage: 'Error creating the project.',
      retryOnForbidden: true,
    }),
  deleteDeployments: ({ csrfToken, deploymentIds, projectName }) =>
    requestApi((nextCsrfToken) => deleteDeployments({
      csrfToken: nextCsrfToken || csrfToken,
      deploymentIds,
      projectName,
    }), {
      fallbackMessage: 'Error deleting deployments.',
      retryOnForbidden: true,
    }),
  deleteDomain: ({ csrfToken, domainName, projectName }) =>
    requestApi((nextCsrfToken) => deleteDomain({
      csrfToken: nextCsrfToken || csrfToken,
      domainName,
      projectName,
    }), {
      fallbackMessage: 'Error deleting the domain.',
      retryOnForbidden: true,
    }),
  fetchAuthStatus: () =>
    publicAuthRequest(() => fetchAuthStatus(), {
      fallbackMessage: 'Could not read the session status.',
    }),
  fetchDeploymentDeleteCandidates: (projectName) =>
    requestApi(() => fetchDeploymentDeleteCandidates(projectName), {
      fallbackMessage: 'Error loading deletable deployments.',
    }),
  fetchDeployments: (projectName, { signal } = {}) =>
    requestApi(() => fetchDeployments(projectName, { signal }), {
      fallbackMessage: 'Error loading deployments.',
    }),
  fetchDomains: (projectName) =>
    requestApi(() => fetchDomains(projectName), {
      fallbackMessage: 'Error loading domains.',
    }),
  fetchProjectSettings: (projectName) =>
    requestApi(() => fetchProjectSettings(projectName), {
      fallbackMessage: 'Error loading the project configuration.',
    }),
  fetchProjects: () =>
    requestApi(() => fetchProjects(), {
      fallbackMessage: 'Error loading projects.',
    }),
  login: ({ csrfToken, password, username }) =>
    publicAuthRequest(() => login({ csrfToken, password, username }), {
      fallbackMessage: 'Could not sign in.',
    }),
  logout: (csrfToken) =>
    publicAuthRequest(() => logout(csrfToken), {
      fallbackMessage: 'Error signing out.',
    }),
  setupCredentials: ({ csrfToken, password, username }) =>
    publicAuthRequest(() => setupCredentials({ csrfToken, password, username }), {
      fallbackMessage: 'Could not complete the initial setup.',
    }),
  triggerDeployment: ({ csrfToken, projectName }) =>
    requestApi((nextCsrfToken) => triggerDeployment({
      csrfToken: nextCsrfToken || csrfToken,
      projectName,
    }), {
      fallbackMessage: 'Error triggering the deployment.',
      retryOnForbidden: true,
    }),
  updateProjectBuildConfig: ({ buildConfig, csrfToken, projectName }) =>
    requestApi((nextCsrfToken) => updateProjectBuildConfig({
      buildConfig,
      csrfToken: nextCsrfToken || csrfToken,
      projectName,
    }), {
      fallbackMessage: 'Error updating the build configuration.',
      retryOnForbidden: true,
    }),
  uploadProjectFiles: ({ csrfToken, formData, projectName }) =>
    requestApi((nextCsrfToken) => uploadProjectFiles({
      csrfToken: nextCsrfToken || csrfToken,
      formData,
      projectName,
    }), {
      fallbackMessage: 'Error uploading the files.',
      retryOnForbidden: true,
    }),
};
