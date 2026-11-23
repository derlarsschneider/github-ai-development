// Maps a GitHub event to the orchestrator action to take.
import { phaseForLabel } from './model.mjs';

export const TRIGGER_LABEL = 'ai-development';
export const AGENT_MARKER = '<!-- ai-agent -->';

const skip = (reason) => ({ action: 'skip', reason });

export function route(eventName, payload) {
  if (eventName === 'issues') {
    if (payload.action !== 'labeled') return skip(`issues.${payload.action} is not handled`);
    const label = payload.label?.name ?? '';
    if (label === TRIGGER_LABEL) return { action: 'init' };
    const phase = phaseForLabel(label);
    if (phase) return { action: 'run', phase };
    return skip(`label "${label}" does not start a phase`);
  }

  if (eventName === 'issue_comment') {
    if (payload.action !== 'created') return skip(`issue_comment.${payload.action} is not handled`);
    if (payload.issue?.pull_request) return skip('comment on a pull request');
    if ((payload.comment?.body ?? '').includes(AGENT_MARKER)) return skip('comment written by an agent');
    const waiting = (payload.issue?.labels ?? []).some((l) => l.name === 'ai:needs-human');
    if (!waiting) return skip('issue is not waiting for a human');
    return { action: 'resume' };
  }

  return skip(`event "${eventName}" is not handled`);
}
