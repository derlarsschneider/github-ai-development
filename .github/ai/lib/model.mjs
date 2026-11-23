// Workflow model: phases, roles, labels and transitions.

export const PHASES = ['requirements', 'develop', 'test', 'review'];

export const MAX_ITERATIONS = 5;

// A person must approve the requirements (comment starting with /approve) before development starts.
export const REQUIREMENTS_APPROVAL = true;

const READ = ['Read', 'Glob', 'Grep'];
const WRITE_CODE = [...READ, 'Edit', 'Write', 'Bash(git:*)', 'Bash(gh issue:*)', 'Bash(gh pr:*)'];

export const ROLES = {
  requirements: {
    name: 'Requirements Engineer',
    icon: '📋',
    prompt: 'requirements-engineer.md',
    maxTurns: 30,
    tools: [...READ, 'Write', 'Bash(gh issue:*)'],
    statuses: ['done', 'needs_clarification'],
  },
  develop: {
    name: 'Developer',
    icon: '🛠️',
    prompt: 'developer.md',
    maxTurns: 60,
    tools: WRITE_CODE,
    statuses: ['done', 'needs_clarification'],
  },
  test: {
    name: 'Tester',
    icon: '🧪',
    prompt: 'tester.md',
    maxTurns: 40,
    tools: WRITE_CODE,
    statuses: ['tests_passed', 'tests_failed'],
  },
  review: {
    name: 'Reviewer',
    icon: '🔍',
    prompt: 'reviewer.md',
    maxTurns: 30,
    tools: [
      ...READ, 'Write',
      'Bash(git diff:*)', 'Bash(git log:*)',
      'Bash(gh issue:*)', 'Bash(gh pr view:*)', 'Bash(gh pr diff:*)',
      'Bash(gh pr comment:*)', 'Bash(gh pr review:*)',
    ],
    statuses: ['approved', 'changes_requested'],
  },
};

const TRANSITIONS = {
  requirements: { done: 'develop', needs_clarification: 'needs-human' },
  develop: { done: 'test', needs_clarification: 'needs-human' },
  test: { tests_passed: 'review', tests_failed: 'develop' },
  review: { approved: 'ready-to-merge', changes_requested: 'develop' },
};

export function labelFor(phase) {
  return `ai:${phase}`;
}

export function phaseForLabel(label) {
  const phase = label.startsWith('ai:') ? label.slice(3) : null;
  return PHASES.includes(phase) ? phase : null;
}

export function transition(phase, status, { approval = REQUIREMENTS_APPROVAL } = {}) {
  const next = TRANSITIONS[phase]?.[status];
  if (next && approval && phase === 'requirements' && status === 'done') return 'awaiting-approval';
  if (!next) throw new Error(`No transition for phase "${phase}" with status "${status}"`);
  return next;
}

// First visible line of every comment a role writes, so people see who wrote it.
export function commentHeader(phase) {
  const role = ROLES[phase];
  if (!role) throw new Error(`Unknown phase "${phase}"`);
  return `**${role.icon} ${role.name}**`;
}
