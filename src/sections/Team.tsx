import {useState} from "react";
import {ArrowUpRight,GitHubIcon,LinkedInIcon} from "../components/icons";
import {Reveal} from "../components/ui/Reveal";
import {SectionHeader} from "../components/ui/SectionHeader";
import {useSiteContent} from "../content/ContentProvider";
import type {SiteContent} from "../content/schema";

type Member=SiteContent["team"]["members"][number];

function SocialIcon({label}:{label:string}){
  const normalized=label.toLowerCase();
  if(normalized.includes("linkedin"))return <LinkedInIcon/>;
  if(normalized.includes("github"))return <GitHubIcon/>;
  return <ArrowUpRight/>;
}

function MemberDetail({member,interactive=true}:{member:Member;interactive?:boolean}){
  const links=["LinkedIn","GitHub"].map(label=>member.links?.find(link=>link.label.toLowerCase()===label.toLowerCase())??{label,href:""});
  return <div className="member-detail"><div className="member-detail__portrait" role="img" aria-label={member.photo?member.photoAlt||`Foto de ${member.name}`:`Foto provisional de ${member.name}`}>{member.photo?<img src={member.photo} alt="" width="520" height="520" loading="lazy"/>:<span>{member.initials}</span>}</div><div><p>{member.role}</p><h3>{member.name}</h3><blockquote>“{member.bio}”</blockquote><div className="member-detail__socials" aria-label={`Perfiles de ${member.name}`}>{links.map(link=>link.href.trim()?<a href={link.href} key={link.label} target="_blank" rel="noreferrer" tabIndex={interactive?undefined:-1} aria-label={`${link.label} de ${member.name}`} title={link.label}><SocialIcon label={link.label}/></a>:<span className="member-detail__social-placeholder" key={link.label} role="img" aria-label={`${link.label} todavía no configurado`} title={`${link.label} todavía no configurado`}><SocialIcon label={link.label}/></span>)}</div></div></div>;
}

export function Team(){
  const {team}=useSiteContent();
  const [selected,setSelected]=useState(0);
  const selectedMember=team.members[selected]??team.members[0];
  return <section id="equipo" className="content-section team" aria-labelledby="team-title"><div className="site-container"><Reveal><SectionHeader id="team-title" eyebrow={team.eyebrow} title={team.title}/></Reveal><div className="team__layout"><div className="team__list" role="list" aria-label="Integrantes del equipo">{team.members.map((member,index)=>{const expanded=selected===index;return <div role="listitem" key={member.name} className={`team-member team-member--${index+1}`}><button type="button" className={expanded?"is-selected":""} aria-expanded={expanded} aria-controls={`team-member-detail-${index}`} onClick={()=>setSelected(index)} onMouseEnter={()=>setSelected(index)} onFocus={()=>setSelected(index)}><span>0{index+1}</span>{member.name}</button><div id={`team-member-detail-${index}`} className={`member-mobile ${expanded?"is-open":""}`} aria-hidden={!expanded}><div><MemberDetail member={member} interactive={expanded}/></div></div></div>})}</div>{selectedMember&&<Reveal className="member-desktop"><MemberDetail member={selectedMember}/></Reveal>}</div></div></section>;
}
