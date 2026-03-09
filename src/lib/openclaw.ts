import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { formatDistanceToNow } from 'date-fns';
import type {
  ActivityItem,
  AgentSummary,
  CronJobSummary,
  DashboardOverview,
  MissionPipeline,
} from './types';
import {
  appendRun,
  createMissionAgent,
  createPipeline,
  listControlCenterData,
  updateTask,
} from './tasks-store';

const execFileAsync = promisify(execFile);
const OPENCLAW_BIN = 'openclaw';
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const IDLE_WINDOW_MS = 60 * 60 * 1000;
const REPO_ROOT = process.cwd();
const MISSIONS_ROOT = path.join(REPO_ROOT, 'missions');

const DEFAULT_MODELS = [
  'openai-codex/gpt-5.4',
  'copilot-proxy/gpt-5-mini',
  'copilot-proxy/claude-opus-4.6',
  'copilot-proxy/gemini-3.1-pro',
  'xai/grok-4-1-fast',
  'xai/grok-4',
  'openai-codex/gpt-5.3-codex',
];

type OpenClawAgent = {
  id: string;
  model?: string;
  workspace?: string;
  bindings?: number;
  isDefault?: boolean;
};

type OpenClawSession = {
  key: string;
  updatedAt?: number;
  agentId?: string;
};

type OpenClawSessionsResponse = {
  sessions?: OpenClawSession[];
};

type OpenClawCronState = {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: string;
  lastRunStatus?: string;
  consecutiveErrors?: number;
};

type OpenClawCronPayload = {
  message?: string;
  agentId?: string;
};

type OpenClawCronJob = {
  id: string;
  name?: string;
  agentId?: string;
  cron?: string;
  every?: string;
  at?: string;
  state?: OpenClawCronState;
  payload?: OpenClawCronPayload;
};

type OpenClawCronResponse = {
  jobs?: OpenClawCronJob[];
};

type OpenClawCreateCronResponse = {
  id?: string;
  job?: { id?: string };
};

async function runJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(OPENCLAW_BIN, args, {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 8,
  });

  const text = stdout.trim();
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const start = objectStart === -1 ? arrayStart : arrayStart === -1 ? objectStart : Math.min(objectStart, arrayStart);
  if (start === -1) throw new Error(`No JSON returned for: ${args.join(' ')}`);
  return JSON.parse(text.slice(start)) as T;
}

async function runText(args: string[]) {
  const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 8,
  });
  return `${stdout}${stderr}`.trim();
}

function getAgentStatus(lastActiveAt?: number | null): AgentSummary['status'] {
  if (!lastActiveAt) return 'offline';
  const age = Date.now() - lastActiveAt;
  if (age <= ACTIVE_WINDOW_MS) return 'online';
  if (age <= IDLE_WINDOW_MS) return 'idle';
  return 'offline';
}

function simplifySchedule(job: OpenClawCronJob): Pick<CronJobSummary, 'schedule' | 'type'> {
  if (job.cron) return { schedule: job.cron, type: 'cron' };
  if (job.every) return { schedule: `every ${job.every}`, type: 'every' };
  if (job.at) return { schedule: job.at, type: 'once' };
  return { schedule: 'unknown', type: 'unknown' };
}

function buildAgentSetup(role: string, missionName: string) {
  return `# AGENT MISSION PROFILE\n\n## Mission\n${missionName}\n\n## Role\n${role}\n\n## Operating Rules\n- Work only within this mission workspace unless explicitly asked otherwise.\n- Keep outputs concise, operational, and easy to act on.\n- Prefer durable notes over hidden assumptions.\n- When the mission has pipelines or cron loops, keep state changes explicit and observable.\n\n## Deliverable Style\n- Summaries first\n- Risks and blockers visible\n- Action items structured\n`;
}

