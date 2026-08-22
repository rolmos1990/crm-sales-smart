export interface EventoEnvelope<P = Record<string, unknown>> {
  eventId: string;
  instanciaId: string;
  tipo: string;
  ocurridoEn: string;
  version: number;
  payload: P;
}

/** Contrato opcional que puede cumplir cualquier error lanzado desde
 *  `manejar()` — si lo cumple, ConsumidorBase respeta `reintentable` en vez
 *  de agotar siempre los MAX_INTENTOS (ver consumidor.ts). Deliberadamente
 *  estructural (duck typing, no una clase base) para que esta capa
 *  genérica de colas no dependa de ninguna excepción de dominio concreta
 *  (ver EnvioMensajeError en src/conversaciones/errores.ts) — cualquier
 *  suscriptor futuro puede sumarse solo con lanzar un objeto que tenga esta
 *  forma, sin importar nada de acá. Un Error común (sin esta propiedad)
 *  sigue la política actual: reintenta hasta agotar MAX_INTENTOS.*/
export interface ErrorConReintentabilidad {
  reintentable: boolean;
}

export function esErrorConReintentabilidad(err: unknown): err is ErrorConReintentabilidad {
  return (
    typeof err === "object" &&
    err !== null &&
    "reintentable" in err &&
    typeof (err as { reintentable: unknown }).reintentable === "boolean"
  );
}
