// PreToolUse gate: rejects `gh pr create` when the PR body breaks the team format.
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = JSON.parse(input)?.tool_input?.command ?? '';
  } catch {
    process.exit(0);
  }
  if (!/gh\s+pr\s+create/.test(cmd)) process.exit(0);

  const problems = [];
  if (/§/.test(cmd)) problems.push('referencias a secciones de documentos (§)');
  if (/(^|\n)\s*([-*]\s|\d+\.\s|#{1,6}\s)/.test(cmd)) problems.push('listas o encabezados');
  if (/verificaci[oó]n|typecheck|lint\b|tests? en verde|suite .* en verde/i.test(cmd))
    problems.push('resultados de verificación (eso vive en la CI, no en el PR)');

  const m = cmd.match(/--body[= ]+("([\s\S]*?[^\\])"|'([\s\S]*?)')/);
  const body = m ? (m[2] ?? m[3] ?? '') : '';
  if (body.length > 450)
    problems.push(`cuerpo de ${body.length} caracteres (máximo ~350)`);

  if (problems.length === 0) process.exit(0);

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Cuerpo de PR rechazado: ${problems.join('; ')}. ` +
          'Formato obligatorio: máximo tres frases corridas (~50 palabras) en lenguaje llano — ' +
          'qué cambia y por qué. Sin listas, sin encabezados, sin §, sin resultados de builds. ' +
          'Reescribe el --body y vuelve a intentar.',
      },
    }),
  );
});
