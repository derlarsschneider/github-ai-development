import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFinish, planResume } from '../lib/finish.mjs';

const ok = (status) => ({ ok: true, status, summary: 's' });
const st = (phase, iteration = 0, resume = null) => ({ phase, iteration, resume });

test('requirements done moves to develop without counting an iteration', () => {
  const p = planFinish(st('requirements'), 'requirements', ok('done'));
  assert.deepEqual(p, { state: st('develop', 0), removeLabel: 'ai:requirements', addLabel: 'ai:develop', markReady: false, failureComment: null });
});

test('develop done moves to test', () => {
  const p = planFinish(st('develop', 1), 'develop', ok('done'));
  assert.equal(p.addLabel, 'ai:test');
  assert.equal(p.state.iteration, 1);
});

test('needs_clarification waits for a human and remembers the phase', () => {
  const p = planFinish(st('requirements'), 'requirements', ok('needs_clarification'));
  assert.equal(p.addLabel, 'ai:needs-human');
  assert.equal(p.state.resume, 'requirements');
  assert.equal(p.state.phase, 'needs-human');
});

test('going back to develop counts an iteration', () => {
  const p = planFinish(st('review', 4), 'review', ok('changes_requested'));
  assert.equal(p.addLabel, 'ai:develop');
  assert.equal(p.state.iteration, 5);
  assert.equal(p.failureComment, null);
});

test('exceeding max iterations fails', () => {
  const p = planFinish(st('test', 5), 'test', ok('tests_failed'));
  assert.equal(p.addLabel, 'ai:failed');
  assert.equal(p.state.phase, 'failed');
  assert.match(p.failureComment, /<!-- ai-agent -->/);
  assert.match(p.failureComment, /5/);
});

test('approved marks the PR ready', () => {
  const p = planFinish(st('review', 2), 'review', ok('approved'));
  assert.equal(p.addLabel, 'ai:ready-to-merge');
  assert.equal(p.markReady, true);
});

test('invalid result fails with the error in the comment', () => {
  const p = planFinish(st('develop'), 'develop', { ok: false, error: 'Result file .ai-result.json is missing' });
  assert.equal(p.addLabel, 'ai:failed');
  assert.equal(p.removeLabel, 'ai:develop');
  assert.match(p.failureComment, /missing/);
  assert.match(p.failureComment, /<!-- ai-agent -->/);
});

test('missing state starts from defaults', () => {
  const p = planFinish(null, 'develop', ok('done'));
  assert.deepEqual(p.state, st('test', 0));
});

test('resume returns to the remembered phase', () => {
  const p = planResume(st('needs-human', 1, 'develop'));
  assert.deepEqual(p, { state: st('develop', 1, null), removeLabel: 'ai:needs-human', addLabel: 'ai:develop' });
});

test('resume without remembered phase falls back to requirements', () => {
  assert.equal(planResume(null).addLabel, 'ai:requirements');
});
