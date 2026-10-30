import {useEffect,useMemo,useRef,useState} from "react";
import {preloaderConfig} from "../config/preloader";

export type PreloaderPhase="hidden"|"visible"|"exiting"|"done";

function sessionWasShown(){
  if(!preloaderConfig.oncePerSession)return false;
  try{return sessionStorage.getItem(preloaderConfig.sessionKey)==="1"}catch{return false}
}

function markSession(){
  if(!preloaderConfig.oncePerSession)return;
  try{sessionStorage.setItem(preloaderConfig.sessionKey,"1")}catch{/* El almacenamiento puede estar bloqueado. */}
}

function debugMode(){return import.meta.env.DEV?new URLSearchParams(window.location.search).get("__preloader"):null}
function prefersReducedMotion(){return typeof window!=="undefined"&&(debugMode()==="reduced"||window.matchMedia("(prefers-reduced-motion: reduce)").matches)}

export function usePreloader({active,poster,logo}:{active:boolean;poster:string;logo:string}){
  const shouldStart=useMemo(()=>active&&preloaderConfig.enabled&&!prefersReducedMotion()&&!sessionWasShown(),[active]);
  const [phase,setPhase]=useState<PreloaderPhase>(shouldStart?"visible":"done");
  const [readyCount,setReadyCount]=useState(0);
  const [minimumElapsed,setMinimumElapsed]=useState(false);
  const [progress,setProgress]=useState(shouldStart?0:100);
  const completed=useRef(new Set<string>());
  const finishing=useRef(false);
  const previousOverflow=useRef("");
  const startedAt=useRef(0);

  const beginExit=()=>{if(finishing.current||phase==="done")return;finishing.current=true;setProgress(100);setPhase("exiting")};
  const skip=()=>beginExit();

  useEffect(()=>{
    if(!shouldStart)return;
    markSession();
    startedAt.current=Date.now();
    performance.clearMarks("xonetr-preloader:start");performance.clearMarks("xonetr-preloader:end");performance.clearMeasures("xonetr-preloader");performance.mark("xonetr-preloader:start");
    previousOverflow.current=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const mark=(key:string)=>{if(completed.current.has(key))return;completed.current.add(key);setReadyCount(completed.current.size)};
    const currentDebugMode=debugMode();
    const previewMode=currentDebugMode==="preview";
    const simulateBlockedResources=currentDebugMode==="slow"||previewMode;

    if(!simulateBlockedResources){
      if(document.readyState==="complete")mark("window");
      else window.addEventListener("load",()=>mark("window"),{once:true});

      if("fonts" in document)void document.fonts.ready.then(()=>mark("fonts"),()=>mark("fonts"));
      else mark("fonts");

      const preloadImage=(key:string,src:string)=>{const image=new Image();image.onload=()=>mark(key);image.onerror=()=>mark(key);image.src=src;if(image.complete)mark(key)};
      preloadImage("poster",poster);
      preloadImage("logo",logo);
    }

    const minimumTimer=window.setTimeout(()=>setMinimumElapsed(true),preloaderConfig.minimumDuration);
    const maximumTimer=previewMode?undefined:window.setTimeout(beginExit,Math.max(0,preloaderConfig.maximumDuration-preloaderConfig.exitDuration));
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"||event.key==="Enter")beginExit()};
    window.addEventListener("keydown",onKey);
    return()=>{window.clearTimeout(minimumTimer);if(maximumTimer!==undefined)window.clearTimeout(maximumTimer);window.removeEventListener("keydown",onKey);document.body.style.overflow=previousOverflow.current};
  },[poster,logo,shouldStart]);

  useEffect(()=>{if(phase==="visible"&&readyCount>=4&&minimumElapsed)beginExit()},[phase,readyCount,minimumElapsed]);

  const target=phase==="exiting"||phase==="done"?100:Math.min(99,readyCount/4*92+(minimumElapsed?7:0));
  useEffect(()=>{
    if(!shouldStart)return;
    let frame=0;
    const tick=()=>{setProgress(current=>{if(Math.abs(target-current)<.5)return target;return Math.min(target,current+Math.max(.35,(target-current)*.11))});frame=requestAnimationFrame(tick)};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[shouldStart,target]);

  useEffect(()=>{
    if(phase!=="exiting")return;
    const timer=window.setTimeout(()=>{
      document.body.style.overflow=previousOverflow.current;
      performance.mark("xonetr-preloader:end");performance.measure("xonetr-preloader","xonetr-preloader:start","xonetr-preloader:end");
      if(import.meta.env.DEV)document.documentElement.dataset.preloaderDuration=String(Date.now()-startedAt.current);
      setPhase("done");
      const root=document.documentElement;
      root.setAttribute("tabindex","-1");
      root.focus({preventScroll:true});
      window.setTimeout(()=>root.removeAttribute("tabindex"),0);
    },preloaderConfig.exitDuration);
    return()=>window.clearTimeout(timer);
  },[phase]);

  return {phase,progress:Math.round(progress),skip,heroReady:phase==="done"};
}

