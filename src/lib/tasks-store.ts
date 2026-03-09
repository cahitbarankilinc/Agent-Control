import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mission, MissionAgentBinding, MissionPipeline, MissionTask, TaskRun } from './types';

const dataDir = path.join(process.cwd(), 'data');
const storeFile = path.join(dataDir, 'control-center.json');

type Store = {
  missions: Mission[];
  tasks: MissionTask[];
  missionAgents: MissionAgentBinding[];
  pipelines: MissionPipeline[];
};

const defaultStore: Store = {
  missions: [],
  tasks: [],
  missionAgents: [],
  pipelines: [],
};

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(storeFile, 'utf8');
  } catch {
    await writeFile(storeFile, JSON.stringify(defaultStore, null, 2), 'utf8');
  }
}

async function readStore(): Promise<Store> {
  await ensureStore();
  const raw = await readFile(storeFile, 'utf8');
  return JSON.parse(raw) as Store;
}

async function writeStore(data: Store) {
  await ensureStore();
  await writeFile(storeFile, JSON.stringify(data, null, 2), 'utf8');
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `mission-${randomUUID().slice(0, 8)}`;
}

export async function listControlCenterData() {
  const store = await readStore();
  return {
    missions: [...store.missions].sort((a, b) => b.updatedAt - a.updatedAt),
    tasks: [...store.tasks].sort((a, b) => b.updatedAt - a.updatedAt),
    missionAgents: [...store.missionAgents].sort((a, b) => b.createdAt - a.createdAt),
    pipelines: [...store.pipelines].sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

export async function createMission(input: { name: string; description: string; color?: string }) {
  const now = Date.now();
  const mission: Mission = {
    id: randomUUID(),
    name: input.name,
    slug: slugify(input.name),
    description: input.description,
    createdAt: now,
    updatedAt: now,
    color: input.color ?? '#67e8f9',
    status: 'active',
  };

  const store = await readStore();
  store.missions.unshift(mission);
  await writeStore(store);
  return mission;
}

export async function createTask(input: Pick<MissionTask, 'title' | 'agentId' | 'prompt' | 'missionId'> & Partial<MissionTask>) {
  const now = Date.now();
  const task: MissionTask = {
    id: randomUUID(),
    missionId: input.missionId,
    title: input.title,
    agentId: input.agentId,
    prompt: input.prompt,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    schedule: input.schedule ?? { mode: 'none' },
    runs: [],
  };

  const store = await readStore();
  store.tasks.unshift(task);
  await writeStore(store);
  return task;
}

export async function updateTask(taskId: string, mutate: (task: MissionTask) => MissionTask | void) {
  const store = await readStore();
  const index = store.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) throw new Error('Task not found');

  const draft = structuredClone(store.tasks[index]);
  const next = mutate(draft) ?? draft;
  next.updatedAt = Date.now();
  store.tasks[index] = next;
  await writeStore(store);
  return next;
}

export async function appendRun(taskId: string, run: TaskRun) {
  return updateTask(taskId, (task) => {
    task.latestRun = run;
    task.runs = [run, ...task.runs].slice(0, 20);
    task.status = run.status === 'error' ? 'error' : run.status === 'success' ? 'success' : 'running';
  });
}

export async function createMissionAgent(input: {
  missionId: string;
  agentId: string;
  source: 'imported' | 'created';
  role: string;
  primaryModel?: string;
  fallbackModel?: string;
  workspacePath?: string;
  notes?: string;
}) {
  const binding: MissionAgentBinding = {
    id: randomUUID(),
    missionId: input.missionId,
    agentId: input.agentId,
    source: input.source,
    role: input.role,
    primaryModel: input.primaryModel,
    fallbackModel: input.fallbackModel,
    workspacePath: input.workspacePath,
    notes: input.notes,
    createdAt: Date.now(),
  };

  const store = await readStore();
  store.missionAgents.unshift(binding);
  await writeStore(store);
  return binding;
}

export async function createPipeline(input: {
  missionId: string;
  name: string;
  description?: string;
  loop?: { mode: 'none' | 'every' | 'cron'; value?: string };
  nodes: MissionPipeline['nodes'];
}) {
  const now = Date.now();
  const pipeline: MissionPipeline = {
    id: randomUUID(),
    missionId: input.missionId,
    name: input.name,
    description: input.description,
    loop: input.loop,
    nodes: input.nodes,
    createdAt: now,
    updatedAt: now,
  };

  const store = await readStore();
  store.pipelines.unshift(pipeline);
  await writeStore(store);
  return pipeline;
}
