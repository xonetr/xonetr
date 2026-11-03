import {Footer} from "./components/Footer";
import {Header} from "./components/Header";
import {SiteMetadata} from "./components/SiteMetadata";
import {Preloader} from "./components/Preloader";
import {useSiteContent} from "./content/ContentProvider";
import {useEffect} from "react";
import {usePreloader} from "./hooks/usePreloader";
import {Contact} from "./sections/Contact";
import {Hero} from "./sections/Hero";
import {LegalPage} from "./sections/LegalPage";
import {Pricing} from "./sections/Pricing";
import {Process} from "./sections/Process";
import {Projects} from "./sections/Projects";
import {PurposeFaq} from "./sections/PurposeFaq";
import {Services} from "./sections/Services";
import {Team} from "./sections/Team";
import {WhatWeDo} from "./sections/WhatWeDo";

export default function App(){
  useEffect(()=>{
    const sessionKey="xonetr.analytics.session";
    let sessionId=sessionStorage.getItem(sessionKey);
    if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem(sessionKey,sessionId)}
    if(sessionStorage.getItem("xonetr.analytics.recorded"))return;
    sessionStorage.setItem("xonetr.analytics.recorded","1");
    fetch("/api/analytics/visit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_type:"page_view",path:window.location.pathname,session_id:sessionId,referrer:document.referrer||null}),keepalive:true}).catch(()=>{});
  },[]);
  const siteContent=useSiteContent();
  const path=window.location.pathname.replace(/\/$/,"")||"/";
  const logo=siteContent.settings?.logo||"/assets/xonetr-logo.png";
  const preloader=usePreloader({active:path==="/",poster:siteContent.hero.background?.poster||"/assets/hero-poster.jpg",logo});
  const legal=path==="/privacidad"?siteContent.legal.privacy:path==="/terminos"?siteContent.legal.terms:null;
  if(legal)return <><SiteMetadata/><Header/><main id="contenido"><LegalPage content={legal}/></main><Footer/></>;
  return <><SiteMetadata/><Preloader phase={preloader.phase} onSkip={preloader.skip} logo={logo}/><Header/><main id="contenido"><Hero entranceReady={preloader.heroReady}/><WhatWeDo/><Services/><Process/><Projects/><Pricing/><Team/><PurposeFaq/><Contact/></main><Footer/></>;
}
