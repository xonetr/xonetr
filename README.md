# XONETR — Web corporativa

Primera fase de la web corporativa de XONETR INC, construida con Vite, React, TypeScript y Tailwind CSS.

## Ejecutar

```bash
npm install
npm run dev
```

Para habilitar el backend FastAPI, consulta `backend/README.md`.

Para producción con Docker y puerto 8010:

```bash
cp backend/.env.example backend/.env
./scripts/deploy.sh up
```

La app queda accesible por:

- http://xonetr.sytes.net:8010
- http://localhost:8010

La API backend queda en:

- http://localhost:8000/api/health

## Estructura

- `src/content.ts`: valores predeterminados del sitio.
- `src/content/schema.ts`: esquema central `SiteContent`, validado con Zod.
- `src/content/ContentProvider.tsx`: fuente de contenido para los componentes públicos.
- `src/data`: repositorios de contenido desacoplados.
- `src/components`: componentes reutilizables, navegación e iconos.
- `src/components/ui`: primitivas (`Button`, `Reveal`, `SectionHeader`).
- `src/sections`: secciones de la página.
- `src/styles.css`: tokens, componentes visuales y responsive.
- `public/assets`: logo, video y póster del Hero.

Los textos provisionales están marcados con `TODO` en `src/content.ts`. Las futuras imágenes deben colocarse en `public/assets` y referenciarse desde ese archivo.

## Alcance actual

Incluye la web corporativa completa: navegación responsive, Hero, ¿Qué hacemos?, servicios, proceso, proyectos filtrables, equipo interactivo, propósito, FAQ, contacto y footer.

## Formulario

Sin configuración, el formulario simula el envío para permitir probar validación, carga y éxito. Para conectarlo a Formspree o a un backend, crear `.env.local`:

```bash
VITE_FORM_ENDPOINT=https://endpoint-del-formulario
```

Los datos de contacto actuales usan dominios y números deliberadamente provisionales; reemplazarlos en `src/content.ts` antes de publicar.

> **Precios (reservado):** cuando se defina el modelo comercial, insertar `id="precios"` entre Proyectos y Equipo. La ubicación también está señalada en `src/App.tsx`.

## Panel de administración

El panel vive en `/admin` y se carga de forma diferida, separado del código de la página pública. Para probar el acceso local:

1. Copiar `.env.example` como `.env.local`.
2. Definir valores propios para `VITE_ADMIN_EMAIL` y `VITE_ADMIN_PASSWORD`.
3. Reiniciar `npm run dev` y abrir `/admin/login`.

> **Advertencia:** `MockAuthProvider` solo simula la experiencia de autenticación en el navegador. No protege rutas, datos ni operaciones. Nunca debe utilizarse como autenticación de producción.

Arquitectura preparada:

- `ContentProvider`: entrega a la web pública únicamente contenido publicado.
- `ContentRepository`: contrato asíncrono para borradores, publicación, versiones e imágenes.
- `LocalContentRepository`: implementación de demostración con `localStorage` y data URL.
- `CloudflareContentRepository`: esqueleto sin conexiones externas.
- `AuthProvider`: contrato de autenticación; actualmente usa `MockAuthProvider`.

Los editores de `/admin/editar/:seccion` mantienen un borrador de trabajo separado del contenido guardado. La vista previa usa `/admin/preview` dentro de un `iframe`, recibe el borrador mediante `postMessage` validando el origen y renderiza los mismos componentes de la página pública. El selector de dispositivo usa anchos reales de 768 px y 390 px. La acción “Abrir vista previa completa” conserva una copia temporal del borrador en este navegador y muestra una cinta de contenido no publicado.

Herramientas disponibles:

- `/admin/medios`: biblioteca local con subida validada (PNG, JPG, WebP o SVG; máximo 2 MB), búsqueda, indicación de uso y eliminación confirmada.
- `/admin/historial`: últimas diez publicaciones locales, vista previa de una versión y restauración segura como borrador.
- `/admin/ajustes`: título y descripción SEO, imagen Open Graph, logo, favicon, acción del menú y enlaces de navegación. Incluye vistas simuladas de Google y de una tarjeta compartida.

En modo local, las imágenes se guardan como data URL y pueden agotar la cuota de `localStorage`; esto es deliberadamente una simulación. En producción, `uploadImage`, `listMedia` y `deleteImage` deben trabajar contra almacenamiento de objetos. Restaurar una versión nunca publica automáticamente: primero crea un borrador revisable.

<!-- TODO: Enfocar automáticamente el campo correspondiente al hacer clic sobre un texto dentro del iframe. -->

### Guía para producción

Antes de publicar el panel debe implementarse:

- autenticación real en servidor y cookies seguras;
- API protegida para contenido y publicación;
- almacenamiento persistente del contenido;
- almacenamiento y procesamiento de imágenes;
- historial de versiones durable;
- roles y permisos por usuario;
- registros de auditoría;
- metadatos de archivos, referencias de uso y eliminación segura en el almacenamiento de objetos;
- validación del esquema también en el servidor;
- protección CSRF, límites de solicitudes y control de concurrencia.
