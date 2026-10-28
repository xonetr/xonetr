import {type RefObject,useEffect,useRef} from "react";
import {cursorTrailConfig,cursorTrailEnabled} from "../config/cursorTrail";

type Options={containerRef:RefObject<HTMLElement|null>;suspended?:boolean};

const reducedRadiusSelector="a,button,input,textarea,select,[role='button'],[contenteditable='true'],.hero__eyebrow,.hero h1,.hero__description";

function hashCell(x:number,y:number,seed:number){
  let value=Math.imul(x+374761393,y+668265263)^Math.imul(seed+1442695041,1274126177);
  value=Math.imul(value^(value>>>13),1274126177);
  return (value^(value>>>16))>>>0;
}

export function useCursorTrail({containerRef,suspended=false}:Options){
  const canvasRef=useRef<HTMLCanvasElement>(null);

  useEffect(()=>{
    const container=containerRef.current,canvas=canvasRef.current;
    if(!container||!canvas||suspended||!cursorTrailEnabled()||window.location.pathname.startsWith("/admin"))return;

    const finePointer=window.matchMedia("(pointer: fine) and (hover: hover)");
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
    const canRun=()=>finePointer.matches&&!reducedMotion.matches;
    if(!canRun())return;
    const context=canvas.getContext("2d");
    if(!context)return;

    let frame=0,width=0,height=0,left=0,top=0;
    let heroVisible=false,documentVisible=document.visibilityState==="visible",pointerInside=false;
    let lastClientX=0,lastClientY=0,targetX=0,targetY=0,currentX=0,currentY=0,hasPosition=false;
    let interactionTarget=1,interactionScale=1,visibilityScale=0;
    let transitionFrom=0,transitionTo=0,transitionStarted=0;

    const clear=()=>context.clearRect(0,0,width,height);
    const updateBounds=()=>{
      const bounds=container.getBoundingClientRect();
      left=bounds.left;top=bounds.top;
      if(pointerInside){targetX=lastClientX-left;targetY=lastClientY-top}
    };
    const resize=()=>{
      updateBounds();
      const bounds=container.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
      width=bounds.width;height=bounds.height;
      canvas.width=Math.max(1,Math.round(width*dpr));
      canvas.height=Math.max(1,Math.round(height*dpr));
      context.setTransform(dpr,0,0,dpr,0,0);
      clear();
    };
    const stopFrame=()=>{if(frame)cancelAnimationFrame(frame);frame=0};
    const hardStop=()=>{stopFrame();visibilityScale=0;transitionFrom=0;transitionTo=0;clear()};
    const requestFrame=()=>{if(!frame)frame=requestAnimationFrame(tick)};
    const transition=(to:number,now=performance.now())=>{
      transitionFrom=visibilityScale;transitionTo=to;transitionStarted=now;requestFrame();
    };
    const updatePointer=(event:PointerEvent)=>{
      lastClientX=event.clientX;lastClientY=event.clientY;
      targetX=lastClientX-left;targetY=lastClientY-top;
      const target=event.target instanceof Element?event.target:null;
      interactionTarget=target?.closest(reducedRadiusSelector)?cursorTrailConfig.interactionScale:1;
      if(!hasPosition){currentX=targetX;currentY=targetY;hasPosition=true}
    };
    const drawGlow=(radius:number)=>{
      const steps=8;
      context.fillStyle=cursorTrailConfig.glowColor;
      context.globalAlpha=cursorTrailConfig.glowOpacity/steps;
      for(let step=steps;step>0;step--){
        context.beginPath();
        context.arc(currentX,currentY,radius*step/steps,0,Math.PI*2);
        context.fill();
      }
    };
    const drawCharacters=(radius:number,now:number)=>{
      const spacing=cursorTrailConfig.gridSpacing,radiusSquared=radius*radius;
      const startColumn=Math.ceil((currentX-radius)/spacing),endColumn=Math.floor((currentX+radius)/spacing);
      const startRow=Math.ceil((currentY-radius)/spacing),endRow=Math.floor((currentY+radius)/spacing);
      const intervalRange=cursorTrailConfig.maxChangeInterval-cursorTrailConfig.minChangeInterval+1;
      context.fillStyle=cursorTrailConfig.color;
      context.font=`500 ${cursorTrailConfig.fontSize}px "JetBrains Mono", monospace`;
      context.textAlign="center";context.textBaseline="middle";
      for(let row=startRow;row<=endRow;row++){
        const y=row*spacing,dy=y-currentY;
        for(let column=startColumn;column<=endColumn;column++){
          const x=column*spacing,dx=x-currentX,distanceSquared=dx*dx+dy*dy;
          if(distanceSquared>radiusSquared)continue;
          const base=hashCell(column,row,0),interval=cursorTrailConfig.minChangeInterval+base%intervalRange;
          const phase=hashCell(column,row,1)%interval,step=Math.floor((now+phase)/interval);
          const characterIndex=hashCell(column,row,step)%cursorTrailConfig.characters.length;
          const radialOpacity=1-Math.sqrt(distanceSquared)/radius;
          context.globalAlpha=cursorTrailConfig.intensity*Math.pow(radialOpacity,.8);
          context.fillText(cursorTrailConfig.characters[characterIndex],x,y);
        }
      }
    };
    function tick(now:number){
      frame=0;
      if(!heroVisible||!documentVisible||!canRun()){hardStop();return}
      const duration=transitionTo===1?cursorTrailConfig.enterDuration:cursorTrailConfig.exitDuration;
      const progress=Math.min(1,(now-transitionStarted)/duration);
      visibilityScale=transitionFrom+(transitionTo-transitionFrom)*progress;
      currentX+=(targetX-currentX)*cursorTrailConfig.smoothing;
      currentY+=(targetY-currentY)*cursorTrailConfig.smoothing;
      interactionScale+=(interactionTarget-interactionScale)*cursorTrailConfig.smoothing;
      clear();
      const radius=cursorTrailConfig.radius*visibilityScale*interactionScale;
      if(radius>.5){drawGlow(radius);drawCharacters(radius,now)}
      context!.globalAlpha=1;
      if(!pointerInside&&transitionTo===0&&progress>=1){hardStop();return}
      if(pointerInside||progress<1)frame=requestAnimationFrame(tick);
    }
    const onPointerEnter=(event:PointerEvent)=>{
      pointerInside=true;updatePointer(event);
      if(heroVisible&&documentVisible&&canRun())transition(1);
    };
    const onPointerMove=(event:PointerEvent)=>{updatePointer(event);if(pointerInside&&heroVisible&&documentVisible&&canRun())requestFrame()};
    const onPointerLeave=()=>{pointerInside=false;interactionTarget=1;if(frame||visibilityScale>0)transition(0)};
    const onScroll=()=>updateBounds();
    const observer=new IntersectionObserver(([entry])=>{
      heroVisible=entry.isIntersecting;
      if(!heroVisible)hardStop();
      else if(pointerInside&&documentVisible&&canRun())transition(1);
    },{threshold:.08});
    const onVisibilityChange=()=>{
      documentVisible=document.visibilityState==="visible";
      if(!documentVisible)hardStop();
      else if(pointerInside&&heroVisible&&canRun())transition(1);
    };
    const onPreferenceChange=()=>{if(!canRun())hardStop();else if(pointerInside&&heroVisible&&documentVisible)transition(1)};

    resize();
    observer.observe(container);
    container.addEventListener("pointerenter",onPointerEnter,{passive:true});
    container.addEventListener("pointermove",onPointerMove,{passive:true});
    container.addEventListener("pointerleave",onPointerLeave,{passive:true});
    window.addEventListener("resize",resize,{passive:true});
    window.addEventListener("scroll",onScroll,{passive:true});
    document.addEventListener("visibilitychange",onVisibilityChange);
    finePointer.addEventListener("change",onPreferenceChange);
    reducedMotion.addEventListener("change",onPreferenceChange);
    return()=>{
      observer.disconnect();
      container.removeEventListener("pointerenter",onPointerEnter);
      container.removeEventListener("pointermove",onPointerMove);
      container.removeEventListener("pointerleave",onPointerLeave);
      window.removeEventListener("resize",resize);
      window.removeEventListener("scroll",onScroll);
      document.removeEventListener("visibilitychange",onVisibilityChange);
      finePointer.removeEventListener("change",onPreferenceChange);
      reducedMotion.removeEventListener("change",onPreferenceChange);
      hardStop();
    };
  },[containerRef,suspended]);

  return canvasRef;
}
