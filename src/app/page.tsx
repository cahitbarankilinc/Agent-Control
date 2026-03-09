'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Briefcase,
  Clock3,
  LayoutDashboard,
  Orbit,
  Radar,
  Workflow,
} from 'lucide-react';
import { formatDistanceToNow, formatISO9075 } from 'date-fns';
import type { DashboardOverview, Mission } from '@/lib/types';

type MissionDraft = { name: string; description: string; color: string };
type TaskDraft = { title: string; missionId: string; agentId: string; prompt: string };
type ImportAgentDraft = { missionId: string; agentId: string; role: string; notes: string };
type CreateAgentDraft = {
  missionId: string;
  agentId: string;
  role: string;
  primaryModel: string;
  fallbackModel: string;
};
type PipelineDraft = {
  missionId: string;
  name: string;
  description: string;
  loopMode: 'none' | 'every' | 'cron';
  loopValue: string;
  agentId: string;
  prompt: string;
};

const missionInitial: MissionDraft = { name: '', description: '', color: '#67e8f9' };
const taskInitial: TaskDraft = { title: '', missionId: '', agentId: '', prompt: '' };
const importInitial: ImportAgentDraft = { missionId: '', agentId: '', role: '', notes: '' };
const createAgentInitial: CreateAgentDraft = { missionId: '', agentId: '', role: '', primaryModel: 'openai-codex/gpt-5.4', fallbackModel: 'copilot-proxy/gpt-5-mini' };
const pipelineInitial: PipelineDraft = { missionId: '', name: '', description: '', loopMode: 'every', loopValue: '15m', agentId: '', prompt: '' };

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'missions', label: 'Missions', icon: Briefcase },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'pipelines', label: 'Pipelines', icon: Workflow },
  { id: 'ops', label: 'Live Ops', icon: Radar },
];

function statusDot(status: string) {
  return <span className={`dot ${status}`} />;
}

