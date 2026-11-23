import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PHASES, ROLES, labelFor, phaseForLabel, transition, MAX_ITERATIONS, REQUIREMENTS_APPROVAL, commentHeader } from '../lib/model.mjs';

test('phases are the four roles in order', () => {
  assert.deepEqual(PHASES, ['requirements', 'develop', 'test', 'review']);
});

test('max iterations is 5', () => {
  assert.equal(MAX_ITERATIONS, 5);
});

const table = [
  ['requirements', 'done', 'awaiting-approval'],
  ['requirements', 'needs_clarification', 'needs-human'],
  ['develop', 'done', 'test'],
  ['develop', 'needs_clarification', 'needs-human'],
  ['test', 'tests_passed', 'review'],
  ['test', 'tests_failed', 'develop'],
  ['review', 'approved', 'ready-to-merge'],
  ['review', 'changes_requested', 'develop'],
];
for (const [phase, status, next] of table) {
  test(`transition ${phase}/${status} -> ${next}`, () => {
    assert.equal(transition(phase, status), next);
  });
}

test('requirements approval is on by default', () => {
  assert.equal(REQUIREMENTS_APPROVAL, true);
});

test('requirements done never goes straight to develop unless approval is off', () => {
  assert.equal(transition('requirements', 'done'), 'awaiting-approval');
  assert.equal(transition('requirements', 'done', { approval: true }), 'awaiting-approval');
  assert.equal(transition('requirements', 'done', { approval: false }), 'develop');
});

test('approval option does not affect other phases', () => {
  assert.equal(transition('develop', 'done', { approval: false }), 'test');
});

test('transition throws on a status the phase does not know', () => {
  assert.throws(() => transition('test', 'approved'));
});

test('labelFor maps phases and terminal states to labels', () => {
  assert.equal(labelFor('develop'), 'ai:develop');
  assert.equal(labelFor('needs-human'), 'ai:needs-human');
  assert.equal(labelFor('ready-to-merge'), 'ai:ready-to-merge');
  assert.equal(labelFor('failed'), 'ai:failed');
  assert.equal(labelFor('awaiting-approval'), 'ai:awaiting-approval');
});

test('phaseForLabel maps only phase labels back', () => {
  assert.equal(phaseForLabel('ai:review'), 'review');
  assert.equal(phaseForLabel('ai:failed'), null);
  assert.equal(phaseForLabel('ai:awaiting-approval'), null);
  assert.equal(phaseForLabel('ai-development'), null);
});

test('role statuses match the transition table', () => {
  assert.deepEqual(ROLES.requirements.statuses, ['done', 'needs_clarification']);
  assert.deepEqual(ROLES.develop.statuses, ['done', 'needs_clarification']);
  assert.deepEqual(ROLES.test.statuses, ['tests_passed', 'tests_failed']);
  assert.deepEqual(ROLES.review.statuses, ['approved', 'changes_requested']);
  assert.deepEqual([ROLES.requirements.maxTurns, ROLES.develop.maxTurns, ROLES.test.maxTurns, ROLES.review.maxTurns], [30, 60, 40, 30]);
});

test('reviewer may not edit files', () => {
  assert.ok(!ROLES.review.tools.includes('Edit'));
});

test('every role has a prompt file', () => {
  for (const phase of PHASES) {
    const path = fileURLToPath(new URL(`../../ai-roles/${ROLES[phase].prompt}`, import.meta.url));
    assert.ok(existsSync(path), path);
  }
});

test('code roles may run flutter tooling, not python or npm', () => {
  for (const phase of ['develop', 'test']) {
    for (const tool of ['Bash(flutter:*)', 'Bash(dart:*)']) {
      assert.ok(ROLES[phase].tools.includes(tool), `${phase} ${tool}`);
    }
    for (const tool of ['Bash(npm:*)', 'Bash(pip:*)', 'Bash(pytest:*)']) {
      assert.ok(!ROLES[phase].tools.includes(tool), `${phase} ${tool}`);
    }
  }
  assert.ok(ROLES.review.tools.includes('Bash(flutter test:*)'));
  assert.ok(ROLES.review.tools.includes('Bash(flutter analyze:*)'));
  assert.ok(!ROLES.review.tools.includes('Bash(pytest:*)'));
});

test('every role has a display name', () => {
  assert.deepEqual(PHASES.map((p) => ROLES[p].name), ['Requirements Engineer', 'Developer', 'Tester', 'Reviewer']);
});

test('every role has its own comment header with icon and name', () => {
  assert.equal(commentHeader('requirements'), '**📋 Requirements Engineer**');
  assert.equal(commentHeader('develop'), '**🛠️ Developer**');
  assert.equal(commentHeader('test'), '**🧪 Tester**');
  assert.equal(commentHeader('review'), '**🔍 Reviewer**');
  assert.throws(() => commentHeader('deploy'));
});
