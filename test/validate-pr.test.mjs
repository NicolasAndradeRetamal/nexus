import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePr } from '../scripts/validate-pr.mjs';
import { parseGhPrCreate } from '../scripts/lib/gh-command.mjs';

const GOOD_BODY =
  'Agrega presupuestos mensuales por categoría con barras de progreso. Migración aditiva, no toca datos existentes.';

test('accepts a valid title and body', () => {
  assert.equal(validatePr({ title: 'feat: add monthly budgets', body: GOOD_BODY }).ok, true);
});

test('does not flag "lint" in a title or as a plain word', () => {
  assert.equal(validatePr({ title: 'chore: add lint config', body: GOOD_BODY }).ok, true);
  assert.equal(
    validatePr({ title: 'chore: add eslint', body: 'Configura el lint del proyecto para toda la base de código.' }).ok,
    true,
  );
});

test('rejects verification results in the body', () => {
  assert.equal(validatePr({ title: 'fix: x', body: 'Corrige el cálculo. Typecheck y lint pasan, tests en verde.' }).ok, false);
  assert.equal(validatePr({ title: 'fix: x', body: 'Corrige el cálculo. Verificación completa.' }).ok, false);
});

test('rejects lists, headings and section references', () => {
  assert.equal(validatePr({ title: 'fix: x', body: '- Cambia esto\n- Cambia aquello' }).ok, false);
  assert.equal(validatePr({ title: 'fix: x', body: '## Resumen\nCambia esto.' }).ok, false);
  assert.equal(validatePr({ title: 'fix: x', body: 'Sigue DESIGN.md §3.1 al pie de la letra.' }).ok, false);
});

test('rejects bodies over the word or sentence limit', () => {
  const long = Array.from({ length: 61 }, () => 'palabra').join(' ') + '.';
  assert.match(validatePr({ title: 'fix: x', body: long }).message, /61 palabras/);
  assert.match(validatePr({ title: 'fix: x', body: 'Uno. Dos. Tres. Cuatro.' }).message, /4 frases/);
  assert.equal(validatePr({ title: 'fix: x', body: 'Uno. Dos. Tres.' }).ok, true);
});

test('rejects Spanish titles', () => {
  assert.equal(validatePr({ title: 'fix: corrige el error de la vista', body: GOOD_BODY }).ok, false);
});

test('parses inline quoted flags', () => {
  const p = parseGhPrCreate(`gh pr create --base main --title "feat: add x" --body "${GOOD_BODY}"`);
  assert.deepEqual(p, { title: 'feat: add x', body: GOOD_BODY });
});

test('returns null for other commands', () => {
  assert.equal(parseGhPrCreate('git status'), null);
  assert.equal(parseGhPrCreate('echo "gh pr create"'), null);
});

test('reads a body passed through a heredoc and applies the limits', () => {
  const long = Array.from({ length: 70 }, () => 'palabra').join(' ');
  const cmd = `gh pr create --title "feat: x" --body "$(cat <<'EOF'\n${long}\nEOF\n)"`;
  const parsed = parseGhPrCreate(cmd);
  assert.equal(parsed.title, 'feat: x');
  assert.equal(parsed.body, long);
  assert.equal(validatePr(parsed).ok, false);
});

test('detects lists inside a heredoc body', () => {
  const cmd = `gh pr create --title "feat: x" --body "$(cat <<'EOF'\n- uno\n- dos\nEOF\n)"`;
  assert.equal(validatePr(parseGhPrCreate(cmd)).ok, false);
});

test('reads --body-file from disk and from a stdin heredoc', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-'));
  writeFileSync(join(dir, 'body.md'), '- uno\n- dos\n');
  const fromFile = parseGhPrCreate('gh pr create --title "feat: x" --body-file body.md', dir);
  assert.equal(fromFile.body, '- uno\n- dos\n');
  assert.equal(validatePr(fromFile).ok, false);

  const fromStdin = parseGhPrCreate(`gh pr create --title "feat: x" --body-file - <<'EOF'\n${GOOD_BODY}\nEOF\n`);
  assert.equal(fromStdin.body, GOOD_BODY);
  assert.equal(validatePr(fromStdin).ok, true);
});

test('accepts short flags and the = form', () => {
  const p = parseGhPrCreate(`gh pr create -t 'fix: y' --body='${GOOD_BODY}'`);
  assert.equal(p.title, 'fix: y');
  assert.equal(p.body, GOOD_BODY);
});

test('leaves title and body undefined when the command has neither', () => {
  assert.deepEqual(parseGhPrCreate('gh pr create --fill'), { title: undefined, body: undefined });
});
