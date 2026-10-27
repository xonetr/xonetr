import {useState} from "react";
import {ArrowUpRight} from "../components/icons";
import {Reveal} from "../components/ui/Reveal";
import {SectionHeader} from "../components/ui/SectionHeader";
import {siteContent} from "../content";

export function Projects(){
  const {projects}=siteContent;const [filter,setFilter]=useState("Todos");
  const visible=projects.items.filter(project=>filter==="Todos"||project.category===filter);
  return <section id="proyectos" className="content-section projects" aria-labelledby="projects-title"><div className="site-container"><Reveal><div className="projects__heading"><SectionHeader id="projects-title" eyebrow={projects.eyebrow} title={projects.title}/><div className="project-filters" aria-label="Filtrar proyectos">{projects.filters.map(item=><button type="button" key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</div></div></Reveal><div className="projects__grid">{visible.map((project,index)=><Reveal key={project.title} delay={index*70}><article className="project-card card-shell"><div className={`project-card__visual project-card__visual--${project.accent}`} role="img" aria-label={`Representación visual provisional de ${project.title}`}><span className="project-card__pill">{project.category}</span><div className="project-mock" aria-hidden="true"><i/><i/><i/><b/><b/><b/></div><span className="project-card__index">0{index+1}</span></div><div className="project-card__body"><div><p>{project.category}</p><h3>{project.title}</h3></div><ArrowUpRight/><p className="project-card__description">{project.description}</p></div></article></Reveal>)}</div></div></section>
}
