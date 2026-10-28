import type {ReactNode} from "react";

const paths:Record<string,ReactNode>={
  summary:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  code:<><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></>,
  layers:<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
  "git-branch":<><circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M8 11h4a6 6 0 0 0 6-3"/></>,
  "folder-kanban":<><path d="M3 6h7l2 2h9v12H3V6Z"/><path d="M8 12v4M12 11v6M16 13v3"/></>,
  users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  "circle-help":<><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.4 1.7c-.9.8-2.1 1.2-2.1 2.8M12 17h.01"/></>,
  tag:<><path d="M20 13 13 20 4 11V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.3"/></>,
  mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  "panel-bottom":<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18M8 18h8"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 3.1h5l.3-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z"/></>,
  image:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 18 5-5 3 3 3-4 5 6"/></>,
  history:<><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 7v5l3 2"/></>,
  menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  chevron:<path d="m9 18 6-6-6-6"/>,
};

export function AdminIcon({name}:{name:string}){
  const common={fill:"none",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]??paths.summary}</svg>;
}
