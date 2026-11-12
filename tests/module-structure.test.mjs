import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml } from '../assets/js/utils.js';
import { apiRequest, API_BASE_URL } from '../assets/js/api.js';

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
