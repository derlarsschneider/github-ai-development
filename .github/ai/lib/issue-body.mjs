// The AI block inside the issue description, and the machine state stored in it.
import { renderStatus } from './status.mjs';

const START = '<!-- ai-development:start -->';
const END = '<!-- ai-development:end -->';
const STATE_RE = /<!-- ai-state: (.*?) -->/;

const stateLine = (state) => `<!-- ai-state: ${JSON.stringify(state)} -->`;

export function hasAiBlock(body) {
  const text = body ?? '';
  return text.includes(START) && text.includes(END);
}

export function initAiBlock(body, branch) {
  const text = body ?? '';
  if (hasAiBlock(text)) return text;
  const state = { phase: 'requirements', iteration: 0, resume: null };
  const block = [
    START,
    renderStatus({ state, branch, pr: null }),
    '',
    stateLine(state),
    END,
  ].join('\n');
  return text ? `${text}\n\n${block}` : block;
}

export function readState(body) {
  if (!hasAiBlock(body)) return null;
  const match = body.match(STATE_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function writeState(body, state) {
  if (!hasAiBlock(body)) throw new Error('Issue body has no AI block');
  if (STATE_RE.test(body)) return body.replace(STATE_RE, () => stateLine(state));
  return body.replace(END, () => `${stateLine(state)}\n${END}`);
}
