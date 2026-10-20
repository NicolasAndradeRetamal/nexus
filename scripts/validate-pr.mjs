#!/usr/bin/env node
// Validates a pull request title and body against the team format.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MAX_WORDS = 60;
export const MAX_SENTENCES = 3;

const SPANISH_WORDS =
  /\b(con|las|los|del|para|sin|una|unos|unas|desde|hacia|sobre|entre|cuando|donde|que|por|al|el|la|en|de|y|o)\b/gi;
const VERIFICATION =
  /verificaci[oó]n|tests? en verde|suite .* en verde|\b(typecheck|lint|build|tests?)\b[^.\n]*\b(pasa|pasan|pasaron|passed|passing|green|ok)\b/i;

function countSentences(text) {
  return text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim()).length;
}

export function validatePr({ title, body }) {
  const problems = [];

  if (title != null) {
    const spanish = (title.match(SPANISH_WORDS) ?? []).length;
    if (spanish >= 2) problems.push(`título que parece estar en español ("${title}")`);
  }

  if (body != null) {
    if (/§/.test(body)) problems.push('referencias a secciones de documentos (§)');
    if (/(^|\n)\s*([-*]\s|\d+\.\s|#{1,6}\s)/.test(body)) problems.push('listas o encabezados');
    if (VERIFICATION.test(body))
      problems.push('resultados de verificación (eso vive en la CI, no en el PR)');
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) problems.push(`cuerpo de ${words} palabras (máximo ${MAX_WORDS})`);
    const sentences = countSentences(body);
    if (sentences > MAX_SENTENCES)
      problems.push(`cuerpo de ${sentences} frases (máximo ${MAX_SENTENCES})`);
  }

  return { ok: problems.length === 0, problems, message: formatMessage(problems) };
}

export function formatMessage(problems) {
  if (problems.length === 0) return '';
  return (
    `PR rechazado: ${problems.join('; ')}. ` +
    'Título en inglés con formato de commit (tipo: asunto en imperativo). ' +
    `Cuerpo en español: máximo ${MAX_SENTENCES} frases corridas y ${MAX_WORDS} palabras en lenguaje llano — ` +
    'qué cambia y por qué. Sin listas, sin encabezados, sin §, sin resultados de builds. ' +
    'Reescribe y vuelve a intentar.'
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--title') args.title = argv[++i];
    else if (a === '--body') args.body = argv[++i];
    else if (a === '--body-file') args.bodyFile = argv[++i];
    else if (a === '--stdin') args.stdin = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let body = args.body;
  if (body == null && args.bodyFile) body = readFileSync(args.bodyFile, 'utf8');
  if (body == null && args.stdin) body = readFileSync(0, 'utf8');
  const result = validatePr({ title: args.title, body });
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
