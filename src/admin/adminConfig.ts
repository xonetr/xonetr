import type {SiteContent} from "../content/schema";

export type AdminNavItem={label:string;to:string;icon:string;section?:keyof SiteContent};

export const editableSections:AdminNavItem[]=[
  {label:"Inicio",to:"/admin/editar/inicio",icon:"hero",section:"hero"},
  {label:"¿Qué hacemos?",to:"/admin/editar/nosotros",icon:"code",section:"whatWeDo"},
  {label:"¿Qué ofrecemos?",to:"/admin/editar/servicios",icon:"services",section:"services"},
  {label:"¿Cómo trabajamos?",to:"/admin/editar/proceso",icon:"process",section:"process"},
  {label:"Proyectos",to:"/admin/editar/proyectos",icon:"projects",section:"projects"},
  {label:"Precios",to:"/admin/editar/precios",icon:"pricing",section:"pricing"},
  {label:"¿Qué queremos?",to:"/admin/editar/proposito",icon:"purpose",section:"purpose"},
  {label:"Equipo",to:"/admin/editar/equipo",icon:"team",section:"team"},
  {label:"FAQ",to:"/admin/editar/faq",icon:"faq",section:"faq"},
  {label:"Contacto",to:"/admin/editar/contacto",icon:"contact",section:"contact"},
  {label:"Pie de página",to:"/admin/editar/footer",icon:"footer",section:"footer"},
];

export const utilityNavigation:AdminNavItem[]=[
  {label:"Medios",to:"/admin/medios",icon:"media"},
  {label:"Historial",to:"/admin/historial",icon:"history"},
  {label:"Ajustes del sitio",to:"/admin/ajustes",icon:"settings",section:"settings"},
];

export function resolveAdminTitle(pathname:string){
  if(pathname==="/admin")return"Resumen";
  return [...editableSections,...utilityNavigation].find(item=>pathname.startsWith(item.to))?.label??"Panel de administración";
}

