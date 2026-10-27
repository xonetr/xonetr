import {useSiteContent} from "../content/ContentProvider";

export function Footer(){
  const siteContent=useSiteContent();
  const {footer,contact,navigation}=siteContent;
  const logo=siteContent.settings?.logo||"/assets/xonetr-logo.png";
  const onHome=window.location.pathname==="/";
  const pageHref=(href:string)=>onHome?href:`/${href}`;
  const socials=footer.socials.filter(item=>item.href.trim());
  const columns=footer.columns?.length?footer.columns:[{title:"Navegación",links:navigation},{title:"Contacto",links:[{label:contact.email,href:`mailto:${contact.email}`},{label:contact.whatsappLabel,href:contact.whatsappHref}]}];
  return <footer className="footer" id="site-footer"><div className="site-container"><div className="footer__main"><div className="footer__brand"><a href={pageHref("#inicio")}><img src={logo} width="52" height="52" alt=""/><span>{siteContent.brand.legalName}</span></a><p>{footer.description}</p></div>{columns.map(column=><div className="footer__column" key={column.title}><h2>{column.title}</h2>{column.links.map(link=><a key={`${link.label}-${link.href}`} href={link.href.startsWith("#")?pageHref(link.href):link.href}>{link.label}</a>)}</div>)}{socials.length>0&&<div className="footer__column"><h2>Redes</h2>{socials.map(item=><a key={item.label} href={item.href} target="_blank" rel="noreferrer">{item.label}</a>)}</div>}</div><div className="footer__bottom"><span>© 2026 {siteContent.brand.legalName}</span><div className="footer__legal"><a href="/privacidad">Política de privacidad</a><a href="/terminos">Términos</a></div><a className="footer__top" href={pageHref("#inicio")}>Volver arriba ↑</a></div></div><div className="footer__watermark" aria-hidden="true">{siteContent.brand.name}</div></footer>;
}
