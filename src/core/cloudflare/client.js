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

const normalizeCloudflareError = (error, fallbackMessage) => {
  if (error.response) {
    const normalizedError = new Error(
      extractCloudflareMessage(error.response.data) || fallbackMessage,
    );
    normalizedError.status = error.response.status;
    normalizedError.details = error.response.data?.errors || error.response.data?.messages;
    return normalizedError;
  }

  if (error.code === 'ECONNABORTED') {
    return Object.assign(new Error('Timeout al conectar con Cloudflare'), { status: 504 });
  }

  if (error.request) {
    return Object.assign(new Error('No se pudo conectar con Cloudflare'), { status: 502 });
  }

  return error;
};

export const createCloudflareClient = ({ apiToken, accountId }) => {
  const defaultHeaders = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  const accountClient = axios.create({
    baseURL: `${CF_API_URL}/accounts/${accountId}`,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: defaultHeaders,
  });

  return {
    get: (resourcePath, config) =>
      accountClient.get(resourcePath, mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error al conectar con Cloudflare');
      }),
    post: (resourcePath, data, config) =>
      accountClient.post(resourcePath, data, mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error enviando datos a Cloudflare');
      }),
    patch: (resourcePath, data, config) =>
      accountClient.patch(resourcePath, data, mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error actualizando datos en Cloudflare');
      }),
    delete: (resourcePath, config) =>
      accountClient.delete(resourcePath, mergeHeaders(defaultHeaders, config)).catch((error) => {
        throw normalizeCloudflareError(error, 'Error eliminando recurso en Cloudflare');
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
        throw normalizeCloudflareError(error, 'Error subiendo assets a Cloudflare');
      }),
  };
};
