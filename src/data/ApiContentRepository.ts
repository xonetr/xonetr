import type {SiteContent} from "../content/schema";
import {siteContent as defaultContent} from "../content";
import {siteContentSchema} from "../content/schema";
import type {ContentRepository,MediaInfo,VersionInfo} from "./ContentRepository";

async function request(path:string,options:RequestInit={}){
  const response=await fetch(path,{credentials:"include",...options,headers:options.headers});
  if(response.ok){
    if(response.status===204)return null;
    return response.json();
  }
  let detail="No se pudo completar la operación.";
  try{detail=(await response.json()).detail??detail}catch{}
  throw new Error(detail);
}

export class ApiContentRepository implements ContentRepository{
  async getPublished():Promise<SiteContent>{
    try{return await request("/api/content/published")}catch(cause){
      if(cause instanceof Error&&cause.message.includes("Todavía no hay contenido publicado"))return siteContentSchema.parse(defaultContent);
      throw cause;
    }
  }
  async getDraft():Promise<SiteContent>{
    try{return await request("/api/content/draft")}catch(cause){
      if(cause instanceof Error&&(cause.message.includes("Todavía no hay contenido publicado")||cause.message.includes("No hay borrador disponible")))return this.getPublished();
      throw cause;
    }
  }
  saveDraft(content:SiteContent):Promise<void>{return request("/api/content/draft",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(content)}).then(()=>undefined)}
  publish():Promise<void>{return request("/api/content/publish",{method:"POST"}).then(()=>undefined)}
  discardDraft():Promise<void>{return request("/api/content/draft",{method:"DELETE"}).then(()=>undefined)}
  listVersions():Promise<VersionInfo[]>{return request("/api/content/versions")}
  getVersion(id:string):Promise<SiteContent>{return request(`/api/content/versions/${encodeURIComponent(id)}`)}
  restoreVersion(id:string):Promise<void>{return request(`/api/content/versions/${encodeURIComponent(id)}/restore`,{method:"POST"}).then(()=>undefined)}
  async uploadImage(file:File):Promise<{url:string}>{
    const form=new FormData();
    form.append("file",file);
    return request("/api/media",{method:"POST",body:form});
  }
  listMedia():Promise<MediaInfo[]>{return request("/api/media")}
  deleteImage(id:string):Promise<void>{return request(`/api/media/${encodeURIComponent(id)}`,{method:"DELETE"}).then(()=>undefined)}
}
