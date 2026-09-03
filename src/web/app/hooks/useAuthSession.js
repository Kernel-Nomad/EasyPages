import { useCallback, useEffect, useRef, useState } from 'react';
import {
  configureEasyPagesApi,
  easyPagesClient,
  fetchAuthStatus,
  isBackendUnreachableError,
} from '../../../api/client/easyPagesApi.js';

/**
 * The whole authentication state machine.
 *
 *   loading -> setup   no credentials yet, draw the wizard
 *           -> login   credentials exist, no valid session
 *           -> ready   session valid, draw the dashboard
 *           -> offline the backend did not answer at all
 *
 * The SPA never navigates to authenticate: it asks /api/auth/status and decides what to
 * draw. That is why nothing here touches window.location.
 */
export const useAuthSession = () => {
  const [authState, setAuthState] = useState('loading');
  const [username, setUsername] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [offlineReason, setOfflineReason] = useState(null);
  const bootstrapInFlightRef = useRef(null);

  const applyStatus = useCallback((status) => {
    // Always take the token from the newest response: StrictMode mounts effects twice in
    // development, so two bootstraps race and only the last Set-Cookie survives.
    setOfflineReason(null);
    setCsrfToken(status?.csrf_token ?? '');
    if (!status?.setup_complete) {
      setUsername(null);
      setAuthState('setup');
      return 'setup';
    }
    if (!status.authenticated) {
      setUsername(null);
      setAuthState('login');
      return 'login';
    }
    setUsername(status.username ?? null);
    setAuthState('ready');
    return 'ready';
  }, []);

  /** Single-flight: two concurrent bootstraps would mint two tokens and keep the wrong one. */
  const bootstrap = useCallback(async () => {
    if (bootstrapInFlightRef.current) {
      return bootstrapInFlightRef.current;
    }

    const run = (async () => {
      try {
        return applyStatus(await easyPagesClient.fetchAuthStatus());
      } catch (error) {
        if (error?.code === 'storage_unwritable') {
          setOfflineReason('storage_unwritable');
          setAuthState('offline');
          return 'offline';
        }
        setOfflineReason(null);
        if (isBackendUnreachableError(error)) {
          setAuthState('offline');
          return 'offline';
        }
        // /api/auth/status answers 200 in every legitimate state, so anything else means
        // the server is broken rather than in a state the UI can render.
        console.error('Could not read the session status', error);
        setAuthState('offline');
        return 'offline';
      } finally {
        bootstrapInFlightRef.current = null;
      }
    })();

    bootstrapInFlightRef.current = run;
    return run;
  }, [applyStatus]);

  /**
   * The 403 recovery path. Raw fetch on purpose: going through easyPagesClient would call
   * this same hook again on a 403 and recurse.
   */
  const refreshCsrfToken = useCallback(async () => {
    try {
      const response = await fetchAuthStatus();
      if (!response.ok) {
        return '';
      }
      const status = await response.json();
      applyStatus(status);
      return status?.csrf_token ?? '';
    } catch {
      return '';
    }
  }, [applyStatus]);

  const handleUnauthorized = useCallback(() => {
    setUsername(null);
    // Read /api/auth/status: a 401 setup_required (credentials gone) must draw the wizard,
    // not the login form. session_expired still lands on login.
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    configureEasyPagesApi({
      onForbidden: refreshCsrfToken,
      onUnauthorized: handleUnauthorized,
    });
  }, [handleUnauthorized, refreshCsrfToken]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const completeSetup = useCallback(async ({ password, username: nextUsername }) => {
    const result = await easyPagesClient.setupCredentials({
      csrfToken,
      password,
      username: nextUsername,
    });
    setCsrfToken(result?.csrf_token ?? '');
    setUsername(result?.username ?? null);
    setAuthState('ready');
    return result;
  }, [csrfToken]);

  const signIn = useCallback(async ({ password, username: nextUsername }) => {
    try {
      const result = await easyPagesClient.login({ csrfToken, password, username: nextUsername });
      setCsrfToken(result?.csrf_token ?? '');
      setUsername(result?.username ?? null);
      setAuthState('ready');
      return result;
    } catch (error) {
      // /login answers 409 setup_required (not 401) so the form can tell it apart from
      // invalid_credentials. Re-read status and draw the wizard.
      if (error?.code === 'setup_required') {
        await bootstrap();
      }
      throw error;
    }
  }, [bootstrap, csrfToken]);

  const signOut = useCallback(async () => {
    try {
      await easyPagesClient.logout(csrfToken);
    } finally {
      // Whatever the server said, the local session is over. Re-bootstrapping reads the
      // real state and yields a usable CSRF token for the login form.
      setUsername(null);
      setAuthState('login');
      await bootstrap();
    }
  }, [bootstrap, csrfToken]);

  const updateCredentials = useCallback(async (input) => {
    const result = await easyPagesClient.changeCredentials({ ...input, csrfToken });
    setCsrfToken(result?.csrf_token ?? '');
    setUsername(result?.username ?? null);
    return result;
  }, [csrfToken]);

  return {
    authState,
    completeSetup,
    csrfToken,
    offlineReason,
    retryConnection: bootstrap,
    signIn,
    signOut,
    updateCredentials,
    username,
  };
};

/**
 * Errors the dashboard should stay quiet about: the auth layer is already reacting
 * (switching to login/setup). CSRF failures and other security errors are NOT silent —
 * the operator needs a toast when a retry fails while they stay on the dashboard.
 */
const SILENT_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'session_expired',
  'setup_required',
]);

export const isSecurityError = (error) => SILENT_ERROR_CODES.has(error?.code);
