import {useState} from "react";
import {GitHubIcon,LinkedInIcon} from "../components/icons";
import {Reveal} from "../components/ui/Reveal";
import {SectionHeader} from "../components/ui/SectionHeader";
import {useSiteContent} from "../content/ContentProvider";
import type {SiteContent} from "../content/schema";

type Member=SiteContent["team"]["members"][number];

function SocialIcon({label}:{label:string}){
  const normalized=label.toLowerCase();
  if(normalized.includes("linkedin"))return <LinkedInIcon/>;
  if(normalized.includes("github"))return <GitHubIcon/>;
  return <span aria-hidden="true">↗</span>;
}

function MemberDetail({member}:{member:Member}){
  const links=["LinkedIn","GitHub"].map(label=>member.links?.find(link=>link.label.toLowerCase()===label.toLowerCase())??{label,href:""});
  return <div className="member-detail"><div className="member-detail__portrait" role="img" aria-label={member.photo?member.photoAlt||`Foto de ${member.name}`:`Foto provisional de ${member.name}`}>{member.photo?<img src={member.photo} alt="" width="520" height="520" loading="lazy"/>:<span>{member.initials}</span>}</div><div><p>{member.role}</p><h3>{member.name}</h3><blockquote>“{member.bio}”</blockquote><div className="member-detail__socials" aria-label={`Perfiles de ${member.name}`}>{links.map(link=>link.href.trim()?<a href={link.href} key={link.label} target="_blank" rel="noreferrer" aria-label={`${link.label} de ${member.name}`} title={link.label}><SocialIcon label={link.label}/></a>:<span className="member-detail__social-placeholder" key={link.label} role="img" aria-label={`${link.label} todavía no configurado`} title={`${link.label} todavía no configurado`}><SocialIcon label={link.label}/></span>)}</div></div></div>;
}

export function Team(){
  const {team}=useSiteContent();
  const [selected,setSelected]=useState(0);
  const selectedMember=team.members[selected]??team.members[0];
  return <section id="equipo" className="content-section team" aria-labelledby="team-title"><div className="site-container"><Reveal><SectionHeader id="team-title" eyebrow={team.eyebrow} title={team.title}/></Reveal><div className="team__layout"><div className="team__list" role="list" aria-label="Integrantes del equipo">{team.members.map((member,index)=><div role="listitem" key={member.name} className={`team-member team-member--${index+1}`}><button type="button" className={selected===index?"is-selected":""} aria-pressed={selected===index} onClick={()=>setSelected(index)} onMouseEnter={()=>setSelected(index)} onFocus={()=>setSelected(index)}><span>0{index+1}</span>{member.name}</button>{selected===index&&<div className="member-mobile"><MemberDetail member={member}/></div>}</div>)}</div>{selectedMember&&<Reveal className="member-desktop"><MemberDetail member={selectedMember}/></Reveal>}</div></div></section>;
}
