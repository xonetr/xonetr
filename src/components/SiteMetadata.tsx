import {useEffect} from "react";
import {useSiteContent} from "../content/ContentProvider";

function setMeta(selector:string,attribute:string,value:string){
  const element=document.head.querySelector<HTMLMetaElement>(selector);
  if(element)element.setAttribute(attribute,value);
}

export function SiteMetadata(){
  const {settings}=useSiteContent();
  useEffect(()=>{
    if(!settings)return;
    document.title=settings.siteTitle;
    setMeta('meta[name="description"]',"content",settings.metaDescription);
    setMeta('meta[property="og:title"]',"content",settings.siteTitle);
    setMeta('meta[property="og:description"]',"content",settings.metaDescription);
    if(settings.ogImage)setMeta('meta[property="og:image"]',"content",settings.ogImage);
    const favicon=document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if(favicon&&settings.favicon)favicon.href=settings.favicon;
  },[settings]);
  return null;
}
