import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAiBlock, initAiBlock, readState, writeState } from '../lib/issue-body.mjs';

const original = 'Als Nutzer möchte ich mich einloggen können.\n\n- Punkt A';
const START = { phase: 'requirements', iteration: 0, resume: null };

test('initAiBlock keeps the original text as exact prefix', () => {
  const body = initAiBlock(original, 'ai/issue-7');
  assert.ok(body.startsWith(original));
  assert.ok(body.includes('<!-- ai-development:start -->'));
  assert.ok(body.includes('<!-- ai-development:end -->'));
  assert.ok(body.includes('## 🤖 AI Status'));
  assert.ok(body.includes('`ai/issue-7`'));
});

test('initAiBlock is idempotent', () => {
  const once = initAiBlock(original, 'ai/issue-7');
  assert.equal(initAiBlock(once, 'ai/issue-7'), once);
});

test('hasAiBlock detects the block', () => {
  assert.equal(hasAiBlock(original), false);
  assert.equal(hasAiBlock(initAiBlock(original, 'ai/issue-7')), true);
});

test('readState returns the start state after init', () => {
  assert.deepEqual(readState(initAiBlock(original, 'ai/issue-7')), START);
});

test('readState returns null without block', () => {
  assert.equal(readState('ohne block'), null);
});

test('writeState only changes the state line', () => {
  const body = initAiBlock(original, 'ai/issue-7');
  const next = { phase: 'test', iteration: 2, resume: null };
  const written = writeState(body, next);
  assert.deepEqual(readState(written), next);
  const strip = (s) => s.replace(/<!-- ai-state: .* -->/, '');
  assert.equal(strip(written), strip(body));
});

test('writeState keeps agent edits inside the block', () => {
  const body = initAiBlock(original, 'ai/issue-7').replace('<!-- ai-development:end -->', '## Anforderungen\n- X\n<!-- ai-development:end -->');
  const written = writeState(body, { phase: 'develop', iteration: 0, resume: null });
  assert.ok(written.includes('## Anforderungen\n- X'));
});

test('null body is treated as empty', () => {
  assert.equal(hasAiBlock(null), false);
  assert.equal(readState(null), null);
  assert.ok(initAiBlock(null, 'ai/issue-1').includes('<!-- ai-development:start -->'));
});
