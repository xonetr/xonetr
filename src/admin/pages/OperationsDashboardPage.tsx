const metrics = [
  {label: 'Visitas', value: '2.4k', trend: '+18% vs semana anterior'},
  {label: 'Proyectos activos', value: '07', trend: '3 en progreso / 4 en revisión'},
  {label: 'Tareas pendientes', value: '24', trend: '6 bloqueadas'},
  {label: 'Tiempo promedio', value: '4.3d', trend: 'mejor que el mes pasado'},
];

const pipeline = [
  {stage: 'Backlog', count: 8, tone: 'neutral'},
  {stage: 'En curso', count: 11, tone: 'warning'},
  {stage: 'Revisión', count: 4, tone: 'info'},
  {stage: 'Hecho', count: 7, tone: 'success'},
];

const activities = [
  {title: 'Landing XONETR', owner: 'Valentina', time: 'hace 2h', status: 'Revisión'},
  {title: 'Integración CRM', owner: 'Mateo', time: 'hace 4h', status: 'En curso'},
  {title: 'SEO/Analytics', owner: 'Lucía', time: 'ayer', status: 'Pendiente'},
  {title: 'QA mobile', owner: 'Nicolás', time: 'ayer', status: 'Bloqueado'},
];

export function OperationsDashboardPage() {
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
          {activities.map((item) => (
            <div key={item.title} className="admin-status-group" style={{padding: '1rem'}}>
              <strong>{item.title}</strong>
              <small style={{display: 'block', marginTop: '0.5rem'}}>{item.owner}</small>
              <small style={{display: 'block'}}>{item.time}</small>
              <span style={{display: 'inline-block', marginTop: '0.75rem'}}>{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
