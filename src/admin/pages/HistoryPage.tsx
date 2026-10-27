import {useEffect,useState} from "react";
import {contentRepository,type VersionInfo} from "../../data";
import {useAdminContent} from "../AdminContentContext";
import {ConfirmDialog} from "../components/ConfirmDialog";
import {Toast} from "../components/Toast";
import {storeFullPreview} from "./PreviewPage";

const dateFormatter=new Intl.DateTimeFormat("es-PY",{dateStyle:"medium",timeStyle:"short"});

export function HistoryPage(){
  const {reload}=useAdminContent();const [items,setItems]=useState<VersionInfo[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [selected,setSelected]=useState<VersionInfo|null>(null);const [toast,setToast]=useState("");
  const load=async()=>{setLoading(true);setError("");try{setItems(await contentRepository.listVersions())}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo cargar el historial.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(""),3200);return()=>window.clearTimeout(timer)},[toast]);
  const view=async(id:string)=>{try{const version=await contentRepository.getVersion(id);storeFullPreview(version);window.open("/admin/preview?full=1","_blank","noopener,noreferrer")}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo abrir la versión.")}};
  const restore=async()=>{if(!selected)return;try{await contentRepository.restoreVersion(selected.id);await reload();setSelected(null);setToast("Versión restaurada como borrador. Revísala antes de publicar.")}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo restaurar la versión.")}};
  if(loading)return <div className="admin-skeleton-grid" aria-label="Cargando historial"><i/><i/><i/></div>;
  if(error&&!items.length)return <div className="admin-state admin-state--error"><span aria-hidden="true">!</span><h2>No pudimos cargar el historial</h2><p>{error}</p><button className="admin-button admin-button--secondary" onClick={()=>void load()}>Reintentar</button></div>;
  return <div className="admin-tool-page"><header className="admin-tool-heading"><div><p className="admin-kicker">// VERSIONES</p><h2>Historial de publicaciones</h2><p>El modo local conserva las últimas diez publicaciones de este navegador.</p></div></header>{error&&<div className="admin-inline-error" role="alert">{error}</div>}{items.length?<div className="admin-history-list">{items.map((item,index)=><article key={item.id}><div className="admin-history-index">{String(items.length-index).padStart(2,"0")}</div><div><strong>{item.summary}</strong><span>{dateFormatter.format(new Date(item.createdAt))} · {item.author}</span></div><div className="admin-history-actions"><button className="admin-button admin-button--ghost" type="button" onClick={()=>void view(item.id)}>Ver ↗</button><button className="admin-button admin-button--secondary" type="button" onClick={()=>setSelected(item)}>Restaurar</button></div></article>)}</div>:<div className="admin-state admin-state--empty"><span aria-hidden="true">↺</span><h2>Aún no hay versiones</h2><p>La primera versión aparecerá aquí cuando publiques contenido desde el panel.</p></div>}<ConfirmDialog open={!!selected} title="Restaurar esta versión" description="Se copiará al borrador actual. Nada se publicará hasta que revises el contenido y pulses Publicar." confirmLabel="Restaurar borrador" onClose={()=>setSelected(null)} onConfirm={restore}/><Toast message={toast}/></div>;
}
