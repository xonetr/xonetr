const envValue=String(import.meta.env.VITE_PRELOADER??"true").toLowerCase();

export const preloaderConfig={
  enabled:envValue!=="false",
  minimumDuration:800,
  maximumDuration:2500,
  exitDuration:700,
  oncePerSession:true,
  sessionKey:"xonetr.preloader.shown",
} as const;