function metric(icon: React.ReactNode, label: string, value: string | number, foot: string) {
  return (
    <div className="card premium">
      <div className="split-top">
        <div>
          <div className="small-meta">{label}</div>
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
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [missionDraft, setMissionDraft] = useState<MissionDraft>(missionInitial);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(taskInitial);
  const [importDraft, setImportDraft] = useState<ImportAgentDraft>(importInitial);
  const [createAgentDraft, setCreateAgentDraft] = useState<CreateAgentDraft>(createAgentInitial);
  const [pipelineDraft, setPipelineDraft] = useState<PipelineDraft>(pipelineInitial);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, { mode: 'every' | 'cron' | 'at'; value: string; timezone: string }>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/overview', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load overview');
      setOverview(payload);
      setError(null);
      if (!selectedMissionId && payload.missions[0]?.id) {
        setSelectedMissionId(payload.missions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedMissionId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selectedMission = useMemo(() => overview?.missions.find((mission) => mission.id === selectedMissionId) ?? overview?.missions[0] ?? null, [overview, selectedMissionId]);
  const missionId = selectedMission?.id ?? '';

  const missionAgents = useMemo(() => overview?.missionAgents.filter((agent) => agent.missionId === missionId) ?? [], [overview, missionId]);
  const missionTasks = useMemo(() => overview?.tasks.filter((task) => task.missionId === missionId) ?? [], [overview, missionId]);
  const missionPipelines = useMemo(() => overview?.pipelines.filter((pipeline) => pipeline.missionId === missionId) ?? [], [overview, missionId]);

  async function postJson(url: string, body: object, successMessage: string) {
    setError(null);
    setNotice(null);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Request failed');
    setNotice(successMessage);
    await load();
    return payload;
  }

  async function createMission() {
    setBusyKey('mission');
    try {
      const payload = await postJson('/api/missions', missionDraft, 'Mission oluşturuldu.');
      setMissionDraft(missionInitial);
      setSelectedMissionId(payload.mission.id);
      setTaskDraft((prev) => ({ ...prev, missionId: payload.mission.id }));
      setImportDraft((prev) => ({ ...prev, missionId: payload.mission.id }));
      setCreateAgentDraft((prev) => ({ ...prev, missionId: payload.mission.id }));
      setPipelineDraft((prev) => ({ ...prev, missionId: payload.mission.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  async function createTask() {
    if (!missionId) return;
    setBusyKey('task');
    try {
      await postJson('/api/tasks', { ...taskDraft, missionId }, 'Mission görevi oluşturuldu.');
      setTaskDraft({ ...taskInitial, missionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  async function importAgent() {
    if (!missionId) return;
    setBusyKey('import-agent');
    try {
      await postJson(`/api/missions/${missionId}/agents/import`, { ...importDraft, missionId }, 'Agent mission içine aktarıldı.');
      setImportDraft({ ...importInitial, missionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  async function createAgent() {
    if (!missionId) return;
    setBusyKey('create-agent');
    try {
      await postJson(`/api/missions/${missionId}/agents/create`, { ...createAgentDraft, missionId }, 'Yeni agent oluşturuldu ve missiona bağlandı.');
      setCreateAgentDraft({ ...createAgentInitial, missionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  async function createPipeline() {
    if (!missionId) return;
    setBusyKey('pipeline');
    try {
      await postJson('/api/pipelines', { ...pipelineDraft, missionId }, 'Pipeline oluşturuldu.');
      setPipelineDraft({ ...pipelineInitial, missionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  async function runTask(taskId: string) {
    setBusyKey(`run-${taskId}`);
    try {
      await postJson(`/api/tasks/${taskId}/run`, {}, 'Görev agente gönderildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  async function scheduleTask(taskId: string) {
    const draft = scheduleDrafts[taskId];
    if (!draft?.value) return;
    setBusyKey(`schedule-${taskId}`);
    try {
      await postJson(`/api/tasks/${taskId}/schedule`, draft, 'Loop / cron göreve bağlandı.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyKey(null);
    }
  }

  function activateMission(mission: Mission) {
    setSelectedMissionId(mission.id);
    setTaskDraft((prev) => ({ ...prev, missionId: mission.id }));
    setImportDraft((prev) => ({ ...prev, missionId: mission.id }));
    setCreateAgentDraft((prev) => ({ ...prev, missionId: mission.id }));
    setPipelineDraft((prev) => ({ ...prev, missionId: mission.id }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">MC</div>
          <div>
            <div className="brand-title">Agent Control</div>
            <div className="brand-subtitle">Premium OpenClaw mission control</div>
          </div>
        </div>

        <div className="side-section">
          <div className="side-label">Navigate</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                href={`#${item.id}`}
                key={item.id}
                className={`side-link ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} /> {item.label}
                </span>
              </a>
            );
          })}
        </div>

        <div className="side-section">
          <div className="side-label">Current mission</div>
          {selectedMission ? (
            <div className="card" style={{ padding: 14 }}>
              <div className="pill-row"><span className="color-chip" style={{ background: selectedMission.color }} /> <span className="name">{selectedMission.name}</span></div>
              <div className="small-meta" style={{ marginTop: 8 }}>{selectedMission.description}</div>
            </div>
          ) : <div className="empty">Henüz mission yok.</div>}
        </div>

        <div className="side-section">
          <div className="side-label">Signals</div>
          <div className="side-link"><span>Agents</span><span className="side-pill">{overview?.metrics.totalAgents ?? 0}</span></div>
          <div className="side-link"><span>Missions</span><span className="side-pill">{overview?.metrics.totalMissions ?? 0}</span></div>
          <div className="side-link"><span>Pipelines</span><span className="side-pill">{overview?.metrics.totalPipelines ?? 0}</span></div>
        </div>
      </aside>

      <section className="content">
        <div className="topbar" id="overview">
          <div>
            <h1 className="title">Mission-first control room</h1>
            <div className="subtitle">
              OpenClaw agent’larını mission bazlı yönet, mevcut agent’ları içeri al, yeni agent’ları brief yazarak üret, pipeline kur ve loop / cron takibini tek panelden yap.
            </div>
          </div>
          <div className="badges">
            <div className="badge">Left-nav UX</div>
            <div className="badge">Mission workspaces</div>
            <div className="badge">Agent builder + importer</div>
            <div className="badge">Pipeline loops</div>
            {overview ? <div className="badge">Refreshed {formatDistanceToNow(overview.generatedAt, { addSuffix: true })}</div> : null}
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {notice ? <div className="notice">{notice}</div> : null}
        {loading && !overview ? <div className="card">Yükleniyor…</div> : null}

        {overview ? (
          <>
            <section className="grid metrics-grid">
              {metric(<Bot size={20} />, 'Agents', overview.metrics.totalAgents, `${overview.metrics.onlineAgents} tanesi aktif sıcak bölgede`)}
              {metric(<Briefcase size={20} />, 'Missions', overview.metrics.totalMissions, 'Her mission kendi workspace mantığıyla ilerler')}
              {metric(<Workflow size={20} />, 'Pipelines', overview.metrics.totalPipelines, 'n8n benzeri görsel akışın ilk sürümü')}
              {metric(<Clock3 size={20} />, 'Cron loops', overview.metrics.totalCronJobs, 'Scheduler haritası mission control içinde')}
              {metric(<Activity size={20} />, 'Active sessions', overview.metrics.activeSessions, 'Son 5 dakikada dokunulan oturumlar')}
            </section>

            <section className="grid main-grid" id="missions">
              <div className="card premium">
                <div className="section-head">
                  <div>
                    <h2 className="card-title">Missions</h2>
                    <div className="kicker">Bir mission aslında ürün alanı / workspace / operasyon alanı gibi davranır. İçine agent, görev, pipeline ve loop bağlarsın.</div>
                  </div>
                </div>
                <div className="mission-grid">
                  {overview.missions.length === 0 ? <div className="empty">İlk mission’ı aşağıdan oluştur.</div> : overview.missions.map((mission) => (
                    <button key={mission.id} className={`mission-card ${mission.id === missionId ? 'active' : ''}`} onClick={() => activateMission(mission)}>
                      <div className="mission-top">
                        <div>
                          <div className="pill-row"><span className="color-chip" style={{ background: mission.color }} /> <span className="name">{mission.name}</span></div>
                          <div className="small-meta" style={{ marginTop: 8 }}>{mission.description}</div>
                        </div>
                        <div className="pill">{mission.status}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="section-head">
                  <div>
                    <h2 className="card-title">Create mission</h2>
                    <div className="kicker">Yeni operasyon alanı aç. Sonra agent import et ya da sıfırdan üret.</div>
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="field-label">Mission name</label>
                    <input className="input" value={missionDraft.name} onChange={(e) => setMissionDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Agent Commerce" />
                  </div>
                  <div>
                    <label className="field-label">Color</label>
                    <input className="input" type="color" value={missionDraft.color} onChange={(e) => setMissionDraft((prev) => ({ ...prev, color: e.target.value }))} />
                  </div>
                  <div className="full">
                    <label className="field-label">Description</label>
                    <textarea className="textarea" value={missionDraft.description} onChange={(e) => setMissionDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="OpenClaw mission control ürününü planlama, operasyon ve otomasyon katmanlarıyla büyüt." />
                  </div>
                  <div className="full actions">
                    <button className="btn primary" disabled={busyKey === 'mission' || !missionDraft.name || !missionDraft.description} onClick={createMission}>Open mission</button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid quick-panels" id="agents">
              <div className="card premium">
                <div className="section-head">
                  <div>
                    <h2 className="card-title">Mission agents</h2>
                    <div className="kicker">Seçili mission içindeki agent’lar. Imported olanlar mevcut ajanlardan gelir; created olanlar brief ile scaffold edilip OpenClaw’a eklenir.</div>
                  </div>
                </div>
                <div className="stack">
                  {!selectedMission ? <div className="empty">Önce bir mission seç.</div> : missionAgents.length === 0 ? <div className="empty">Bu mission içinde henüz agent yok.</div> : missionAgents.map((item) => {
                    const live = overview.agents.find((agent) => agent.id === item.agentId);
                    return (
                      <div className="row-card" key={item.id}>
                        <div className="split-top">
                          <div>
                            <div className="name">{item.agentId}</div>
                            <div className="small-meta">{item.source} · {item.primaryModel ?? live?.model ?? 'model unknown'}</div>
                          </div>
                          <div className="pill">{statusDot(live?.status ?? 'offline')} {live?.status ?? 'offline'}</div>
                        </div>
                        <div style={{ marginTop: 10 }}>{item.role}</div>
                        <div className="small-meta" style={{ marginTop: 10 }}>
                          fallback: {item.fallbackModel ?? 'none'}
                          {item.workspacePath ? ` · workspace: ${item.workspacePath}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="stack">
                <div className="card">
                  <div className="section-head">
                    <div>
                      <h2 className="card-title">Import existing agent</h2>
                      <div className="kicker">Mevcut OpenClaw agent’ını mission içine mantıksal olarak bağla.</div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div>
                      <label className="field-label">Agent</label>
                      <select className="select" value={importDraft.agentId} onChange={(e) => setImportDraft((prev) => ({ ...prev, agentId: e.target.value, missionId }))}>
                        <option value="">Select agent</option>
                        {overview.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Mission role</label>
                      <input className="input" value={importDraft.role} onChange={(e) => setImportDraft((prev) => ({ ...prev, role: e.target.value, missionId }))} placeholder="Ops observer + escalation agent" />
                    </div>
                    <div className="full">
                      <label className="field-label">Notes</label>
                      <textarea className="textarea" value={importDraft.notes} onChange={(e) => setImportDraft((prev) => ({ ...prev, notes: e.target.value, missionId }))} placeholder="Bu agent yalnızca raporlama ve izleme için kullanılacak." />
                    </div>
                    <div className="full actions">
                      <button className="btn secondary" disabled={!missionId || !importDraft.agentId || !importDraft.role || busyKey === 'import-agent'} onClick={importAgent}>Import agent</button>
                    </div>
                  </div>
                </div>

                <div className="card premium">
                  <div className="section-head">
                    <div>
                      <h2 className="card-title">Create new agent from brief</h2>
                      <div className="kicker">Agent görevini yaz; sistem mission workspace altında agent dizinini, AGENTS.md / IDENTITY.md / MISSION.md dosyalarını kurup OpenClaw agent’ını yaratır.</div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div>
                      <label className="field-label">Agent id</label>
                      <input className="input" value={createAgentDraft.agentId} onChange={(e) => setCreateAgentDraft((prev) => ({ ...prev, agentId: e.target.value, missionId }))} placeholder="commerce-scout" />
                    </div>
                    <div>
                      <label className="field-label">Primary model</label>
                      <input className="input" list="models" value={createAgentDraft.primaryModel} onChange={(e) => setCreateAgentDraft((prev) => ({ ...prev, primaryModel: e.target.value, missionId }))} />
                    </div>
                    <div>
                      <label className="field-label">Fallback model</label>
                      <input className="input" list="models" value={createAgentDraft.fallbackModel} onChange={(e) => setCreateAgentDraft((prev) => ({ ...prev, fallbackModel: e.target.value, missionId }))} />
                    </div>
                    <div className="full">
                      <label className="field-label">Agent role / brief</label>
                      <textarea className="textarea" value={createAgentDraft.role} onChange={(e) => setCreateAgentDraft((prev) => ({ ...prev, role: e.target.value, missionId }))} placeholder="Yeni çıkan agentic SaaS fırsatlarını tara, ticari sinyal çıkar, görevleri görev kartlarına dönüştür ve haftalık büyüme risklerini raporla." />
                    </div>
                    <div className="full actions">
                      <button className="btn primary" disabled={!missionId || !createAgentDraft.agentId || !createAgentDraft.role || !createAgentDraft.primaryModel || busyKey === 'create-agent'} onClick={createAgent}>Create agent</button>
                    </div>
                  </div>
                  <datalist id="models">
                    {overview.availableModels.map((model) => <option key={model} value={model} />)}
                  </datalist>
                </div>
              </div>
            </section>

            <section className="grid two-col" id="pipelines">
              <div className="card premium">
                <div className="section-head">
                  <div>
                    <h2 className="card-title">Pipeline builder</h2>
                    <div className="kicker">n8n tadında, ama mission/agent düşüncesine göre sadeleştirilmiş: trigger → agent → decision → loop → delivery.</div>
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="field-label">Pipeline name</label>
                    <input className="input" value={pipelineDraft.name} onChange={(e) => setPipelineDraft((prev) => ({ ...prev, name: e.target.value, missionId }))} placeholder="Daily growth radar" />
                  </div>
                  <div>
                    <label className="field-label">Loop mode</label>
                    <select className="select" value={pipelineDraft.loopMode} onChange={(e) => setPipelineDraft((prev) => ({ ...prev, loopMode: e.target.value as PipelineDraft['loopMode'], missionId }))}>
                      <option value="none">None</option>
                      <option value="every">Every</option>
                      <option value="cron">Cron</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Loop value</label>
                    <input className="input" value={pipelineDraft.loopValue} onChange={(e) => setPipelineDraft((prev) => ({ ...prev, loopValue: e.target.value, missionId }))} placeholder="15m or */30 * * * *" />
                  </div>
                  <div>
                    <label className="field-label">Primary agent</label>
                    <select className="select" value={pipelineDraft.agentId} onChange={(e) => setPipelineDraft((prev) => ({ ...prev, agentId: e.target.value, missionId }))}>
                      <option value="">Select mission agent</option>
                      {missionAgents.map((agent) => <option key={agent.id} value={agent.agentId}>{agent.agentId}</option>)}
                    </select>
                  </div>
                  <div className="full">
                    <label className="field-label">Description</label>
                    <input className="input" value={pipelineDraft.description} onChange={(e) => setPipelineDraft((prev) => ({ ...prev, description: e.target.value, missionId }))} placeholder="Yeni sinyalleri topla, agent ile işle, karar noktasıyla ayır ve görev olarak bırak." />
                  </div>
                  <div className="full">
                    <label className="field-label">Agent prompt</label>
                    <textarea className="textarea" value={pipelineDraft.prompt} onChange={(e) => setPipelineDraft((prev) => ({ ...prev, prompt: e.target.value, missionId }))} placeholder="Mission içindeki günlük operasyon sinyallerini tara ve önemli olanları aksiyon kartlarına dönüştür." />
                  </div>
                  <div className="full actions">
                    <button className="btn primary" disabled={!missionId || !pipelineDraft.name || busyKey === 'pipeline'} onClick={createPipeline}>Create pipeline</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="section-head">
                  <div>
                    <h2 className="card-title">Mission pipelines</h2>
                    <div className="kicker">Loop’lu akışlar burada görünür. Her pipeline future cron orkestrasyonu için hazır metadata taşır.</div>
                  </div>
                </div>
                <div className="stack">
                  {!selectedMission ? <div className="empty">Önce bir mission seç.</div> : missionPipelines.length === 0 ? <div className="empty">Bu mission için pipeline yok.</div> : missionPipelines.map((pipeline) => (
                    <div className="pipeline-card" key={pipeline.id}>
                      <div className="pipeline-top">
                        <div>
                          <div className="name">{pipeline.name}</div>
                          <div className="small-meta">{pipeline.description || 'No description'} </div>
                        </div>
                        <div className="pill"><Orbit size={13} /> {pipeline.loop?.mode ?? 'none'} {pipeline.loop?.value ?? ''}</div>
                      </div>
                      <div className="pipeline-lane">
                        {pipeline.nodes.map((node) => (
                          <div className="pipeline-node" key={node.id}>
                            <div className="pipeline-type">{node.type}</div>
                            <div className="name" style={{ fontSize: 14 }}>{node.label}</div>
                            <div className="small-meta" style={{ marginTop: 8 }}>{Object.values(node.config).filter(Boolean).join(' · ') || 'configured'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid two-col">
              <div className="card premium">
                <div className="section-head">
                  <div>
                    <h2 className="card-title">Mission task board</h2>
                    <div className="kicker">Mission içindeki tekil görevler. Hemen çalıştırabilir ya da loop / cron bağlayabilirsin.</div>
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="field-label">Task title</label>
                    <input className="input" value={taskDraft.title} onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value, missionId }))} placeholder="Weekly risk sweep" />
                  </div>
                  <div>
                    <label className="field-label">Agent</label>
                    <select className="select" value={taskDraft.agentId} onChange={(e) => setTaskDraft((prev) => ({ ...prev, agentId: e.target.value, missionId }))}>
                      <option value="">Select mission agent</option>
                      {missionAgents.map((agent) => <option key={agent.id} value={agent.agentId}>{agent.agentId}</option>)}
                    </select>
                  </div>
                  <div className="full">
                    <label className="field-label">Prompt</label>
                    <textarea className="textarea" value={taskDraft.prompt} onChange={(e) => setTaskDraft((prev) => ({ ...prev, prompt: e.target.value, missionId }))} placeholder="Mission içindeki tüm pipeline ve cron hatalarını incele, kritik noktaları sırala ve düzeltme önerisi ver." />
                  </div>
                  <div className="full actions">
                    <button className="btn secondary" disabled={!missionId || !taskDraft.title || !taskDraft.agentId || !taskDraft.prompt || busyKey === 'task'} onClick={createTask}>Create mission task</button>
                  </div>
                </div>
                <div className="stack" style={{ marginTop: 18 }}>
                  {!selectedMission ? <div className="empty">Önce bir mission seç.</div> : missionTasks.length === 0 ? <div className="empty">Bu mission için görev yok.</div> : missionTasks.map((task) => {
                    const draft = scheduleDrafts[task.id] ?? { mode: 'every', value: '15m', timezone: 'Europe/Istanbul' };
                    return (
                      <div className="task-card" key={task.id}>
                        <div className="task-top">
                          <div>
                            <div className="name">{task.title}</div>
                            <div className="small-meta">{task.agentId}</div>
                          </div>
                          <div className="pill">{statusDot(task.status === 'running' ? 'online' : task.status === 'success' ? 'idle' : task.status === 'error' ? 'offline' : 'idle')} {task.status}</div>
                        </div>
                        <div style={{ marginTop: 10 }}>{task.prompt}</div>
                        <div className="small-meta" style={{ marginTop: 10 }}>
                          created {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                          {task.schedule?.jobId ? ` · ${task.schedule.mode}: ${task.schedule.value}` : ''}
                        </div>
                        {task.latestRun?.output ? <details style={{ marginTop: 10 }}><summary>Latest output</summary><pre className="code">{task.latestRun.output}</pre></details> : null}
                        {task.latestRun?.error ? <div className="error" style={{ marginTop: 10 }}>{task.latestRun.error}</div> : null}
                        <div className="form-grid" style={{ marginTop: 12 }}>
                          <div>
                            <label className="field-label">Loop mode</label>
                            <select className="select" value={draft.mode} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [task.id]: { ...draft, mode: e.target.value as 'every' | 'cron' | 'at' } }))}>
                              <option value="every">Every</option>
                              <option value="cron">Cron</option>
                              <option value="at">One-shot</option>
                            </select>
                          </div>
                          <div>
                            <label className="field-label">Value</label>
                            <input className="input" value={draft.value} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [task.id]: { ...draft, value: e.target.value } }))} />
                          </div>
                          <div>
                            <label className="field-label">Timezone</label>
                            <input className="input" value={draft.timezone} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [task.id]: { ...draft, timezone: e.target.value } }))} />
                          </div>
                          <div className="actions" style={{ alignItems: 'end' }}>
                            <button className="btn secondary" disabled={busyKey === `run-${task.id}`} onClick={() => void runTask(task.id)}>Run now</button>
                            <button className="btn warn" disabled={busyKey === `schedule-${task.id}`} onClick={() => void scheduleTask(task.id)}>Attach loop</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="stack" id="ops">
                <div className="card">
                  <div className="section-head">
                    <div>
                      <h2 className="card-title">All agents</h2>
                      <div className="kicker">Global OpenClaw agent havuzu. Mission’lara buradan import edebilirsin.</div>
                    </div>
                  </div>
                  <div className="stack">
                    {overview.agents.map((agent) => (
                      <div className="row-card" key={agent.id}>
                        <div className="row-grid">
                          <div>
                            <div className="name">{agent.id}</div>
                            <div className="small-meta">{agent.model}</div>
                            <div className="code">{agent.workspace}</div>
                          </div>
                          <div>
                            <div className="small-meta">Status</div>
                            <div className="pill">{statusDot(agent.status)} {agent.status}</div>
                          </div>
                          <div>
                            <div className="small-meta">Last active</div>
                            <div>{agent.lastActiveHuman}</div>
                          </div>
                          <div>
                            <div className="small-meta">Sessions</div>
                            <div>{agent.sessionCount} total · {agent.activeSessionCount} hot</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card premium">
                  <div className="section-head">
                    <div>
                      <h2 className="card-title">Live ops + cron map</h2>
                      <div className="kicker">Olay akışı ve scheduler görünürlüğü aynı yerde. Premium control room hissi için en kritik iki panel bunlar.</div>
                    </div>
                  </div>
                  <div className="stack">
                    {overview.activity.slice(0, 8).map((item) => (
                      <div className="feed-item" key={item.id}>
                        <div className="feed-top">
                          <div>
                            <div className="name">{item.title}</div>
                            <div className="small-meta">{item.agentId} · {item.kind}</div>
                          </div>
                          <div className="pill">{statusDot(item.status)} {item.status}</div>
                        </div>
                        <div className="code" style={{ marginTop: 10 }}>{item.detail}</div>
                        <div className="small-meta" style={{ marginTop: 10 }}>{formatDistanceToNow(item.at, { addSuffix: true })} · {formatISO9075(item.at)}</div>
                      </div>
                    ))}
                    {overview.cronJobs.slice(0, 6).map((job) => (
                      <div className="feed-item" key={job.id}>
                        <div className="feed-top">
                          <div>
                            <div className="name">{job.name}</div>
                            <div className="small-meta">{job.agentId} · {job.schedule}</div>
                          </div>
                          <div className="pill">{statusDot(job.lastStatus === 'error' ? 'offline' : 'idle')} {job.lastStatus ?? 'scheduled'}</div>
                        </div>
                        <div className="small-meta" style={{ marginTop: 10 }}>
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
      </section>
    </main>
  );
}
