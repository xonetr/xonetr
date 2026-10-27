import {useState} from "react";
import {Reveal} from "../components/ui/Reveal";
import {SectionHeader} from "../components/ui/SectionHeader";
import {siteContent} from "../content";

function MemberDetail({member}:{member:(typeof siteContent.team.members)[number]}){return <div className="member-detail"><div className="member-detail__portrait" role="img" aria-label={`Foto provisional de ${member.name}`}><span>{member.initials}</span></div><div><p>{member.role}</p><h3>{member.name}</h3><blockquote>“{member.bio}”</blockquote></div></div>}

export function Team(){const {team}=siteContent;const [selected,setSelected]=useState(0);return <section id="equipo" className="content-section team" aria-labelledby="team-title"><div className="site-container"><Reveal><SectionHeader id="team-title" eyebrow={team.eyebrow} title={team.title}/></Reveal><div className="team__layout"><div className="team__list" role="list" aria-label="Integrantes del equipo">{team.members.map((member,index)=><div role="listitem" key={member.name} className={`team-member team-member--${index+1}`}><button type="button" className={selected===index?"is-selected":""} aria-pressed={selected===index} onClick={()=>setSelected(index)} onMouseEnter={()=>setSelected(index)} onFocus={()=>setSelected(index)}><span>0{index+1}</span>{member.name}</button>{selected===index&&<div className="member-mobile"><MemberDetail member={member}/></div>}</div>)}</div><Reveal className="member-desktop"><MemberDetail member={team.members[selected]}/></Reveal></div></div></section>}
