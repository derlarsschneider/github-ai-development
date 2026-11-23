#!/usr/bin/env node
// Entry point for the AI Development workflow.
// Usage: node cli.mjs <route|init|prompt|tools|finish|resume|approve|revise> [phase] [issue]
// Project inputs come from the environment: AI_CHECKS, AI_TOOLS, AI_JOB_STATUS.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLES, PHASES, labelFor } from './lib/model.mjs';
import { route, TRIGGER_LABEL } from './lib/route.mjs';
import { hasAiBlock, initAiBlock, readState, writeState } from './lib/issue-body.mjs';
import { parseResult, setupFailedResult } from './lib/result.mjs';
import { planFinish, planResume, planApprove, planRevise } from './lib/finish.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { parseChecks, parseTools, toolsFor } from './lib/tools.mjs';
import { usageFromClaude, readUsage, writeUsage } from './lib/usage.mjs';
import { writeStatus } from './lib/status.mjs';
import * as github from './lib/github.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROLES_DIR = join(here, '..', 'ai-roles');
const ALL_LABELS = [TRIGGER_LABEL, ...PHASES.map(labelFor), ...['awaiting-approval', 'needs-human', 'ready-to-merge', 'failed'].map(labelFor)];
const TRUSTED = ['admin', 'maintain', 'write'];

const branchFor = (issue) => `ai/issue-${issue}`;
const log = (msg) => console.log(`[ai] ${msg}`);

function withStatus(body, issue, state) {
  const branch = branchFor(issue);
  let pr = null;
  try {
    pr = github.findPr(branch);
  } catch (e) {
    log(`could not look up PR: ${e.message}`);
  }
  return writeStatus(body, { state, branch, pr });
}

function output(values) {
  for (const [key, value] of Object.entries(values)) {
    log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

function cmdRoute() {
  const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let decision = route(process.env.GITHUB_EVENT_NAME, payload);

  if (decision.action !== 'skip' && process.env.AI_SKIP_PERMISSION !== '1') {
    const login = payload.sender?.login;
    const level = login ? github.permission(login) : 'none';
    if (!TRUSTED.includes(level)) decision = { action: 'skip', reason: `sender ${login} has permission "${level}"` };
  }
  if (decision.reason) log(`skip: ${decision.reason}`);

  const issue = payload.issue?.number ?? '';
  const role = decision.phase ? ROLES[decision.phase] : null;
  output({
    action: decision.action,
    phase: decision.phase ?? '',
    issue,
    branch: issue ? branchFor(issue) : '',
    role_name: role?.name ?? '',
    max_turns: role?.maxTurns ?? '',
    run: decision.action === 'run' ? 'true' : 'false',
  });
}

function cmdInit(issue) {
  const { body } = github.getIssue(issue);
  if (hasAiBlock(body)) {
    log('AI block already exists, nothing to do');
    return;
  }
  github.ensureLabels(ALL_LABELS);
  github.setIssueBody(issue, initAiBlock(body, branchFor(issue)));
  github.addLabel(issue, labelFor('requirements'));
}

function cmdPrompt(phase, issue) {
  const state = readState(github.getIssue(issue).body);
  const prompt = buildPrompt(phase, {
    repo: process.env.GITHUB_REPOSITORY,
    issue,
    branch: branchFor(issue),
    iteration: state?.iteration ?? 0,
    checks: parseChecks(process.env.AI_CHECKS),
  }, ROLES_DIR);
  const file = join(process.env.RUNNER_TEMP ?? '.', 'prompt.md');
  writeFileSync(file, prompt);
  log(`prompt written to ${file}`);
}

function cmdTools(phase) {
  const tools = toolsFor(phase, {
    extraTools: parseTools(process.env.AI_TOOLS),
    checks: parseChecks(process.env.AI_CHECKS),
  });
  output({ tools: tools.join(',') });
}

function cmdFinish(phase, issue) {
  const jobStatus = process.env.AI_JOB_STATUS;
  const resultFile = join(process.cwd(), '.ai-result.json');
  const result = jobStatus && jobStatus !== 'success'
    ? setupFailedResult(jobStatus)
    : parseResult(existsSync(resultFile) ? readFileSync(resultFile, 'utf8') : null, phase);
  log(`result: ${JSON.stringify(result)}`);

  // Re-read right before writing so agent edits to the description are kept.
  const { body } = github.getIssue(issue);
  const plan = planFinish(readState(body), phase, result);
  if (hasAiBlock(body)) {
    const outputFile = join(process.env.RUNNER_TEMP ?? '.', 'claude-output.json');
    const usage = usageFromClaude(existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : null);
    const rows = [...readUsage(body), { role: ROLES[phase].name, result: result.ok ? result.status : 'failed', ...usage }];
    github.setIssueBody(issue, withStatus(writeUsage(writeState(body, plan.state), rows), issue, plan.state));
  }
  if (plan.failureComment) github.comment(issue, plan.failureComment);
  if (plan.markReady) {
    try {
      github.prReady(branchFor(issue));
    } catch (e) {
      log(`could not mark PR ready: ${e.message}`);
    }
  }
  github.swapLabels(issue, plan.removeLabel, plan.addLabel);
}

// Applies a label change that needs no agent run (resume, approve, revise).
function applyPlan(issue, planner) {
  const { body } = github.getIssue(issue);
  const plan = planner(readState(body));
  if (hasAiBlock(body)) github.setIssueBody(issue, withStatus(writeState(body, plan.state), issue, plan.state));
  github.swapLabels(issue, plan.removeLabel, plan.addLabel);
}

const [command, ...args] = process.argv.slice(2);
const commands = {
  route: () => cmdRoute(),
  init: () => cmdInit(Number(args[0])),
  prompt: () => cmdPrompt(args[0], Number(args[1])),
  tools: () => cmdTools(args[0]),
  finish: () => cmdFinish(args[0], Number(args[1])),
  resume: () => applyPlan(Number(args[0]), planResume),
  approve: () => applyPlan(Number(args[0]), planApprove),
  revise: () => applyPlan(Number(args[0]), planRevise),
};

if (!commands[command]) {
  console.error(`Unknown command "${command}". Use one of: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
commands[command]();
