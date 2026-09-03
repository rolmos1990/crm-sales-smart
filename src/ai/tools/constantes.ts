// 024-alias-ubicaciones-transportistas — única fuente de verdad para las
// herramientas operativas de solo lectura que deben estar siempre
// disponibles para el agente (015/018), independientemente de lo que el
// negocio haya marcado en el toggle de herramientas CRM. Antes vivía
// duplicada e informativa en sheet-editar-agente.tsx sin unirse nunca a
// `herramientasPermitidas` en runtime (research.md §6, FR-011) — ahora es
// también la lista que autoriza su ejecución real en
// generar-respuesta-ia.suscriptor.ts.
export const HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES = [
  "consultar_disponibilidad",
  "consultar_precio_actual",
  "consultar_promociones",
  "validar_combinacion_productos",
  "obtener_metodos_entrega",
  "calcular_costo_envio",
  "estimar_fecha_entrega",
  "validar_cobertura",
  "obtener_ubicaciones_retiro",
  "agregar_productos_oportunidad",
  "consultar_opciones_envio",
] as const;
