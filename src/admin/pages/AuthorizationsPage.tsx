import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {ConfirmDialog} from "../components/ConfirmDialog";
import {Toast} from "../components/Toast";

type Authorization={id:string;project:string;subject:string;scopes:string[];issuedAt:string;expiresAt:string;revokedAt?:string;revokeReason?:string;renewedFrom?:string;status:"active"|"expired"|"revoked"|"invalid"};
type LicenseClient={id:string;project:string;subject:string;name:string;createdAt:string;lastSeenAt:string|null;status:"active"|"revoked"};
type Secret={title:string;env:string;note:string};
type GroupStatus=Authorization["status"]|"expiring";
// Un cliente (proyecto + ID) con su licencia vigente y el historial de firmas anteriores.
type Group={key:string;project:string;subject:string;name:string;current:Authorization;history:Authorization[];credential?:LicenseClient;status:GroupStatus;daysLeft:number};
type Filter="all"|"active"|"expiring"|"expired"|"revoked";
type Pending={kind:"revoke";group:Group}|{kind:"rotate";group:Group}|{kind:"revoke-credential";group:Group};

async function api(path:string,body?:unknown){
  const response=await fetch(path,{credentials:"include",method:body===undefined?"GET":"POST",headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof data?.detail==="string"?data.detail:"No se pudo completar la operación.");
  return data;
}

const EXPIRING_DAYS=30;
const DAY=86_400_000;
const STATUS:Record<GroupStatus,string>={active:"Activa",expiring:"Por vencer",expired:"Vencida",revoked:"Revocada",invalid:"Inválida"};
const ORDER:Record<GroupStatus,number>={expiring:0,active:1,expired:2,invalid:3,revoked:4};
const FILTERS:{id:Filter;label:string}[]=[{id:"all",label:"Todas"},{id:"active",label:"Activas"},{id:"expiring",label:"Por vencer"},{id:"expired",label:"Vencidas"},{id:"revoked",label:"Revocadas"}];
const PRESETS=[{label:"+1 mes",months:1},{label:"+3 meses",months:3},{label:"+6 meses",months:6},{label:"+1 año",months:12}];
const addMonths=(from:Date,months:number)=>{const date=new Date(from);date.setMonth(date.getMonth()+months);return date};
const toLocalInput=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const emptyForm=()=>({project:"escfutboll",subject:"",name:"",scopes:"",expiresAt:toLocalInput(addMonths(new Date(),1))});
const formatDate=(value?:string|null)=>value?new Intl.DateTimeFormat("es-PY",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—";
const formatDay=(value:string|Date)=>new Intl.DateTimeFormat("es-PY",{dateStyle:"medium"}).format(new Date(value));
const remaining=(days:number)=>days<0?`Venció hace ${-days} ${days===-1?"día":"días"}`:days===0?"Vence hoy":`${days} ${days===1?"día":"días"} restantes`;
const isRenewal=(item:Authorization)=>Boolean(item.revokeReason?.startsWith("Reemplazada"));
const message=(cause:unknown)=>cause instanceof Error?cause.message:"No se pudo completar la operación.";

function groupByClient(items:Authorization[],clients:LicenseClient[]):Group[]{
  const map=new Map<string,Authorization[]>();
  for(const item of items){const key=`${item.project}\u0000${item.subject}`;map.set(key,[...(map.get(key)??[]),item])}
  return [...map.entries()].map(([key,list])=>{
    const active=list.filter(item=>item.status==="active").sort((a,b)=>b.expiresAt.localeCompare(a.expiresAt));
    // Vigente: la activa que vence más tarde (la que recibe el cliente); si no hay, la última emitida.
    const current=active[0]??[...list].sort((a,b)=>b.issuedAt.localeCompare(a.issuedAt))[0];
    const own=clients.filter(client=>client.project===current.project&&client.subject===current.subject);
    const credential=own.find(client=>client.status==="active");
    const daysLeft=Math.ceil((new Date(current.expiresAt).getTime()-Date.now())/DAY);
    const status:GroupStatus=current.status==="active"&&daysLeft<=EXPIRING_DAYS?"expiring":current.status;
    return {key,project:current.project,subject:current.subject,name:(credential??own[0])?.name||"",current,history:list.filter(item=>item!==current).sort((a,b)=>b.issuedAt.localeCompare(a.issuedAt)),credential,status,daysLeft};
  }).sort((a,b)=>ORDER[a.status]-ORDER[b.status]||a.current.expiresAt.localeCompare(b.current.expiresAt));
}

const matches=(group:Group,filter:Filter)=>filter==="all"||(filter==="active"?group.status==="active"||group.status==="expiring":filter==="revoked"?group.status==="revoked"||group.status==="invalid":group.status===filter);

function ExpiryDialog({group,busy,onClose,onSave}:{group:Group;busy:boolean;onClose:()=>void;onSave:(expiresAt:Date)=>void}){
  const base=new Date(Math.max(Date.now(),new Date(group.current.expiresAt).getTime()));
  const [value,setValue]=useState(toLocalInput(addMonths(base,1)));
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{input.current?.focus()},[]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[onClose]);
  const next=value?new Date(value):null;
  const invalid=!next||Number.isNaN(next.getTime())?"Elegí una fecha.":next.getTime()<=Date.now()?"La fecha tiene que ser futura.":"";
  const shorter=next&&!invalid&&next<new Date(group.current.expiresAt);
  const submit=(event:FormEvent)=>{event.preventDefault();if(next&&!invalid)onSave(next)};
  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <form className="admin-dialog expiry-dialog" role="dialog" aria-modal="true" aria-labelledby="expiry-dialog-title" onSubmit={submit}>
      <p className="admin-kicker">// VENCIMIENTO</p>
      <h2 id="expiry-dialog-title">Cambiar vencimiento</h2>
      <p>{group.name||group.subject} · vence {group.current.status==="expired"?"(vencida) ":""}el <strong>{formatDate(group.current.expiresAt)}</strong>.</p>
      <div className="expiry-presets" role="group" aria-label="Extender desde el vencimiento actual">{PRESETS.map(preset=><button key={preset.months} type="button" className={value===toLocalInput(addMonths(base,preset.months))?"is-selected":""} onClick={()=>setValue(toLocalInput(addMonths(base,preset.months)))}>{preset.label}</button>)}</div>
      <div className="admin-field authorization-field"><div className="admin-field__heading"><label htmlFor="expiry-date">Nueva fecha de vencimiento</label></div><input ref={input} id="expiry-date" type="datetime-local" value={value} onChange={event=>setValue(event.target.value)} required/></div>
      {invalid?<p className="expiry-note expiry-note--error">{invalid}</p>:<p className={`expiry-note${shorter?" expiry-note--warn":""}`}>{formatDay(group.current.expiresAt)} → <strong>{formatDay(next!)}</strong>. {shorter?"Estás acortando la licencia. ":""}Se firma una licencia nueva y la actual se revoca; el cliente la recibe en su próxima consulta a XONETR.</p>}
      <div className="admin-dialog__actions"><button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancelar</button><button type="submit" className="admin-button admin-button--primary" disabled={busy||Boolean(invalid)}>Guardar vencimiento</button></div>
    </form>
  </div>;
}

export function AuthorizationsPage(){
  const [items,setItems]=useState<Authorization[]>([]);
  const [clients,setClients]=useState<LicenseClient[]>([]);
  const [form,setForm]=useState(emptyForm);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [formError,setFormError]=useState("");
  const [listError,setListError]=useState("");
  const [secret,setSecret]=useState<Secret|null>(null);
  const [pending,setPending]=useState<Pending|null>(null);
  const [editing,setEditing]=useState<Group|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("all");
  const [toast,setToast]=useState("");
  const secretRef=useRef<HTMLDivElement>(null);
  const formRef=useRef<HTMLElement>(null);

  const load=async()=>{try{const [authorizations,licenseClients]=await Promise.all([api("/api/authorizations"),api("/api/license-clients")]);setItems(authorizations);setClients(licenseClients)}catch(cause){setListError(message(cause))}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  useEffect(()=>{if(secret)secretRef.current?.scrollIntoView({behavior:"smooth",block:"center"})},[secret]);

  // Cada acción reporta su error en su propia zona (formulario o registro).
  const run=async(action:()=>Promise<void>,done:string,setError:(value:string)=>void)=>{setBusy(true);setFormError("");setListError("");try{await action();setToast(done);await load()}catch(cause){setError(message(cause))}finally{setBusy(false)}};
  const set=(key:keyof ReturnType<typeof emptyForm>)=>(event:{target:{value:string}})=>setForm(current=>({...current,[key]:event.target.value}));
  const groups=useMemo(()=>groupByClient(items,clients),[items,clients]);
  const counts=useMemo(()=>Object.fromEntries(FILTERS.map(({id})=>[id,groups.filter(group=>matches(group,id)).length])) as Record<Filter,number>,[groups]);
  const needle=query.trim().toLowerCase();
  const visible=groups.filter(group=>matches(group,filter)&&(!needle||[group.name,group.subject,group.project].some(value=>value.toLowerCase().includes(needle))));

  // Emite la licencia y, si el cliente todavía no tiene, su credencial para consultar renovaciones y revocaciones.
  const issue=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
    const project=form.project.trim(),subject=form.subject.trim();
    const result=await api("/api/authorizations",{project,subject,scopes:form.scopes.split(",").map(value=>value.trim()).filter(Boolean),expires_at:new Date(form.expiresAt).toISOString()});
    const hasCredential=clients.some(client=>client.project===project&&client.subject===subject&&client.status==="active");
    const credential=hasCredential?null:await api("/api/license-clients",{project,subject,name:form.name.trim()});
    const keys=await api("/api/authorization/public-keys");
    const env=[`CLIENT_ID=${subject}`,`LICENSE_TOKEN=${result.token}`,`LICENSE_PUBLIC_KEYS=${JSON.stringify(keys)}`,`XONETR_URL=${window.location.origin}`,...(credential?[`LICENSE_API_KEY=${credential.apiKey}`]:[])].join("\n");
    setSecret({title:`Datos para el despliegue de ${subject}`,env,note:`Cargalos en el .env del servidor del cliente.${credential?" La credencial (LICENSE_API_KEY) se muestra solo esta vez.":" El cliente ya tenía credencial: se conserva."}`});
    setForm(emptyForm());
  },"Autorización firmada emitida.",setFormError)};

  // Cambiar el vencimiento (alargar o acortar) = firmar una nueva y revocar la actual.
  const saveExpiry=(group:Group,expiresAt:Date)=>{setEditing(null);void run(async()=>{await api(`/api/authorizations/${encodeURIComponent(group.current.id)}/renew`,{expires_at:expiresAt.toISOString(),revoke_previous:true})},`Vencimiento actualizado al ${formatDay(expiresAt)}. El cliente lo recibe en su próxima consulta.`,setListError)};

  const showKey=(group:Group,apiKey:string,title:string)=>setSecret({title,env:`LICENSE_API_KEY=${apiKey}`,note:`Reemplazala en el .env de ${group.subject} y reiniciá su backend. Se muestra solo esta vez.`});
  const createCredential=(group:Group)=>void run(async()=>{const created=await api("/api/license-clients",{project:group.project,subject:group.subject,name:group.name});showKey(group,created.apiKey,`Nueva credencial de ${group.subject}`)},"Credencial creada.",setListError);

  const confirmPending=()=>{const target=pending;setPending(null);if(!target)return;const {group}=target;
    if(target.kind==="revoke")void run(()=>api(`/api/authorizations/${encodeURIComponent(group.current.id)}/revoke`,{reason:"Revocada desde el panel"}),"Autorización revocada.",setListError);
    if(target.kind==="rotate"&&group.credential)void run(async()=>{const rotated=await api(`/api/license-clients/${encodeURIComponent(group.credential!.id)}/rotate-secret`);showKey(group,rotated.apiKey,`Credencial regenerada de ${group.subject}`)},"Credencial regenerada.",setListError);
    if(target.kind==="revoke-credential"&&group.credential)void run(()=>api(`/api/license-clients/${encodeURIComponent(group.credential!.id)}/revoke`),"Credencial revocada.",setListError);
  };
  const reissue=(group:Group)=>{setForm({project:group.project,subject:group.subject,name:group.name,scopes:group.current.scopes.join(", "),expiresAt:toLocalInput(addMonths(new Date(),1))});formRef.current?.scrollIntoView({behavior:"smooth",block:"start"})};
  const copy=async()=>{if(!secret)return;try{await navigator.clipboard.writeText(secret.env);setToast("Copiado.")}catch{setFormError("No se pudo copiar; seleccioná el texto.")}};

  const dialog=pending&&{
    revoke:{title:"Revocar autorización",description:`${pending.group.subject} quedará en solo lectura en su próxima consulta a XONETR. Sus datos se conservan.`,confirmLabel:"Revocar"},
    rotate:{title:"Regenerar credencial",description:`La LICENSE_API_KEY actual de ${pending.group.subject} deja de funcionar ya mismo. Hasta que cargues la nueva en su .env, el cliente no recibe renovaciones (su licencia actual sigue valiendo).`,confirmLabel:"Regenerar"},
    "revoke-credential":{title:"Revocar credencial",description:`${pending.group.subject} ya no podrá consultar XONETR: no recibirá renovaciones ni revocaciones. Su licencia actual sigue valiendo hasta que venza.`,confirmLabel:"Revocar credencial"},
  }[pending.kind];

  return <div className="admin-page authorizations-page">
    <header className="authorizations-header">
      <div><p className="admin-kicker">// FIRMAS DIGITALES</p><h2>Autorizaciones</h2><p>Licencias firmadas por cliente. El cliente las valida sin conexión y consulta XONETR para recibir renovaciones y revocaciones; al vencer, su app queda en solo lectura.</p></div>
      <div className="authorizations-header__metrics">
        <div className="authorizations-header__metric"><strong>{counts.active}</strong><span>activas</span></div>
        <div className={`authorizations-header__metric${counts.expiring?" is-warn":""}`}><strong>{counts.expiring}</strong><span>por vencer</span></div>
        <div className={`authorizations-header__metric${counts.expired?" is-danger":""}`}><strong>{counts.expired}</strong><span>vencidas</span></div>
      </div>
    </header>

    {secret&&<div ref={secretRef} className="authorization-token authorization-token--standalone"><div><div><strong>{secret.title}</strong><span>{secret.note}</span></div><div className="authorization-token__actions"><button className="admin-button admin-button--secondary" type="button" onClick={()=>void copy()}>Copiar</button><button className="admin-button admin-button--ghost" type="button" onClick={()=>setSecret(null)}>Ya lo guardé</button></div></div><textarea readOnly value={secret.env} rows={Math.min(6,secret.env.split("\n").length+1)}/></div>}

    <section ref={formRef} className="admin-panel-card authorization-issue-card">
      <div className="admin-panel-card__heading"><div><span className="authorization-card-icon" aria-hidden="true">+</span><div><p className="admin-kicker">// NUEVA AUTORIZACIÓN</p><h2>Emitir firma</h2></div></div></div>
      <form className="authorization-form" onSubmit={issue}>
        <div className="admin-field authorization-field authorization-field--project"><div className="admin-field__heading"><label htmlFor="authorization-project">Proyecto</label></div><input id="authorization-project" value={form.project} onChange={set("project")} placeholder="escfutboll" required/></div>
        <div className="admin-field authorization-field authorization-field--subject"><div className="admin-field__heading"><label htmlFor="authorization-subject">ID del cliente</label></div><input id="authorization-subject" value={form.subject} onChange={set("subject")} pattern="[a-z0-9][a-z0-9-]*" title="Minúsculas, números y guiones" placeholder="club-ejemplo" required/><p className="admin-field__help">Es el CLIENT_ID de su despliegue.</p></div>
        <div className="admin-field authorization-field"><div className="admin-field__heading"><label htmlFor="authorization-name">Nombre del cliente</label></div><input id="authorization-name" value={form.name} onChange={set("name")} placeholder="Club Ejemplo"/></div>
        <div className="admin-field authorization-field authorization-field--scopes"><div className="admin-field__heading"><label htmlFor="authorization-scopes">Módulos</label></div><input id="authorization-scopes" value={form.scopes} onChange={set("scopes")} placeholder="jugadores, cobranza"/><p className="admin-field__help">Separados por comas. Vacío = todos.</p></div>
        <div className="admin-field authorization-field authorization-field--expires"><div className="admin-field__heading"><label htmlFor="authorization-expires">Fecha de vencimiento</label></div><input id="authorization-expires" type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} required/></div>
        <button className="admin-button admin-button--primary authorization-submit" type="submit" disabled={busy}>Emitir autorización</button>
      </form>
      {formError&&<p className="authorization-error" role="alert">{formError}</p>}
    </section>

    <section className="admin-panel-card authorization-register">
      <div className="admin-panel-card__heading"><div><p className="admin-kicker">// REGISTRO</p><h2>Clientes con licencia</h2></div><span className="authorization-total">{groups.length} {groups.length===1?"cliente":"clientes"}</span></div>
      {groups.length>0&&<div className="authorization-toolbar">
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar cliente, ID o proyecto…" aria-label="Buscar"/>
        <div className="authorization-filters" role="group" aria-label="Filtrar por estado">{FILTERS.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}</div>
      </div>}
      {listError&&<p className="authorization-error authorization-error--list" role="alert">{listError}</p>}
      {loading?<div className="authorization-loading">Cargando autorizaciones…</div>:groups.length===0?<div className="admin-empty"><strong>Sin autorizaciones todavía</strong><p>Las firmas emitidas aparecerán en este registro.</p></div>:visible.length===0?<div className="admin-empty"><strong>Sin resultados</strong><p>Ningún cliente coincide con la búsqueda o el filtro.</p></div>:<div className="authorization-table-wrap"><table className="authorization-table"><thead><tr><th>Cliente</th><th>Vencimiento</th><th>Estado</th><th>Última consulta</th><th aria-label="Acciones"/></tr></thead><tbody>{visible.map(group=>{const {current}=group;const open=expanded===group.key;const editable=current.status==="active"||current.status==="expired";return [
        <tr key={group.key} className={open?"is-open":""}>
          <td data-label="Cliente"><strong>{group.name||group.subject}</strong><span>{group.name?`${group.subject} · `:""}{group.project} · {current.scopes.length>0?current.scopes.join(" · "):"todos los módulos"}</span></td>
          <td data-label="Vencimiento">{formatDate(current.expiresAt)}{current.status!=="revoked"&&<span className={`authorization-days authorization-days--${group.status}`}>{remaining(group.daysLeft)}</span>}</td>
          <td data-label="Estado"><span className={`authorization-status authorization-status--${group.status}`}>{STATUS[group.status]}</span>{current.revokeReason&&!isRenewal(current)&&<span className="authorization-reason">{current.revokeReason}</span>}</td>
          <td data-label="Última consulta">{group.credential?formatDate(group.credential.lastSeenAt):<span className="authorization-muted">Sin credencial</span>}</td>
          <td className="authorization-actions">
            {editable&&<button type="button" className="authorization-action authorization-action--primary" disabled={busy} onClick={()=>setEditing(group)}>Cambiar vencimiento</button>}
            {current.status==="active"&&<button type="button" className="authorization-action authorization-action--danger" disabled={busy} onClick={()=>setPending({kind:"revoke",group})}>Revocar</button>}
            <button type="button" className="authorization-action" aria-expanded={open} onClick={()=>setExpanded(open?null:group.key)}>{open?"Ocultar":"Detalle"}</button>
          </td>
        </tr>,
        open&&<tr key={`${group.key}-detail`} className="authorization-detail-row"><td colSpan={5}><div className="authorization-detail">
          <div className="authorization-detail__block">
            <p className="admin-kicker">// CREDENCIAL</p>
            {group.credential?<><p>Activa desde {formatDate(group.credential.createdAt)} · última consulta {formatDate(group.credential.lastSeenAt)}</p><div className="authorization-detail__actions"><button type="button" className="authorization-action" disabled={busy} onClick={()=>setPending({kind:"rotate",group})}>Regenerar clave</button><button type="button" className="authorization-action authorization-action--danger" disabled={busy} onClick={()=>setPending({kind:"revoke-credential",group})}>Revocar credencial</button></div></>
              :<><p>Sin credencial activa: el cliente no puede consultar XONETR, así que no recibe renovaciones.</p><div className="authorization-detail__actions"><button type="button" className="authorization-action authorization-action--primary" disabled={busy} onClick={()=>createCredential(group)}>Crear credencial</button></div></>}
            {(current.status==="revoked"||current.status==="invalid")&&<><p className="admin-kicker authorization-detail__gap">// LICENCIA</p><p>Una licencia revocada no se puede renovar.</p><div className="authorization-detail__actions"><button type="button" className="authorization-action authorization-action--primary" onClick={()=>reissue(group)}>Emitir nueva para este cliente</button></div></>}
          </div>
          <div className="authorization-detail__block">
            <p className="admin-kicker">// HISTORIAL</p>
            <ol className="authorization-history">
              <li><strong>{formatDay(current.issuedAt)}</strong> Emitida · vence {formatDay(current.expiresAt)}<em>{current.status==="active"?"vigente":STATUS[current.status].toLowerCase()}</em></li>
              {group.history.map(item=><li key={item.id}><strong>{formatDay(item.issuedAt)}</strong> Emitida · vence {formatDay(item.expiresAt)}<em>{isRenewal(item)?"reemplazada":STATUS[item.status].toLowerCase()}</em></li>)}
            </ol>
          </div>
        </div></td></tr>,
      ]})}</tbody></table></div>}
    </section>

    {dialog&&<ConfirmDialog open title={dialog.title} description={dialog.description} confirmLabel={dialog.confirmLabel} danger onClose={()=>setPending(null)} onConfirm={confirmPending}/>}
    {editing&&<ExpiryDialog group={editing} busy={busy} onClose={()=>setEditing(null)} onSave={date=>saveExpiry(editing,date)}/>}
    <Toast message={toast}/>
  </div>;
}
