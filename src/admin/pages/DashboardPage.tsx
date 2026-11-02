import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import type {SiteContent} from "../../content/schema";
import {contentRepository,type VersionInfo} from "../../data";
import {useAdminContent} from "../AdminContentContext";
import {adminNavigationGroups,editableSections,type AdminNavItem} from "../adminConfig";
import {AdminIcon} from "../components/AdminIcon";

type SectionState={label:string;kind:"idle"|"draft"|"published"};

const relativePublication=(createdAt:string)=>{
  const elapsed=Math.max(0,Date.now()-new Date(createdAt).getTime());
  if(elapsed<60_000)return"Publicado ahora";
  const units:Array<[Intl.RelativeTimeFormatUnit,number]>=[["year",31_536_000_000],["month",2_592_000_000],["day",86_400_000],["hour",3_600_000],["minute",60_000]];
  const [unit,size]=units.find(([,duration])=>elapsed>=duration)??units.at(-1)!;
  return `Publicado ${new Intl.RelativeTimeFormat("es",{numeric:"auto"}).format(-Math.floor(elapsed/size),unit)}`;
};

const authorLabel=(version:VersionInfo)=>{
  if(version.authorName?.trim())return version.authorName.trim();
  const source=(version.authorEmail||version.author||"").split("@")[0].trim();
  const initials=source.split(/[._\-\s]+/).filter(Boolean).map(part=>part[0]).join("").slice(0,2).toUpperCase();
  return initials||"A";
};

export function DashboardPage(){
  const {loading,error,changedSections,unsavedSections,reload}=useAdminContent();
  const [versions,setVersions]=useState<VersionInfo[]>([]);
  useEffect(()=>{void contentRepository.listVersions().then(setVersions).catch(()=>setVersions([]))},[]);
  if(loading)return <div className="admin-skeleton-grid" aria-label="Cargando resumen"><i/><i/><i/></div>;
  if(error)return <div className="admin-state admin-state--error"><h2>No pudimos cargar el contenido</h2><p>{error}</p><button className="admin-button admin-button--secondary" onClick={()=>void reload()}>Reintentar</button></div>;

  const latest=versions[0]??null;
  const pendingSections=new Set([...changedSections,...unsavedSections]);
  const label=(section:string)=>section==="legal"?"Textos legales":section==="navigation"?"Navegación":editableSections.find(item=>item.section===section)?.label??section;
  const relatedSections=(item:AdminNavItem):Array<keyof SiteContent>=>item.section==="footer"?["footer","legal"]:item.section==="settings"?["settings","navigation","brand"]:item.section?[item.section]:[];
  const sectionState=(item:AdminNavItem):SectionState=>{
    const sections=relatedSections(item);
    if(sections.some(section=>pendingSections.has(section)))return{label:"Borrador",kind:"draft"};
    if(item.section){
      const publicationLabels=sections.map(section=>label(section));
      const publication=versions.find(version=>version.changedSections?.some(section=>publicationLabels.includes(section)));
      if(publication)return{label:relativePublication(publication.createdAt),kind:"published"};
    }
    return{label:"Sin cambios",kind:"idle"};
  };
  const latestSectionList=latest?.changedSections?.join(", ")||"Sin detalle de secciones";
  const latestSections=latest?.summary||latestSectionList;
  const isUpcoming=(groupId:string,item:AdminNavItem)=>groupId==="operations"&&(item.label==="Dashboard"||item.label==="Tablero");

  return <div className="admin-dashboard">
    <section className="admin-summary-cards" aria-label="Resumen de publicación">
      <article><p className="admin-kicker">// ESTADO</p><strong>{pendingSections.size?"Borrador con cambios":"Todo publicado"}</strong><span>{pendingSections.size?`${pendingSections.size} ${pendingSections.size===1?"sección tiene":"secciones tienen"} cambios locales.`:"No hay cambios pendientes."}</span></article>
      <article className="admin-summary-card--publication"><p className="admin-kicker">// ÚLTIMA PUBLICACIÓN</p>{latest?<><strong><time dateTime={latest.createdAt}>{new Intl.DateTimeFormat("es-PY",{dateStyle:"medium",timeStyle:"short"}).format(new Date(latest.createdAt))}</time></strong><span><span title={latest.authorEmail||latest.author}>Por {authorLabel(latest)}</span> · <span title={latestSectionList}>{latestSections}</span> · <Link to="/admin/historial">Ver historial</Link></span></>:<><strong>Sin publicaciones</strong><span>Todavía no hay publicaciones. <Link to="/admin/historial">Ver historial</Link></span></>}</article>
      <article><p className="admin-kicker">// ALMACENAMIENTO</p><strong>Este navegador</strong><span>Los borradores y versiones se guardan localmente en modo demostración.</span></article>
    </section>

    <section className="admin-section-status"><div className="admin-panel-card__heading"><div><p className="admin-kicker">// CONTENIDO</p><h2>Estado por sección</h2></div></div>{adminNavigationGroups.map(group=><div className="admin-status-group" key={group.id}><h3>// {group.label.toLocaleUpperCase("es")}</h3><div className="admin-status-grid">{group.items.map(item=>{
      if(isUpcoming(group.id,item))return <div className="admin-status-card is-upcoming" key={item.to} aria-disabled="true"><AdminIcon name={item.icon}/><span><strong>{item.label}</strong><small>Próximamente</small></span></div>;
      const state=sectionState(item);
      return <Link className="admin-status-card" to={item.to} key={item.to}><AdminIcon name={item.icon}/><span><strong>{item.label}</strong><small className={`admin-section-state is-${state.kind}`}><i aria-hidden="true"/>{state.label}</small></span><b aria-hidden="true"><AdminIcon name="arrow-up-right" className="admin-symbol"/></b></Link>;
    })}</div></div>)}</section>

    <section className="admin-panel-card"><div className="admin-panel-card__heading"><div><p className="admin-kicker">// BORRADOR</p><h2>Cambios sin publicar</h2></div></div>{pendingSections.size?<ul className="admin-change-list">{[...pendingSections].map(section=><li key={section}><span>{label(section)}</span><small>{unsavedSections.includes(section)?"Sin guardar":"Pendiente de publicación"}</small></li>)}</ul>:<div className="admin-empty admin-empty--compact"><span aria-hidden="true"><AdminIcon name="check" className="admin-symbol"/></span><p>El contenido local coincide con lo publicado.</p></div>}</section>
  </div>;
}
