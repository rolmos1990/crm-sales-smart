import { evaluarDisponibilidadIA } from "./presupuesto";

/**
 * 042 — ¿El análisis con IA está activo y disponible para la cuenta?
 *
 * Una sola fuente para dos decisiones que no pueden discrepar: el ejecutor
 * (¿mando este lote a la IA?) y el suscriptor del perfil 012 (¿sigo con la
 * extracción por evento o la deja en manos del motor?). Si discreparan, un
 * contacto podría quedar sin interpretación de nadie (FR-022).
 *
 * Se evalúa con prioridad P0, la misma con la que el suscriptor marca la
 * conversación: si la cuenta está en el 80 % de su límite (histórico pausado)
 * pero no en el 100 %, el motor todavía atiende el P0.
 */
let motorIAConectado = false;

/**
 * Lo llama el worker al arrancar el ciclo con un ejecutor de IA. Sin eso, el
 * motor no puede interpretar a nadie y el perfil 012 debe seguir con su
 * extracción por evento (riesgo R1): nunca se apaga un camino sin el otro.
 */
export function marcarMotorIAConectado(conectado: boolean): void {
  motorIAConectado = conectado;
}

export async function analisisIAActivo(instanciaId: string): Promise<boolean> {
  if (!motorIAConectado) return false;
  try {
    return (await evaluarDisponibilidadIA(instanciaId, "P0")).disponible;
  } catch (err) {
    // Ante la duda, que siga la extracción por evento de siempre.
    console.error("[analisis-contactos] No se pudo evaluar la disponibilidad de IA", { instanciaId, err });
    return false;
  }
}
