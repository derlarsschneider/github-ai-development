// Composes the tools each role may use from the project's action inputs.
// Inputs come only from the project's workflow file, never from files on the branch.
import { ROLES } from './model.mjs';

const TOOL_RE = /^[A-Za-z_]+(\(.+\))?$/;

// One command per line; empty lines and lines starting with # are ignored.
export function parseChecks(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

// Claude Code tool rules, separated by commas or newlines.
export function parseTools(text) {
  const tools = (text ?? '').split(/[,\r\n]/).map((t) => t.trim()).filter(Boolean);
  for (const tool of tools) {
    if (!TOOL_RE.test(tool)) throw new Error(`Invalid tool "${tool}" in input "tools"`);
  }
  return tools;
}

// develop/test: base + extra tools + checks; review: base + checks; requirements: base only.
export function toolsFor(phase, { extraTools = [], checks = [] } = {}) {
  const role = ROLES[phase];
  if (!role) throw new Error(`Unknown phase "${phase}"`);
  const checkTools = checks.map((cmd) => `Bash(${cmd}:*)`);
  const added = {
    develop: [...extraTools, ...checkTools],
    test: [...extraTools, ...checkTools],
    review: checkTools,
  }[phase] ?? [];
  return [...new Set([...role.tools, ...added])];
}
