import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeStatus, phaseDisplay } from '../lib/status.mjs';
import { initAiBlock, readState } from '../lib/issue-body.mjs';
import { readUsage, writeUsage } from '../lib/usage.mjs';

const ctx = (phase, iteration = 0, pr = null) => ({ state: { phase, iteration, resume: null }, branch: 'ai/issue-1', pr });

test('phaseDisplay names roles and terminal states', () => {
  assert.equal(phaseDisplay('requirements'), 'Requirements Engineer');
  assert.equal(phaseDisplay('develop'), 'Developer');
  assert.equal(phaseDisplay('test'), 'Tester');
  assert.equal(phaseDisplay('review'), 'Reviewer');
  assert.equal(phaseDisplay('needs-human'), 'Waiting for human');
  assert.equal(phaseDisplay('awaiting-approval'), 'Waiting for approval');
  assert.equal(phaseDisplay('ready-to-merge'), 'Ready to merge');
  assert.equal(phaseDisplay('failed'), 'Failed');
});

test('status shows phase, iteration, branch and PR', () => {
  const body = writeStatus(initAiBlock('Original', 'ai/issue-1'), ctx('test', 2, 7));
  assert.match(body, /## 🤖 AI Status/);
  assert.match(body, /\*\*Phase:\*\* Tester/);
  assert.match(body, /\*\*Iteration:\*\* 2 \/ 5/);
  assert.match(body, /\*\*Branch:\*\* `ai\/issue-1`/);
  assert.match(body, /\*\*Pull Request:\*\* #7/);
});

test('status without PR shows a dash', () => {
  const body = writeStatus(initAiBlock('Original', 'ai/issue-1'), ctx('requirements'));
  assert.match(body, /\*\*Pull Request:\*\* –/);
});

test('status is replaced, not duplicated', () => {
  let body = writeStatus(initAiBlock('Original', 'ai/issue-1'), ctx('develop'));
  body = writeStatus(body, ctx('review', 1, 2));
  assert.equal(body.split('## 🤖 AI Status').length, 2);
  assert.match(body, /\*\*Phase:\*\* Reviewer/);
  assert.doesNotMatch(body, /\*\*Phase:\*\* Developer/);
});

test('status keeps original text, agent sections, state and usage', () => {
  let body = initAiBlock('Original', 'ai/issue-1').replace('<!-- ai-state', '## Verlauf\n- Developer: fertig\n\n<!-- ai-state');
  body = writeUsage(body, [{ role: 'Developer', result: 'done' }]);
  const written = writeStatus(body, ctx('test', 0, 2));
  assert.ok(written.startsWith('Original'));
  assert.ok(written.includes('## Verlauf\n- Developer: fertig'));
  assert.deepEqual(readState(written), { phase: 'requirements', iteration: 0, resume: null });
  assert.equal(readUsage(written).length, 1);
  assert.ok(written.indexOf('## 🤖 AI Status') < written.indexOf('## Verlauf'));
});

test('initAiBlock already contains the workflow status section', () => {
  const body = initAiBlock('Original', 'ai/issue-3');
  assert.match(body, /<!-- ai-status:start -->/);
  assert.match(body, /\*\*Phase:\*\* Requirements Engineer/);
  assert.match(body, /\*\*Branch:\*\* `ai\/issue-3`/);
});
