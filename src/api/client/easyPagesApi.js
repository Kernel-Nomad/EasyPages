export class EasyPagesApiError extends Error {
  constructor(message, { code = 'REQUEST_FAILED', details, status } = {}) {
    super(message);
    this.name = 'EasyPagesApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const apiHooks = {
  onForbidden: null,
  onUnauthorized: null,
};

const encodePathSegment = (value) => encodeURIComponent(value);
const projectApiPath = (projectName) => `/api/projects/${encodePathSegment(projectName)}`;

// Centraliza cabeceras CSRF / JSON para las peticiones del dashboard (no exportado).
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

export const fetchCsrfToken = () => fetch('/api/csrf-token');

export const logout = (csrfToken) =>
  easyPagesFetch('/logout', { method: 'POST', csrfToken });

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

const buildApiError = async (response, fallbackMessage, code = 'REQUEST_FAILED') => {
  const payload = await parseResponsePayload(response);
  const message = payload?.error || payload?.message || fallbackMessage || 'La petición ha fallado.';
  return new EasyPagesApiError(message, {
    code,
    details: payload?.details || payload?.errors,
    status: response.status,
  });
};

const handleUnauthorizedResponse = async (response) => {
  if (response.status === 401) {
    apiHooks.onUnauthorized?.(response);
    throw await buildApiError(response, 'Sesión expirada.', 'AUTH_REQUIRED');
  }
};

const handleForbiddenResponse = async (response) => {
  throw await buildApiError(response, 'Error de seguridad.', 'SECURITY_ERROR');
};

const requestApi = async (
  requestFactory,
  { fallbackMessage, parse = 'json', retryOnForbidden = false } = {},
) => {
  const executeRequest = async (csrfTokenOverride, hasRetried = false) => {
    const response = await requestFactory(csrfTokenOverride);

    if (response.status === 401) {
      await handleUnauthorizedResponse(response);
    }

    if (response.status === 403) {
      const refreshedCsrfToken = !hasRetried ? await apiHooks.onForbidden?.(response) : null;

      if (retryOnForbidden && refreshedCsrfToken) {
        return executeRequest(refreshedCsrfToken, true);
      }

      await handleForbiddenResponse(response);
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

export const easyPagesClient = {
  addDomain: ({ csrfToken, name, projectName }) =>
    requestApi((nextCsrfToken) => addDomain({
      csrfToken: nextCsrfToken || csrfToken,
      name,
      projectName,
    }), {
      fallbackMessage: 'Error al añadir el dominio.',
      retryOnForbidden: true,
    }),
  createProject: ({ csrfToken, name }) =>
    requestApi((nextCsrfToken) => createProject({
      csrfToken: nextCsrfToken || csrfToken,
      name,
    }), {
      fallbackMessage: 'Error al crear el proyecto.',
      retryOnForbidden: true,
    }),
  deleteDeployments: ({ csrfToken, deploymentIds, projectName }) =>
    requestApi((nextCsrfToken) => deleteDeployments({
      csrfToken: nextCsrfToken || csrfToken,
      deploymentIds,
      projectName,
    }), {
      fallbackMessage: 'Error al eliminar despliegues.',
      retryOnForbidden: true,
    }),
  deleteDomain: ({ csrfToken, domainName, projectName }) =>
    requestApi((nextCsrfToken) => deleteDomain({
      csrfToken: nextCsrfToken || csrfToken,
      domainName,
      projectName,
    }), {
      fallbackMessage: 'Error al eliminar el dominio.',
      retryOnForbidden: true,
    }),
  fetchCsrfToken: () =>
    requestApi(() => fetchCsrfToken(), {
      fallbackMessage: 'Error al obtener el token CSRF.',
    }),
  fetchDeploymentDeleteCandidates: (projectName) =>
    requestApi(() => fetchDeploymentDeleteCandidates(projectName), {
      fallbackMessage: 'Error al obtener candidatos a borrar de despliegues.',
    }),
  fetchDeployments: (projectName, { signal } = {}) =>
    requestApi(() => fetchDeployments(projectName, { signal }), {
      fallbackMessage: 'Error al cargar los despliegues.',
    }),
  fetchDomains: (projectName) =>
    requestApi(() => fetchDomains(projectName), {
      fallbackMessage: 'Error al cargar los dominios.',
    }),
  fetchProjectSettings: (projectName) =>
    requestApi(() => fetchProjectSettings(projectName), {
      fallbackMessage: 'Error al cargar la configuración del proyecto.',
    }),
  fetchProjects: () =>
    requestApi(() => fetchProjects(), {
      fallbackMessage: 'Error al cargar los proyectos.',
    }),
  logout: (csrfToken) =>
    requestApi((nextCsrfToken) => logout(nextCsrfToken || csrfToken), {
      fallbackMessage: 'Error al cerrar sesión.',
      parse: 'raw',
      retryOnForbidden: true,
    }),
  triggerDeployment: ({ csrfToken, projectName }) =>
    requestApi((nextCsrfToken) => triggerDeployment({
      csrfToken: nextCsrfToken || csrfToken,
      projectName,
    }), {
      fallbackMessage: 'Error al disparar el despliegue.',
      retryOnForbidden: true,
    }),
  updateProjectBuildConfig: ({ buildConfig, csrfToken, projectName }) =>
    requestApi((nextCsrfToken) => updateProjectBuildConfig({
      buildConfig,
      csrfToken: nextCsrfToken || csrfToken,
      projectName,
    }), {
      fallbackMessage: 'Error al actualizar la configuración de build.',
      retryOnForbidden: true,
    }),
  uploadProjectFiles: ({ csrfToken, formData, projectName }) =>
    requestApi((nextCsrfToken) => uploadProjectFiles({
      csrfToken: nextCsrfToken || csrfToken,
      formData,
      projectName,
    }), {
      fallbackMessage: 'Error al subir los archivos.',
      retryOnForbidden: true,
    }),
};
