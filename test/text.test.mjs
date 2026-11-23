import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capitalize } from '../src/text.mjs';

test('capitalize uppercases the first letter', () => {
  assert.equal(capitalize('hallo'), 'Hallo');
});

test('capitalize keeps an empty string empty', () => {
  assert.equal(capitalize(''), '');
});
