import type {SiteContent} from "../content/schema";

export type VersionInfo={
  id:string;
  createdAt:string;
  summary:string;
  author:string;
  changedSections?:string[];
  authorName?:string;
  authorEmail?:string;
};

export type VersionAuthor={name?:string;email:string};

export const CONTENT_SECTION_LABELS:Partial<Record<keyof SiteContent,string>>={navigation:"Navegación",hero:"Inicio",whatWeDo:"¿Qué hacemos?",services:"¿Qué ofrecemos?",process:"¿Cómo trabajamos?",projects:"Proyectos",pricing:"Precios",team:"Equipo",purpose:"¿Qué queremos?",faq:"FAQ",contact:"Contacto",footer:"Pie de página",legal:"Textos legales",settings:"Ajustes del sitio",brand:"Marca"};

export function getChangedSectionLabels(next:SiteContent,previous:SiteContent){return(Object.keys(next) as Array<keyof SiteContent>).filter(key=>JSON.stringify(next[key])!==JSON.stringify(previous[key])).map(key=>CONTENT_SECTION_LABELS[key]??String(key))}
export function summarizeChangedSections(sections:string[]){if(!sections.length)return"Publicación sin cambios";return sections.length<=3?sections.join(", "):`${sections.length} secciones modificadas`}

export type MediaInfo={
  id:string;
  name:string;
  size:number;
  type:string;
  url:string;
  createdAt:string;
};

export interface ContentRepository{
  getPublished():Promise<SiteContent>;
  getDraft():Promise<SiteContent>;
  saveDraft(content:SiteContent):Promise<void>;
  publish(author?:VersionAuthor):Promise<void>;
  discardDraft():Promise<void>;
  listVersions():Promise<VersionInfo[]>;
  getVersion(id:string):Promise<SiteContent>;
  restoreVersion(id:string):Promise<void>;
  uploadImage(file:File):Promise<{url:string}>;
  listMedia():Promise<MediaInfo[]>;
  deleteImage(id:string):Promise<void>;
}

