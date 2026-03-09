import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityItem, AgentSummary, CronJobSummary, DashboardOverview } from './types';
import { appendRun, listTasks, updateTask } from './tasks-store';

const execFileAsync = promisify(execFile);
const OPENCLAW_BIN = 'openclaw';
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const IDLE_WINDOW_MS = 60 * 60 * 1000;

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
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 8,
  });

  const text = stdout.trim();
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const start = objectStart === -1 ? arrayStart : arrayStart === -1 ? objectStart : Math.min(objectStart, arrayStart);

  if (start === -1) {
    throw new Error(`No JSON returned for: ${args.join(' ')}`);
  }
  return JSON.parse(text.slice(start)) as T;
}

async function runText(args: string[]) {
  const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
    cwd: process.cwd(),
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

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [agentsRaw, sessionsRaw, cronRaw, tasks] = await Promise.all([
    runJson<OpenClawAgent[]>(['agents', 'list', '--json']),
    runJson<OpenClawSessionsResponse>(['sessions', '--all-agents', '--json']),
    runJson<OpenClawCronResponse>(['cron', 'list', '--json']),
    listTasks(),
  ]);

  const sessions = Array.isArray(sessionsRaw.sessions) ? sessionsRaw.sessions : [];
  const jobs = Array.isArray(cronRaw.jobs) ? cronRaw.jobs : [];

  const agents: AgentSummary[] = agentsRaw.map((agent) => {
    const agentSessions = sessions
      .filter((session) => session.agentId === agent.id)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    const lastActiveAt = agentSessions[0]?.updatedAt ?? null;
    const status = getAgentStatus(lastActiveAt);

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
      status,
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
    ...cronJobs
      .filter((job) => job.lastRunAt)
      .map((job) => ({
        id: `cron-${job.id}`,
        agentId: job.agentId,
        title: `${job.name} ran`,
        detail: `${job.schedule} · ${job.lastStatus ?? 'unknown'}`,
        at: job.lastRunAt ?? Date.now(),
        kind: 'cron' as const,
        status: (job.lastStatus === 'error' ? 'offline' : 'idle') as ActivityItem['status'],
      })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 20);

  return {
    generatedAt: Date.now(),
    agents,
    cronJobs,
    activity,
    tasks,
    metrics: {
      totalAgents: agents.length,
      onlineAgents: agents.filter((agent) => agent.status === 'online').length,
      activeSessions: agents.reduce((sum, agent) => sum + agent.activeSessionCount, 0),
      totalCronJobs: cronJobs.length,
    },
  };
}

export async function runTask(taskId: string) {
  const tasks = await listTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Task not found');

  const runId = randomUUID();
  const startedAt = Date.now();
  await appendRun(taskId, {
    id: runId,
    startedAt,
    status: 'running',
  });

  try {
    const output = await runText(['agent', '--agent', task.agentId, '--message', task.prompt, '--json']);
    await appendRun(taskId, {
      id: runId,
      startedAt,
      finishedAt: Date.now(),
      status: 'success',
      output,
    });
    return { ok: true, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await appendRun(taskId, {
      id: runId,
      startedAt,
      finishedAt: Date.now(),
      status: 'error',
      error: message,
    });
    throw error;
  }
}

export async function scheduleTask(taskId: string, schedule: { mode: 'every' | 'cron' | 'at'; value: string; timezone?: string }) {
  const tasks = await listTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Task not found');

  const args = ['cron', 'add', '--json', '--name', task.title, '--agent', task.agentId, '--message', task.prompt, '--session', 'isolated', '--no-deliver'];
  if (schedule.timezone) args.push('--tz', schedule.timezone);
  if (schedule.mode === 'every') {
    args.push('--every', schedule.value);
  } else if (schedule.mode === 'cron') {
    args.push('--cron', schedule.value);
  } else {
    args.push('--at', schedule.value, '--delete-after-run');
  }

  const result = await runJson<OpenClawCreateCronResponse>(args);
  await updateTask(taskId, (draft) => {
    draft.schedule = {
      mode: schedule.mode,
      value: schedule.value,
      timezone: schedule.timezone,
      jobId: result.id ?? result.job?.id,
    };
  });
  return result;
}
