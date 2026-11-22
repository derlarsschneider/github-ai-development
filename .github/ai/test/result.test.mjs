import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResult } from '../lib/result.mjs';

test('valid result is accepted', () => {
  const r = parseResult('{"status":"tests_failed","summary":"2 Tests rot"}', 'test');
  assert.deepEqual(r, { ok: true, status: 'tests_failed', summary: '2 Tests rot' });
});

test('missing file is rejected', () => {
  const r = parseResult(null, 'develop');
  assert.equal(r.ok, false);
  assert.match(r.error, /missing/i);
});

test('invalid JSON is rejected', () => {
  assert.equal(parseResult('{status: done', 'develop').ok, false);
});

test('status not allowed for the phase is rejected', () => {
  const r = parseResult('{"status":"approved","summary":"x"}', 'test');
  assert.equal(r.ok, false);
  assert.match(r.error, /approved/);
});

test('missing summary is rejected', () => {
  assert.equal(parseResult('{"status":"done"}', 'develop').ok, false);
});

test('non-object JSON is rejected', () => {
  assert.equal(parseResult('"done"', 'develop').ok, false);
  assert.equal(parseResult('null', 'develop').ok, false);
});
