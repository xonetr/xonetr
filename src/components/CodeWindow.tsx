import {useEffect,useRef,useState,type ReactNode} from "react";

const tokenPattern=/(<\/?[A-Za-z][\w-]*|\b(?:class|type|export|function|return|const)\b|"(?:[^"\\]|\\.)*")/g;
function highlight(code:string){
  const nodes:ReactNode[]=[];let cursor=0;let match:RegExpExecArray|null;
  tokenPattern.lastIndex=0;
  while((match=tokenPattern.exec(code))!==null){
    if(match.index>cursor)nodes.push(code.slice(cursor,match.index));
    const token=match[0];const className=token.startsWith("<")?"syntax-tag":token.startsWith('"')?"syntax-string":"syntax-keyword";
    nodes.push(<span className={className} key={`${match.index}-${token}`}>{token}</span>);cursor=match.index+token.length;
  }
  if(cursor<code.length)nodes.push(code.slice(cursor));
  return nodes;
}

export function CodeWindow({language,status,filename,code,delay=0}:{language:string;status:string;filename:string;code:string;delay?:number}){
  const ref=useRef<HTMLDivElement>(null);const reduced=useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);const [started,setStarted]=useState(false);const [count,setCount]=useState(0);
  useEffect(()=>{const node=ref.current;if(!node||reduced.current)return;const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setStarted(true);observer.disconnect()}},{threshold:.35});observer.observe(node);return()=>observer.disconnect()},[]);
  useEffect(()=>{if(!started||reduced.current)return;let timer=0,current=0;const begin=window.setTimeout(()=>{const type=()=>{current++;setCount(current);if(current<code.length)timer=window.setTimeout(type,13+Math.random()*24);else timer=window.setTimeout(()=>{current=0;setCount(0);type()},2600)};type()},delay);return()=>{clearTimeout(begin);clearTimeout(timer)}},[code,delay,started]);
  const typing=started&&!reduced.current;const visible=typing?code.slice(0,count):code;const totalLines=code.split("\n");const visibleLines=visible.split("\n");const activeLine=Math.max(0,visibleLines.length-1);const line=activeLine+1;const column=(visibleLines.at(-1)?.length??0)+1;
  return <div ref={ref} className="code-window card-shell"><span className="corner-mark corner-mark--tl" aria-hidden="true">+</span><span className="corner-mark corner-mark--br" aria-hidden="true">+</span><div className="code-window__bar"><span className="traffic"><i/><i/><i/></span><span>{filename}</span><b>{language}</b></div><pre aria-label={`Ejemplo de código ${language}`}><code>{totalLines.map((_,index)=><span className="code-line" key={index}><span className="code-line__number" aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span className="code-line__body"><span className="code-line__content">{highlight(visibleLines[index]??"")}</span>{typing&&index===activeLine&&<span className="code-cursor" aria-hidden="true"/>}</span></span>)}</code></pre><div className="code-window__status">{status} · UTF-8 · Ln {line}, Col {column}</div></div>;
}
