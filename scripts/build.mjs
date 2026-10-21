#!/usr/bin/env node
// Generates the Claude Code adapter (agents/, skills/, hooks/, templates/, .claude-plugin/) from core/.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => join(ROOT, ...p);

const MODEL_BY_TIER = { high: 'opus', standard: 'sonnet', inherit: 'inherit' };
const TOOLS_BY_CAPABILITY = {
  read: ['Read'],
  edit: ['Edit'],
  write: ['Write'],
  shell: ['Bash'],
  search: ['Grep', 'Glob'],
  skill: ['Skill'],
  tasks: ['TaskCreate', 'TaskUpdate', 'TaskList'],
  ask: ['AskUserQuestion'],
};
const NAMESPACE = 'nexus';

// Neutral phrases used in core/ and the Claude Code name each one becomes.
const TRANSLATIONS = [
  ['el archivo de contexto del proyecto', 'el CLAUDE.md del proyecto'],
  ['el directorio local de configuración de la herramienta', '`.claude/`'],
  ['la herramienta de lectura de archivos', 'Read'],
  ['la herramienta de preguntas interactivas', 'AskUserQuestion'],
  ['la lista de tareas', 'TaskCreate/TaskUpdate'],
];

const FORBIDDEN_IN_CORE =
  /Agent\(|nexus:|^tools:|model:\s*(opus|sonnet)|CLAUDE\.md|AGENTS\.md|GEMINI\.md|AskUserQuestion|TaskCreate|TaskUpdate|\.claude\//m;

const HOOKS = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/claude-pr-hook.mjs"',
            statusMessage: 'Validando formato del PR',
          },
        ],
      },
    ],
  },
};

function parseValue(raw) {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[') && v.endsWith(']'))
    return v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
  return v;
}

function parseDoc(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) throw new Error(`${file}: invalid metadata line "${line}"`);
    meta[line.slice(0, i).trim()] = parseValue(line.slice(i + 1));
  }
  return { meta, body: m[2] };
}

const read = (...p) => readFileSync(at(...p), 'utf8').replace(/\r\n/g, '\n');

function section(body, heading, file) {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => /^#{1,6} /.test(l) && l.replace(/^#+ /, '') === heading);
  if (start === -1) throw new Error(`${file}: section "${heading}" not found`);
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6}) /);
    if (h && h[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

const DOCS = { workflow: 'core/workflow.md', conventions: 'core/conventions.md' };

function expandIncludes(text) {
  return text.replace(/^\{\{include:([a-z]+)(?:#(.+?))?\}\}$/gm, (_, name, heading) => {
    const file = DOCS[name];
    if (!file) throw new Error(`unknown include "${name}"`);
    const { body } = parseDoc(read(file), file);
    return expandIncludes(heading ? section(body, heading, file) : body.trim());
  });
}

function toClaude(text) {
  let out = text;
  for (const [neutral, claude] of TRANSLATIONS)
    out = out.replace(new RegExp(neutral.replace(/ /g, '\\s+'), 'g'), () => claude);
  if (/archivo de contexto/.test(out)) throw new Error('untranslated context-file phrase in output');
  return out;
}

function assertNeutral(text, file) {
  const hit = text.match(FORBIDDEN_IN_CORE);
  if (hit) throw new Error(`${file}: tool-specific text in core/ ("${hit[0]}")`);
}

function normalizeBody(text) {
  return text.replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
}

function buildAgent(file) {
  const raw = read('core', 'roles', file);
  const { meta, body } = parseDoc(raw, file);
  assertNeutral(raw, `core/roles/${file}`);
  for (const key of ['name', 'description', 'model_tier', 'read_only', 'project_memory', 'color', 'capabilities'])
    if (meta[key] === undefined) throw new Error(`core/roles/${file}: missing "${key}"`);
  if (!(meta.model_tier in MODEL_BY_TIER)) throw new Error(`${file}: unknown model_tier "${meta.model_tier}"`);
  if (meta.read_only && meta.capabilities.some((c) => c === 'edit' || c === 'write'))
    throw new Error(`${file}: read_only role cannot have edit or write`);

  const tools = meta.capabilities.flatMap((c) => {
    if (c === 'delegate')
      return [`Agent(${(meta.delegates ?? []).map((d) => `${NAMESPACE}:${d}`).join(', ')})`];
    if (!TOOLS_BY_CAPABILITY[c]) throw new Error(`${file}: unknown capability "${c}"`);
    return TOOLS_BY_CAPABILITY[c];
  });

  const front = [
    '---',
    `name: ${meta.name}`,
    `description: ${meta.description}`,
    `tools: ${tools.join(', ')}`,
    `model: ${MODEL_BY_TIER[meta.model_tier]}`,
    `color: ${meta.color}`,
  ];
  if (meta.project_memory) front.push('memory: project');
  front.push('---');
  return `${front.join('\n')}\n\n${normalizeBody(toClaude(expandIncludes(body)))}`;
}

function buildSkill() {
  const file = 'core/conventions.md';
  const raw = read(file);
  assertNeutral(raw, file);
  const { meta, body } = parseDoc(raw, file);
  return `---\nname: ${meta.name}\ndescription: ${meta.description}\n---\n\n${normalizeBody(toClaude(body))}`;
}

const json = (v) => JSON.stringify(v, null, 2) + '\n';

function generate() {
  const files = new Map();
  const roles = readdirSync(at('core', 'roles')).filter((f) => f.endsWith('.md')).sort();
  for (const f of roles) files.set(`agents/${f}`, buildAgent(f));
  files.set('skills/convenciones/SKILL.md', buildSkill());
  files.set('hooks/hooks.json', json(HOOKS));
  for (const f of readdirSync(at('core', 'templates')).sort())
    files.set(`templates/${f}`, read('core', 'templates', f));
  const manifest = JSON.parse(read('scripts', 'claude-manifest.json'));
  files.set('.claude-plugin/plugin.json', json(manifest.plugin));
  files.set('.claude-plugin/marketplace.json', json(manifest.marketplace));
  return files;
}

function write(files) {
  for (const dir of ['agents', 'templates']) {
    for (const f of readdirSync(at(dir)))
      if (!files.has(`${dir}/${f}`)) rmSync(at(dir, f), { recursive: true, force: true });
  }
  for (const [path, content] of files) {
    mkdirSync(dirname(at(path)), { recursive: true });
    writeFileSync(at(path), content);
  }
}

write(generate());
