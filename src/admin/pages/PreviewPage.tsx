import {useEffect,useMemo,useState} from "react";
import App from "../../App";
import {siteContent as defaultContent} from "../../content";
import {ContentProvider} from "../../content/ContentProvider";
import {siteContentSchema,type SiteContent} from "../../content/schema";

export type PreviewMessage={type:"xonetr:preview-content";content:SiteContent;section?:string};

const sectionIds:Record<string,string>={inicio:"inicio",nosotros:"nosotros",servicios:"servicios",proceso:"proceso",proyectos:"proyectos",precios:"precios",proposito:"proposito",equipo:"equipo",faq:"faq",contacto:"contacto",footer:"site-footer"};
const storageKey="xonetr.admin.full-preview";

function readStoredPreview(){try{const raw=localStorage.getItem(storageKey);return raw?siteContentSchema.parse(JSON.parse(raw)):null}catch{return null}}

export function PreviewPage(){
  const full=useMemo(()=>new URLSearchParams(window.location.search).get("full")==="1",[]);
  const [content,setContent]=useState<SiteContent>(()=>readStoredPreview()??defaultContent);
  const [section,setSection]=useState("");
  useEffect(()=>{
    document.documentElement.classList.add("admin-preview-document");
    const receive=(event:MessageEvent<PreviewMessage>)=>{if(event.origin!==window.location.origin||event.data?.type!=="xonetr:preview-content")return;const result=siteContentSchema.safeParse(event.data.content);if(!result.success)return;setContent(result.data);setSection(event.data.section??"")};
    window.addEventListener("message",receive);
    window.parent?.postMessage({type:"xonetr:preview-ready"},window.location.origin);
    window.opener?.postMessage({type:"xonetr:preview-ready"},window.location.origin);
    return()=>{document.documentElement.classList.remove("admin-preview-document");window.removeEventListener("message",receive)};
  },[]);
  useEffect(()=>{if(!section)return;const reveal=()=>{document.querySelectorAll(".admin-preview-highlight").forEach(node=>node.classList.remove("admin-preview-highlight"));const target=document.getElementById(sectionIds[section]??section);if(target){target.classList.add("admin-preview-highlight");target.scrollIntoView({block:"start",behavior:"auto"})}};const first=window.setTimeout(reveal,180);const settle=window.setTimeout(reveal,700);return()=>{window.clearTimeout(first);window.clearTimeout(settle)}},[content,section]);
  return <ContentProvider initialContent={content}><div className={full?"admin-full-preview":""}>{full&&<div className="admin-preview-ribbon">Vista previa del borrador — no publicado</div>}<App/></div></ContentProvider>;
}

export function storeFullPreview(content:SiteContent){localStorage.setItem(storageKey,JSON.stringify(content))}
