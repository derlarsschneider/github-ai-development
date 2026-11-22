// Token usage per agent run, rendered as a table inside the AI block.

const SECTION_START = '<!-- ai-usage:start -->';
const SECTION_END = '<!-- ai-usage:end -->';
const SECTION_RE = /\n*<!-- ai-usage:start -->[\s\S]*?<!-- ai-usage:end -->\n*/;
const DATA_RE = /<!-- ai-usage-data: (.*?) -->/;
const STATE_MARK = '<!-- ai-state:';
const END = '<!-- ai-development:end -->';

export function usageFromClaude(text) {
  if (!text) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const u = data?.usage;
  if (!u) return null;
  return {
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    turns: data.num_turns ?? 0,
    durationMs: data.duration_ms ?? 0,
    costUsd: data.total_cost_usd ?? 0,
  };
}

const num = (n) => n.toLocaleString('en-US');
const cost = (n) => `$${n.toFixed(2)}`;
function duration(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function renderUsageTable(rows) {
  const has = (r) => typeof r.inputTokens === 'number';
  const lines = [
    '## 📊 AI Usage',
    '',
    '| # | Role | Result | Input tokens | Output tokens | Turns | Duration | Cost (API) |',
    '|---|---|---|---|---|---|---|---|',
  ];
  rows.forEach((r, i) => {
    const cells = has(r)
      ? [num(r.inputTokens), num(r.outputTokens), r.turns, duration(r.durationMs), cost(r.costUsd)]
      : ['–', '–', '–', '–', '–'];
    lines.push(`| ${i + 1} | ${r.role} | ${r.result} | ${cells.join(' | ')} |`);
  });
  const counted = rows.filter(has);
  const sum = (key) => counted.reduce((acc, r) => acc + r[key], 0);
  lines.push(`|   | **Total** | | **${num(sum('inputTokens'))}** | **${num(sum('outputTokens'))}** | **${sum('turns')}** | **${duration(sum('durationMs'))}** | **${cost(sum('costUsd'))}** |`);
  return lines.join('\n');
}

export function readUsage(body) {
  const match = (body ?? '').match(DATA_RE);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

export function writeUsage(body, rows) {
  const section = [
    SECTION_START,
    renderUsageTable(rows),
    `<!-- ai-usage-data: ${JSON.stringify(rows)} -->`,
    SECTION_END,
  ].join('\n');
  const text = body.replace(SECTION_RE, '\n\n');
  const anchor = text.includes(STATE_MARK) ? STATE_MARK : END;
  const at = text.indexOf(anchor);
  if (at === -1) throw new Error('Issue body has no AI block');
  const before = text.slice(0, at).replace(/\n*$/, '');
  return `${before}\n\n${section}\n\n${text.slice(at)}`;
}
