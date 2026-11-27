import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {useEffect,useRef,useState,type FormEvent,type KeyboardEvent,type PointerEvent as ReactPointerEvent} from "react";
import {ConfirmDialog} from "../components/ConfirmDialog";

type ColumnId="backlog"|"in_progress"|"review"|"done";
type Priority="Baja"|"Media"|"Alta";
type Task={id:string;title:string;assignee:string;priority:Priority;column:ColumnId;color:string};

const STORAGE_KEY="xonetr.admin.project-activity.tasks";
type AnalyticsSummary={total_visits:number;unique_visitors:number;active_projects:number;open_tasks:number;visits_by_day:Array<{day:string;total:number}>;visit_change_percent:number;published_changes_month:number;published_changes_week:number;last_published_at:string|null};
const columns:Array<{id:ColumnId;label:string}>=[
  {id:"backlog",label:"Backlog"},
  {id:"in_progress",label:"En curso"},
  {id:"review",label:"Revisión"},
  {id:"done",label:"Hecho"},
];
const assigneeColors=["#6E73DC","#2F8F83","#A066C8","#C27652","#587FB5","#8B6A36"];
const sampleTasks:Task[]=[
  {id:"sample-1",title:"Definir estructura del nuevo caso de estudio",assignee:"Lucía Medina",priority:"Alta",column:"backlog",color:assigneeColors[2]},
  {id:"sample-2",title:"Revisar textos de la página de servicios",assignee:"Martín Ríos",priority:"Media",column:"backlog",color:assigneeColors[4]},
  {id:"sample-3",title:"Optimizar imágenes del encabezado",assignee:"Ana Díaz",priority:"Alta",column:"in_progress",color:assigneeColors[0]},
  {id:"sample-4",title:"Preparar métricas para la reunión semanal",assignee:"Julián Vera",priority:"Baja",column:"in_progress",color:assigneeColors[1]},
  {id:"sample-5",title:"Validar versión móvil del contacto",assignee:"Sofía Ortiz",priority:"Media",column:"review",color:assigneeColors[3]},
  {id:"sample-6",title:"Actualizar enlaces del pie de página",assignee:"Diego León",priority:"Baja",column:"done",color:assigneeColors[5]},
];

function readTasks(){
  try{
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)??"null");
    if(Array.isArray(stored)&&stored.every(item=>item&&typeof item.id==="string"&&typeof item.title==="string"&&columns.some(column=>column.id===item.column)))return stored as Task[];
  }catch{}
  return sampleTasks;
}

function initials(name:string){return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"?"}

function TrendChart({id,line,area,label,ticks,formatValue}:{id:string;line:string;area:string;label:string;ticks:string[];formatValue:(ratio:number)=>string}){
  const lineRef=useRef<SVGPathElement>(null);const [hoverPoint,setHoverPoint]=useState<{x:number;y:number;value:string}|null>(null);
  const followCurve=(event:ReactPointerEvent<SVGSVGElement>)=>{
    const path=lineRef.current;if(!path)return;
    const bounds=event.currentTarget.getBoundingClientRect();const targetX=Math.max(4,Math.min(156,((event.clientX-bounds.left)/bounds.width)*160));
    const length=path.getTotalLength();let nearest=path.getPointAtLength(0);let distance=Number.POSITIVE_INFINITY;
    for(let index=0;index<=120;index++){const point=path.getPointAtLength((index/120)*length);const delta=Math.abs(point.x-targetX);if(delta<distance){distance=delta;nearest=point}}
    const ratio=Math.max(0,Math.min(1,(68-nearest.y)/60));setHoverPoint({x:nearest.x,y:nearest.y,value:formatValue(ratio)});
  };
  return <div className="project-metric__chart">
    <svg viewBox="0 0 160 78" role="img" aria-label={`${label}. Pasa el cursor para explorar los valores.`} preserveAspectRatio="none" onPointerEnter={followCurve} onPointerMove={followCurve} onPointerLeave={()=>setHoverPoint(null)}>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".3"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
      <path className="project-metric__area" d={area} fill={`url(#${id}-fill)`}/>
      <path ref={lineRef} className="project-metric__line" d={line} vectorEffect="non-scaling-stroke"/>
      {hoverPoint&&<g className="project-metric__point" transform={`translate(${hoverPoint.x} ${hoverPoint.y})`}><line y1="5" y2={72-hoverPoint.y}/><circle r="3.2"/></g>}
    </svg>
    {hoverPoint&&<span className="project-metric__tooltip" style={{left:`${Math.max(10,Math.min(90,(hoverPoint.x/160)*100))}%`,top:`${(hoverPoint.y/78)*100}%`}}>{hoverPoint.value}</span>}
    <span className="project-metric__ticks" aria-hidden="true">{ticks.map(tick=><i key={tick}>{tick}</i>)}</span>
  </div>;
}

