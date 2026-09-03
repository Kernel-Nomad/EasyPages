import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Shared plumbing for the integration suites: a real Express app on an ephemeral port with
 * a mock Cloudflare client, plus the cookie jar the auth flow needs.
 *
 * EASYPAGES_DATA_DIR always points at a fresh temp directory. Without that, a test run
 * would create credentials in the developer's working tree and every later run would
 * pass or fail depending on what the previous one left behind.
 */

const ENV_KEYS = [
  'CF_API_TOKEN',
  'CF_ACCOUNT_ID',
  'EASYPAGES_DATA_DIR',
  'SESSION_SECRET',
  'NODE_ENV',
  'SESSION_COOKIE_SECURE',
  'TRUST_PROXY',
];

const appJsPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/api/server/app.js',
);

/**
 * Must run before anything imports src/config/env.js: it snapshots process.env at module
 * load, so a later change would not be picked up.
 */
export const prepareEnv = (overrides = {}) => {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypages-it-'));

  process.env.CF_API_TOKEN = 'test-token';
  // CF_ACCOUNT_ID is deliberately NOT set: it is optional now, inferred from the token on
  // the first Cloudflare call, so booting without it is part of what these suites check.
  delete process.env.CF_ACCOUNT_ID;
  process.env.EASYPAGES_DATA_DIR = dataDir;
  process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
  process.env.NODE_ENV = 'test';
  delete process.env.SESSION_COOKIE_SECURE;
  delete process.env.TRUST_PROXY;
  Object.assign(process.env, overrides);

  const restore = () => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    fs.rmSync(dataDir, { force: true, recursive: true });
  };

  return { credentialsPath: path.join(dataDir, 'credentials.json'), dataDir, restore };
};

/**
 * Boot a server. Safe to call more than once per process: createApp builds a fresh auth
 * state each time, which is how a "credentials wiped and recreated" scenario is set up.
 */
export const startApp = async ({ cloudflare } = {}) => {
  const { createApp } = await import(pathToFileURL(appJsPath).href);
  const app = createApp({ cloudflare: cloudflare ?? createMockCloudflare() });

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve(listener)));
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

const readSetCookie = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
};

/**
 * Minimal cookie jar. cookie-session emits two cookies (value and signature), so a jar
 * that only kept the last Set-Cookie would drop the signature and every request would
 * arrive unauthenticated.
 */
