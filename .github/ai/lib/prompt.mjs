// Builds the full prompt for one agent run.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLES, commentHeader } from './model.mjs';

export function buildPrompt(phase, ctx, rolesDir) {
  const role = ROLES[phase];
  if (!role) throw new Error(`Unknown phase "${phase}"`);
  if (!ctx.checks?.length) throw new Error('No project checks configured (input "checks")');

  const common = readFileSync(join(rolesDir, '_common.md'), 'utf8');
  const roleText = readFileSync(join(rolesDir, role.prompt), 'utf8');
  const context = [
    '# Context of this run',
    '',
    `- Repository: ${ctx.repo}`,
    `- Issue: #${ctx.issue}`,
    `- Branch (checked out): ${ctx.branch}`,
    `- Iteration: ${ctx.iteration}`,
    `- Comment header of your role: ${commentHeader(phase)}`,
    `- Allowed statuses for .ai-result.json: ${role.statuses.map((s) => `\`${s}\``).join(', ')}`,
    '- Project checks (run all of them; every one must succeed):',
    ...ctx.checks.map((cmd) => `  - \`${cmd}\``),
  ].join('\n');

  return [common, roleText, context].join('\n\n');
}
