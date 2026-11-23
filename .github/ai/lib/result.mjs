// Validates the .ai-result.json an agent writes at the end of its run.
import { ROLES } from './model.mjs';

export function parseResult(text, phase) {
  if (text == null) return { ok: false, error: 'Result file .ai-result.json is missing' };

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Result file is not valid JSON: ${e.message}` };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Result file must contain a JSON object' };
  }

  const allowed = ROLES[phase]?.statuses ?? [];
  if (!allowed.includes(data.status)) {
    return { ok: false, error: `Status "${data.status}" is not allowed for phase "${phase}" (allowed: ${allowed.join(', ')})` };
  }
  if (typeof data.summary !== 'string' || !data.summary.trim()) {
    return { ok: false, error: 'Result file has no summary' };
  }
  return { ok: true, status: data.status, summary: data.summary };
}
