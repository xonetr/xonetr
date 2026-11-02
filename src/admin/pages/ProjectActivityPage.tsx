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

type ColumnId="backlog"|"in_progress"|"review"|"done";
type Priority="Baja"|"Media"|"Alta";
type Task={id:string;title:string;assignee:string;priority:Priority;column:ColumnId;color:string};

const STORAGE_KEY="xonetr.admin.project-activity.tasks";
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

function TaskCard({task,onMove}:{task:Task;onMove:(taskId:string,direction:-1|1)=>void}){
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:task.id,data:{column:task.column}});
  const style=transform?{transform:`translate3d(${transform.x}px, ${transform.y}px, 0)`}:undefined;
  const onKeyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
    event.preventDefault();event.stopPropagation();onMove(task.id,event.key==="ArrowLeft"?-1:1);
  };
  return <button ref={setNodeRef} type="button" className={`project-task ${isDragging?"is-dragging":""}`} style={style} {...listeners} {...attributes} onKeyDown={onKeyDown} aria-label={`${task.title}. Responsable: ${task.assignee}. Prioridad ${task.priority}. Usa flecha izquierda o derecha para moverla de columna.`}>
    <strong>{task.title}</strong>
    <span className="project-task__meta"><span className="project-task__person"><i style={{background:task.color}} aria-hidden="true">{initials(task.assignee)}</i><span>{task.assignee}</span></span><span className={`project-priority is-${task.priority.toLowerCase()}`}>{task.priority}</span></span>
  </button>;
}

function KanbanColumn({column,tasks,onMove}:{column:{id:ColumnId;label:string};tasks:Task[];onMove:(taskId:string,direction:-1|1)=>void}){
  const {setNodeRef,isOver}=useDroppable({id:column.id});
  return <section ref={setNodeRef} className={`project-column ${isOver?"is-over":""}`} aria-labelledby={`column-${column.id}`}>
    <header><h3 id={`column-${column.id}`}>{column.label}</h3><span aria-label={`${tasks.length} tareas`}>{tasks.length}</span></header>
    <div className="project-column__tasks">{tasks.map(task=><TaskCard key={task.id} task={task} onMove={onMove}/>)}{tasks.length===0&&<p className="project-column__empty">Arrastra una tarea aquí</p>}</div>
  </section>;
}