function buildIdentity(agentId: string, role: string) {
  return `# IDENTITY.md\n\n- **Name:** ${agentId}\n- **Creature:** mission operator\n- **Vibe:** precise, fast, composed\n- **Emoji:** 🛰️\n\n## Role\n${role}\n`;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [agentsRaw, sessionsRaw, cronRaw, controlCenter] = await Promise.all([
    runJson<OpenClawAgent[]>(['agents', 'list', '--json']),
    runJson<OpenClawSessionsResponse>(['sessions', '--all-agents', '--json']),
    runJson<OpenClawCronResponse>(['cron', 'list', '--json']),
    listControlCenterData(),
  ]);

  const sessions = Array.isArray(sessionsRaw.sessions) ? sessionsRaw.sessions : [];
  const jobs = Array.isArray(cronRaw.jobs) ? cronRaw.jobs : [];

  const agents: AgentSummary[] = agentsRaw.map((agent) => {
    const agentSessions = sessions
      .filter((session) => session.agentId === agent.id)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    const lastActiveAt = agentSessions[0]?.updatedAt ?? null;
    return {
      id: agent.id,
      model: agent.model,
      workspace: agent.workspace,
      bindings: agent.bindings,
      isDefault: agent.isDefault,
      lastActiveAt,
      lastActiveHuman: lastActiveAt ? formatDistanceToNow(lastActiveAt, { addSuffix: true }) : 'never',
      sessionCount: agentSessions.length,
      activeSessionCount: agentSessions.filter((session) => (Date.now() - (session.updatedAt ?? 0)) <= ACTIVE_WINDOW_MS).length,
      status: getAgentStatus(lastActiveAt),
      latestSessionKey: agentSessions[0]?.key,
    } satisfies AgentSummary;
  });

  const cronJobs: CronJobSummary[] = jobs.map((job) => {
    const { schedule, type } = simplifySchedule(job);
    const state = job.state ?? {};
    const payload = job.payload ?? {};
    return {
      id: job.id,
      name: job.name ?? 'Untitled job',
      agentId: job.agentId ?? payload.agentId ?? 'main',
      schedule,
      type,
      message: payload.message,
      nextRunAt: state.nextRunAtMs ?? null,
      lastRunAt: state.lastRunAtMs ?? null,
      lastStatus: state.lastStatus ?? state.lastRunStatus ?? null,
      consecutiveErrors: state.consecutiveErrors ?? 0,
    };
  });

  const activity: ActivityItem[] = [
    ...sessions.slice(0, 20).map((session) => ({
      id: session.key,
      agentId: session.agentId ?? 'unknown',
      title: `${session.agentId ?? 'agent'} session touched`,
      detail: session.key,
      at: session.updatedAt ?? Date.now(),
      kind: 'session' as const,
      status: getAgentStatus(session.updatedAt ?? null),
    })),
    ...cronJobs.filter((job) => job.lastRunAt).map((job) => ({
      id: `cron-${job.id}`,
      agentId: job.agentId,
      title: `${job.name} ran`,
      detail: `${job.schedule} · ${job.lastStatus ?? 'unknown'}`,
      at: job.lastRunAt ?? Date.now(),
      kind: 'cron' as const,
      status: (job.lastStatus === 'error' ? 'offline' : 'idle') as ActivityItem['status'],
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 20);

  return {
    generatedAt: Date.now(),
    agents,
    cronJobs,
    activity,
    tasks: controlCenter.tasks,
    missions: controlCenter.missions,
    missionAgents: controlCenter.missionAgents,
    pipelines: controlCenter.pipelines,
    availableModels: DEFAULT_MODELS,
    metrics: {
      totalAgents: agents.length,
      onlineAgents: agents.filter((agent) => agent.status === 'online').length,
      activeSessions: agents.reduce((sum, agent) => sum + agent.activeSessionCount, 0),
      totalCronJobs: cronJobs.length,
      totalMissions: controlCenter.missions.length,
      totalPipelines: controlCenter.pipelines.length,
    },
  };
}

export async function runTask(taskId: string) {
  const controlCenter = await listControlCenterData();
  const task = controlCenter.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Task not found');

  const runId = randomUUID();
  const startedAt = Date.now();
  await appendRun(taskId, { id: runId, startedAt, status: 'running' });

  try {
    const output = await runText(['agent', '--agent', task.agentId, '--message', task.prompt, '--json']);
    await appendRun(taskId, { id: runId, startedAt, finishedAt: Date.now(), status: 'success', output });
    return { ok: true, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await appendRun(taskId, { id: runId, startedAt, finishedAt: Date.now(), status: 'error', error: message });
    throw error;
  }
}

export async function scheduleTask(taskId: string, schedule: { mode: 'every' | 'cron' | 'at'; value: string; timezone?: string }) {
  const controlCenter = await listControlCenterData();
  const task = controlCenter.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Task not found');

  const args = ['cron', 'add', '--json', '--name', task.title, '--agent', task.agentId, '--message', task.prompt, '--session', 'isolated', '--no-deliver'];
  if (schedule.timezone) args.push('--tz', schedule.timezone);
  if (schedule.mode === 'every') args.push('--every', schedule.value);
  else if (schedule.mode === 'cron') args.push('--cron', schedule.value);
  else args.push('--at', schedule.value, '--delete-after-run');

  const result = await runJson<OpenClawCreateCronResponse>(args);
  await updateTask(taskId, (draft) => {
    draft.schedule = { mode: schedule.mode, value: schedule.value, timezone: schedule.timezone, jobId: result.id ?? result.job?.id };
  });
  return result;
}

export async function importAgentToMission(input: {
  missionId: string;
  agentId: string;
  role: string;
  notes?: string;
}) {
  return createMissionAgent({
    missionId: input.missionId,
    agentId: input.agentId,
    role: input.role,
    notes: input.notes,
    source: 'imported',
  });
}

export async function createMissionAgentFromBrief(input: {
  missionId: string;
  missionName: string;
  agentId: string;
  role: string;
  primaryModel: string;
  fallbackModel?: string;
}) {
  const workspacePath = path.join(MISSIONS_ROOT, input.missionId, 'agents', input.agentId);
  await mkdir(workspacePath, { recursive: true });
  await writeFile(path.join(workspacePath, 'AGENTS.md'), buildAgentSetup(input.role, input.missionName), 'utf8');
  await writeFile(path.join(workspacePath, 'IDENTITY.md'), buildIdentity(input.agentId, input.role), 'utf8');
  await writeFile(
    path.join(workspacePath, 'MISSION.md'),
    `# Mission Agent Settings\n\n- Mission: ${input.missionName}\n- Primary model: ${input.primaryModel}\n- Fallback model: ${input.fallbackModel ?? 'none'}\n- Created at: ${new Date().toISOString()}\n`,
    'utf8',
  );

  await runJson(['agents', 'add', input.agentId, '--workspace', workspacePath, '--model', input.primaryModel, '--non-interactive', '--json']);

  return createMissionAgent({
    missionId: input.missionId,
    agentId: input.agentId,
    source: 'created',
    role: input.role,
    primaryModel: input.primaryModel,
    fallbackModel: input.fallbackModel,
    workspacePath,
    notes: 'Workspace scaffolded by Agent Control',
  });
}

export async function createMissionPipeline(input: {
  missionId: string;
  name: string;
  description?: string;
  loopMode: 'none' | 'every' | 'cron';
  loopValue?: string;
  agentId?: string;
  prompt?: string;
}) {
  const nodes: MissionPipeline['nodes'] = [
    { id: randomUUID(), label: 'Trigger', type: 'trigger', config: { event: 'manual-or-scheduled' } },
    { id: randomUUID(), label: input.agentId || 'Select agent', type: 'agent', config: { agentId: input.agentId ?? '', prompt: input.prompt ?? '' } },
    { id: randomUUID(), label: 'Review / route', type: 'decision', config: { rule: 'human-readable result' } },
    { id: randomUUID(), label: input.loopMode === 'none' ? 'One-shot' : 'Loop', type: 'loop', config: { mode: input.loopMode, value: input.loopValue ?? '' } },
    { id: randomUUID(), label: 'Deliver', type: 'deliver', config: { mode: 'dashboard' } },
  ];

  return createPipeline({
    missionId: input.missionId,
    name: input.name,
    description: input.description,
    loop: { mode: input.loopMode, value: input.loopValue },
    nodes,
  });
}
