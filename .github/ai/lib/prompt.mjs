// Builds the full prompt for one agent run.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLES } from './model.mjs';

export function buildPrompt(phase, ctx, rolesDir) {
  const role = ROLES[phase];
  if (!role) throw new Error(`Unknown phase "${phase}"`);

  const common = readFileSync(join(rolesDir, '_common.md'), 'utf8');
  const roleText = readFileSync(join(rolesDir, role.prompt), 'utf8');
  const context = [
    '# Context of this run',
    '',
    `- Repository: ${ctx.repo}`,
    `- Issue: #${ctx.issue}`,
    `- Branch (checked out): ${ctx.branch}`,
    `- Iteration: ${ctx.iteration}`,
    `- Allowed statuses for .ai-result.json: ${role.statuses.map((s) => `\`${s}\``).join(', ')}`,
  ].join('\n');

  return [common, roleText, context].join('\n\n');
}
