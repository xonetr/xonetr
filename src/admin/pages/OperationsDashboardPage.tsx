import {useEffect,useState} from 'react';

type AnalyticsSummary = {
  total_visits: number;
  unique_visitors: number;
  active_projects: number;
  open_tasks: number;
  task_status: Array<{status: string; total: number}>;
  visits_by_day: Array<{day: string; total: number}>;
};

type ProjectItem = {
  id: string;
  name: string;
  description: string;
  status: string;
  updated_at: string;
};

type TaskItem = {
  id: string;
  project_name: string;
  title: string;
  status: string;
  priority: string;
  assignee_name?: string | null;
  updated_at: string;
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {credentials: 'include', ...options, headers: options.headers});
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail ?? 'No se pudo completar la operación.');
  return body;
}

const statusStyles: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  in_progress: 'En curso',
  review: 'Revisión',
  done: 'Hecho',
  blocked: 'Bloqueado',
};

export function OperationsDashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [analytics, projectData, taskData] = await Promise.all([
          api('/api/analytics/summary?range_days=30'),
          api('/api/projects'),
          api('/api/tasks'),
        ]);
        setSummary(analytics);
        setProjects(projectData ?? []);
        setTasks(taskData ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el dashboard.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const metrics = [
    {label: 'Visitas', value: summary ? summary.total_visits.toLocaleString('es-AR') : '0', trend: summary ? `${summary.unique_visitors.toLocaleString('es-AR')} únicos` : 'Sin datos'},
    {label: 'Proyectos activos', value: summary ? String(summary.active_projects) : '0', trend: `${projects.length} visibles en el panel`},
    {label: 'Tareas abiertas', value: summary ? String(summary.open_tasks) : '0', trend: tasks.filter((task) => task.status !== 'done').length > 0 ? `${tasks.filter((task) => task.status !== 'done').length} en flujo` : 'Sin tareas pendientes'},
    {label: 'Ritmo', value: summary ? `${summary.task_status.find((item) => item.status === 'done')?.total ?? 0}` : '0', trend: 'completadas este periodo'},
  ];

  const pipeline = [
    {stage: 'Backlog', count: tasks.filter((task) => task.status === 'backlog').length},
    {stage: 'En curso', count: tasks.filter((task) => task.status === 'in_progress').length},
    {stage: 'Revisión', count: tasks.filter((task) => task.status === 'review').length},
    {stage: 'Hecho', count: tasks.filter((task) => task.status === 'done').length},
  ];

  const recentTasks = [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 4);

  if (loading) {
    return <div className="admin-skeleton-grid" aria-label="Cargando dashboard"><i/><i/><i/></div>;
  }

  if (error) {
    return <div className="admin-state admin-state--error"><span aria-hidden="true">!</span><h2>No se pudo cargar el dashboard</h2><p>{error}</p></div>;
  }

  return (
    <div className="admin-dashboard">
      <section className="admin-summary-cards">
        {metrics.map((item) => (
          <article key={item.label}>
            <p className="admin-kicker">// {item.label.toUpperCase()}</p>
            <strong>{item.value}</strong>
            <span>{item.trend}</span>
          </article>
        ))}
      </section>

      <section className="admin-section-status">
        <div className="admin-panel-card__heading">
          <div>
            <p className="admin-kicker">// FLUJO</p>
            <h2>Pipeline de entregas</h2>
          </div>
        </div>

        <div className="admin-status-grid">
          {pipeline.map((item) => (
            <div key={item.stage} className="admin-status-group" style={{padding: '1rem'}}>
              <h3>{item.stage}</h3>
              <div style={{fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem'}}>{item.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section-status">
        <div className="admin-panel-card__heading">
          <div>
            <p className="admin-kicker">// ACTIVIDAD</p>
            <h2>Últimas tareas</h2>
          </div>
        </div>

        <div className="admin-status-grid">
          {recentTasks.map((item) => (
            <div key={item.id} className="admin-status-group" style={{padding: '1rem'}}>
              <strong>{item.title}</strong>
              <small style={{display: 'block', marginTop: '0.5rem'}}>{item.project_name}</small>
              <small style={{display: 'block'}}>{item.assignee_name ?? 'Sin asignación'}</small>
              <span style={{display: 'inline-block', marginTop: '0.75rem'}}>{statusStyles[item.status] ?? item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