function AddTaskDialog({open,onClose,onAdd}:{open:boolean;onClose:()=>void;onAdd:(task:Omit<Task,"id"|"color">)=>void}){
  const firstInput=useRef<HTMLInputElement>(null);
  const [title,setTitle]=useState("");const [assignee,setAssignee]=useState("");const [priority,setPriority]=useState<Priority>("Media");const [column,setColumn]=useState<ColumnId>("backlog");
  useEffect(()=>{if(!open)return;firstInput.current?.focus();const close=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[open,onClose]);
  if(!open)return null;
  const submit=(event:FormEvent)=>{event.preventDefault();if(!title.trim()||!assignee.trim())return;onAdd({title:title.trim(),assignee:assignee.trim(),priority,column});setTitle("");setAssignee("");setPriority("Media");setColumn("backlog");onClose()};
  return <div className="project-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-task-title"><header><div><p className="admin-kicker">// NUEVA TAREA</p><h2 id="new-task-title">Agregar tarea</h2></div><button type="button" className="project-dialog__close" onClick={onClose} aria-label="Cerrar formulario">×</button></header><form onSubmit={submit}>
    <label>Título<input ref={firstInput} value={title} onChange={event=>setTitle(event.target.value)} required maxLength={100}/></label>
    <label>Responsable<input value={assignee} onChange={event=>setAssignee(event.target.value)} required maxLength={60}/></label>
    <label>Prioridad<select value={priority} onChange={event=>setPriority(event.target.value as Priority)}><option>Baja</option><option>Media</option><option>Alta</option></select></label>
    <label>Columna<select value={column} onChange={event=>setColumn(event.target.value as ColumnId)}>{columns.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <footer><button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancelar</button><button type="submit" className="admin-button admin-button--primary">Agregar tarea</button></footer>
  </form></section></div>;
}

export function ProjectActivityPage(){
  const [tasks,setTasks]=useState<Task[]>(readTasks);const [dialogOpen,setDialogOpen]=useState(false);const [announcement,setAnnouncement]=useState("");
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor));
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks))}catch{}},[tasks]);
  const moveToColumn=(taskId:string,column:ColumnId)=>setTasks(current=>current.map(task=>task.id===taskId?{...task,column}:task));
  const moveWithArrow=(taskId:string,direction:-1|1)=>setTasks(current=>current.map(task=>{if(task.id!==taskId)return task;const currentIndex=columns.findIndex(column=>column.id===task.column);const next=columns[Math.max(0,Math.min(columns.length-1,currentIndex+direction))];if(next.id!==task.column)setAnnouncement(`${task.title} movida a ${next.label}`);return{...task,column:next.id}}));
  const onDragEnd=({active,over}:DragEndEvent)=>{if(!over||!columns.some(column=>column.id===over.id))return;const destination=over.id as ColumnId;const task=tasks.find(item=>item.id===active.id);if(task&&task.column!==destination){moveToColumn(String(active.id),destination);setAnnouncement(`${task.title} movida a ${columns.find(column=>column.id===destination)?.label}`)}};
  const addTask=(task:Omit<Task,"id"|"color">)=>setTasks(current=>[...current,{...task,id:`task-${Date.now()}`,color:assigneeColors[current.length%assigneeColors.length]}]);
  return <div className="project-activity">
    <header className="project-activity__header"><div><p className="admin-kicker">// OPERACIONES</p><h2>Actividad del proyecto</h2><p>Una vista simple del ritmo del sitio y las tareas del equipo.</p></div><button type="button" className="admin-button admin-button--primary" onClick={()=>setDialogOpen(true)}>Agregar tarea</button></header>
    <aside className="project-sample-note"><strong>Datos de ejemplo.</strong> Se conectará a datos reales cuando el equipo defina el backend.</aside>
    <section className="project-metrics" aria-label="Métricas de ejemplo">
      <article><div><p>Visitas al sitio <span>(7 días)</span></p><strong>1.284</strong><small>+12% vs. semana anterior</small></div><TrendChart id="visits" line="M4 62 C14 55 22 45 33 48 S48 67 60 57 S74 35 86 39 S100 48 111 30 S129 19 140 24 S151 17 156 12" area="M4 62 C14 55 22 45 33 48 S48 67 60 57 S74 35 86 39 S100 48 111 30 S129 19 140 24 S151 17 156 12 L156 72 L4 72 Z" label="Gráfica de visitas de lunes a domingo, con tendencia general ascendente" formatValue={ratio=>String(Math.round(120+ratio*140))} ticks={["Lun","Mié","Vie","Dom"]}/></article>
      <article><div><p>Cambios publicados <span>este mes</span></p><strong>18</strong><small>5 durante esta semana</small></div><TrendChart id="changes" line="M4 64 C16 64 22 59 32 59 S48 51 58 53 S72 42 82 43 S96 31 106 33 S121 25 131 26 S145 16 156 17" area="M4 64 C16 64 22 59 32 59 S48 51 58 53 S72 42 82 43 S96 31 106 33 S121 25 131 26 S145 16 156 17 L156 72 L4 72 Z" label="Gráfica acumulada de publicaciones durante el mes" formatValue={ratio=>String(Math.round(ratio*18))} ticks={["1","10","20","30"]}/></article>
      <article><div><p>Tiempo desde la última publicación</p><strong>2 h 14 min</strong><small>Hoy, 10:32</small></div><TrendChart id="publish-time" line="M4 25 C14 25 21 31 31 29 S47 20 58 31 S73 48 84 43 S99 34 109 44 S124 59 135 53 S149 43 156 49" area="M4 25 C14 25 21 31 31 29 S47 20 58 31 S73 48 84 43 S99 34 109 44 S124 59 135 53 S149 43 156 49 L156 72 L4 72 Z" label="Gráfica de tiempo entre publicaciones durante el día" formatValue={ratio=>`${(0.5+ratio*3.5).toFixed(1)}h`} ticks={["09h","12h","15h","Ahora"]}/></article>
    </section>
    <section className="project-board" aria-labelledby="project-board-title"><div className="project-board__heading"><div><p className="admin-kicker">// FLUJO DE TRABAJO</p><h2 id="project-board-title">Tablero del proyecto</h2></div><p>Arrastra las tarjetas o usa ← y → cuando tengan el foco.</p></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><div className="project-columns">{columns.map(column=><KanbanColumn key={column.id} column={column} tasks={tasks.filter(task=>task.column===column.id)} onMove={moveWithArrow}/>)}</div></DndContext>
    </section>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <AddTaskDialog open={dialogOpen} onClose={()=>setDialogOpen(false)} onAdd={addTask}/>
  </div>;
}
