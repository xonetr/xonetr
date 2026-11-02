import {ArrowLeft} from "../components/icons";

type LegalContent={readonly title:string;readonly date:string;readonly paragraphs:readonly string[]};

export function LegalPage({content}:{content:LegalContent}){
  return <article className="legal-page"><div className="site-container legal-page__inner"><p className="eyebrow">// INFORMACIÓN LEGAL</p><h1>{content.title}</h1><p className="legal-page__date">{content.date}</p><div className="legal-page__content">{content.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}</div><a className="legal-page__back" href="/"><ArrowLeft/>Volver al inicio</a></div></article>;
}
