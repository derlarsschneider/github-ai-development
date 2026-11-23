import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { route } from '../lib/route.mjs';

const labeled = (name) => ({ action: 'labeled', label: { name }, issue: { number: 7, labels: [{ name }] } });
const comment = (body, labels, extra = {}) => ({
  action: 'created',
  comment: { body },
  issue: { number: 7, labels: labels.map((name) => ({ name })), ...extra },
});

test('trigger label starts init', () => {
  assert.deepEqual(route('issues', labeled('ai-development')), { action: 'init' });
});

test('phase label starts a run of that phase', () => {
  assert.deepEqual(route('issues', labeled('ai:test')), { action: 'run', phase: 'test' });
});

test('fixture: labeled ai:develop runs develop', () => {
  const payload = JSON.parse(readFileSync(new URL('./fixtures/labeled-develop.json', import.meta.url)));
  assert.deepEqual(route('issues', payload), { action: 'run', phase: 'develop' });
});

test('other labels are skipped', () => {
  for (const name of ['ai:awaiting-approval', 'ai:needs-human', 'ai:ready-to-merge', 'ai:failed', 'bug']) {
    assert.equal(route('issues', labeled(name)).action, 'skip', name);
  }
});

test('other issue actions are skipped', () => {
  assert.equal(route('issues', { action: 'opened', issue: { number: 7, labels: [] } }).action, 'skip');
});

test('human comment on issue waiting for a human resumes', () => {
  assert.deepEqual(route('issue_comment', comment('Bitte OAuth.', ['ai-development', 'ai:needs-human'])), { action: 'resume' });
});

test('agent comment is ignored even when waiting for a human', () => {
  const r = route('issue_comment', comment('<!-- ai-agent -->\nRückfrage: …', ['ai:needs-human']));
  assert.equal(r.action, 'skip');
});

test('human comment without ai:needs-human is ignored', () => {
  assert.equal(route('issue_comment', comment('Super!', ['ai-development', 'ai:develop'])).action, 'skip');
});

const awaiting = ['ai-development', 'ai:awaiting-approval'];

for (const body of ['/approve', '  /APPROVE danke', '/approve\nSieht gut aus.']) {
  test(`approval comment ${JSON.stringify(body)} approves`, () => {
    assert.deepEqual(route('issue_comment', comment(body, awaiting)), { action: 'approve' });
  });
}

for (const body of ['/approved', 'Sieht gut aus, /approve', 'Ich approve das nicht.', 'Bitte noch X ergänzen.']) {
  test(`comment ${JSON.stringify(body)} while awaiting approval is feedback`, () => {
    assert.deepEqual(route('issue_comment', comment(body, awaiting)), { action: 'revise' });
  });
}

test('agent cannot approve its own requirements', () => {
  assert.equal(route('issue_comment', comment('/approve\n<!-- ai-agent -->', awaiting)).action, 'skip');
});

test('comments on pull requests are ignored', () => {
  const r = route('issue_comment', comment('lgtm', ['ai:needs-human'], { pull_request: { url: 'x' } }));
  assert.equal(r.action, 'skip');
});

test('edited comments are ignored', () => {
  const p = { ...comment('x', ['ai:needs-human']), action: 'edited' };
  assert.equal(route('issue_comment', p).action, 'skip');
});

test('unknown events are skipped', () => {
  assert.equal(route('push', {}).action, 'skip');
});
