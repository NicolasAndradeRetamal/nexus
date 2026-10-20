import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCommit } from '../scripts/validate-commit.mjs';

test('accepts valid messages', () => {
  for (const m of [
    'feat: add login rate limiting',
    'fix(api): handle empty cart',
    'chore: regenerate adapter output',
    'docs: embed diagram in readme',
    'feat: add x\n\nBecause the old flow lost state.',
  ])
    assert.equal(validateCommit(m).ok, true, m);
});

test('rejects unknown types and missing format', () => {
  assert.equal(validateCommit('update stuff').ok, false);
  assert.equal(validateCommit('wip: add x').ok, false);
});

test('rejects capitalized subjects and trailing periods', () => {
  assert.equal(validateCommit('feat: Add login').ok, false);
  assert.equal(validateCommit('feat: add login.').ok, false);
});

test('rejects non-imperative verbs', () => {
  for (const m of ['feat: added login', 'feat: adds login', 'feat: adding login'])
    assert.equal(validateCommit(m).ok, false, m);
  assert.equal(validateCommit('fix: address overflow').ok, true);
});

test('rejects headers over 50 characters', () => {
  assert.equal(validateCommit('feat: ' + 'x'.repeat(45)).ok, false);
  assert.equal(validateCommit('feat: ' + 'x'.repeat(44)).ok, true);
});

test('requires a blank line before the body', () => {
  assert.equal(validateCommit('feat: add x\nbody right away').ok, false);
});