export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  apply(headers) {
    for (const setCookie of readSetCookie(headers)) {
      const pair = setCookie.split(';')[0].trim();
      const name = pair.slice(0, pair.indexOf('='));
      const value = pair.slice(pair.indexOf('=') + 1);
      if (value === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
    return this;
  }

  get header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

/**
 * fetch() that carries the jar both ways and never follows redirects, so a test can assert
 * on the 302 itself.
 */
export const createClient = (baseUrl, existingJar) => {
  // An explicit jar lets a test carry a session across two app instances, which is how the
  // "credentials wiped and recreated" scenario is set up.
  const jar = existingJar ?? new CookieJar();

  const request = async (requestPath, { body, csrfToken, headers = {}, json, method = 'GET' } = {}) => {
    const finalHeaders = { ...headers };
    if (jar.header) {
      finalHeaders.Cookie = jar.header;
    }
    if (csrfToken) {
      finalHeaders['CSRF-Token'] = csrfToken;
    }
    if (json !== undefined) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${requestPath}`, {
      body: json !== undefined ? JSON.stringify(json) : body,
      headers: finalHeaders,
      method,
      redirect: 'manual',
    });
    jar.apply(response.headers);
    return response;
  };

  /** Bootstrap: also the only public source of a CSRF token. */
  const status = async () => {
    const response = await request('/api/auth/status');
    return { body: await response.json(), response };
  };

  /** Run the wizard end to end and return the session-scoped CSRF token. */
  const completeSetup = async ({ password = 'a-good-password', username = 'admin' } = {}) => {
    const { body: bootstrap } = await status();
    const response = await request('/api/auth/setup', {
      csrfToken: bootstrap.csrf_token,
      json: { password, username },
      method: 'POST',
    });
    const body = await response.json();
    return { body, csrfToken: body.csrf_token, response };
  };

  const login = async ({ password = 'a-good-password', username = 'admin' } = {}) => {
    const { body: bootstrap } = await status();
    const response = await request('/api/auth/login', {
      csrfToken: bootstrap.csrf_token,
      json: { password, username },
      method: 'POST',
    });
    const body = await response.json();
    return { body, csrfToken: body.csrf_token, response };
  };

  return { completeSetup, jar, login, request, status };
};

const pageFromPath = (resourcePath) => {
  const query = resourcePath.split('?')[1] || '';
  const match = /(?:^|&)page=(\d+)/.exec(query);
  return match ? Number.parseInt(match[1], 10) : 1;
};

export const createMockCloudflare = (overrides = {}) => ({
  get: async (resourcePath) => {
    const pathOnly = resourcePath.split('?')[0];
    const page = pageFromPath(resourcePath);
    if (pathOnly === '/pages/projects') {
      const item = {
        id: 'proj-1',
        name: 'demo',
        subdomain: 'demo.pages.dev',
        source: { type: 'github', config: { owner: 'acme', repo_name: 'demo' } },
        latest_deployment: {
          id: 'dep-1',
          latest_stage: { status: 'success' },
          url: 'https://demo.pages.dev',
        },
        build_config: {},
        deployment_configs: {
          production: {
            env_vars: { SECRET: { type: 'secret_text', value: 'should-not-leak' } },
          },
        },
      };
      return {
        data: {
          result: page > 1 ? [] : [item],
          result_info: { page, per_page: 100, total_count: 1, total_pages: 1 },
        },
      };
    }
    if (pathOnly === '/pages/projects/demo/domains') {
      return {
        data: {
          result: page > 1 ? [] : [{ id: 'dom-existing', name: 'existing.example.com' }],
          result_info: { page, per_page: 100, total_count: 1, total_pages: 1 },
        },
      };
    }
    if (pathOnly === '/pages/projects/demo') {
      return {
        data: {
          result: {
            id: 'proj-1',
            name: 'demo',
            build_config: { build_command: 'npm run build', destination_dir: 'dist' },
            production_branch: 'main',
            canonical_deployment: { id: 'dep-prod' },
            source: { type: 'github', config: { owner: 'acme', repo_name: 'demo' } },
            latest_deployment: { latest_stage: { status: 'success' } },
            deployment_configs: {
              production: {
                env_vars: { SECRET: { type: 'plain_text', value: 'nope' } },
              },
            },
          },
        },
      };
    }
    throw new Error(`unexpected GET ${resourcePath}`);
  },
  post: async (resourcePath, data) => {
    const pathOnly = resourcePath.split('?')[0];
    if (pathOnly === '/pages/projects/demo/domains') {
      return { data: { result: { id: 'dom-new', name: data.name } } };
    }
    if (pathOnly === '/pages/projects') {
      return {
        data: {
          result: {
            id: 'proj-new',
            name: data.name,
            subdomain: `${data.name}.pages.dev`,
            source: {},
            latest_deployment: null,
            deployment_configs: {
              production: { env_vars: { X: { value: 'secret' } } },
            },
          },
        },
      };
    }
    throw new Error(`unexpected POST ${resourcePath}`);
  },
  patch: async (resourcePath) => {
    const pathOnly = resourcePath.split('?')[0];
    if (pathOnly === '/pages/projects/demo') {
      return {
        data: {
          result: {
            id: 'proj-1',
            name: 'demo',
            subdomain: 'demo.pages.dev',
            source: { type: 'github', config: { owner: 'acme', repo_name: 'demo' } },
            latest_deployment: { latest_stage: { status: 'success' } },
            deployment_configs: {
              production: { env_vars: { SECRET: { value: 'nope' } } },
            },
          },
        },
      };
    }
    throw new Error(`unexpected patch ${resourcePath}`);
  },
  delete: async (resourcePath) => {
    const pathOnly = resourcePath.split('?')[0];
    if (pathOnly === '/pages/projects/demo/domains/example.com') {
      return { data: { success: true } };
    }
    throw new Error(`unexpected DELETE ${resourcePath}`);
  },
  uploadAssets: async () => {
    throw new Error('unexpected uploadAssets');
  },
  ...overrides,
});
