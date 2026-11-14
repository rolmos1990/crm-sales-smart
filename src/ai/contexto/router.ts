// Decide qué contexto incluir en cada request IA para minimizar tokens
// sin perder información relevante.

export interface DecisionContexto {
  mensajesAIncluir: number;
  incluirContactoDetallado: boolean;
  incluirOportunidad: boolean;
  usarResumen: boolean;
  /** 031 — el límite de tokens obligó a entregar menos mensajes de los que
   *  el negocio pidió en el nodo. El llamador lo registra en el log (FR-007). */
  recortadoPorTokens: boolean;
}

// Reservado para system prompt + datos de contacto/oportunidad.
const TOKENS_RESERVADOS_BASE = 2000;
// Aproximación histórica, no una medición: sirve para acotar, no para predecir.
const TOKENS_POR_MENSAJE = 150;
const MAX_MENSAJES = 30;
const MIN_MENSAJES_SIN_OVERRIDE = 3;

export function resolverDecisionContexto(opciones: {
  totalMensajes: number;
  tieneResumen: boolean;
  esPrimerMensajeDeContacto: boolean;
  limiteTokensCtx: number;
  /** 031 — cantidad pedida explícitamente en el nodo Atención IA. Cuando
   *  viene, manda sobre el presupuesto: el negocio eligió este número y no
   *  se le aplica el piso de 3. Lo único que puede bajarlo es el límite de
   *  tokens del agente, y en ese caso se marca `recortadoPorTokens`. */
  override?: number;
  /** 031 — tokens que consume la ficha de la conversación, para que
   *  activarla no recorte mensajes en silencio (FR-007, research D11). */
  tokensReservadosExtra?: number;
}): DecisionContexto {
  const { totalMensajes, tieneResumen, esPrimerMensajeDeContacto, limiteTokensCtx, override } = opciones;

  const tokensBudget = Math.max(0, limiteTokensCtx - TOKENS_RESERVADOS_BASE - (opciones.tokensReservadosExtra ?? 0));
  const mensajesPorBudget = Math.floor(tokensBudget / TOKENS_POR_MENSAJE);
  const mensajesMaximos = Math.min(mensajesPorBudget, MAX_MENSAJES);

  // Cuando hay resumen disponible y la conversación es larga, solo incluir
  // los últimos 5 mensajes post-resumen (Fase 4A implementará esto).
  const usarResumen = tieneResumen && totalMensajes > 20;

  const base = {
    incluirContactoDetallado: esPrimerMensajeDeContacto,
    incluirOportunidad: true,
    usarResumen,
  };

  if (override !== undefined) {
    const acotado = Math.min(override, Math.max(mensajesMaximos, 1));
    return { ...base, mensajesAIncluir: acotado, recortadoPorTokens: acotado < override };
  }

  const mensajesAIncluir = usarResumen ? Math.min(5, mensajesMaximos) : mensajesMaximos;

  return { ...base, mensajesAIncluir: Math.max(mensajesAIncluir, MIN_MENSAJES_SIN_OVERRIDE), recortadoPorTokens: false };
}
