#!/usr/bin/env node
// Validates a commit message: Conventional Commits, English, imperative, <= 50 chars.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MAX_HEADER = 50;
const TYPES = ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'perf', 'build', 'ci', 'style'];
const HEADER = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?: (.+)$`);
const IMPERATIVE_EXCEPTIONS = new Set(['embed', 'proceed', 'succeed', 'exceed', 'speed', 'seed', 'feed', 'need', 'shed', 'bundle']);

export function validateCommit(message) {
  const problems = [];
  const lines = message.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const header = lines[0] ?? '';

  const m = header.match(HEADER);
  if (!m) {
    problems.push(`formato inválido: se espera "tipo: asunto" con tipo en ${TYPES.slice(0, 6).join('|')}`);
  } else {
    const subject = m[3];
    if (/^[A-Z]/.test(subject)) problems.push('el asunto debe empezar en minúscula');
    if (/\.$/.test(subject)) problems.push('el asunto no termina en punto');
    const verb = subject.split(/\s+/)[0].toLowerCase();
    if (
      !IMPERATIVE_EXCEPTIONS.has(verb) &&
      verb.length > 3 &&
      (/(ed|ing)$/.test(verb) || (/[^s]s$/.test(verb) && !/(ss|us|is)$/.test(verb)))
    )
      problems.push(`el asunto debe ir en imperativo ("${verb}")`);
  }
  if (header.length > MAX_HEADER)
    problems.push(`primera línea de ${header.length} caracteres (máximo ${MAX_HEADER})`);
  if (lines.length > 1 && lines[1].trim() !== '')
    problems.push('falta una línea en blanco entre el asunto y el cuerpo');

  return { ok: problems.length === 0, problems };
}

function main() {
  const args = process.argv.slice(2);
  let message;
  if (args[0] === '--file') message = readFileSync(args[1], 'utf8');
  else if (args.length) message = args.join(' ');
  else message = readFileSync(0, 'utf8');
  const { ok, problems } = validateCommit(message);
  if (!ok) {
    console.error(`Commit rechazado: ${problems.join('; ')}.`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
