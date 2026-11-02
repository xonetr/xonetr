import type {SiteContent} from "../content/schema";
import type {AppliedImageEdit,ContentRepository,MediaInfo,VersionInfo} from "./ContentRepository";

const notConfigured=()=>Promise.reject(new Error("El repositorio Cloudflare todavía no está configurado."));

// TODO(PRODUCCIÓN): implementar esta clase contra una API autenticada en Cloudflare Workers.
// El Worker debería validar SiteContent con el mismo esquema antes de persistirlo.
// Contenido y versiones pueden residir en D1 o KV; las imágenes deben almacenarse en R2.
// Las operaciones de publicación/restauración necesitan permisos, auditoría y control de concurrencia en servidor.
export class CloudflareContentRepository implements ContentRepository{
  getPublished():Promise<SiteContent>{return notConfigured()}
  getDraft():Promise<SiteContent>{return notConfigured()}
  saveDraft(_content:SiteContent):Promise<void>{return notConfigured()}
  publish():Promise<void>{return notConfigured()}
  discardDraft():Promise<void>{return notConfigured()}
  listVersions():Promise<VersionInfo[]>{return notConfigured()}
  getVersion(_id:string):Promise<SiteContent>{return notConfigured()}
  restoreVersion(_id:string):Promise<void>{return notConfigured()}
  uploadImage(_file:File,_original?:File,_edit?:AppliedImageEdit):Promise<{url:string;original?:string}>{return notConfigured()}
  listMedia():Promise<MediaInfo[]>{return notConfigured()}
  deleteImage(_id:string):Promise<void>{return notConfigured()}
}

