import {ArrowUpRight,ServiceGlyph} from "../components/icons";
import {Reveal} from "../components/ui/Reveal";
import {useSiteContent} from "../content/ContentProvider";

function ServiceWireframe({index}:{index:number}){
  const drawings=[
    <g key="web"><rect x="8" y="10" width="104" height="68" rx="5"/><path d="M8 25h104M18 18h2m7 0h2m9 18h34M18 48h42m-42 10h56m-56 10h32"/><rect x="80" y="36" width="22" height="30" rx="2"/></g>,
    <g key="app"><rect x="37" y="5" width="50" height="78" rx="8"/><path d="M51 14h22M45 27h34M45 38h34M45 49h22M45 68h34"/><circle cx="62" cy="76" r="2"/></g>,
    <g key="system"><ellipse cx="60" cy="18" rx="38" ry="10"/><path d="M22 18v22c0 5.5 17 10 38 10s38-4.5 38-10V18M22 40v22c0 5.5 17 10 38 10s38-4.5 38-10V40"/><path d="M107 31h8m-4-4v8M10 57h8m-4-4v8"/></g>,
  ];
  return <svg className="service-wireframe" viewBox="0 0 120 90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">{drawings[index]}</svg>;
}

export function Services(){
  const {services}=useSiteContent();
  return <section id="servicios" className="content-section services" aria-labelledby="services-title"><div className="site-container"><Reveal><header className="services__header"><div><p className="eyebrow">// {services.eyebrow}</p><h2 id="services-title">{services.title}</h2></div><p>{services.intro}</p></header></Reveal><div className="services__stack"><svg className="service-connector" viewBox="0 0 1000 1050" preserveAspectRatio="none" aria-hidden="true"><path d="M210 334V346H500V359"/><path d="M500 693V706H790V718"/><circle cx="210" cy="334" r="4"/><circle cx="500" cy="359" r="4"/><circle cx="500" cy="693" r="4"/><circle cx="790" cy="718" r="4"/></svg>{services.items.map((item,index)=>{const cta=item.cta??{label:"Cotizar este servicio",href:"#contacto"};return <Reveal key={`${item.number}-${item.title}`} delay={index*90} className={`service-offset service-offset--${index+1}`}><article className="service-card card-shell"><span className="corner-mark corner-mark--tl" aria-hidden="true">+</span><span className="corner-mark corner-mark--br" aria-hidden="true">+</span><div className="service-card__top"><span className="service-card__number">{item.number}</span><span className="service-card__icon"><ServiceGlyph index={index}/></span></div><div className="service-card__copy"><h3>{item.title}</h3><p>{item.description}</p></div><ul className="service-card__features" aria-label={`Incluye ${item.title}`}>{item.features.map(feature=><li key={feature}>{feature}</li>)}</ul><a className="service-card__link" href={cta.href}>{cta.label} <ArrowUpRight/></a><ServiceWireframe index={index}/></article></Reveal>})}</div></div></section>;
}
