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
