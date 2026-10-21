import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../scripts/claude-pr-hook.mjs', import.meta.url));
const run = (command) =>
  spawnSync('node', [hook], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' });

test('stays silent for unrelated commands and valid PRs', () => {
  assert.equal(run('git status').stdout, '');
  assert.equal(run('gh pr create --title "feat: add x" --body "Agrega x. Resuelve y."').stdout, '');
});

test('denies a PR whose body breaks the format', () => {
  const out = JSON.parse(run('gh pr create --title "feat: add x" --body "- uno\n- dos"').stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /listas o encabezados/);
});

test('ignores malformed hook input', () => {
  const r = spawnSync('node', [hook], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
