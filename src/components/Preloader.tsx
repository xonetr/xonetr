import {useEffect,useRef} from "react";
import type {PreloaderPhase} from "../hooks/usePreloader";

export function Preloader({phase,progress,onSkip,logo="/assets/xonetr-logo.png"}:{phase:PreloaderPhase;progress:number;onSkip:()=>void;logo?:string}){
  const dialogRef=useRef<HTMLDivElement>(null);const skipRef=useRef<HTMLButtonElement>(null);
  const blocking=phase!=="done"&&phase!=="hidden";
  useEffect(()=>{if(!blocking)return;const background=[document.querySelector<HTMLElement>(".skip-link"),document.querySelector<HTMLElement>(".site-header"),document.getElementById("contenido"),document.getElementById("site-footer")].filter((element):element is HTMLElement=>Boolean(element));const previous=background.map(element=>({element,ariaHidden:element.getAttribute("aria-hidden"),inert:element.hasAttribute("inert")}));background.forEach(element=>{element.setAttribute("inert","");element.setAttribute("aria-hidden","true")});dialogRef.current?.focus();return()=>previous.forEach(({element,ariaHidden,inert})=>{if(inert)element.setAttribute("inert","");else element.removeAttribute("inert");if(ariaHidden===null)element.removeAttribute("aria-hidden");else element.setAttribute("aria-hidden",ariaHidden)})},[blocking]);
  if(phase==="done"||phase==="hidden")return null;
  return <div ref={dialogRef} tabIndex={-1} className={`xonetr-preloader ${phase==="exiting"?"is-exiting":""}`} role="dialog" aria-modal="true" aria-labelledby="preloader-title" aria-describedby="preloader-instructions" onKeyDown={event=>{if(event.key==="Tab"){event.preventDefault();skipRef.current?.focus()}}} onClick={onSkip}>
    <span id="preloader-title" className="sr-only">Cargando XONETR</span><p id="preloader-instructions" className="sr-only">La animación se puede omitir con el botón Saltar animación, o con las teclas Escape o Enter.</p>
    <div className="preloader__half preloader__half--top" aria-hidden="true"/><div className="preloader__half preloader__half--bottom" aria-hidden="true"/>
    <button ref={skipRef} className="preloader__skip" type="button" onClick={event=>{event.stopPropagation();onSkip()}}>Saltar animación</button>
    <span className="preloader__corner preloader__corner--tl" aria-hidden="true">+</span><span className="preloader__corner preloader__corner--tr" aria-hidden="true">+</span><span className="preloader__corner preloader__corner--bl" aria-hidden="true">+</span><span className="preloader__corner preloader__corner--br" aria-hidden="true">+</span>
    <div className="preloader__center">
      <img className="preloader__logo" src={logo} alt="" aria-hidden="true"/>
      <div className="preloader__track" aria-hidden="true"><span style={{transform:`scaleX(${progress/100})`}}/></div>
    </div>
    <output className="preloader__counter" aria-hidden="true">{String(progress).padStart(2,"0")}%</output>
  </div>;
}

