export type AgentSummary = {
  id: string;
  model?: string;
  workspace?: string;
  bindings?: number;
  isDefault?: boolean;
  lastActiveAt?: number | null;
  lastActiveHuman?: string;
  sessionCount: number;
  activeSessionCount: number;
  status: 'online' | 'idle' | 'offline';
  latestSessionKey?: string;
};

export type CronJobSummary = {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  type: 'cron' | 'every' | 'once' | 'unknown';
  message?: string;
  nextRunAt?: number | null;
  lastRunAt?: number | null;
  lastStatus?: string | null;
  consecutiveErrors?: number;
};

export type ActivityItem = {
  id: string;
  agentId: string;
  title: string;
  detail: string;
  at: number;
  kind: 'session' | 'cron';
  status: 'online' | 'idle' | 'offline';
};

export type TaskRun = {
  id: string;
  startedAt: number;
  finishedAt?: number;
  status: 'queued' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
};

export type MissionTask = {
  id: string;
  title: string;
  agentId: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'running' | 'success' | 'error';
  schedule?: {
    mode: 'none' | 'every' | 'cron' | 'at';
    value?: string;
    timezone?: string;
    jobId?: string;
  };
  latestRun?: TaskRun;
  runs: TaskRun[];
};

export type DashboardOverview = {
  generatedAt: number;
  agents: AgentSummary[];
  cronJobs: CronJobSummary[];
  activity: ActivityItem[];
  tasks: MissionTask[];
  metrics: {
    totalAgents: number;
    onlineAgents: number;
    activeSessions: number;
    totalCronJobs: number;
  };
};
