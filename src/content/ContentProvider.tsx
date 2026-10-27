import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {siteContent as defaultContent} from "../content";
import {contentRepository} from "../data";
import {siteContentSchema,type SiteContent} from "./schema";

type ContentMode="published"|"draft";
type ContentContextValue={content:SiteContent;loading:boolean;error:string|null;refresh:()=>Promise<void>;replaceContent:(content:SiteContent)=>void};
const ContentContext=createContext<ContentContextValue|null>(null);

export function ContentProvider({children,mode="published",initialContent}:{children:ReactNode;mode?:ContentMode;initialContent?:SiteContent}){
  const [content,setContent]=useState<SiteContent>(()=>siteContentSchema.parse(initialContent??defaultContent));
  const [loading,setLoading]=useState(!initialContent);
  const [error,setError]=useState<string|null>(null);
  const load=async()=>{if(initialContent){setContent(siteContentSchema.parse(initialContent));setLoading(false);return}setLoading(true);setError(null);try{setContent(await(mode==="draft"?contentRepository.getDraft():contentRepository.getPublished()))}catch(cause){setContent(siteContentSchema.parse(defaultContent));setError(cause instanceof Error?cause.message:"No se pudo cargar el contenido.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[mode,initialContent]);
  const value=useMemo<ContentContextValue>(()=>({content,loading,error,refresh:load,replaceContent(next){setContent(siteContentSchema.parse(next))}}),[content,loading,error,mode,initialContent]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(){const value=useContext(ContentContext);if(!value)throw new Error("useContent debe usarse dentro de ContentProvider.");return value}
export function useSiteContent(){return useContent().content}

