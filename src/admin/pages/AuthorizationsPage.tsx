import {useEffect,useState,type FormEvent} from "react";
import {ConfirmDialog} from "../components/ConfirmDialog";
import {Toast} from "../components/Toast";

type Authorization={id:string;project:string;subject:string;scopes:string[];issuedAt:string;expiresAt:string;revokedAt?:string;revokeReason?:string;renewedFrom?:string;status:"active"|"expired"|"revoked"|"invalid"};
type LicenseClient={id:string;project:string;subject:string;name:string;lastSeenAt:string|null;status:"active"|"revoked"};
type Issued={subject:string;env:string;newCredential:boolean};

async function api(path:string,body?:unknown){
  const response=await fetch(path,{credentials:"include",method:body===undefined?"GET":"POST",headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof data?.detail==="string"?data.detail:"No se pudo completar la operación.");
  return data;
}

const STATUS={active:"Activa",expired:"Vencida",revoked:"Revocada",invalid:"Inválida"};
const addMonths=(from:Date,months:number)=>{const date=new Date(from);date.setMonth(date.getMonth()+months);return date};
const toLocalInput=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const emptyForm=()=>({project:"escfutboll",subject:"",name:"",scopes:"",expiresAt:toLocalInput(addMonths(new Date(),1))});

export function AuthorizationsPage(){
  const [items,setItems]=useState<Authorization[]>([]);
  const [clients,setClients]=useState<LicenseClient[]>([]);
  const [form,setForm]=useState(emptyForm);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [issued,setIssued]=useState<Issued|null>(null);
  const [selected,setSelected]=useState<Authorization|null>(null);
  const [toast,setToast]=useState("");

  const load=async()=>{setError("");try{const [authorizations,licenseClients]=await Promise.all([api("/api/authorizations"),api("/api/license-clients")]);setItems(authorizations);setClients(licenseClients)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudieron cargar las autorizaciones.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const run=async(action:()=>Promise<void>,done:string)=>{setBusy(true);setError("");try{await action();setToast(done);await load()}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo completar la operación.")}finally{setBusy(false)}};
  const clientOf=(item:{project:string;subject:string})=>clients.find(client=>client.project===item.project&&client.subject===item.subject&&client.status==="active");
  const set=(key:keyof ReturnType<typeof emptyForm>)=>(event:{target:{value:string}})=>setForm(current=>({...current,[key]:event.target.value}));

  // Emite la licencia y, si el cliente todavía no tiene, su credencial para consultar renovaciones y revocaciones.
  const issue=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
    const project=form.project.trim(),subject=form.subject.trim();
    const result=await api("/api/authorizations",{project,subject,scopes:form.scopes.split(",").map(value=>value.trim()).filter(Boolean),expires_at:new Date(form.expiresAt).toISOString()});
    const credential=clientOf({project,subject})?null:await api("/api/license-clients",{project,subject,name:form.name.trim()});
    const keys=await api("/api/authorization/public-keys");
    const env=[`CLIENT_ID=${subject}`,`LICENSE_TOKEN=${result.token}`,`LICENSE_PUBLIC_KEYS=${JSON.stringify(keys)}`,`XONETR_URL=${window.location.origin}`,...(credential?[`LICENSE_API_KEY=${credential.apiKey}`]:[])].join("\n");
    setIssued({subject,env,newCredential:Boolean(credential)});setForm(emptyForm());
  },"Autorización firmada emitida.")};

  // La renovación reemplaza a la actual: el cliente la descarga en su próxima consulta a XONETR.
  const renew=(item:Authorization,months:number)=>void run(async()=>{
    const from=new Date(Math.max(Date.now(),new Date(item.expiresAt).getTime()));
    await api(`/api/authorizations/${encodeURIComponent(item.id)}/renew`,{expires_at:addMonths(from,months).toISOString(),revoke_previous:true});
  },"Renovada. El cliente la recibe en su próxima consulta.");
  const revoke=()=>{const target=selected;setSelected(null);if(target)void run(()=>api(`/api/authorizations/${encodeURIComponent(target.id)}/revoke`,{reason:"Revocada desde el panel"}),"Autorización revocada.")};
  const copy=async()=>{if(!issued)return;try{await navigator.clipboard.writeText(issued.env);setToast("Copiado.")}catch{setError("No se pudo copiar; seleccioná el texto.")}};

  const activeCount=items.filter(item=>item.status==="active").length;
  const formatDate=(value?:string|null)=>value?new Intl.DateTimeFormat("es-PY",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—";
  return <div className="admin-page authorizations-page">
    <header className="authorizations-header">
      <div><p className="admin-kicker">// FIRMAS DIGITALES</p><h2>Autorizaciones</h2><p>Licencias firmadas por cliente. El cliente las valida sin conexión y consulta XONETR para recibir renovaciones y revocaciones; al vencer, su app queda en solo lectura.</p></div>
      <div className="authorizations-header__metric"><strong>{activeCount}</strong><span>activas</span></div>
    </header>
    <section className="admin-panel-card authorization-issue-card">
      <div className="admin-panel-card__heading"><div><span className="authorization-card-icon" aria-hidden="true">+</span><div><p className="admin-kicker">// NUEVA AUTORIZACIÓN</p><h2>Emitir firma</h2></div></div></div>
      <form className="authorization-form" onSubmit={issue}>
        <div className="admin-field authorization-field authorization-field--project"><div className="admin-field__heading"><label htmlFor="authorization-project">Proyecto</label></div><input id="authorization-project" value={form.project} onChange={set("project")} placeholder="escfutboll" required/></div>
        <div className="admin-field authorization-field authorization-field--subject"><div className="admin-field__heading"><label htmlFor="authorization-subject">ID del cliente</label></div><input id="authorization-subject" value={form.subject} onChange={set("subject")} pattern="[a-z0-9][a-z0-9-]*" title="Minúsculas, números y guiones" placeholder="club-ejemplo" required/><p className="admin-field__help">Es el CLIENT_ID de su despliegue.</p></div>
        <div className="admin-field authorization-field"><div className="admin-field__heading"><label htmlFor="authorization-name">Nombre del cliente</label></div><input id="authorization-name" value={form.name} onChange={set("name")} placeholder="Club Ejemplo"/></div>
        <div className="admin-field authorization-field authorization-field--scopes"><div className="admin-field__heading"><label htmlFor="authorization-scopes">Módulos</label></div><input id="authorization-scopes" value={form.scopes} onChange={set("scopes")} placeholder="jugadores, cobranza"/><p className="admin-field__help">Separados por comas. Vacío = todos.</p></div>
        <div className="admin-field authorization-field authorization-field--expires"><div className="admin-field__heading"><label htmlFor="authorization-expires">Fecha de vencimiento</label></div><input id="authorization-expires" type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} required/></div>
        <button className="admin-button admin-button--primary authorization-submit" type="submit" disabled={busy}>Emitir autorización</button>
      </form>
      {issued&&<div className="authorization-token"><div><div><strong>Datos para el despliegue de {issued.subject}</strong><span>Cargalos en el .env del servidor del cliente.{issued.newCredential?" La credencial (LICENSE_API_KEY) se muestra solo esta vez.":" El cliente ya tenía credencial: se conserva."}</span></div><button className="admin-button admin-button--secondary" type="button" onClick={()=>void copy()}>Copiar</button></div><textarea readOnly value={issued.env} rows={6}/></div>}
      {error&&<p className="authorization-error" role="alert">{error}</p>}
    </section>
    <section className="admin-panel-card authorization-register">
      <div className="admin-panel-card__heading"><div><p className="admin-kicker">// REGISTRO</p><h2>Autorizaciones emitidas</h2></div><span className="authorization-total">{items.length} {items.length===1?"registro":"registros"}</span></div>
      {loading?<div className="authorization-loading">Cargando autorizaciones…</div>:items.length===0?<div className="admin-empty"><strong>Sin autorizaciones todavía</strong><p>Las firmas emitidas aparecerán en este registro.</p></div>:<div className="authorization-table-wrap"><table className="authorization-table"><thead><tr><th>Proyecto</th><th>Cliente</th><th>Vencimiento</th><th>Estado</th><th>Última consulta</th><th aria-label="Acciones"/></tr></thead><tbody>{items.map(item=>{const client=clientOf(item);return <tr key={item.id}>
        <td data-label="Proyecto"><strong>{item.project}</strong><span>{item.scopes.length>0?item.scopes.join(" · "):"Todos los módulos"}</span></td>
        <td data-label="Cliente">{client?.name||item.subject}{client?.name&&<span>{item.subject}</span>}</td>
        <td data-label="Vencimiento">{formatDate(item.expiresAt)}</td>
        <td data-label="Estado"><span className={`authorization-status authorization-status--${item.status}`}>{STATUS[item.status]??item.status}</span>{item.revokeReason&&<span>{item.revokeReason.startsWith("Reemplazada")?"Renovada":item.revokeReason}</span>}</td>
        <td data-label="Última consulta">{formatDate(client?.lastSeenAt)}</td>
        <td className="authorization-actions">{item.status!=="revoked"&&<><button type="button" disabled={busy} onClick={()=>renew(item,1)}>+1 mes</button><button type="button" disabled={busy} onClick={()=>renew(item,12)}>+1 año</button><button type="button" disabled={busy} onClick={()=>setSelected(item)}>Revocar</button></>}</td>
      </tr>})}</tbody></table></div>}
    </section>
    {selected&&<ConfirmDialog open title="Revocar autorización" description={`${selected.subject} quedará en solo lectura en su próxima consulta a XONETR. Sus datos se conservan.`} confirmLabel="Revocar" danger onClose={()=>setSelected(null)} onConfirm={revoke}/>}
    <Toast message={toast}/>
  </div>;
}
