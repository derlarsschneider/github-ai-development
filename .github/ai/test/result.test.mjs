import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResult, setupFailedResult, finishResult } from '../lib/result.mjs';

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

test('setup failure is a failed result that names the job status', () => {
  const r = setupFailedResult('failure');
  assert.equal(r.ok, false);
  assert.match(r.error, /project environment/i);
  assert.match(r.error, /failure/);
});

test('finishResult ignores a leftover result file when no agent ran', () => {
  const stale = '{"status":"done","summary":"old"}';
  const r = finishResult({ phase: 'develop', jobStatus: 'success', setupError: 'Neither claude_code_oauth_token nor anthropic_api_key is set', resultText: stale });
  assert.equal(r.ok, false);
  assert.match(r.error, /No agent was started/);
  assert.match(r.error, /claude_code_oauth_token/);
});

test('finishResult prefers a failed job status over everything else', () => {
  const r = finishResult({ phase: 'develop', jobStatus: 'failure', setupError: '', resultText: '{"status":"done","summary":"x"}' });
  assert.match(r.error, /project environment/i);
});

test('finishResult parses the result file after a normal agent run', () => {
  const r = finishResult({ phase: 'develop', jobStatus: 'success', setupError: '', resultText: '{"status":"done","summary":"x"}' });
  assert.deepEqual(r, { ok: true, status: 'done', summary: 'x' });
});
