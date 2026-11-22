import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PHASES, ROLES, labelFor, phaseForLabel, transition, MAX_ITERATIONS } from '../lib/model.mjs';

test('phases are the four roles in order', () => {
  assert.deepEqual(PHASES, ['requirements', 'develop', 'test', 'review']);
});

test('max iterations is 5', () => {
  assert.equal(MAX_ITERATIONS, 5);
});

const table = [
  ['requirements', 'done', 'develop'],
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

test('transition throws on a status the phase does not know', () => {
  assert.throws(() => transition('test', 'approved'));
});

test('labelFor maps phases and terminal states to labels', () => {
  assert.equal(labelFor('develop'), 'ai:develop');
  assert.equal(labelFor('needs-human'), 'ai:needs-human');
  assert.equal(labelFor('ready-to-merge'), 'ai:ready-to-merge');
  assert.equal(labelFor('failed'), 'ai:failed');
});

test('phaseForLabel maps only phase labels back', () => {
  assert.equal(phaseForLabel('ai:review'), 'review');
  assert.equal(phaseForLabel('ai:failed'), null);
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
