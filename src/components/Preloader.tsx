import type {PreloaderPhase} from "../hooks/usePreloader";

const letters=[..."XONETR"];

export function Preloader({phase,progress,onSkip}:{phase:PreloaderPhase;progress:number;onSkip:()=>void}){
  if(phase==="done"||phase==="hidden")return null;
  return <div className={`xonetr-preloader ${phase==="exiting"?"is-exiting":""}`} role="status" aria-live="polite" aria-label="Cargando XONETR" onClick={onSkip}>
    <div className="preloader__half preloader__half--top" aria-hidden="true"/><div className="preloader__half preloader__half--bottom" aria-hidden="true"/>
    <button className="preloader__skip" type="button" onClick={event=>{event.stopPropagation();onSkip()}}>Saltar animación</button>
    <span className="preloader__corner preloader__corner--tl" aria-hidden="true">+</span><span className="preloader__corner preloader__corner--tr" aria-hidden="true">+</span><span className="preloader__corner preloader__corner--bl" aria-hidden="true">+</span><span className="preloader__corner preloader__corner--br" aria-hidden="true">+</span>
    <div className="preloader__center">
      <div className="preloader__glow" aria-hidden="true"/>
      <svg className="preloader__mark" viewBox="0 0 500 360" aria-hidden="true">
        <defs><linearGradient id="preloader-orbit-gradient" x1=".08" y1=".15" x2=".9" y2=".82"><stop stopColor="#BCBDF6"/><stop offset="1" stopColor="#747EFA"/></linearGradient><filter id="preloader-star-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <ellipse className="preloader__orbit" cx="250" cy="180" rx="166" ry="72"/><ellipse className="preloader__orbit preloader__orbit--tilt" cx="250" cy="180" rx="166" ry="72"/>
        <circle className="preloader__dot" cx="84" cy="180" r="5"/><circle className="preloader__dot" cx="416" cy="180" r="3.5"/>
        <path className="preloader__star" filter="url(#preloader-star-glow)" d="M250 126c7 31 24 47 54 54-30 7-47 24-54 54-7-30-24-47-54-54 30-7 47-23 54-54Z"/>
      </svg>
      <div className="preloader__word" aria-hidden="true">{letters.map((letter,index)=><span key={letter} style={{animationDelay:`${300+index*40}ms`}}>{letter}</span>)}</div>
      <div className="preloader__track" aria-hidden="true"><span style={{transform:`scaleX(${progress/100})`}}/></div>
    </div>
    <output className="preloader__counter" aria-hidden="true">{String(progress).padStart(2,"0")}%</output>
  </div>;
}

