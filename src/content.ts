import type {SiteContent} from "./content/schema";

export const siteContent:SiteContent = {
  brand:{name:"XONETR",legalName:"XONETR INC"},
  // TODO: Revisar metadatos, recursos de marca y llamada a la acción antes del lanzamiento.
  settings:{siteTitle:"XONETR INC — Soluciones de software",metaDescription:"XONETR INC desarrolla páginas web, aplicaciones y sistemas a medida.",ogImage:"/assets/xonetr-logo.png",logo:"/assets/xonetr-logo.png",favicon:"/assets/favicon-x.svg",menuAction:{label:"Hablemos",href:"#contacto"}},
  // TODO: Revisar los nombres finales de navegación antes de publicar.
  navigation:[{label:"Sobre nosotros",href:"#nosotros"},{label:"Proyectos",href:"#proyectos"},{label:"Servicios",href:"#servicios"},{label:"FAQ",href:"#faq"}],
  hero:{eyebrow:"XONETR INC",title:{lead:"Soluciones modernas,",emphasis:"confiables,",tail:"tecnológicas, cercanas"},description:"Desarrollamos páginas web, apps y sistemas a medida para tu negocio.",primaryCta:{label:"Cotiza tu proyecto",href:"#contacto"},secondaryCta:{label:"Ver servicios",href:"#servicios"}},
  // TODO: Validar estos textos, snippets y mensajes de apoyo con el equipo antes de publicar.
  whatWeDo:{eyebrow:"SERVICIO",title:"Cómo pensamos",description:"Convertimos ideas y procesos en productos digitales claros, sólidos y fáciles de usar. Código cuidado, decisiones honestas y trabajo en equipo.",codeSamples:[
    {language:"HTML · CSS",status:"HTML",filename:"experiencia.html",support:{label:"DISEÑO",description:"Interfaces claras que se entienden a la primera."},code:`<section class="product">\n  <h2>Ideas que funcionan.</h2>\n  <p>Diseño claro. Código sólido.</p>\n</section>\n\n<style>\n  .product { display: grid; gap: 1rem; }\n</style>`},
    {language:"REACT · TYPESCRIPT",status:"TSX",filename:"Product.tsx",support:{label:"CÓDIGO",description:"Base sólida, ordenada y lista para crecer."},code:`type ProductProps = {\n  title: string;\n};\n\nexport function Product({ title }: ProductProps) {\n  return (\n    <article className="product">\n      <h2>{title}</h2>\n    </article>\n  );\n}`}
  ]},
  // TODO: Ajustar el alcance según la oferta comercial definitiva.
  services:{eyebrow:"PROPUESTAS",title:"¿Qué ofrecemos?",intro:"Soluciones digitales pensadas para resolver necesidades reales y acompañar el crecimiento de cada proyecto.",items:[
    {number:"01",title:"Páginas web",description:"Sitios rápidos, accesibles y diseñados para comunicar con claridad.",features:["Diseño UX/UI","Responsive","SEO técnico"]},
    {number:"02",title:"Aplicaciones",description:"Experiencias web y móviles útiles, intuitivas y listas para crecer.",features:["Interfaces","Integraciones","Escalabilidad"]},
    {number:"03",title:"Sistemas a medida",description:"Herramientas que ordenan procesos y se adaptan a tu forma de trabajar.",features:["Automatización","Datos","Soporte"]}
  ]},
  // TODO: Confirmar el proceso y el vocabulario con todo el equipo.
  // TODO: Confirmar las duraciones estimadas cuando se defina el proceso comercial definitivo.
  process:{eyebrow:"PROCESO",title:"¿Cómo trabajamos?",description:"Un proceso simple, visible y colaborativo de principio a fin.",steps:[{number:"01",title:"Reunión inicial",duration:"~1 SEMANA",description:"Entendemos tu contexto, objetivos y prioridades antes de proponer una solución."},{number:"02",title:"Propuesta",duration:"2-3 DÍAS",description:"Definimos alcance, etapas y entregables para avanzar con expectativas claras."},{number:"03",title:"Desarrollo",duration:"SEGÚN EL PROYECTO",description:"Diseñamos, construimos y compartimos avances frecuentes para validar decisiones."},{number:"04",title:"Entrega y soporte",duration:"CONTINUO",description:"Publicamos, documentamos y acompañamos la evolución del producto."}]},
  // TODO: Reemplazar títulos, descripciones e imágenes por los proyectos autorizados para publicación.
  projects:{eyebrow:"TRABAJOS",title:"Últimos proyectos",filters:["Todos","Web","Apps","Sistemas"],items:[
    // TODO: Agregar la ruta de la imagen real en `image` cuando esté disponible.
    {title:"Plataforma escolar",category:"Sistemas",description:"Un entorno centralizado para organizar información y simplificar tareas de una comunidad educativa.",accent:"violet",image:undefined as string|undefined},
    {title:"Sitio institucional",category:"Web",description:"Una presencia digital clara y adaptable, pensada para presentar servicios sin fricción.",accent:"indigo",image:undefined as string|undefined},
    {title:"Panel operativo",category:"Sistemas",description:"Una interfaz enfocada en visualizar procesos y tomar decisiones con información ordenada.",accent:"blue",image:undefined as string|undefined},
    {title:"Aplicación de gestión",category:"Apps",description:"Una experiencia compacta para consultar, registrar y acompañar tareas desde cualquier dispositivo.",accent:"lavender",image:undefined as string|undefined}
  ]},
  // TODO: Confirmar roles, biografías y fotografías con cada integrante.
  team:{eyebrow:"PERSONAL",title:"Conoce al equipo",members:[
    {name:"Joshua Mongelos",initials:"JM",role:"Desarrollo de software",bio:"Construye productos digitales con atención al detalle y foco en las personas.",photo:undefined as string|undefined,links:[{label:"LinkedIn",href:""},{label:"GitHub",href:""}]},
    {name:"Thiago Estigarribia",initials:"TE",role:"Desarrollo de software",bio:"Convierte problemas complejos en soluciones claras, mantenibles y útiles.",photo:undefined as string|undefined,links:[{label:"LinkedIn",href:""},{label:"GitHub",href:""}]},
    {name:"Marcos Molinas",initials:"MM",role:"Desarrollo de software",bio:"Une criterio técnico y diseño para crear experiencias digitales consistentes.",photo:undefined as string|undefined,links:[{label:"LinkedIn",href:""},{label:"GitHub",href:""}]},
    {name:"Samuel Schmidt",initials:"SS",role:"Desarrollo de software",bio:"Impulsa sistemas sólidos y procesos de trabajo simples para el equipo.",photo:undefined as string|undefined,links:[{label:"LinkedIn",href:""},{label:"GitHub",href:""}]}
  ]},
  // TODO: Validar la declaración de propósito y los principios definitivos.
  purpose:{eyebrow:"PROPÓSITO",title:"¿Qué queremos?",description:"Crear software que haga más simple lo complejo y construir relaciones de trabajo cercanas, transparentes y duraderas.",principles:[
    {number:"01",label:"SIMPLE",description:"Diseñamos experiencias claras, directas y fáciles de entender."},
    {number:"02",label:"TRANSPARENTE",description:"Compartimos decisiones, avances y límites con total claridad."},
    {number:"03",label:"DURADERO",description:"Construimos soluciones preparadas para mantenerse y evolucionar."}
  ]},
  // TODO: Ajustar respuestas según las condiciones comerciales y operativas finales.
  faq:{eyebrow:"INFORMACIÓN",title:"Preguntas frecuentes",prompt:"¿No encuentras tu respuesta?",cta:{label:"Escríbenos",href:"#contacto"},items:[
    {question:"¿Cuánto tarda un proyecto?",answer:"Depende del alcance y la complejidad. Después de la reunión inicial entregamos una propuesta con etapas y tiempos claros."},
    {question:"¿Cómo es el proceso de trabajo?",answer:"Trabajamos por etapas, compartimos avances frecuentes y validamos contigo las decisiones importantes antes de continuar."},
    {question:"¿Ofrecen soporte después de la entrega?",answer:"Sí. Definimos el acompañamiento posterior según las necesidades del producto y lo dejamos documentado en la propuesta."},
    {question:"¿Qué tecnologías utilizan?",answer:"Elegimos tecnologías modernas y mantenibles según cada problema; no forzamos una herramienta cuando no es la adecuada."},
    {question:"¿Cómo empezamos?",answer:"Cuéntanos brevemente qué quieres resolver. Coordinaremos una conversación para entender el contexto y recomendar el siguiente paso."}
  ]},
  // TODO: Reemplazar correo y WhatsApp por los canales oficiales.
  contact:{eyebrow:"CONTACTO",title:"Hagamos algo que funcione.",description:"Cuéntanos sobre tu idea, proceso o desafío. Te responderemos con claridad y sin vueltas.",email:"contacto@xonetr.example",whatsappLabel:"+595 000 000 000",whatsappHref:"https://wa.me/595000000000"},
  // TODO: Confirmar enlaces sociales y páginas legales antes del lanzamiento.
  footer:{description:"Software bien pensado para negocios que quieren avanzar con claridad.",columns:[
    {title:"Navegación",links:[{label:"Sobre nosotros",href:"#nosotros"},{label:"Proyectos",href:"#proyectos"},{label:"Servicios",href:"#servicios"},{label:"FAQ",href:"#faq"}]},
    {title:"Contacto",links:[{label:"contacto@xonetr.example",href:"mailto:contacto@xonetr.example"},{label:"+595 000 000 000",href:"https://wa.me/595000000000"}]}
  ],socials:[
    {label:"LinkedIn",href:""},
    {label:"Instagram",href:""},
    {label:"GitHub",href:""}
  ]},
  // TODO: Sustituir estos textos por las versiones legales revisadas y aprobadas.
  legal:{
    privacy:{title:"Política de privacidad",date:"Última actualización: pendiente",paragraphs:["Este contenido es provisional y deberá describir qué datos se recopilan, con qué finalidad y durante cuánto tiempo se conservan.","También deberá explicar los derechos de las personas usuarias y los canales disponibles para ejercerlos."]},
    terms:{title:"Términos y condiciones",date:"Última actualización: pendiente",paragraphs:["Este contenido es provisional y deberá definir las condiciones de uso del sitio y el alcance de la información publicada.","La versión definitiva deberá ser revisada antes del lanzamiento público."]}
  }
};
