// The "AI Status" section at the top of the AI block. Written only by the workflow.
import { ROLES, MAX_ITERATIONS } from './model.mjs';

const START = '<!-- ai-development:start -->';
const SECTION_START = '<!-- ai-status:start -->';
const SECTION_END = '<!-- ai-status:end -->';
const SECTION_RE = /\n*<!-- ai-status:start -->[\s\S]*?<!-- ai-status:end -->\n*/;

const TERMINAL = {
  'needs-human': 'Waiting for human',
  'ready-to-merge': 'Ready to merge',
  failed: 'Failed',
};

export function phaseDisplay(phase) {
  return ROLES[phase]?.name ?? TERMINAL[phase] ?? phase;
}

export function renderStatus({ state, branch, pr }) {
  return [
    SECTION_START,
    '---',
    '## 🤖 AI Status',
    '',
    `**Phase:** ${phaseDisplay(state.phase)}  `,
    `**Iteration:** ${state.iteration} / ${MAX_ITERATIONS}  `,
    `**Branch:** \`${branch}\`  `,
    `**Pull Request:** ${pr ? `#${pr}` : '–'}`,
    SECTION_END,
  ].join('\n');
}

export function writeStatus(body, ctx) {
  const at = body.indexOf(START);
  if (at === -1) throw new Error('Issue body has no AI block');
  const head = body.slice(0, at + START.length);
  const rest = body.slice(at + START.length).replace(SECTION_RE, '\n').replace(/^\n*(---\n)?\n*/, '');
  return `${head}\n${renderStatus(ctx)}\n\n${rest}`;
}
