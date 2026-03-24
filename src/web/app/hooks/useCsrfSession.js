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

export const useCsrfSession = () => {
  const [csrfToken, setCsrfToken] = useState('');

  const refreshCsrfToken = async () => {
    const response = await requestCsrfToken();

    if (response.status === 401) {
      redirectToLogin();
      return '';
    }

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    setCsrfToken(data.csrfToken);
    return data.csrfToken;
  };

  const loadCsrfToken = async () => {
    const data = await easyPagesClient.fetchCsrfToken();
    setCsrfToken(data.csrfToken);
    return data.csrfToken;
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
