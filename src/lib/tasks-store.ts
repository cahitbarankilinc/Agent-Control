import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MissionTask, TaskRun } from './types';

const dataDir = path.join(process.cwd(), 'data');
const tasksFile = path.join(dataDir, 'tasks.json');

type TaskFile = { tasks: MissionTask[] };

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(tasksFile, 'utf8');
  } catch {
    await writeFile(tasksFile, JSON.stringify({ tasks: [] }, null, 2), 'utf8');
  }
}

async function readStore(): Promise<TaskFile> {
  await ensureStore();
  const raw = await readFile(tasksFile, 'utf8');
  return JSON.parse(raw) as TaskFile;
}

async function writeStore(data: TaskFile) {
  await ensureStore();
  await writeFile(tasksFile, JSON.stringify(data, null, 2), 'utf8');
}

export async function listTasks() {
  const store = await readStore();
  return store.tasks.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createTask(input: Pick<MissionTask, 'title' | 'agentId' | 'prompt'> & Partial<MissionTask>) {
  const now = Date.now();
  const task: MissionTask = {
    id: randomUUID(),
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
  if (index === -1) {
    throw new Error('Task not found');
  }

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
