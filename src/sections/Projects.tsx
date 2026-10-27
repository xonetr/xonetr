import {useState} from "react";
import {ArrowUpRight} from "../components/icons";
import {Reveal} from "../components/ui/Reveal";
import {SectionHeader} from "../components/ui/SectionHeader";
import {useSiteContent} from "../content/ContentProvider";

function ProjectWireframe({index}:{index:number}){
  const drawings=[
    <g key="school"><rect x="8" y="8" width="184" height="104" rx="7"/><path d="M8 27h184M43 27v85"/><circle cx="20" cy="18" r="2"/><circle cx="28" cy="18" r="2"/><path d="M17 40h17M17 52h12M17 64h15M54 40h72M54 51h120M54 62h120M54 73h120M54 84h88"/><rect x="151" y="92" width="24" height="8" rx="4"/></g>,
    <g key="site"><rect x="8" y="8" width="184" height="104" rx="7"/><path d="M8 27h184M19 18h36M144 18h10m8 0h10m8 0h4"/><rect x="20" y="38" width="160" height="35" rx="3"/><path d="M30 48h56M30 58h38"/><rect x="20" y="83" width="47" height="17" rx="2"/><rect x="77" y="83" width="47" height="17" rx="2"/><rect x="134" y="83" width="46" height="17" rx="2"/></g>,
    <g key="dashboard"><rect x="8" y="8" width="184" height="104" rx="7"/><rect x="20" y="20" width="45" height="25" rx="3"/><rect x="77" y="20" width="45" height="25" rx="3"/><rect x="134" y="20" width="46" height="25" rx="3"/><path d="M29 35h24M86 35h24M143 35h25M24 92V63m16 29V74m16 18V58m16 34V69m16 23V51m16 41V65m16 27V57m16 35V72m16 20V61"/></g>,
    <g key="app"><rect x="65" y="5" width="70" height="110" rx="12"/><path d="M88 15h24M77 31h46M77 45h46M77 59h46M77 73h46M77 87h31"/><circle cx="82" cy="38" r="2"/><circle cx="82" cy="52" r="2"/><circle cx="82" cy="66" r="2"/><circle cx="82" cy="80" r="2"/><path d="M95 106h10"/></g>,
  ];
  return <svg className="project-wireframe" viewBox="0 0 200 120" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">{drawings[index]}</svg>;
}

export function Projects(){
  const {projects}=useSiteContent();const [filter,setFilter]=useState("Todos");
  const visible=projects.items.filter(project=>(project.visible??true)&&(filter==="Todos"||project.category===filter));
  return <section id="proyectos" className="content-section projects" aria-labelledby="projects-title"><div className="site-container"><Reveal><div className="projects__heading"><SectionHeader id="projects-title" eyebrow={projects.eyebrow} title={projects.title}/><div className="project-filters" aria-label="Filtrar proyectos">{projects.filters.map(item=><button type="button" key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</div></div></Reveal><div className="projects__grid">{visible.map((project,index)=><Reveal key={project.title} delay={index*70}><article className="project-card card-shell"><div className={`project-card__visual project-card__visual--${project.accent}`} role="img" aria-label={project.image?`Vista de ${project.title}`:`Representación visual provisional de ${project.title}`}><span className="project-card__pill">{project.category}</span>{project.image?<img className="project-card__image" src={project.image} alt="" width="800" height="500" loading="lazy"/>:<ProjectWireframe index={projects.items.indexOf(project)}/>}<span className="project-card__index">0{index+1}</span></div><div className="project-card__body"><div><p>{project.category}</p><h3>{project.title}</h3></div><ArrowUpRight/><p className="project-card__description">{project.description}</p></div></article></Reveal>)}</div></div></section>
}
