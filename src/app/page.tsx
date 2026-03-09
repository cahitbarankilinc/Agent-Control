'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Clock3, PlayCircle } from 'lucide-react';
import { formatDistanceToNow, formatISO9075 } from 'date-fns';
import type { DashboardOverview } from '@/lib/types';

type ComposerState = {
  title: string;
  agentId: string;
  prompt: string;
};

const initialComposer: ComposerState = { title: '', agentId: '', prompt: '' };

function statusDot(status: string) {
  return <span className={`dot ${status}`} />;
}

function metric(icon: React.ReactNode, label: string, value: string | number, foot: string) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="muted small">{label}</div>
          <div className="metric-value">{value}</div>
          <div className="metric-foot">{foot}</div>
        </div>
        <div className="metric-icon">{icon}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState>(initialComposer);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, { mode: 'every' | 'cron' | 'at'; value: string; timezone: string }>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/overview', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load overview');
      setOverview(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const agentOptions = useMemo(() => overview?.agents ?? [], [overview]);

  async function createTask() {
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composer),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Task creation failed');
      setComposer(initialComposer);
      setNotice('Görev oluşturuldu. İstersen hemen çalıştırabilir ya da cron bağlayabilirsin.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function runTask(taskId: string) {
    setBusyTaskId(taskId);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/run`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Task run failed');
      setNotice('Görev agente gönderildi ve çalıştırıldı.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function scheduleTask(taskId: string) {
    const draft = scheduleDrafts[taskId];
    if (!draft?.value) return;
    setBusyTaskId(taskId);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Task schedule failed');
      setNotice('Göreve OpenClaw cron bağlandı.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1 className="title">Agent Control</h1>
          <div className="subtitle">
            OpenClaw ajanlarını tek panelden izle, görev ata, cron bağla ve son hareketleri gerçek zamana yakın takip et.
          </div>
        </div>
        <div className="badges">
          <div className="badge">OpenClaw Mission Control</div>
          <div className="badge">5s polling</div>
          {overview ? <div className="badge">Last refresh {formatDistanceToNow(overview.generatedAt, { addSuffix: true })}</div> : null}
        </div>
      </div>

      {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {notice ? <div className="success" style={{ marginBottom: 16 }}>{notice}</div> : null}

      {loading && !overview ? <div className="card">Yükleniyor…</div> : null}

      {overview ? (
        <>
          <section className="grid metrics">
            {metric(<Bot size={20} />, 'Agents', overview.metrics.totalAgents, `${overview.metrics.onlineAgents} tanesi şu anda sıcak`)}
            {metric(<Activity size={20} />, 'Active sessions', overview.metrics.activeSessions, 'Son 5 dakika içinde dokunulan oturumlar')}
            {metric(<Clock3 size={20} />, 'Cron jobs', overview.metrics.totalCronJobs, 'OpenClaw scheduler üstünden okunuyor')}
            {metric(<PlayCircle size={20} />, 'Mission tasks', overview.tasks.length, 'Dashboard içinde oluşturulan görevler')}
          </section>

          <section className="grid main">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Agents</h2>
                  <div className="kicker">Kim ayakta, kim boşta, kim uzun süredir sessiz.</div>
                </div>
              </div>
              <div className="agent-list">
                {overview.agents.map((agent) => (
                  <div className="agent-row" key={agent.id}>
                    <div>
                      <div className="agent-name">{agent.id} {agent.isDefault ? <span className="badge" style={{ marginLeft: 8 }}>default</span> : null}</div>
                      <div className="agent-meta small">{agent.model}</div>
                      <div className="agent-meta small code">{agent.workspace}</div>
                    </div>
                    <div>
                      <div className="small muted">Status</div>
                      <div className="pill">{statusDot(agent.status)} {agent.status}</div>
                    </div>
                    <div>
                      <div className="small muted">Last active</div>
                      <div>{agent.lastActiveHuman}</div>
                    </div>
                    <div>
                      <div className="small muted">Sessions</div>
                      <div>{agent.sessionCount} total · {agent.activeSessionCount} hot</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Create mission task</h2>
                  <div className="kicker">Bir agente prompt ver, sonra ister hemen çalıştır ister cron bağla.</div>
                </div>
              </div>
              <div className="form-grid">
                <div>
                  <div className="small muted" style={{ marginBottom: 6 }}>Task title</div>
                  <input className="input" value={composer.title} onChange={(e) => setComposer((prev) => ({ ...prev, title: e.target.value }))} placeholder="Daily ops sweep" />
                </div>
                <div>
                  <div className="small muted" style={{ marginBottom: 6 }}>Agent</div>
                  <select className="select" value={composer.agentId} onChange={(e) => setComposer((prev) => ({ ...prev, agentId: e.target.value }))}>
                    <option value="">Select agent</option>
                    {agentOptions.map((agent) => <option key={agent.id} value={agent.id}>{agent.id}</option>)}
                  </select>
                </div>
                <div className="full">
                  <div className="small muted" style={{ marginBottom: 6 }}>Prompt</div>
                  <textarea className="textarea" value={composer.prompt} onChange={(e) => setComposer((prev) => ({ ...prev, prompt: e.target.value }))} placeholder="OpenClaw logs, active sessions, and pending cron failures için kısa bir durum özeti ver." />
                </div>
                <div className="full actions">
                  <button className="btn primary" onClick={createTask} disabled={!composer.title || !composer.agentId || !composer.prompt}>Create task</button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid lower">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Mission tasks</h2>
                  <div className="kicker">Dashboard üstünden verdiğin görevler ve son koşuları.</div>
                </div>
              </div>
              <div className="task-list">
                {overview.tasks.length === 0 ? <div className="empty">Henüz görev yok.</div> : overview.tasks.map((task) => {
                  const draft = scheduleDrafts[task.id] ?? { mode: 'every', value: '', timezone: 'Europe/Istanbul' };
                  return (
                    <div className="task-item" key={task.id}>
                      <div className="task-top">
                        <div>
                          <div className="agent-name">{task.title}</div>
                          <div className="meta small">agent: {task.agentId}</div>
                        </div>
                        <div className="pill">{statusDot(task.status === 'running' ? 'online' : task.status === 'success' ? 'idle' : task.status === 'error' ? 'offline' : 'idle')} {task.status}</div>
                      </div>
                      <div>{task.prompt}</div>
                      <div className="meta small">
                        created {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                        {task.schedule?.jobId ? ` · cron ${task.schedule.mode}: ${task.schedule.value} (${task.schedule.jobId})` : ''}
                      </div>
                      {task.latestRun?.output ? <details><summary>Latest output</summary><pre className="code" style={{ whiteSpace: 'pre-wrap' }}>{task.latestRun.output}</pre></details> : null}
                      {task.latestRun?.error ? <div className="error small">{task.latestRun.error}</div> : null}
                      <div className="form-grid">
                        <div>
                          <div className="small muted" style={{ marginBottom: 6 }}>Schedule mode</div>
                          <select className="select" value={draft.mode} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [task.id]: { ...draft, mode: e.target.value as 'every' | 'cron' | 'at' } }))}>
                            <option value="every">Every</option>
                            <option value="cron">Cron</option>
                            <option value="at">One-shot</option>
                          </select>
                        </div>
                        <div>
                          <div className="small muted" style={{ marginBottom: 6 }}>Value</div>
                          <input className="input" value={draft.value} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [task.id]: { ...draft, value: e.target.value } }))} placeholder={draft.mode === 'every' ? '15m' : draft.mode === 'cron' ? '*/30 * * * *' : '2026-03-10T09:00:00+03:00'} />
                        </div>
                        <div>
                          <div className="small muted" style={{ marginBottom: 6 }}>Timezone</div>
                          <input className="input" value={draft.timezone} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [task.id]: { ...draft, timezone: e.target.value } }))} placeholder="Europe/Istanbul" />
                        </div>
                        <div className="actions" style={{ alignItems: 'end' }}>
                          <button className="btn secondary" disabled={busyTaskId === task.id} onClick={() => void runTask(task.id)}>Run now</button>
                          <button className="btn warn" disabled={busyTaskId === task.id || !draft.value} onClick={() => void scheduleTask(task.id)}>Attach cron</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card">
                <div className="section-head">
                  <div>
                    <h2>Live activity</h2>
                    <div className="kicker">Session touch + cron run birleşik akış.</div>
                  </div>
                </div>
                <div className="feed-list">
                  {overview.activity.length === 0 ? <div className="empty">Henüz aktivite yok.</div> : overview.activity.map((item) => (
                    <div className="feed-item" key={item.id}>
                      <div className="feed-top">
                        <div>
                          <div className="agent-name">{item.title}</div>
                          <div className="meta small">{item.agentId} · {item.kind}</div>
                        </div>
                        <div className="pill">{statusDot(item.status)} {item.status}</div>
                      </div>
                      <div className="code">{item.detail}</div>
                      <div className="meta small">{formatDistanceToNow(item.at, { addSuffix: true })} · {formatISO9075(item.at)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="section-head">
                  <div>
                    <h2>Agent cron map</h2>
                    <div className="kicker">OpenClaw scheduler’dan çekilen job listesi.</div>
                  </div>
                </div>
                <div className="cron-list">
                  {overview.cronJobs.length === 0 ? <div className="empty">Cron job yok.</div> : overview.cronJobs.map((job) => (
                    <div className="cron-item" key={job.id}>
                      <div className="cron-top">
                        <div>
                          <div className="agent-name">{job.name}</div>
                          <div className="meta small">{job.agentId} · {job.schedule}</div>
                        </div>
                        <div className="pill">{statusDot(job.lastStatus === 'error' ? 'offline' : 'idle')} {job.lastStatus ?? 'scheduled'}</div>
                      </div>
                      {job.message ? <div>{job.message}</div> : null}
                      <div className="meta small">
                        {job.nextRunAt ? `next ${formatDistanceToNow(job.nextRunAt, { addSuffix: true })}` : 'next run unknown'}
                        {job.lastRunAt ? ` · last ${formatDistanceToNow(job.lastRunAt, { addSuffix: true })}` : ''}
                        {job.consecutiveErrors ? ` · errors ${job.consecutiveErrors}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
