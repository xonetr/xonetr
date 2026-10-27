export type NavItem = { label: string; href: `#${string}` };
export const siteContent = {
  brand:{name:"XONETR",legalName:"XONETR INC"},
  // TODO: Revisar los nombres finales de navegación antes de publicar.
  navigation:[{label:"Sobre nosotros",href:"#nosotros"},{label:"Proyectos",href:"#proyectos"},{label:"Servicios",href:"#servicios"},{label:"FAQ",href:"#faq"}] satisfies NavItem[],
  hero:{eyebrow:"XONETR INC",title:{lead:"Soluciones modernas,",emphasis:"confiables,",tail:"tecnológicas, cercanas"},description:"Desarrollamos páginas web, apps y sistemas a medida para tu negocio.",primaryCta:{label:"Cotiza tu proyecto",href:"#contacto"},secondaryCta:{label:"Ver servicios",href:"#servicios"}},
  // TODO: Validar estos textos con el equipo antes de publicar.
  whatWeDo:{eyebrow:"SERVICIO",title:"¿Qué hacemos?",description:"Convertimos ideas y procesos en productos digitales claros, sólidos y fáciles de usar. Código cuidado, decisiones honestas y trabajo en equipo.",codeSamples:[{language:"HTML · CSS",filename:"experiencia.html",code:`<section class="product">\n  <h2>Ideas que funcionan.</h2>\n  <p>Diseño claro. Código sólido.</p>\n</section>`},{language:"REACT · TYPESCRIPT",filename:"Product.tsx",code:`type ProductProps = { idea: string };\n\nexport function Product({ idea }: ProductProps) {\n  return <Build withCare>{idea}</Build>;\n}`} ]},
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
    {title:"Plataforma escolar",category:"Sistemas",description:"Un entorno centralizado para organizar información y simplificar tareas de una comunidad educativa.",accent:"violet"},
    {title:"Sitio institucional",category:"Web",description:"Una presencia digital clara y adaptable, pensada para presentar servicios sin fricción.",accent:"indigo"},
    {title:"Panel operativo",category:"Sistemas",description:"Una interfaz enfocada en visualizar procesos y tomar decisiones con información ordenada.",accent:"blue"},
    {title:"Aplicación de gestión",category:"Apps",description:"Una experiencia compacta para consultar, registrar y acompañar tareas desde cualquier dispositivo.",accent:"lavender"}
  ]},
  // TODO: Confirmar roles, biografías y fotografías con cada integrante.
  team:{eyebrow:"PERSONAL",title:"Conoce al equipo",members:[
    {name:"Joshua Mongelos",initials:"JM",role:"Desarrollo de software",bio:"Construye productos digitales con atención al detalle y foco en las personas."},
    {name:"Thiago Estigarribia",initials:"TE",role:"Desarrollo de software",bio:"Convierte problemas complejos en soluciones claras, mantenibles y útiles."},
    {name:"Marcos Molinas",initials:"MM",role:"Desarrollo de software",bio:"Une criterio técnico y diseño para crear experiencias digitales consistentes."},
    {name:"Samuel Schmidt",initials:"SS",role:"Desarrollo de software",bio:"Impulsa sistemas sólidos y procesos de trabajo simples para el equipo."}
  ]},
  // TODO: Validar la declaración de propósito definitiva.
  purpose:{eyebrow:"PROPÓSITO",title:"¿Qué queremos?",description:"Crear software que haga más simple lo complejo y construir relaciones de trabajo cercanas, transparentes y duraderas."},
  // TODO: Ajustar respuestas según las condiciones comerciales y operativas finales.
  faq:{eyebrow:"INFORMACIÓN",title:"Preguntas frecuentes",items:[
    {question:"¿Cuánto tarda un proyecto?",answer:"Depende del alcance y la complejidad. Después de la reunión inicial entregamos una propuesta con etapas y tiempos claros."},
    {question:"¿Cómo es el proceso de trabajo?",answer:"Trabajamos por etapas, compartimos avances frecuentes y validamos contigo las decisiones importantes antes de continuar."},
    {question:"¿Ofrecen soporte después de la entrega?",answer:"Sí. Definimos el acompañamiento posterior según las necesidades del producto y lo dejamos documentado en la propuesta."},
    {question:"¿Qué tecnologías utilizan?",answer:"Elegimos tecnologías modernas y mantenibles según cada problema; no forzamos una herramienta cuando no es la adecuada."},
    {question:"¿Cómo empezamos?",answer:"Cuéntanos brevemente qué quieres resolver. Coordinaremos una conversación para entender el contexto y recomendar el siguiente paso."}
  ]},
  // TODO: Reemplazar correo y WhatsApp por los canales oficiales.
  contact:{eyebrow:"CONTACTO",title:"Hagamos algo que funcione.",description:"Cuéntanos sobre tu idea, proceso o desafío. Te responderemos con claridad y sin vueltas.",email:"contacto@xonetr.example",whatsappLabel:"+595 000 000 000",whatsappHref:"https://wa.me/595000000000"},
  // TODO: Confirmar enlaces sociales y páginas legales antes del lanzamiento.
  footer:{description:"Software bien pensado para negocios que quieren avanzar con claridad.",socials:[{label:"LinkedIn",href:"#"},{label:"Instagram",href:"#"},{label:"GitHub",href:"#"}]}
} as const;
