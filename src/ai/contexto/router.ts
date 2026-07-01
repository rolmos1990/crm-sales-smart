// Decide qué contexto incluir en cada request IA para minimizar tokens
// sin perder información relevante.

export interface DecisionContexto {
  mensajesAIncluir: number;
  incluirContactoDetallado: boolean;
  incluirOportunidad: boolean;
  usarResumen: boolean;
}

export function resolverDecisionContexto(opciones: {
  totalMensajes: number;
  tieneResumen: boolean;
  esPrimerMensajeDeContacto: boolean;
  limiteTokensCtx: number;
}): DecisionContexto {
  const { totalMensajes, tieneResumen, esPrimerMensajeDeContacto, limiteTokensCtx } = opciones;

  // Reservar ~2000 tokens para system prompt + datos de contacto/oportunidad.
  // Aproximación: 150 tokens por mensaje de conversación.
  const tokensBudget = Math.max(0, limiteTokensCtx - 2000);
  const mensajesPorBudget = Math.floor(tokensBudget / 150);
  const mensajesMaximos = Math.min(mensajesPorBudget, 30);

  // Cuando hay resumen disponible y la conversación es larga, solo incluir
  // los últimos 5 mensajes post-resumen (Fase 4A implementará esto).
  const usarResumen = tieneResumen && totalMensajes > 20;
  const mensajesAIncluir = usarResumen
    ? Math.min(5, mensajesMaximos)
    : mensajesMaximos;

  return {
    mensajesAIncluir: Math.max(mensajesAIncluir, 3),
    incluirContactoDetallado: esPrimerMensajeDeContacto,
    incluirOportunidad: true,
    usarResumen,
  };
}
