// PreToolUse hook: extracts title and body from `gh pr create` and delegates to the validator.
import { parseGhPrCreate } from './lib/gh-command.mjs';
import { validatePr } from './validate-pr.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  const parsed = parseGhPrCreate(payload?.tool_input?.command ?? '', payload?.cwd);
  if (!parsed) process.exit(0);

  const { ok, message } = validatePr(parsed);
  if (ok) process.exit(0);
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: message,
      },
    }),
  );
});
