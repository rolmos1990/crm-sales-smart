import type { ConversacionResumen } from "./types";

/**
 * Una conversación depende de una persona por dos vías distintas: alguien la
 * tomó (o la IA se la transfirió), o la IA dejó un borrador esperando que lo
 * aprueben. Las dos significan lo mismo para quien atiende — acá no avanza
 * nada hasta que un humano entre — y por eso alimentan el mismo filtro.
 *
 * Vive fuera de inbox-layout.tsx para poder probarse sin arrastrar el
 * componente entero, y porque es una regla de negocio, no de presentación.
 */
export function requiereAtencionHumana(
  c: Pick<ConversacionResumen, "modoAtencion" | "pendientesIA">,
): boolean {
  return c.modoAtencion === "HUMANO" || (c.pendientesIA ?? 0) > 0;
}

/** Cerradas y archivadas quedan fuera: ya no hay nada que atender. */
export function cuentaParaAtencionHumana(
  c: Pick<ConversacionResumen, "estado" | "modoAtencion" | "pendientesIA">,
): boolean {
  if (c.estado === "CERRADA" || c.estado === "ARCHIVADA") return false;
  return requiereAtencionHumana(c);
}
