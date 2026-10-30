const envValue=String(import.meta.env.VITE_PRELOADER??"true").toLowerCase();

export const preloaderConfig={
  enabled:envValue!=="false",
  // El SVG del logo completa su apertura y la estrella central en unos 3.2 s.
  minimumDuration:3200,
  maximumDuration:5200,
  exitDuration:700,
  oncePerSession:true,
  sessionKey:"xonetr.preloader.shown",
} as const;

