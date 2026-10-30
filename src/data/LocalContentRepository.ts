import {siteContent as defaultContent} from "../content";
import {siteContentSchema,type SiteContent} from "../content/schema";
import {getChangedSectionLabels,summarizeChangedSections,type ContentRepository,type MediaInfo,type VersionAuthor,type VersionInfo} from "./ContentRepository";

const KEYS={published:"xonetr.content.published",draft:"xonetr.content.draft",versions:"xonetr.content.versions",media:"xonetr.content.media"} as const;
const MAX_IMAGE_BYTES=2*1024*1024;
const VALID_IMAGE_TYPES=new Set(["image/png","image/jpeg","image/webp","image/svg+xml"]);

type StoredVersion=VersionInfo&{content:SiteContent};

function cloneDefault():SiteContent{return siteContentSchema.parse(defaultContent)}
function hydrateMemberLinks(links:SiteContent["team"]["members"][number]["links"]){const current=links??[];const required=[{label:"LinkedIn",href:""},{label:"GitHub",href:""}];return[...current,...required.filter(item=>!current.some(link=>link.label.toLowerCase()===item.label.toLowerCase()))]}
function hydrateContent(content:SiteContent):SiteContent{
  const defaults=cloneDefault();
  const storedFavicon=content.settings?.favicon;
  return siteContentSchema.parse({
    ...content,
    team:{...content.team,members:content.team.members.map(member=>({...member,links:hydrateMemberLinks(member.links)}))},
    footer:{...content.footer,columns:content.footer.columns?.length?content.footer.columns:defaults.footer.columns},
    settings:{...defaults.settings,...content.settings,favicon:!storedFavicon||storedFavicon==="/assets/xonetr-logo.png"?defaults.settings?.favicon:storedFavicon},
  });
}
function readContent(key:string):SiteContent|null{
  try{const raw=localStorage.getItem(key);if(!raw)return null;const result=siteContentSchema.safeParse(JSON.parse(raw));return result.success?result.data:null}catch{return null}
}
function readVersions():StoredVersion[]{
  try{const raw=localStorage.getItem(KEYS.versions);if(!raw)return[];const parsed=JSON.parse(raw) as StoredVersion[];return Array.isArray(parsed)?parsed:[]}catch{return[]}
}
function readMedia():MediaInfo[]{
  try{const raw=localStorage.getItem(KEYS.media);if(!raw)return[];const parsed=JSON.parse(raw) as MediaInfo[];return Array.isArray(parsed)?parsed.filter(item=>item&&typeof item.url==="string"):[]}catch{return[]}
}
function fileToDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("No se pudo leer la imagen."));reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(file)})}

export class LocalContentRepository implements ContentRepository{
  async getPublished(){return hydrateContent(readContent(KEYS.published)??cloneDefault())}
  async getDraft(){const stored=readContent(KEYS.draft);return stored?hydrateContent(stored):this.getPublished()}
  async saveDraft(content:SiteContent){const validated=siteContentSchema.parse(content);localStorage.setItem(KEYS.draft,JSON.stringify(validated))}
  async publish(author?:VersionAuthor){
    const content=await this.getDraft();
    const validated=siteContentSchema.parse(content);
    const previous=await this.getPublished();
    const changedSections=getChangedSectionLabels(validated,previous);
    localStorage.setItem(KEYS.published,JSON.stringify(validated));
    const authorEmail=author?.email??"administrador@local";const authorName=author?.name?.trim()||"Administrador local";
    const version:StoredVersion={id:crypto.randomUUID(),createdAt:new Date().toISOString(),summary:summarizeChangedSections(changedSections),changedSections,author:authorName,authorName,authorEmail,content:validated};
    localStorage.setItem(KEYS.versions,JSON.stringify([version,...readVersions()].slice(0,10)));
    localStorage.removeItem(KEYS.draft);
  }
  async discardDraft(){localStorage.removeItem(KEYS.draft)}
  async listVersions(){return readVersions().map(({content:_,...info})=>info)}
  async getVersion(id:string){const version=readVersions().find(item=>item.id===id);if(!version)throw new Error("La versión solicitada no existe.");return siteContentSchema.parse(version.content)}
  async restoreVersion(id:string){const version=readVersions().find(item=>item.id===id);if(!version)throw new Error("La versión solicitada no existe.");await this.saveDraft(version.content)}
  async uploadImage(file:File){
    if(!VALID_IMAGE_TYPES.has(file.type))throw new Error("Usa una imagen PNG, JPG, WebP o SVG.");
    if(file.size>MAX_IMAGE_BYTES)throw new Error("La imagen no puede superar 2 MB.");
    // Los data URL sobreviven recargas y son apropiados únicamente para el modo local.
    const url=await fileToDataUrl(file);
    const media:MediaInfo={id:crypto.randomUUID(),name:file.name,size:file.size,type:file.type,url,createdAt:new Date().toISOString()};
    try{localStorage.setItem(KEYS.media,JSON.stringify([media,...readMedia()]))}catch{throw new Error("No queda espacio local para guardar esta imagen. Prueba con un archivo más liviano.")}
    return{url};
  }
  async listMedia(){return readMedia()}
  async deleteImage(id:string){localStorage.setItem(KEYS.media,JSON.stringify(readMedia().filter(item=>item.id!==id)))}
}

