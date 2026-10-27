# XONETR — Web corporativa

Primera fase de la web corporativa de XONETR INC, construida con Vite, React, TypeScript y Tailwind CSS.

## Ejecutar

```bash
npm install
npm run dev
```

Para producción: `npm run build` y luego `npm run preview`.

## Estructura

- `src/content.ts`: único origen para textos, navegación, servicios y pasos.
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
