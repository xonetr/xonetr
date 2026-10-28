import {useEffect,useRef,useState} from "react";
import {ArrowUpRight} from "../components/icons";
import {useSiteContent} from "../content/ContentProvider";

function Orbit(){
  const artRef=useRef<HTMLDivElement>(null);
  const svgRef=useRef<SVGSVGElement>(null);

  useEffect(()=>{
    const art=artRef.current,svg=svgRef.current;
    if(!art||!svg)return;
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible=false;
    const sync=()=>{
      const paused=!visible||document.visibilityState!=="visible"||reducedMotion.matches;
      art.classList.toggle("is-orbit-paused",paused);
      svg.classList.toggle("is-paused",paused);
      if(paused)svg.pauseAnimations();else svg.unpauseAnimations();
    };
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()},{threshold:.1});
    observer.observe(art);
    document.addEventListener("visibilitychange",sync);
    reducedMotion.addEventListener("change",sync);
    sync();
    return()=>{observer.disconnect();document.removeEventListener("visibilitychange",sync);reducedMotion.removeEventListener("change",sync);svg.pauseAnimations()};
  },[]);

  return <div ref={artRef} className="mosaic__art">
    <div className="purpose-glow" aria-hidden="true"/><div className="purpose-star-glow" aria-hidden="true"/>
    <svg ref={svgRef} className="orbit" viewBox="0 0 500 360" aria-hidden="true" focusable="false">
      <path id="orbit-horizontal-path" className="orbit__path" d="M84 180A166 72 0 1 1 416 180A166 72 0 1 1 84 180"/>
      <g className="orbit__inclined" transform="rotate(62 250 180)">
        <path id="orbit-tilted-path" className="orbit__path" d="M84 180A166 72 0 1 0 416 180A166 72 0 1 0 84 180"/>
        <circle className="orbit__dot" r="5"><animateMotion dur="22s" begin="-3s" repeatCount="indefinite" calcMode="linear"><mpath href="#orbit-tilted-path"/></animateMotion></circle>
        <circle className="orbit__dot orbit__dot--secondary" r="3"><animateMotion dur="22s" begin="-14s" repeatCount="indefinite" calcMode="linear"><mpath href="#orbit-tilted-path"/></animateMotion></circle>
      </g>
      <circle className="orbit__dot" r="6"><animateMotion dur="14s" repeatCount="indefinite" calcMode="linear"><mpath href="#orbit-horizontal-path"/></animateMotion></circle>
      <circle className="orbit__dot orbit__dot--secondary" r="3.6"><animateMotion dur="14s" begin="-7s" repeatCount="indefinite" calcMode="linear"><mpath href="#orbit-horizontal-path"/></animateMotion></circle>
      <g className="orbit__star-rotation"><path className="orbit__star" d="M250 126c7 31 24 47 54 54-30 7-47 24-54 54-7-30-24-47-54-54 30-7 47-23 54-54Z"/></g>
    </svg>
  </div>;
}

export function PurposeFaq(){
  const {purpose,faq}=useSiteContent();
  const [open,setOpen]=useState(0);
  return <section className="mosaic" aria-label="Propósito y preguntas frecuentes"><div id="proposito" className="mosaic__purpose"><div className="mosaic__copy"><p className="eyebrow">// {purpose.eyebrow}</p><h2>{purpose.title}</h2><p className="mosaic__description">{purpose.description}</p><ol className="purpose-principles">{purpose.principles.map(item=><li key={item.number}><span>{item.number} {item.label}</span><p>{item.description}</p></li>)}</ol></div><Orbit/></div><div id="faq" className="mosaic__faq"><header><p className="eyebrow">// {faq.eyebrow}</p><h2>{faq.title}</h2><div className="faq-contact"><p>{faq.prompt}</p><a href={faq.cta.href}>{faq.cta.label}<ArrowUpRight/></a></div></header><div className="accordion">{faq.items.map((item,index)=>{const expanded=open===index;return <div className="accordion__item" key={item.question}><h3><button type="button" aria-expanded={expanded} aria-controls={`faq-answer-${index}`} onClick={()=>setOpen(expanded?-1:index)}><span>{item.question}</span><i aria-hidden="true"/></button></h3><div id={`faq-answer-${index}`} className={`accordion__answer ${expanded?"is-open":""}`}><div><p>{item.answer}</p></div></div></div>})}</div></div></section>;
}