function TaskCard({task,onMove,onEdit}:{task:Task;onMove:(taskId:string,direction:-1|1)=>void;onEdit:(task:Task)=>void}){
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:task.id,data:{column:task.column}});
  const style=transform?{transform:`translate3d(${transform.x}px, ${transform.y}px, 0)`}:undefined;
  const onKeyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
    event.preventDefault();event.stopPropagation();onMove(task.id,event.key==="ArrowLeft"?-1:1);
  };
  return <button ref={setNodeRef} type="button" className={`project-task ${isDragging?"is-dragging":""}`} style={style} {...listeners} {...attributes} onKeyDown={onKeyDown} onClick={()=>{if(!isDragging)onEdit(task)}} aria-label={`${task.title}. Responsable: ${task.assignee}. Prioridad ${task.priority}. Pulsa para editarla; usa flecha izquierda o derecha para moverla de columna.`}>
    <strong>{task.title}</strong>
    <span className="project-task__meta"><span className="project-task__person"><i style={{background:task.color}} aria-hidden="true">{initials(task.assignee)}</i><span>{task.assignee}</span></span><span className={`project-priority is-${task.priority.toLowerCase()}`}>{task.priority}</span></span>
  </button>;
}

function KanbanColumn({column,tasks,onMove,onEdit}:{column:{id:ColumnId;label:string};tasks:Task[];onMove:(taskId:string,direction:-1|1)=>void;onEdit:(task:Task)=>void}){
  const {setNodeRef,isOver}=useDroppable({id:column.id});
  return <section ref={setNodeRef} className={`project-column ${isOver?"is-over":""}`} aria-labelledby={`column-${column.id}`}>
    <header><h3 id={`column-${column.id}`}>{column.label}</h3><span aria-label={`${tasks.length} tareas`}>{tasks.length}</span></header>
    <div className="project-column__tasks">{tasks.map(task=><TaskCard key={task.id} task={task} onMove={onMove} onEdit={onEdit}/>)}{tasks.length===0&&<p className="project-column__empty">Arrastra una tarea aquí</p>}</div>
  </section>;
}

