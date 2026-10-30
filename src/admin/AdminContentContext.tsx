import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {contentRepository} from "../data";
import {siteContentSchema,type SiteContent} from "../content/schema";
import {useAdminAuth} from "./AuthContext";

type ContentSection=keyof SiteContent;
type AdminContentValue={published:SiteContent|null;draft:SiteContent|null;loading:boolean;error:string|null;unsavedSections:ContentSection[];changedSections:ContentSection[];updateDraft:(content:SiteContent,section:ContentSection)=>void;saveDraft:()=>Promise<void>;publish:()=>Promise<void>;discardDraft:()=>Promise<void>;uploadImage:(file:File)=>Promise<{url:string}>;reload:()=>Promise<void>};
const AdminContentContext=createContext<AdminContentValue|null>(null);

const changedKeys=(left:SiteContent|null,right:SiteContent|null)=>(!left||!right?[]:Object.keys(left).filter(key=>JSON.stringify(left[key as ContentSection])!==JSON.stringify(right[key as ContentSection])) as ContentSection[]);

export function AdminContentProvider({children}:{children:ReactNode}){
  const {session}=useAdminAuth();
  const [published,setPublished]=useState<SiteContent|null>(null);const [savedDraft,setSavedDraft]=useState<SiteContent|null>(null);const [draft,setDraft]=useState<SiteContent|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
  const reload=async()=>{setLoading(true);setError(null);try{const [nextPublished,nextDraft]=await Promise.all([contentRepository.getPublished(),contentRepository.getDraft()]);setPublished(nextPublished);setSavedDraft(nextDraft);setDraft(nextDraft)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo cargar el contenido.")}finally{setLoading(false)}};
  useEffect(()=>{void reload()},[]);
  const value=useMemo<AdminContentValue>(()=>({published,draft,loading,error,unsavedSections:changedKeys(draft,savedDraft),changedSections:changedKeys(draft,published),updateDraft(content){setDraft(content)},async saveDraft(){if(!draft)return;const valid=siteContentSchema.parse(draft);await contentRepository.saveDraft(valid);setSavedDraft(valid);setDraft(valid)},async publish(){if(!draft)return;const valid=siteContentSchema.parse(draft);await contentRepository.saveDraft(valid);await contentRepository.publish({name:session?.name,email:session?.email??"administrador@local"});setPublished(valid);setSavedDraft(valid);setDraft(valid)},async discardDraft(){await contentRepository.discardDraft();if(published){setSavedDraft(published);setDraft(published)}},uploadImage(file){return contentRepository.uploadImage(file)},reload}),[published,savedDraft,draft,loading,error,session]);
  return <AdminContentContext.Provider value={value}>{children}</AdminContentContext.Provider>;
}

export function useAdminContent(){const value=useContext(AdminContentContext);if(!value)throw new Error("useAdminContent debe usarse dentro de AdminContentProvider.");return value}

