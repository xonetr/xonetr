import {useEffect,useState,type FormEvent} from 'react';

type TaskItem = {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_name?: string | null;
  due_date?: string | null;
  updated_at: string;
};

type TaskNote = {
  id: string;
  content: string;
  user_name: string;
  created_at: string;
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {credentials: 'include', ...options, headers: options.headers});
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail ?? 'No se pudo completar la operación.');
  return body;
}

const columns = [
  {id: 'backlog', label: 'Backlog'},
  {id: 'todo', label: 'Por hacer'},
  {id: 'in_progress', label: 'En curso'},
  {id: 'review', label: 'Revisión'},
  {id: 'done', label: 'Hecho'},
  {id: 'blocked', label: 'Bloqueado'},
];

const statusLabels: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  in_progress: 'En curso',
  review: 'Revisión',
  done: 'Hecho',
  blocked: 'Bloqueado',
};

const priorityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

export function ProjectBoardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBoard = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/tasks');
      setTasks(result ?? []);
      if (result && result.length > 0 && !selectedTaskId) {
        setSelectedTaskId(result[0].id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el tablero.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBoard();
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      setNotes([]);
      setDraft('');
      return;
    }

    const loadNotes = async () => {
      try {
        const result = await api(`/api/tasks/${selectedTaskId}/notes`);
        setNotes(result ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las notas.');
      }
    };

    void loadNotes();
  }, [selectedTaskId]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const addNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTaskId || !draft.trim()) return;
    try {
      await api(`/api/tasks/${selectedTaskId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({content: draft.trim()}),
      });
      setDraft('');
      const result = await api(`/api/tasks/${selectedTaskId}/notes`);
      setNotes(result ?? []);
      await loadBoard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la nota.');
    }
  };

  if (loading) {
    return <div className="admin-skeleton-grid" aria-label="Cargando tablero"><i/><i/><i/></div>;
  }

  if (error) {
    return <div className="admin-state admin-state--error"><span aria-hidden="true">!</span><h2>No se pudo cargar el tablero</h2><p>{error}</p></div>;
  }

  return (
    <div className="admin-dashboard">
      <section className="admin-section-status">
        <div className="admin-panel-card__heading">
          <div>
            <p className="admin-kicker">// TABLERO</p>
            <h2>Proyecto activo</h2>
          </div>
        </div>

        <div className="admin-status-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'}}>
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.id);
            return (
              <div key={column.id} className="admin-status-group" style={{padding: '1rem'}}>
                <h3>{column.label} <span style={{color: '#8a8aa3'}}>{columnTasks.length}</span></h3>
                <div style={{display: 'grid', gap: '0.75rem', marginTop: '1rem'}}>
                  {columnTasks.length === 0 ? (
                    <div style={{padding: '0.7rem', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', color: '#7c7c8d'}}>Sin tareas</div>
                  ) : columnTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      style={{padding: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', background: selectedTaskId === task.id ? 'rgba(122, 126, 255, 0.08)' : '#0c0d16', color: '#f5f5ff', textAlign: 'left', cursor: 'pointer'}}
                    >
                      <strong style={{display: 'block'}}>{task.title}</strong>
                      <small style={{display: 'block', marginTop: '0.35rem'}}>{task.project_name}</small>
                      <small style={{display: 'block', marginTop: '0.2rem'}}>{task.assignee_name ?? 'Sin asignación'} · {priorityLabels[task.priority] ?? task.priority}</small>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {selectedTask && (
        <section className="admin-panel-card">
          <div className="admin-panel-card__heading">
            <div>
              <p className="admin-kicker">// DETALLE</p>
              <h2>{selectedTask.title}</h2>
            </div>
          </div>

          <div style={{display: 'grid', gap: '1rem'}}>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.75rem'}}>
              <span className="admin-status-pill" style={{padding: '0.45rem 0.7rem'}}>{statusLabels[selectedTask.status] ?? selectedTask.status}</span>
              <span className="admin-status-pill" style={{padding: '0.45rem 0.7rem'}}>{priorityLabels[selectedTask.priority] ?? selectedTask.priority}</span>
              <span className="admin-status-pill" style={{padding: '0.45rem 0.7rem'}}>{selectedTask.assignee_name ?? 'Sin asignación'}</span>
            </div>

            <p style={{margin: 0, color: '#9ca0b4', lineHeight: 1.6}}>{selectedTask.description || 'Sin descripción adicional.'}</p>

            <div style={{padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', background: '#10131c'}}>
              <h3 style={{margin: '0 0 0.75rem'}}>Notas</h3>
              {notes.length === 0 ? (
                <p style={{margin: 0, color: '#8d91a8'}}>Todavía no hay notas para esta tarea.</p>
              ) : (
                <div style={{display: 'grid', gap: '0.75rem'}}>
                  {notes.map((note) => (
                    <div key={note.id} style={{padding: '0.8rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px'}}>
                      <strong style={{display: 'block', marginBottom: '0.35rem'}}>{note.user_name}</strong>
                      <small style={{display: 'block', marginBottom: '0.5rem', color: '#8c8fa4'}}>{new Date(note.created_at).toLocaleString('es-AR')}</small>
                      <p style={{margin: 0, color: '#dfe4ff', lineHeight: 1.5}}>{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={addNote} style={{display: 'grid', gap: '0.75rem'}}>
              <label className="admin-field__heading" htmlFor="board-note">Añadir nota</label>
              <textarea
                id="board-note"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                placeholder="Escribe una actualización del proyecto..."
                style={{width: '100%', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#090b12', color: '#f5f5ff'}}
              />
              <button className="admin-button admin-button--primary" type="submit" style={{justifySelf: 'start'}}>Guardar nota</button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
