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
  return <div className="admin-page">
    <section className="admin-panel-card"><div className="admin-panel-card__heading"><div><p className="admin-kicker">// FIRMA CRIPTOGRÁFICA</p><h2>Emitir autorización</h2></div></div>
      <form className="admin-form-grid" onSubmit={issue}>
        <label>Proyecto<input value={project} onChange={event=>setProject(event.target.value)} required/></label>
        <label>Sujeto / cliente<input value={subject} onChange={event=>setSubject(event.target.value)} required/></label>
        <label>Alcances, separados por comas<input value={scopes} onChange={event=>setScopes(event.target.value)} placeholder="software:deploy, api:read"/></label>
        <label>Expira<input type="datetime-local" value={expiresAt} onChange={event=>setExpiresAt(event.target.value)} required/></label>
        <button className="admin-button admin-button--primary" type="submit">Emitir firma</button>
      </form>
      {token&&<div className="admin-field"><div className="admin-field__heading"><label>Token firmado</label><button className="admin-button admin-button--secondary" type="button" onClick={()=>void copy()}>Copiar</button></div><textarea readOnly value={token} rows={5}/></div>}
      {error&&<p className="admin-state admin-state--error" role="alert">{error}</p>}
    </section>
    <section className="admin-panel-card"><div className="admin-panel-card__heading"><div><p className="admin-kicker">// REGISTRO</p><h2>Autorizaciones emitidas</h2></div></div>
      {loading?<p>Cargando autorizaciones…</p>:items.length===0?<div className="admin-empty"><p>Todavía no hay autorizaciones emitidas.</p></div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Proyecto</th><th>Sujeto</th><th>Vencimiento</th><th>Estado</th><th/></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.project}<small>{item.scopes.join(", ")||"Sin alcances"}</small></td><td>{item.subject}</td><td>{new Date(item.expiresAt).toLocaleString("es-PY")}</td><td>{item.status==="active"?"Activa":"Revocada"}</td><td>{item.status==="active"&&<button className="admin-button admin-button--danger" type="button" onClick={()=>setSelected(item)}>Revocar</button>}</td></tr>)}</tbody></table></div>}
    </section>
    {selected&&<ConfirmDialog open title="Revocar autorización" description={`La autorización de ${selected.project} quedará inválida inmediatamente.`} confirmLabel="Revocar" danger onClose={()=>setSelected(null)} onConfirm={()=>void revoke()}/>}
    {toast&&<Toast message={toast}/>}
  </div>;
}
