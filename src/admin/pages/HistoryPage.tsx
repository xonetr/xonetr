import {useEffect,useState} from "react";
import {contentRepository,type VersionInfo} from "../../data";
import {useAdminContent} from "../AdminContentContext";
import {ConfirmDialog} from "../components/ConfirmDialog";
import {AdminIcon} from "../components/AdminIcon";
import {Toast} from "../components/Toast";
import {storeFullPreview} from "./PreviewPage";

const dateFormatter=new Intl.DateTimeFormat("es-PY",{dateStyle:"medium",timeStyle:"short"});
const initials=(value:string)=>value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"A";

function versionAuthor(item:VersionInfo){
  const legacyEmail=item.author.includes("@")?item.author:"";
  const email=item.authorEmail||legacyEmail;
  const name=item.authorName||(legacyEmail?"Administrador":item.author)||"Administrador";
  return{name,email,initials:initials(name)};
}

export function HistoryPage(){
  const {reload}=useAdminContent();const [items,setItems]=useState<VersionInfo[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [selected,setSelected]=useState<VersionInfo|null>(null);const [toast,setToast]=useState("");
  const load=async()=>{setLoading(true);setError("");try{setItems(await contentRepository.listVersions())}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo cargar el historial.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(""),3200);return()=>window.clearTimeout(timer)},[toast]);
  const view=async(id:string)=>{try{const version=await contentRepository.getVersion(id);storeFullPreview(version);window.open("/admin/preview?full=1","_blank","noopener,noreferrer")}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo abrir la versión.")}};
  const restore=async()=>{if(!selected)return;try{await contentRepository.restoreVersion(selected.id);await reload();setSelected(null);setToast("Versión restaurada como borrador. Revísala antes de publicar.")}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo restaurar la versión.")}};
  if(loading)return <div className="admin-skeleton-grid" aria-label="Cargando historial"><i/><i/><i/></div>;
  if(error&&!items.length)return <div className="admin-state admin-state--error"><span aria-hidden="true">!</span><h2>No pudimos cargar el historial</h2><p>{error}</p><button className="admin-button admin-button--secondary" onClick={()=>void load()}>Reintentar</button></div>;
  return <div className="admin-tool-page"><header className="admin-tool-heading"><div><p className="admin-kicker">// VERSIONES</p><h2>Historial de publicaciones</h2><p>El modo local conserva las últimas diez publicaciones de este navegador.</p></div></header>{error&&<div className="admin-inline-error" role="alert">{error}</div>}{items.length?<div className="admin-history-list">{items.map((item,index)=>{const current=index===0;const author=versionAuthor(item);const sections=item.changedSections??[];return <article key={item.id} className={current?"is-current":undefined}><div className="admin-history-index">{String(items.length-index).padStart(2,"0")}</div><div className="admin-history-content"><div className="admin-history-title"><strong>{item.summary}</strong>{current&&<span className="admin-history-current">Actual</span>}</div>{sections.length>3?<details className="admin-history-details"><summary>Ver secciones modificadas</summary><p>{sections.join(", ")}</p></details>:sections.length>0&&<p className="admin-history-sections">{sections.join(", ")}</p>}<div className="admin-history-meta"><time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time><span aria-hidden="true">·</span><span className="admin-history-author" title={author.email||undefined} aria-label={author.email?`${author.name}. Correo: ${author.email}`:author.name}><i aria-hidden="true">{author.initials}</i>{author.name}</span></div></div><div className="admin-history-actions"><button className="admin-button admin-button--secondary" type="button" onClick={()=>void view(item.id)}>Ver <AdminIcon name="arrow-up-right" className="admin-symbol"/></button>{!current&&<button className="admin-button admin-button--restore" type="button" onClick={()=>setSelected(item)}>Restaurar</button>}</div></article>})}</div>:<div className="admin-state admin-state--empty"><span aria-hidden="true"><AdminIcon name="rotate-ccw" className="admin-symbol"/></span><h2>Aún no hay versiones</h2><p>La primera versión aparecerá aquí cuando publiques contenido desde el panel.</p></div>}<ConfirmDialog open={!!selected} title="Restaurar esta versión" description="La versión elegida se copiará como borrador. El contenido publicado actual y todo el historial se conservarán; si luego publicas, se creará una nueva versión." confirmLabel="Restaurar como borrador" onClose={()=>setSelected(null)} onConfirm={restore}/><Toast message={toast}/></div>;
}