function TaskDialog({open,task,onClose,onSave,onRequestDelete}:{open:boolean;task:Task|null;onClose:()=>void;onSave:(task:Omit<Task,"id"|"color">)=>void;onRequestDelete:(task:Task)=>void}){
  const firstInput=useRef<HTMLInputElement>(null);
  const [title,setTitle]=useState("");const [assignee,setAssignee]=useState("");const [priority,setPriority]=useState<Priority>("Media");const [column,setColumn]=useState<ColumnId>("backlog");
  useEffect(()=>{if(!open)return;setTitle(task?.title??"");setAssignee(task?.assignee??"");setPriority(task?.priority??"Media");setColumn(task?.column??"backlog");requestAnimationFrame(()=>firstInput.current?.focus())},[open,task]);
  useEffect(()=>{if(!open)return;const close=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[open,onClose]);
  if(!open)return null;
  const submit=(event:FormEvent)=>{event.preventDefault();if(!title.trim()||!assignee.trim())return;onSave({title:title.trim(),assignee:assignee.trim(),priority,column});onClose()};
  const titleId=task?"edit-task-title":"new-task-title";
  return <div className="project-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><header><div><p className="admin-kicker">{task?"// EDITAR TAREA":"// NUEVA TAREA"}</p><h2 id={titleId}>{task?"Editar tarea":"Agregar tarea"}</h2></div><button type="button" className="project-dialog__close" onClick={onClose} aria-label="Cerrar formulario">×</button></header><form onSubmit={submit}>
    <label>Título<input ref={firstInput} value={title} onChange={event=>setTitle(event.target.value)} required maxLength={100}/></label>
    <label>Responsable<input value={assignee} onChange={event=>setAssignee(event.target.value)} required maxLength={60}/></label>
    <label>Prioridad<select value={priority} onChange={event=>setPriority(event.target.value as Priority)}><option>Baja</option><option>Media</option><option>Alta</option></select></label>
    <label>Columna<select value={column} onChange={event=>setColumn(event.target.value as ColumnId)}>{columns.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <footer className={task?"has-delete":""}>{task&&<button type="button" className="admin-button admin-button--danger project-dialog__delete" onClick={()=>onRequestDelete(task)}>Eliminar</button>}<button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancelar</button><button type="submit" className="admin-button admin-button--primary">{task?"Guardar cambios":"Agregar tarea"}</button></footer>
  </form></section></div>;
}

export function ProjectActivityPage(){
  const [tasks,setTasks]=useState<Task[]>(readTasks);const [dialogOpen,setDialogOpen]=useState(false);const [editingTask,setEditingTask]=useState<Task|null>(null);const [deleteCandidate,setDeleteCandidate]=useState<Task|null>(null);const [announcement,setAnnouncement]=useState("");
  const [analytics,setAnalytics]=useState<AnalyticsSummary|null>(null);
  const [analyticsError,setAnalyticsError]=useState("");
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor));
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks))}catch{}},[tasks]);
  useEffect(()=>{
    fetch("/api/analytics/summary?range_days=7",{credentials:"include"})
      .then(async response=>{if(!response.ok)throw new Error("No se pudieron cargar las estadísticas.");return response.json()})
      .then((data:AnalyticsSummary)=>setAnalytics(data))
      .catch(error=>setAnalyticsError(error instanceof Error?error.message:"No se pudieron cargar las estadísticas."));
  },[]);
  const moveToColumn=(taskId:string,column:ColumnId)=>setTasks(current=>current.map(task=>task.id===taskId?{...task,column}:task));
  const moveWithArrow=(taskId:string,direction:-1|1)=>setTasks(current=>current.map(task=>{if(task.id!==taskId)return task;const currentIndex=columns.findIndex(column=>column.id===task.column);const next=columns[Math.max(0,Math.min(columns.length-1,currentIndex+direction))];if(next.id!==task.column)setAnnouncement(`${task.title} movida a ${next.label}`);return{...task,column:next.id}}));
  const onDragEnd=({active,over}:DragEndEvent)=>{if(!over||!columns.some(column=>column.id===over.id))return;const destination=over.id as ColumnId;const task=tasks.find(item=>item.id===active.id);if(task&&task.column!==destination){moveToColumn(String(active.id),destination);setAnnouncement(`${task.title} movida a ${columns.find(column=>column.id===destination)?.label}`)}};
  const openNewTask=()=>{setEditingTask(null);setDialogOpen(true)};
  const openEditTask=(task:Task)=>{setEditingTask(task);setDialogOpen(true)};
  const saveTask=(draft:Omit<Task,"id"|"color">)=>setTasks(current=>{
    if(editingTask){setAnnouncement(`${draft.title} actualizada`);return current.map(task=>task.id===editingTask.id?{...task,...draft}:task)}
    setAnnouncement(`${draft.title} agregada`);return [...current,{...draft,id:`task-${Date.now()}`,color:assigneeColors[current.length%assigneeColors.length]}];
  });
  const requestDelete=(task:Task)=>{setDialogOpen(false);setDeleteCandidate(task)};
  const deleteTask=()=>{if(!deleteCandidate)return;setTasks(current=>current.filter(task=>task.id!==deleteCandidate.id));setAnnouncement(`${deleteCandidate.title} eliminada`);setDeleteCandidate(null);setEditingTask(null)};
  return <div className="project-activity">
    <header className="project-activity__header"><div><p className="admin-kicker">// OPERACIONES</p><h2>Actividad del proyecto</h2><p>Una vista simple del ritmo del sitio y las tareas del equipo.</p></div><button type="button" className="admin-button admin-button--primary" onClick={openNewTask}>Agregar tarea</button></header>
    {analyticsError&&<aside className="project-sample-note">{analyticsError}</aside>}
    <section className="project-metrics" aria-label="Métricas reales">
      <article><div><p>Visitas al sitio <span>(7 días)</span></p><strong>{analytics?.total_visits.toLocaleString("es")??"—"}</strong><small>{analytics ? `${analytics.visit_change_percent>=0?"+" : ""}${analytics.visit_change_percent}% vs. semana anterior` : "Cargando estadísticas…"}</small></div><TrendChart id="visits" line="M4 62 C14 55 22 45 33 48 S48 67 60 57 S74 35 86 39 S100 48 111 30 S129 19 140 24 S151 17 156 12" area="M4 62 C14 55 22 45 33 48 S48 67 60 57 S74 35 86 39 S100 48 111 30 S129 19 140 24 S151 17 156 12 L156 72 L4 72 Z" label="Visitas registradas durante los últimos siete días" formatValue={ratio=>String(Math.round(ratio*(analytics?.total_visits??0)))} ticks={["Lun","Mié","Vie","Dom"]}/></article>
      <article><div><p>Cambios publicados <span>este mes</span></p><strong>{analytics?.published_changes_month??"—"}</strong><small>{analytics?.published_changes_week??0} durante esta semana · {analytics?.open_tasks??0} tareas abiertas</small></div><TrendChart id="changes" line="M4 64 C16 64 22 59 32 59 S48 51 58 53 S72 42 82 43 S96 31 106 33 S121 25 131 26 S145 16 156 17" area="M4 64 C16 64 22 59 32 59 S48 51 58 53 S72 42 82 43 S96 31 106 33 S121 25 131 26 S145 16 156 17 L156 72 L4 72 Z" label="Cambios publicados durante el mes" formatValue={ratio=>String(Math.round(ratio*(analytics?.published_changes_month??0)))} ticks={["1","10","20","30"]}/></article>
      <article><div><p>Tiempo desde la última publicación</p><strong>{analytics?.last_published_at ? `${Math.max(0,Math.floor((Date.now()-new Date(analytics.last_published_at).getTime())/3600000))} h` : "Sin publicaciones"}</strong><small>{analytics?.last_published_at ? new Date(analytics.last_published_at).toLocaleString("es") : "Todavía no hay cambios registrados"}</small></div><TrendChart id="publish-time" line="M4 25 C14 25 21 31 31 29 S47 20 58 31 S73 48 84 43 S99 34 109 44 S124 59 135 53 S149 43 156 49" area="M4 25 C14 25 21 31 31 29 S47 20 58 31 S73 48 84 43 S99 34 109 44 S124 59 135 53 S149 43 156 49 L156 72 L4 72 Z" label="Tiempo desde la última publicación" formatValue={ratio=>`${(ratio*24).toFixed(1)}h`} ticks={["09h","12h","15h","Ahora"]}/></article>
    </section>
    <section className="project-board" aria-labelledby="project-board-title"><div className="project-board__heading"><div><p className="admin-kicker">// FLUJO DE TRABAJO</p><h2 id="project-board-title">Tablero del proyecto</h2></div><p>Toca una tarjeta para editarla o eliminarla. También puedes arrastrarla entre columnas.</p></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><div className="project-columns">{columns.map(column=><KanbanColumn key={column.id} column={column} tasks={tasks.filter(task=>task.column===column.id)} onMove={moveWithArrow} onEdit={openEditTask}/>)}</div></DndContext>
    </section>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <TaskDialog open={dialogOpen} task={editingTask} onClose={()=>setDialogOpen(false)} onSave={saveTask} onRequestDelete={requestDelete}/>
    <ConfirmDialog open={Boolean(deleteCandidate)} title="Eliminar tarea" description={deleteCandidate?`Se eliminará “${deleteCandidate.title}”. Esta acción no se puede deshacer.`:""} confirmLabel="Eliminar" danger onConfirm={deleteTask} onClose={()=>setDeleteCandidate(null)}/>
  </div>;
}
