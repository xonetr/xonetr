import type {SiteContent} from "../content/schema";

export type AdminNavItem={label:string;to:string;icon:string;section?:keyof SiteContent};
export type AdminNavGroup={id:string;label:string;items:AdminNavItem[]};

export const summaryNavigation:AdminNavItem={label:"Resumen",to:"/admin",icon:"summary"};

export const adminNavigationGroups:AdminNavGroup[]=[
  {id:"presentation",label:"Presentación",items:[
  {label:"Inicio",to:"/admin/editar/inicio",icon:"home",section:"hero"},
  {label:"¿Qué hacemos?",to:"/admin/editar/nosotros",icon:"code",section:"whatWeDo"},
  {label:"¿Qué ofrecemos?",to:"/admin/editar/servicios",icon:"layers",section:"services"},
  {label:"¿Cómo trabajamos?",to:"/admin/editar/proceso",icon:"git-branch",section:"process"},
  ]},
  {id:"trust",label:"Confianza",items:[
  {label:"Proyectos",to:"/admin/editar/proyectos",icon:"folder-kanban",section:"projects"},
  {label:"Equipo",to:"/admin/editar/equipo",icon:"users",section:"team"},
  {label:"¿Qué queremos?",to:"/admin/editar/proposito",icon:"target",section:"purpose"},
  {label:"FAQ",to:"/admin/editar/faq",icon:"circle-help",section:"faq"},
  ]},
  {id:"conversion",label:"Conversión",items:[
  {label:"Precios",to:"/admin/editar/precios",icon:"tag",section:"pricing"},
  {label:"Contacto",to:"/admin/editar/contacto",icon:"mail",section:"contact"},
  ]},
  {id:"operations",label:"Operaciones",items:[
  {label:"Dashboard",to:"/admin/operaciones",icon:"summary"},
  {label:"Tablero",to:"/admin/tablero",icon:"folder-kanban"},
  ]},
  {id:"site",label:"Sitio",items:[
  {label:"Pie de página",to:"/admin/editar/footer",icon:"panel-bottom",section:"footer"},
  {label:"Ajustes del sitio",to:"/admin/ajustes",icon:"settings",section:"settings"},
  ]},
  {id:"tools",label:"Herramientas",items:[
  {label:"Medios",to:"/admin/medios",icon:"image"},
  {label:"Historial",to:"/admin/historial",icon:"history"},
  {label:"Autorizaciones",to:"/admin/autorizaciones",icon:"key"},
  ]},
];

export const allAdminNavigation=adminNavigationGroups.flatMap(group=>group.items);
export const editableSections=allAdminNavigation.filter(item=>item.to.startsWith("/admin/editar/"));
export const utilityNavigation=allAdminNavigation.filter(item=>!item.to.startsWith("/admin/editar/"));

export function resolveAdminTitle(pathname:string){
  if(pathname==="/admin")return"Resumen";
  return allAdminNavigation.find(item=>pathname.startsWith(item.to))?.label??"Panel de administración";
}
