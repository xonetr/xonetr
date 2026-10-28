export const cursorTrailConfig={
  enabled:true,
  radius:140,
  intensity:.85,
  fontSize:14,
  gridSpacing:28,
  minChangeInterval:80,
  maxChangeInterval:120,
  smoothing:.15,
  enterDuration:250,
  exitDuration:250,
  interactionScale:.6,
  color:"#A6ABFD",
  glowColor:"#747EFA",
  glowOpacity:.12,
  characters:[..."ABCDEF0123456789/*+-=>_"],
} as const;

export function cursorTrailEnabled(){
  return cursorTrailConfig.enabled&&import.meta.env.VITE_CURSOR_TRAIL!=="false";
}
