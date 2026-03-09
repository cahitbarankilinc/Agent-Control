export type AgentStatus = 'online' | 'idle' | 'offline';

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
  status: AgentStatus;
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
  status: AgentStatus;
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
  missionId: string;
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

export type PipelineNode = {
  id: string;
  label: string;
  type: 'trigger' | 'agent' | 'decision' | 'loop' | 'deliver';
  config: Record<string, string>;
};

export type MissionPipeline = {
  id: string;
  missionId: string;
  name: string;
  description?: string;
  loop?: {
    mode: 'none' | 'every' | 'cron';
    value?: string;
  };
  nodes: PipelineNode[];
  createdAt: number;
  updatedAt: number;
};

export type MissionAgentBinding = {
  id: string;
  missionId: string;
  agentId: string;
  source: 'imported' | 'created';
  role: string;
  primaryModel?: string;
  fallbackModel?: string;
  workspacePath?: string;
  notes?: string;
  createdAt: number;
};

export type Mission = {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  color: string;
  status: 'planning' | 'active' | 'paused';
};

export type DashboardOverview = {
  generatedAt: number;
  agents: AgentSummary[];
  cronJobs: CronJobSummary[];
  activity: ActivityItem[];
  tasks: MissionTask[];
  missions: Mission[];
  missionAgents: MissionAgentBinding[];
  pipelines: MissionPipeline[];
  availableModels: string[];
  metrics: {
    totalAgents: number;
    onlineAgents: number;
    activeSessions: number;
    totalCronJobs: number;
    totalMissions: number;
    totalPipelines: number;
  };
};
