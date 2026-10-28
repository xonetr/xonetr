import type {RefObject} from "react";
import {useCursorTrail} from "../hooks/useCursorTrail";
import "./CursorTrail.css";

export function CursorTrail({containerRef,suspended=false}:{containerRef:RefObject<HTMLElement|null>;suspended?:boolean}){
  const canvasRef=useCursorTrail({containerRef,suspended});
  return <canvas ref={canvasRef} className="cursor-trail" aria-hidden="true"/>;
}
