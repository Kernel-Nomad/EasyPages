import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const envKeys = [
  'CF_API_TOKEN',
  'CF_ACCOUNT_ID',
  'AUTH_USER',
  'AUTH_PASS',
  'SESSION_SECRET',
  'NODE_ENV',
  'SESSION_COOKIE_SECURE',
];

const mergeSetCookie = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
};

const applySetCookieHeaders = (headers, jarState) => {
  const list = mergeSetCookie(headers);
  let next = jarState;
  for (const sc of list) {
    const pair = sc.split(';')[0].trim();
    const name = pair.split('=')[0];
    const parts = next
      ? next.split(';').map((s) => s.trim()).filter(Boolean).filter((c) => !c.startsWith(`${name}=`))
      : [];
    next = [...parts, pair].join('; ');
  }
  return next;
};

const extractCsrfFromLoginHtml = (html) => {
  const m = html.match(/name="_csrf"\s+value="([^"]+)"/);
  assert.ok(m, 'debe existir el campo oculto _csrf en el HTML de login');
  return m[1];
};

let prevEnv = {};
let server;
let baseUrl;

before(async () => {
  for (const k of envKeys) {
    prevEnv[k] = process.env[k];
  }
  process.env.CF_API_TOKEN = 'test-token';
  process.env.CF_ACCOUNT_ID = 'test-account';
  process.env.AUTH_USER = 'testuser';
  process.env.AUTH_PASS = 'testpass';
  process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
  process.env.NODE_ENV = 'test';
  delete process.env.SESSION_COOKIE_SECURE;

  const mockCloudflare = {
    get: async (resourcePath) => {
      if (resourcePath === '/pages/projects') {
        return {
          data: {
            result: [{
              id: 'proj-1',
              name: 'demo',
              subdomain: 'demo.pages.dev',
              source: { type: 'direct_upload' },
              latest_deployment: { status: 'success' },
              build_config: {},
            }],
          },
        };
      }
      if (resourcePath === '/pages/projects/demo/domains') {
        return {
          data: {
            result: [{ id: 'dom-existing', name: 'existing.example.com' }],
          },
        };
      }
      throw new Error(`unexpected GET ${resourcePath}`);
    },
    post: async (resourcePath, data) => {
      if (resourcePath === '/pages/projects/demo/domains') {
        return {
          data: {
            result: { id: 'dom-new', name: data.name },
          },
        };
      }
      throw new Error(`unexpected POST ${resourcePath}`);
    },
    patch: async () => {
      throw new Error('unexpected patch');
    },
    delete: async (resourcePath) => {
      if (resourcePath === '/pages/projects/demo/domains/example.com') {
        return { data: { success: true } };
      }
      throw new Error(`unexpected DELETE ${resourcePath}`);
    },
    uploadAssets: async () => {
      throw new Error('unexpected uploadAssets');
    },
  };

  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const appJs = path.resolve(testDir, '../../../../src/api/server/app.js');
  const appModule = await import(pathToFileURL(appJs).href);
  const app = appModule.createApp({ cloudflare: mockCloudflare });

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  for (const k of envKeys) {
    if (prevEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = prevEnv[k];
    }
  }
});

test('flujo HTTP: login, token CSRF y listado de proyectos con Cloudflare simulado', async () => {
  let jar = '';

  const loginPage = await fetch(`${baseUrl}/login`);
  assert.strictEqual(loginPage.status, 200);
  jar = applySetCookieHeaders(loginPage.headers, jar);
  const html = await loginPage.text();
  const csrf = extractCsrfFromLoginHtml(html);

  const loginPost = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar,
    },
    body: new URLSearchParams({
      username: 'testuser',
      password: 'testpass',
      _csrf: csrf,
    }),
    redirect: 'manual',
  });
  assert.strictEqual(loginPost.status, 302);
  jar = applySetCookieHeaders(loginPost.headers, jar);

  const csrfRes = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { Cookie: jar },
  });
  assert.strictEqual(csrfRes.status, 200);
  jar = applySetCookieHeaders(csrfRes.headers, jar);
  const { csrfToken } = await csrfRes.json();
  assert.ok(typeof csrfToken === 'string' && csrfToken.length > 0);

  const projectsRes = await fetch(`${baseUrl}/api/projects`, {
    headers: {
      Cookie: jar,
      'CSRF-Token': csrfToken,
    },
  });
  assert.strictEqual(projectsRes.status, 200);
  const projects = await projectsRes.json();
  assert.ok(Array.isArray(projects));
  assert.strictEqual(projects.length, 1);
  assert.strictEqual(projects[0].name, 'demo');
});

test('flujo HTTP: listar, añadir y eliminar dominio con Cloudflare simulado', async () => {
  let jar = '';

  const loginPage = await fetch(`${baseUrl}/login`);
  jar = applySetCookieHeaders(loginPage.headers, jar);
  const csrfLogin = extractCsrfFromLoginHtml(await loginPage.text());

  const loginPost = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar,
    },
    body: new URLSearchParams({
      username: 'testuser',
      password: 'testpass',
      _csrf: csrfLogin,
    }),
    redirect: 'manual',
  });
  assert.strictEqual(loginPost.status, 302);
  jar = applySetCookieHeaders(loginPost.headers, jar);

  const csrfRes = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { Cookie: jar },
  });
  assert.strictEqual(csrfRes.status, 200);
  jar = applySetCookieHeaders(csrfRes.headers, jar);
  const { csrfToken } = await csrfRes.json();

  const listRes = await fetch(`${baseUrl}/api/projects/demo/domains`, {
    headers: { Cookie: jar },
  });
  assert.strictEqual(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(Array.isArray(list));
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'existing.example.com');

  const addRes = await fetch(`${baseUrl}/api/projects/demo/domains`, {
    method: 'POST',
    headers: {
      Cookie: jar,
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ name: 'new.example.com' }),
  });
  assert.strictEqual(addRes.status, 200);
  const added = await addRes.json();
  assert.strictEqual(added.name, 'new.example.com');

  const delRes = await fetch(`${baseUrl}/api/projects/demo/domains/example.com`, {
    method: 'DELETE',
    headers: {
      Cookie: jar,
      'CSRF-Token': csrfToken,
    },
  });
  assert.strictEqual(delRes.status, 200);
  const delBody = await delRes.json();
  assert.strictEqual(delBody.success, true);
});

test('sin sesión: GET /index.html redirige al login', async () => {
  const res = await fetch(`${baseUrl}/index.html`, { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  const loc = res.headers.get('location');
  assert.ok(loc && loc.includes('/login'));
});
