import { useEffect, useState } from 'react';
import {
  configureEasyPagesApi,
  easyPagesClient,
  fetchCsrfToken as requestCsrfToken,
} from '../../../api/client/easyPagesApi.js';

const redirectToLogin = () => {
  window.location.href = '/login';
};

export const isSecurityError = (error) =>
  error?.code === 'AUTH_REQUIRED' || error?.code === 'SECURITY_ERROR';

const parseCsrfPayload = async (response) => {
  const data = await response.json();
  return typeof data?.csrfToken === 'string' ? data.csrfToken : '';
};

export const useCsrfSession = () => {
  const [csrfToken, setCsrfToken] = useState('');

  const commitCsrfToken = (token) => {
    const value = typeof token === 'string' ? token : '';
    setCsrfToken(value);
    return value;
  };

  // onForbidden must use raw fetch for GET /api/csrf-token: routing that response
  // through easyPagesClient/requestApi would call onForbidden again on 403 and recurse.
  const refreshCsrfToken = async () => {
    const response = await requestCsrfToken();

    if (response.status === 401) {
      redirectToLogin();
      return '';
    }

    if (!response.ok) {
      return '';
    }

    const token = await parseCsrfPayload(response);
    return commitCsrfToken(token);
  };

  const loadCsrfToken = async () => {
    const data = await easyPagesClient.fetchCsrfToken();
    return commitCsrfToken(data?.csrfToken);
  };

  useEffect(() => {
    configureEasyPagesApi({
      onForbidden: refreshCsrfToken,
      onUnauthorized: redirectToLogin,
    });
  }, []);

  return {
    csrfToken,
    loadCsrfToken,
  };
};
