import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../shared/i18n';
import { resetEasyPagesApi } from '../../api/client/easyPagesApi.js';
import App from './App';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Routes fetch by path. Every request goes through the central API client, so this is the
 * whole seam. */
const mockBackend = (routes) => {
  const calls = [];
  globalThis.fetch = vi.fn((url, init = {}) => {
    const path = String(url);
    calls.push({ method: init.method ?? 'GET', path });
    const handler = Object.entries(routes).find(([route]) => path.startsWith(route))?.[1];
    if (!handler) {
      return Promise.resolve(jsonResponse({ error: 'no route', code: 'not_found' }, 404));
    }
    return Promise.resolve(typeof handler === 'function' ? handler(init) : handler);
  });
  return calls;
};

const statusBody = (overrides = {}) => ({
  setup_complete: true,
  authenticated: true,
  username: 'admin',
  csrf_token: 'test-token',
  ...overrides,
});

describe('App authentication state machine', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    resetEasyPagesApi();
    vi.restoreAllMocks();
  });

  it('draws the setup wizard when there are no credentials', async () => {
    mockBackend({
      '/api/auth/status': jsonResponse(statusBody({
        setup_complete: false,
        authenticated: false,
        username: null,
      })),
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('draws the login screen when credentials exist but the session does not', async () => {
    mockBackend({
      '/api/auth/status': jsonResponse(statusBody({ authenticated: false, username: null })),
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('draws the dashboard and only then asks for projects', async () => {
    const calls = mockBackend({
      '/api/auth/status': jsonResponse(statusBody()),
      '/api/projects': jsonResponse([]),
    });

    render(<App />);

    await screen.findByRole('button', { name: /Create New Project/i });
    await waitFor(() => expect(calls.some((c) => c.path === '/api/projects')).toBe(true));
  });

  it('does not fetch dashboard data before the state is ready', async () => {
    const calls = mockBackend({
      '/api/auth/status': jsonResponse(statusBody({ authenticated: false, username: null })),
    });

    render(<App />);
    await screen.findByRole('button', { name: 'Sign in' });

    // These used to fire unconditionally and 401 on a brand new install.
    expect(calls.filter((c) => c.path.startsWith('/api/projects'))).toHaveLength(0);
  });

  it('shows the offline screen when the backend does not answer, with a retry', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn((url) => {
      if (String(url).startsWith('/api/auth/status')) {
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve(jsonResponse(statusBody({ authenticated: false, username: null })));
      }
      return Promise.resolve(jsonResponse([]));
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('returns to login on a mid-session 401 without reloading the page', async () => {
    let authenticated = true;
    mockBackend({
      '/api/auth/status': () => jsonResponse(statusBody({
        authenticated,
        username: authenticated ? 'admin' : null,
      })),
      '/api/projects': () => (authenticated
        ? jsonResponse([])
        : jsonResponse({ error: 'Session expired.', code: 'session_expired' }, 401)),
    });

    render(<App />);
    const refresh = await screen.findByRole('button', { name: /Refresh List/i });

    authenticated = false;
    fireEvent.click(refresh);

    // No reload: the SPA changes state, not the URL.
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    // And no error toast on top: the auth layer is already reacting. The code that arrives
    // is the server's (`session_expired`), not the `AUTH_REQUIRED` fallback.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('goes straight from the wizard to the dashboard', async () => {
    mockBackend({
      '/api/auth/status': jsonResponse(statusBody({
        setup_complete: false,
        authenticated: false,
        username: null,
      })),
      '/api/auth/setup': jsonResponse({ username: 'admin', csrf_token: 'new-token' }, 201),
      '/api/projects': jsonResponse([]),
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-password' } });
    fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: 'a-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('button', { name: /Create New Project/i })).toBeInTheDocument();
  });

  it('warns in the account dialog that saving signs out other devices', async () => {
    mockBackend({
      '/api/auth/status': jsonResponse(statusBody()),
      '/api/projects': jsonResponse([]),
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /admin/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Saving will sign you out on every other device.');
  });

  it('returns to login after signing out, without navigating', async () => {
    let authenticated = true;
    mockBackend({
      '/api/auth/status': () => jsonResponse(statusBody({
        authenticated,
        username: authenticated ? 'admin' : null,
      })),
      '/api/auth/logout': () => {
        authenticated = false;
        return jsonResponse({ status: 'ok' });
      },
      '/api/projects': jsonResponse([]),
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Logout/ }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
