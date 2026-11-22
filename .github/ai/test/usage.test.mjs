import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageFromClaude, readUsage, writeUsage, renderUsageTable } from '../lib/usage.mjs';
import { initAiBlock, readState, writeState } from '../lib/issue-body.mjs';

const claudeJson = JSON.stringify({
  subtype: 'success', num_turns: 9, duration_ms: 100_000, total_cost_usd: 0.2134,
  usage: { input_tokens: 210, cache_creation_input_tokens: 8000, cache_read_input_tokens: 40000, output_tokens: 2130 },
});
const row = (role, result, u) => ({ role, result, ...u });

test('usageFromClaude sums input and cache tokens', () => {
  assert.deepEqual(usageFromClaude(claudeJson), { inputTokens: 48210, outputTokens: 2130, turns: 9, durationMs: 100000, costUsd: 0.2134 });
});

test('usageFromClaude returns null for missing or broken output', () => {
  assert.equal(usageFromClaude(null), null);
  assert.equal(usageFromClaude(''), null);
  assert.equal(usageFromClaude('{oops'), null);
  assert.equal(usageFromClaude('{"subtype":"success"}'), null);
});

test('table shows one row per run plus total', () => {
  const u = usageFromClaude(claudeJson);
  const table = renderUsageTable([row('Requirements Engineer', 'done', u), row('Developer', 'done', u)]);
  assert.match(table, /^## 📊 AI Usage/);
  assert.match(table, /\| 1 \| Requirements Engineer \| done \| 48,210 \| 2,130 \| 9 \| 1m 40s \| \$0\.21 \|/);
  assert.match(table, /\| 2 \| Developer \|/);
  assert.match(table, /\|   \| \*\*Total\*\* \| \| \*\*96,420\*\* \| \*\*4,260\*\* \| \*\*18\*\* \| \*\*3m 20s\*\* \| \*\*\$0\.43\*\* \|/);
});

test('run without claude output shows dashes and is left out of the total', () => {
  const u = usageFromClaude(claudeJson);
  const table = renderUsageTable([row('Developer', 'done', u), { role: 'Tester', result: 'failed' }]);
  assert.match(table, /\| 2 \| Tester \| failed \| – \| – \| – \| – \| – \|/);
  assert.match(table, /\*\*48,210\*\*/);
});

test('writeUsage stores rows and keeps state and agent text', () => {
  let body = initAiBlock('Original', 'ai/issue-1').replace('<!-- ai-state', '## Anforderungen\n- X\n\n<!-- ai-state');
  body = writeState(body, { phase: 'develop', iteration: 0, resume: null });
  const rows = [row('Requirements Engineer', 'done', usageFromClaude(claudeJson))];
  const written = writeUsage(body, rows);
  assert.deepEqual(readUsage(written), rows);
  assert.deepEqual(readState(written), { phase: 'develop', iteration: 0, resume: null });
  assert.ok(written.startsWith('Original'));
  assert.ok(written.includes('## Anforderungen\n- X'));
  assert.ok(written.includes('## 📊 AI Usage'));
});

test('writeUsage replaces the previous table instead of adding a second one', () => {
  const u = usageFromClaude(claudeJson);
  const body = initAiBlock('Original', 'ai/issue-1');
  const once = writeUsage(body, [row('Requirements Engineer', 'done', u)]);
  const twice = writeUsage(once, [row('Requirements Engineer', 'done', u), row('Developer', 'done', u)]);
  assert.equal(twice.split('## 📊 AI Usage').length, 2);
  assert.equal(readUsage(twice).length, 2);
});

test('readUsage returns an empty list without table', () => {
  assert.deepEqual(readUsage(initAiBlock('x', 'ai/issue-1')), []);
  assert.deepEqual(readUsage(null), []);
});
