import type {SiteContent} from "../content/schema";

export type VersionInfo={
  id:string;
  createdAt:string;
  summary:string;
  author:string;
};

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
  publish():Promise<void>;
  discardDraft():Promise<void>;
  listVersions():Promise<VersionInfo[]>;
  getVersion(id:string):Promise<SiteContent>;
  restoreVersion(id:string):Promise<void>;
  uploadImage(file:File):Promise<{url:string}>;
  listMedia():Promise<MediaInfo[]>;
  deleteImage(id:string):Promise<void>;
}

