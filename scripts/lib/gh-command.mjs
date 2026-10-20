import { readFileSync } from 'node:fs';

const HEREDOC_SUBST = /"?\$\(\s*cat\s+<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*\n?\s*\)"?/g;
const HEREDOC_STDIN = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*(?:\n|$)/;

function tokenize(src) {
  const tokens = [];
  let cur = '';
  let has = false;
  const push = () => {
    if (has) tokens.push(cur);
    cur = '';
    has = false;
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "'") {
      has = true;
      const end = src.indexOf("'", i + 1);
      const stop = end === -1 ? src.length : end;
      cur += src.slice(i + 1, stop);
      i = stop;
    } else if (c === '"') {
      has = true;
      for (i++; i < src.length && src[i] !== '"'; i++) {
        if (src[i] === '\\' && /["\\$`]/.test(src[i + 1] ?? '')) i++;
        cur += src[i];
      }
    } else if (c === '\\') {
      if (src[i + 1] === '\n') i++;
      else if (src[i + 1] !== undefined) {
        has = true;
        cur += src[++i];
      }
    } else if (/\s/.test(c)) push();
    else {
      has = true;
      cur += c;
    }
  }
  push();
  return tokens;
}

function toNativePath(p) {
  return process.platform === 'win32' ? p.replace(/^\/([a-zA-Z])\//, '$1:/') : p;
}

// Returns null when the command is not `gh pr create`; title/body are undefined when not determinable.
export function parseGhPrCreate(command, cwd = process.cwd()) {
  const bodies = [];
  let stdinBody;
  let src = command.replace(HEREDOC_SUBST, (_, __, ___, text) => {
    bodies.push(text);
    return `"\u0000H${bodies.length - 1}\u0000"`;
  });
  src = src.replace(HEREDOC_STDIN, (_, __, ___, text) => {
    stdinBody = text;
    return '';
  });

  const tokens = tokenize(src);
  const at = tokens.findIndex(
    (t, i) => t === 'gh' && tokens[i + 1] === 'pr' && tokens[i + 2] === 'create',
  );
  if (at === -1) return null;

  const restore = (v) =>
    v?.replace(/\u0000H(\d+)\u0000/g, (_, n) => bodies[Number(n)]);
  const flags = {};
  const args = tokens.slice(at + 3);
  for (let i = 0; i < args.length; i++) {
    const m = args[i].match(/^(--title|--body|--body-file|-t|-b|-F)(?:=([\s\S]*))?$/);
    if (!m) continue;
    const name = { '-t': '--title', '-b': '--body', '-F': '--body-file' }[m[1]] ?? m[1];
    flags[name] = m[2] ?? args[++i];
  }

  const title = restore(flags['--title']);
  let body = restore(flags['--body']);
  if (body === undefined && flags['--body-file'] !== undefined) {
    const file = restore(flags['--body-file']);
    if (file === '-') body = stdinBody;
    else {
      try {
        body = readFileSync(toNativePath(file.startsWith('/') || /^[a-z]:/i.test(file) ? file : `${cwd}/${file}`), 'utf8');
      } catch {
        body = undefined;
      }
    }
  }
  return { title, body };
}
