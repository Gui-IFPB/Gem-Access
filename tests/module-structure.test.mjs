import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml } from '../assets/js/utils.js';
import { apiRequest, API_BASE_URL, getAuthToken, login, register } from '../assets/js/api.js';

test('utils exports escapeHtml', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('api module exposes base URL and request helper', () => {
  assert.equal(typeof API_BASE_URL, 'string');
  assert.equal(typeof apiRequest, 'function');
});

test('apiRequest sends configured write methods and JSON bodies', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ saved: true }) };
  };

  try {
    for (const method of ['POST', 'PUT', 'PATCH']) {
      await apiRequest('connections', { method, body: { user: 'Demo' } });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests.map(({ options }) => options.method), ['POST', 'PUT', 'PATCH']);
  assert.deepEqual(requests.map(({ options }) => JSON.parse(options.body)), [
    { user: 'Demo' },
    { user: 'Demo' },
    { user: 'Demo' }
  ]);
});

test('apiRequest accepts empty DELETE responses and rejects HTTP errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => options.method === 'DELETE'
    ? { ok: true, status: 204 }
    : { ok: false, status: 500 };

  try {
    assert.equal(await apiRequest('connections/1', { method: 'DELETE' }), null);
    await assert.rejects(apiRequest('connections', { method: 'POST' }), /500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('register sends public signup data and stores the returned JWT', async () => {
  const originalFetch = globalThis.fetch;
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201, json: async () => ({ token: 'signed-jwt', user: { email: 'new@test.local' } }) };
  };

  try {
    const user = await register('New User', 'new@test.local', 'long-password');
    assert.equal(user.email, 'new@test.local');
    assert.equal(request.url, `${API_BASE_URL}/auth/register`);
    assert.equal(request.options.headers.get('Authorization'), null);
    assert.equal(JSON.parse(request.options.body).password, 'long-password');
    assert.equal(getAuthToken(), 'signed-jwt');
  } finally {
    globalThis.fetch = originalFetch;
    if (storageDescriptor) Object.defineProperty(globalThis, 'sessionStorage', storageDescriptor);
    else delete globalThis.sessionStorage;
  }
});

test('login stores the token and authenticated API requests send it', async () => {
  const originalFetch = globalThis.fetch;
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  });
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/auth/login')) {
      return { ok: true, status: 200, json: async () => ({ token: 'session-token', user: { email: 'admin@test.local' } }) };
    }
    if (url.endsWith('/expired')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Sua sessão expirou.' } })
      };
    }
    return { ok: true, status: 200, json: async () => [] };
  };

  try {
    await login('admin@test.local', 'secret');
    await apiRequest('connections');
    assert.equal(getAuthToken(), 'session-token');
    assert.equal(requests[0].options.headers.get('Authorization'), null);
    assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer session-token');
    await assert.rejects(apiRequest('expired'), (error) => {
      assert.equal(error.message, 'Sua sessão expirou.');
      assert.equal(error.status, 401);
      return true;
    });
    assert.equal(getAuthToken(), '');
  } finally {
    globalThis.fetch = originalFetch;
    if (storageDescriptor) {
      Object.defineProperty(globalThis, 'sessionStorage', storageDescriptor);
    } else {
      delete globalThis.sessionStorage;
    }
  }
});
