import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPrompt } from '../lib/prompt.mjs';

const rolesDir = fileURLToPath(new URL('../../ai-roles/', import.meta.url));
const ctx = { repo: 'me/sandbox', issue: 42, branch: 'ai/issue-42', iteration: 2 };
const read = (f) => readFileSync(rolesDir + f, 'utf8');

test('prompt contains common rules, role text and context', () => {
  const p = buildPrompt('test', ctx, rolesDir);
  assert.ok(p.includes(read('_common.md')));
  assert.ok(p.includes(read('tester.md')));
  assert.ok(p.includes('me/sandbox'));
  assert.ok(p.includes('42'));
  assert.ok(p.includes('ai/issue-42'));
  assert.ok(p.includes('tests_passed'));
  assert.ok(p.includes('tests_failed'));
});

test('unknown phase throws', () => {
  assert.throws(() => buildPrompt('deploy', ctx, rolesDir));
});
