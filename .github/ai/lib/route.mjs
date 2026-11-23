// Maps a GitHub event to the orchestrator action to take.
import { phaseForLabel } from './model.mjs';

export const TRIGGER_LABEL = 'ai-development';
export const AGENT_MARKER = '<!-- ai-agent -->';

const APPROVE_RE = /^\/approve(\s|$)/i;

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
    const body = payload.comment?.body ?? '';
    if (body.includes(AGENT_MARKER)) return skip('comment written by an agent');
    const labels = (payload.issue?.labels ?? []).map((l) => l.name);
    if (labels.includes('ai:awaiting-approval')) {
      return { action: APPROVE_RE.test(body.trim()) ? 'approve' : 'revise' };
    }
    if (labels.includes('ai:needs-human')) return { action: 'resume' };
    return skip('issue is not waiting for a human');
  }

  return skip(`event "${eventName}" is not handled`);
}
