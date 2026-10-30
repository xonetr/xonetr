import {useEffect,useState,type FormEvent} from "react";
import {ConfirmDialog} from "../components/ConfirmDialog";
import {Toast} from "../components/Toast";

type Authorization={id:string;project:string;subject:string;scopes:string[];issuedAt:string;expiresAt:string;revokedAt?:string;revokedBy?:string;status:string};

async function api(path:string,options:RequestInit={}){
  const response=await fetch(path,{credentials:"include",...options,headers:options.headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(body?.detail??"No se pudo completar la operación.");
  return body;
}

export function AuthorizationsPage(){
  const [items,setItems]=useState<Authorization[]>([]);
  const [project,setProject]=useState("");
  const [subject,setSubject]=useState("");
  const [scopes,setScopes]=useState("");
  const [expiresAt,setExpiresAt]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [token,setToken]=useState("");
  const [selected,setSelected]=useState<Authorization|null>(null);
  const [toast,setToast]=useState("");
  const load=async()=>{setLoading(true);setError("");try{setItems(await api("/api/authorizations"))}catch(cause){setError(cause instanceof Error?cause.message:"No se pudieron cargar las autorizaciones.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const issue=async(event:FormEvent)=>{event.preventDefault();
    setError("");setToken("");
    try{const result=await api("/api/authorizations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({project:project.trim(),subject:subject.trim(),scopes:scopes.split(",").map(value=>value.trim()).filter(Boolean),expires_at:expiresAt})});setToken(result.token);setToast("Autorización firmada emitida.");setProject("");setSubject("");setScopes("");setExpiresAt("");await load()}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo emitir la autorización.")}};
  const revoke=async()=>{if(!selected)return;try{await api(`/api/authorizations/${encodeURIComponent(selected.id)}/revoke`,{method:"POST"});setSelected(null);setToast("Autorización revocada.");await load()}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo revocar la autorización.")}};
  const copy=async()=>{try{await navigator.clipboard.writeText(token);setToast("Token copiado.")}catch{setError("No se pudo copiar el token.")}};
  const activeCount=items.filter(item=>item.status==="active").length;
  const formatDate=(value:string)=>new Intl.DateTimeFormat("es-PY",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
  return <div className="admin-page authorizations-page">
    <header className="authorizations-header">
      <div><p className="admin-kicker">// FIRMAS DIGITALES</p><h2>Autorizaciones</h2><p>Emite credenciales firmadas y controla quién puede acceder a cada proyecto.</p></div>
      <div className="authorizations-header__metric"><strong>{activeCount}</strong><span>activas</span></div>
    </header>
    <section className="admin-panel-card authorization-issue-card">
      <div className="admin-panel-card__heading"><div><span className="authorization-card-icon" aria-hidden="true">+</span><div><p className="admin-kicker">// NUEVA AUTORIZACIÓN</p><h2>Emitir firma</h2></div></div></div>
      <form className="authorization-form" onSubmit={issue}>
        <div className="admin-field authorization-field authorization-field--project"><div className="admin-field__heading"><label htmlFor="authorization-project">Proyecto</label></div><input id="authorization-project" value={project} onChange={event=>setProject(event.target.value)} placeholder="Nombre o identificador del proyecto" required/></div>
        <div className="admin-field authorization-field authorization-field--subject"><div className="admin-field__heading"><label htmlFor="authorization-subject">Sujeto / cliente</label></div><input id="authorization-subject" value={subject} onChange={event=>setSubject(event.target.value)} placeholder="Nombre, email o ID" required/></div>
        <div className="admin-field authorization-field authorization-field--scopes"><div className="admin-field__heading"><label htmlFor="authorization-scopes">Permisos</label></div><input id="authorization-scopes" value={scopes} onChange={event=>setScopes(event.target.value)} placeholder="api:read, software:deploy"/><p className="admin-field__help">Separados por comas.</p></div>
        <div className="admin-field authorization-field authorization-field--expires"><div className="admin-field__heading"><label htmlFor="authorization-expires">Fecha de vencimiento</label></div><input id="authorization-expires" type="datetime-local" value={expiresAt} onChange={event=>setExpiresAt(event.target.value)} required/></div>
        <button className="admin-button admin-button--primary authorization-submit" type="submit">Emitir autorización</button>
      </form>
      {token&&<div className="authorization-token"><div><div><strong>Firma emitida correctamente</strong><span>Entregá este token únicamente al sujeto autorizado.</span></div><button className="admin-button admin-button--secondary" type="button" onClick={()=>void copy()}>Copiar token</button></div><textarea readOnly value={token} rows={4}/></div>}
      {error&&<p className="authorization-error" role="alert">{error}</p>}
    </section>
    <section className="admin-panel-card authorization-register">
      <div className="admin-panel-card__heading"><div><p className="admin-kicker">// REGISTRO</p><h2>Autorizaciones emitidas</h2></div><span className="authorization-total">{items.length} {items.length===1?"registro":"registros"}</span></div>
      {loading?<div className="authorization-loading">Cargando autorizaciones…</div>:items.length===0?<div className="admin-empty"><strong>Sin autorizaciones todavía</strong><p>Las firmas emitidas aparecerán en este registro.</p></div>:<div className="authorization-table-wrap"><table className="authorization-table"><thead><tr><th>Proyecto</th><th>Sujeto</th><th>Vencimiento</th><th>Estado</th><th aria-label="Acciones"/></tr></thead><tbody>{items.map(item=><tr key={item.id}><td data-label="Proyecto"><strong>{item.project}</strong>{item.scopes.length>0&&<span>{item.scopes.join(" · ")}</span>}</td><td data-label="Sujeto">{item.subject}</td><td data-label="Vencimiento">{formatDate(item.expiresAt)}</td><td data-label="Estado"><span className={`authorization-status authorization-status--${item.status}`}>{item.status==="active"?"Activa":"Revocada"}</span></td><td className="authorization-actions">{item.status==="active"&&<button type="button" onClick={()=>setSelected(item)}>Revocar</button>}</td></tr>)}</tbody></table></div>}
    </section>
    {selected&&<ConfirmDialog open title="Revocar autorización" description={`La autorización de ${selected.project} quedará inválida inmediatamente.`} confirmLabel="Revocar" danger onClose={()=>setSelected(null)} onConfirm={()=>void revoke()}/>}
    {toast&&<Toast message={toast}/>}
  </div>;
}
