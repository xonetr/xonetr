import {useEffect,useRef} from "react";

export function ConfirmDialog({open,title,description,confirmLabel="Confirmar",danger=false,onConfirm,onClose}:{open:boolean;title:string;description:string;confirmLabel?:string;danger?:boolean;onConfirm:()=>void|Promise<void>;onClose:()=>void}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const dialog=ref.current;if(!dialog)return;const focusable=Array.from(dialog.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])'));focusable[0]?.focus();const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();if(event.key!=="Tab"||focusable.length===0)return;const first=focusable[0],last=focusable.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[open,onClose]);
  if(!open)return null;
  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div ref={ref} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><p className="admin-kicker">// CONFIRMACIÓN</p><h2 id="admin-dialog-title">{title}</h2><p>{description}</p><div className="admin-dialog__actions"><button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancelar</button><button type="button" className={`admin-button ${danger?"admin-button--danger":"admin-button--primary"}`} onClick={()=>void onConfirm()}>{confirmLabel}</button></div></div></div>;
}

