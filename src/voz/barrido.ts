import { configEntornoVoz } from "./config-entorno";
import { reclamarLote, recuperarLeasesVencidos, devolverConBackoff } from "./cola";
import { transcribirMediaArchivo } from "./transcribir";

/**
 * 049 — Barrido de transcripciones pendientes, en el worker.
 *
 * Toma lo que la transcripción en línea no alcanzó a hacer: los audios
 * salientes (que nadie espera) y los entrantes cuyo timeout venció o cuyo
 * proveedor falló de forma recuperable.
 *
 * Ciclo propio con setTimeout recursivo, igual que el motor de análisis de
 * contactos, para que un proveedor de voz lento no atrase los disparadores de
 * pipeline ni los Workflows.
 */

let corriendo = false;
let temporizador: NodeJS.Timeout | null = null;

export async function unaVueltaDeBarrido(): Promise<number> {
  const config = configEntornoVoz();

  // Un worker que murió a mitad del trabajo dejó filas en PROCESANDO con el
  // lease vencido; sin esto quedarían atascadas para siempre.
  await recuperarLeasesVencidos();

  const lote = await reclamarLote({ limite: config.lote, leaseMs: config.leaseMs });
  if (lote.length === 0) return 0;

  let hechos = 0;
  for (const audio of lote) {
    try {
      const r = await transcribirMediaArchivo(audio.id);
      if (r.estado === "LISTO" || r.estado === "INAUDIBLE") hechos++;
      // OMITIDO por falta de proveedor: la fila sigue en PROCESANDO y la
      // recupera el barrido siguiente al vencer el lease. No se consumen
      // intentos por algo que el comercio todavía no configuró.
    } catch (e) {
      console.error(`[voz] Fallo inesperado transcribiendo ${audio.id}:`, e);
      await devolverConBackoff([audio.id]);
    }
  }
  return hechos;
}

export function iniciarBarridoVoz(): void {
  if (corriendo) return;
  corriendo = true;

  const config = configEntornoVoz();

  const vuelta = async () => {
    try {
      await unaVueltaDeBarrido();
    } catch (e) {
      // El ciclo nunca muere: un error acá dejaría la transcripción apagada
      // hasta el siguiente reinicio del worker, en silencio.
      console.error("[voz] Error en el barrido:", e);
    } finally {
      if (corriendo) temporizador = setTimeout(vuelta, config.barridoIntervaloMs);
    }
  };

  temporizador = setTimeout(vuelta, config.barridoIntervaloMs);
  console.log(`[voz] Barrido de transcripciones cada ${config.barridoIntervaloMs} ms`);
}

export function detenerBarridoVoz(): void {
  corriendo = false;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}
