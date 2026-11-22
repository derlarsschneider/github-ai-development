// Thin wrappers around the gh CLI. Authentication comes from GH_TOKEN.
import { execFileSync } from 'node:child_process';

const repoArgs = () => (process.env.GITHUB_REPOSITORY ? ['-R', process.env.GITHUB_REPOSITORY] : []);

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] });
}

export function getIssue(nr) {
  const data = JSON.parse(gh(['issue', 'view', String(nr), ...repoArgs(), '--json', 'body,labels']));
  return { body: data.body ?? '', labels: data.labels.map((l) => l.name) };
}

export function setIssueBody(nr, body) {
  gh(['issue', 'edit', String(nr), ...repoArgs(), '--body-file', '-'], body);
}

export function addLabel(nr, label) {
  gh(['issue', 'edit', String(nr), ...repoArgs(), '--add-label', label]);
}

export function removeLabel(nr, label) {
  gh(['issue', 'edit', String(nr), ...repoArgs(), '--remove-label', label]);
}

// Remove first, then add: adding the new label triggers the next run.
export function swapLabels(nr, remove, add) {
  removeLabel(nr, remove);
  addLabel(nr, add);
}

export function comment(nr, text) {
  gh(['issue', 'comment', String(nr), ...repoArgs(), '--body-file', '-'], text);
}

export function ensureLabels(names) {
  for (const name of names) {
    gh(['label', 'create', name, ...repoArgs(), '--force', '--color', '6f42c1']);
  }
}

export function prReady(branch) {
  gh(['pr', 'ready', branch, ...repoArgs()]);
}

export function permission(login) {
  const repo = process.env.GITHUB_REPOSITORY;
  return gh(['api', `repos/${repo}/collaborators/${login}/permission`, '--jq', '.permission']).trim();
}
