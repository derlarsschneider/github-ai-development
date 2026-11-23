import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoPath = (f) => fileURLToPath(new URL(`../../../${f}`, import.meta.url));
const read = (f) => readFileSync(repoPath(f), 'utf8');

test('route action declares its input and outputs', () => {
  const y = read('route/action.yml');
  assert.match(y, /using: composite/);
  for (const k of ['github_token:', 'run:', 'phase:', 'issue:', 'role_name:']) assert.ok(y.includes(k), k);
});

test('run action declares all inputs', () => {
  const y = read('run/action.yml');
  assert.match(y, /using: composite/);
  for (const k of ['github_token:', 'job_status:', 'claude_code_oauth_token:', 'anthropic_api_key:', 'checks:', 'tools:']) assert.ok(y.includes(k), k);
});

test('actions contain nothing project-specific and the reusable workflow is gone', () => {
  for (const f of ['route/action.yml', 'run/action.yml']) assert.doesNotMatch(read(f), /flutter|dart|supabase|teamworktime/i, f);
  assert.ok(!existsSync(repoPath('.github/workflows/orchestrate.yml')));
});

test('composite steps do not use continue-on-error', () => {
  for (const f of ['route/action.yml', 'run/action.yml']) assert.doesNotMatch(read(f), /continue-on-error/, f);
});

test('template wires route, setup and run correctly', () => {
  const y = read('templates/workflows/ai-development.yml');
  assert.ok(y.includes('github-ai-development/route@v1') && y.includes('github-ai-development/run@v1'));
  assert.match(y, /if: always\(\) && steps\.ai\.outputs\.run == 'true'/);
  assert.ok(y.includes('job_status: ${{ job.status }}'));
  assert.ok(!y.includes('orchestrate.yml'));
});
