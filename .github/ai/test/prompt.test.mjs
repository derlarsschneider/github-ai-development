import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPrompt } from '../lib/prompt.mjs';

const rolesDir = fileURLToPath(new URL('../../ai-roles/', import.meta.url));
const ctx = { repo: 'me/sandbox', issue: 42, branch: 'ai/issue-42', iteration: 2, checks: ['flutter analyze', 'supabase test db'] };
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

test('requirements prompt demands the minimum criteria and asks for approval', () => {
  const p = buildPrompt('requirements', ctx, rolesDir);
  for (const word of ['Goal', 'Expected behavior', 'Scope', 'Success criterion', '/approve', 'Assumption:']) {
    assert.ok(p.includes(word), word);
  }
});

test('developer prompt contains nothing specific to one project', () => {
  assert.doesNotMatch(buildPrompt('develop', ctx, rolesDir), /team_work_time|teamworktime/i);
});

test('prompt tells the agent the exact comment header of its role', () => {
  assert.ok(buildPrompt('review', ctx, rolesDir).includes('**🔍 Reviewer**'));
  assert.ok(!buildPrompt('review', ctx, rolesDir).includes('**🧪 Tester**'));
});

test('unknown phase throws', () => {
  assert.throws(() => buildPrompt('deploy', ctx, rolesDir));
});

test('context lists every project check', () => {
  const p = buildPrompt('develop', ctx, rolesDir);
  assert.match(p, /Project checks/);
  assert.ok(p.includes('- `flutter analyze`') && p.includes('- `supabase test db`'));
});

test('missing checks throw', () => {
  assert.throws(() => buildPrompt('develop', { ...ctx, checks: [] }, rolesDir), /checks/);
  assert.throws(() => buildPrompt('develop', { ...ctx, checks: undefined }, rolesDir), /checks/);
});

test('role prompts name no language or project', () => {
  for (const f of ['_common.md', 'developer.md', 'tester.md', 'reviewer.md', 'requirements-engineer.md']) {
    assert.doesNotMatch(read(f), /flutter|dart|supabase|teamworktime/i, f);
  }
});

test('common rules point to the project CLAUDE.md', () => {
  assert.ok(read('_common.md').includes('CLAUDE.md'));
});
