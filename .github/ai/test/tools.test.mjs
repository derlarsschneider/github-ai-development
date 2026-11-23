import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChecks, parseTools, toolsFor } from '../lib/tools.mjs';
import { ROLES } from '../lib/model.mjs';

test('parseChecks keeps one command per non-empty, non-comment line', () => {
  assert.deepEqual(parseChecks('  flutter analyze\r\n\n# db\n  supabase test db  \n'), ['flutter analyze', 'supabase test db']);
  assert.deepEqual(parseChecks(undefined), []);
});

test('parseTools splits on commas and newlines and trims', () => {
  assert.deepEqual(parseTools(' Bash(flutter:*), Bash(dart:*)\nBash(supabase:*) ,'), ['Bash(flutter:*)', 'Bash(dart:*)', 'Bash(supabase:*)']);
  assert.deepEqual(parseTools(''), []);
  assert.deepEqual(parseTools(undefined), []);
});

test('parseTools rejects malformed entries and names them', () => {
  assert.throws(() => parseTools('Bash(flutter:*), rm -rf /'), /rm -rf \//);
});

test('develop and test get base tools, extra tools and one Bash rule per check', () => {
  const t = toolsFor('develop', { extraTools: ['Bash(supabase:*)'], checks: ['flutter test'] });
  for (const x of ['Edit', 'Bash(git:*)', 'Bash(supabase:*)', 'Bash(flutter test:*)']) assert.ok(t.includes(x), x);
  assert.ok(toolsFor('test', { extraTools: ['Bash(x:*)'], checks: [] }).includes('Bash(x:*)'));
});

test('reviewer gets checks but never extra tools', () => {
  const t = toolsFor('review', { extraTools: ['Bash(rm:*)'], checks: ['flutter analyze'] });
  assert.ok(t.includes('Bash(flutter analyze:*)'));
  assert.ok(!t.includes('Bash(rm:*)'));
  assert.ok(!t.includes('Edit'));
});

test('requirements engineer gets neither checks nor extra tools', () => {
  const t = toolsFor('requirements', { extraTools: ['Bash(rm:*)'], checks: ['flutter test'] });
  assert.deepEqual(t, ROLES.requirements.tools);
});

test('no duplicates and unknown phase throws', () => {
  const t = toolsFor('develop', { extraTools: ['Bash(git:*)'], checks: [] });
  assert.equal(t.filter((x) => x === 'Bash(git:*)').length, 1);
  assert.throws(() => toolsFor('deploy', {}));
});
