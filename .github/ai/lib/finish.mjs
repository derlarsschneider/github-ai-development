// Pure decisions for the end of an agent run and for resuming after a human answer.
import { transition, labelFor, MAX_ITERATIONS } from './model.mjs';
import { AGENT_MARKER } from './route.mjs';

const DEFAULT_STATE = { phase: 'requirements', iteration: 0, resume: null };

const failure = (message) => `${AGENT_MARKER}\n⚠️ **AI Development stopped:** ${message}\n\nFix the cause and set the label of the phase to retry.`;

export function planFinish(state, phase, result) {
  const current = { ...DEFAULT_STATE, ...state };
  const removeLabel = labelFor(phase);
  const fail = (message) => ({
    state: { ...current, phase: 'failed' },
    removeLabel,
    addLabel: labelFor('failed'),
    markReady: false,
    failureComment: failure(message),
  });

  if (!result.ok) return fail(`phase "${phase}" did not report a valid result. ${result.error}`);

  const next = transition(phase, result.status);
  let iteration = current.iteration;
  if (next === 'develop' && (phase === 'test' || phase === 'review')) {
    iteration += 1;
    if (iteration > MAX_ITERATIONS) {
      return fail(`the iteration limit of ${MAX_ITERATIONS} was exceeded (last status of phase "${phase}": ${result.status}).`);
    }
  }

  return {
    state: { phase: next, iteration, resume: next === 'needs-human' ? phase : null },
    removeLabel,
    addLabel: labelFor(next),
    markReady: next === 'ready-to-merge',
    failureComment: null,
  };
}

export function planResume(state) {
  const current = { ...DEFAULT_STATE, ...state };
  const phase = current.resume ?? 'requirements';
  return {
    state: { ...current, phase, resume: null },
    removeLabel: labelFor('needs-human'),
    addLabel: labelFor(phase),
  };
}
