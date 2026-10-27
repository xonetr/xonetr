import {ArrowUpRight} from "../components/icons";
import {Reveal} from "../components/ui/Reveal";
import {SectionHeader} from "../components/ui/SectionHeader";
import {useSiteContent} from "../content/ContentProvider";

export function Pricing(){
  const {pricing}=useSiteContent();
  if(!pricing?.enabled)return null;
  return <section id="precios" className="content-section pricing" aria-labelledby="pricing-title"><div className="site-container"><Reveal><SectionHeader id="pricing-title" eyebrow={pricing.eyebrow} title={pricing.title} description={pricing.intro}/></Reveal><div className="pricing__grid">{pricing.plans.map((plan,index)=><Reveal key={`${plan.name}-${index}`} delay={index*70}><article className={`pricing-card card-shell ${plan.featured?"is-featured":""}`}><p className="pricing-card__number">{String(index+1).padStart(2,"0")}</p><h3>{plan.name}</h3><p className="pricing-card__price">{plan.priceFrom}</p><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul><a href={plan.buttonHref}>{plan.buttonLabel}<ArrowUpRight/></a></article></Reveal>)}</div></div></section>;
}
