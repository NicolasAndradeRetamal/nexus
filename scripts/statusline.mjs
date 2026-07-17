#!/usr/bin/env node
// Starcraft-themed status line for Claude Code (cross-platform port of statusline.ps1)
import { execSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  // Strip a leading UTF-8 BOM if present (0xFEFF)
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);
  let d = {};
  try {
    d = JSON.parse(input);
  } catch {
    console.log('[HUD OFFLINE]');
    return;
  }

  // --- ANSI palette (Protoss gold / cyan) ---
  const e = '\x1b';
  const R = `${e}[0m`;
  const gold = `${e}[38;5;214m`;
  const cyan = `${e}[38;5;45m`;
  const green = `${e}[38;5;40m`;
  const yell = `${e}[38;5;220m`;
  const red = `${e}[38;5;196m`;
  const blue = `${e}[38;5;75m`;
  const gray = `${e}[38;5;244m`;
  const mag = `${e}[38;5;171m`;

  // --- Unit (model) ---
  const id = d.model?.id || '';
  const modelName = d.model?.display_name || '?';
  let unit = 'Dragoon';
  if (/fable|mythos/.test(id)) unit = 'Archon';
  else if (id.includes('opus')) unit = 'High Templar';
  else if (id.includes('sonnet')) unit = 'Zealot';
  else if (id.includes('haiku')) unit = 'Probe';
  const think = d.thinking?.enabled ? ` ${mag}✦${R}` : '';

  // --- Supply (context window) ---
  const cw = d.context_window || {};
  const pct = Math.min(100, Math.floor(cw.used_percentage || 0));
  const usedK = Math.round((cw.total_input_tokens || 0) / 1000);
  const capK = Math.round((cw.context_window_size || 200000) / 1000);
  const supColor = pct >= 90 ? red : pct >= 70 ? yell : green;
  const filled = Math.floor(pct / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);

  // --- Minerals (session cost) + game clock + kills ---
  const cost = (d.cost?.total_cost_usd || 0).toFixed(2);
  const mins = Math.floor((d.cost?.total_duration_ms || 0) / 60000);
  const clock =
    mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
  const lAdd = d.cost?.total_lines_added || 0;
  const lDel = d.cost?.total_lines_removed || 0;

  // --- Vespene gas (rate limits) ---
  let gasTxt = '';
  let gasWorst = 0;
  const parts = [];
  for (const [key, label] of [['five_hour', '5h'], ['seven_day', '7d']]) {
    const g = d.rate_limits?.[key]?.used_percentage;
    if (g != null) {
      const v = Math.round(g);
      gasWorst = Math.max(gasWorst, v);
      parts.push(`${label}:${v}%`);
    }
  }
  if (parts.length) {
    const gc = gasWorst >= 90 ? red : gasWorst >= 70 ? yell : green;
    gasTxt = `  ⛽ ${gc}${parts.join(' ')}${R}`;
  }

  // --- Sector (dir) + git branch ---
  const cwd = d.workspace?.current_dir || '';
  const dirName = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() : '';
  let branchTxt = '';
  if (cwd) {
    try {
      const b = execSync(`git -C "${cwd}" branch --show-current`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      if (b) branchTxt = `  ${gray}\u{1F33F}${R} ${green}${b}${R}`;
    } catch {}
  }

  // --- Active agent (claude --agent) ---
  const agentTxt = d.agent?.name ? `  ${mag}⌖ ${d.agent.name}${R}` : '';

  // --- Alerts (Starcraft voice lines) ---
  let alert = '';
  if (pct >= 90) alert = `  ${red}⚠ YOU MUST CONSTRUCT ADDITIONAL PYLONS${R}`;
  else if (gasWorst >= 90) alert = `  ${red}⚠ NOT ENOUGH VESPENE GAS${R}`;
  else if (pct >= 70) alert = `  ${yell}⚠ SUPPLY RUNNING LOW${R}`;

  // --- Render ---
  let line1 = `${gold}⚡ ${unit}${R} ${gray}[${modelName}]${R}${think}`;
  if (dirName) line1 += `  ${cyan}\u{1FA90} ${dirName}${R}`;
  line1 += branchTxt + agentTxt;

  const kills = lAdd + lDel > 0 ? `  ⚔ ${green}+${lAdd}${R}/${red}-${lDel}${R}` : '';

  const line2 =
    `${supColor}${bar}${R} ${supColor}${usedK}k/${capK}k${R} ${gray}(${pct}%)${R}` +
    `  ${blue}\u{1F48E} $${cost}${R}${gasTxt}  ${gray}⏱ ${clock}${R}${kills}${alert}`;

  console.log(line1);
  console.log(line2);
});
