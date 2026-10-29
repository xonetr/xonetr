const columns = [
  {
    id: 'backlog',
    label: 'Backlog',
    tasks: [
      {title: 'Definir CTA de pricing', owner: 'Ana', priority: 'Alta'},
      {title: 'Preparar contenido de SEO', owner: 'Pablo', priority: 'Media'},
    ],
  },
  {
    id: 'doing',
    label: 'En curso',
    tasks: [
      {title: 'Diseño hero de campaña', owner: 'Luz', priority: 'Alta'},
      {title: 'Integración con CRM', owner: 'Mateo', priority: 'Alta'},
    ],
  },
  {
    id: 'review',
    label: 'Revisión',
    tasks: [{title: 'QA mobile', owner: 'Nico', priority: 'Media'}],
  },
  {
    id: 'done',
    label: 'Hecho',
    tasks: [{title: 'Actualizar favicon', owner: 'Sofía', priority: 'Baja'}],
  },
];

export function ProjectBoardPage() {
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
          {columns.map((column) => (
            <div key={column.id} className="admin-status-group" style={{padding: '1rem'}}>
              <h3>{column.label}</h3>
              <div style={{display: 'grid', gap: '0.75rem', marginTop: '1rem'}}>
                {column.tasks.map((task) => (
                  <div key={`${column.id}-${task.title}`} style={{padding: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}}>
                    <strong style={{display: 'block'}}>{task.title}</strong>
                    <small style={{display: 'block', marginTop: '0.35rem'}}>{task.owner}</small>
                    <small style={{display: 'block', marginTop: '0.2rem'}}>Prioridad: {task.priority}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
