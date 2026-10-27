export function Toast({message}:{message:string}){return <div className={`admin-toast ${message?"is-visible":""}`} role="status" aria-live="polite">{message}</div>}

