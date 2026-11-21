import { z } from "zod";

/**
 * 049 — Parámetros de operación de la transcripción que maneja el equipo de
 * Karia (no las cuentas). Viven en el entorno y no en una tabla porque son de
 * la plataforma: cuánto esperamos a un proveedor externo, cada cuánto barre el
 * worker y de a cuántos audios por vuelta.
 *
 * Lo que sí es de cada cuenta —credencial, proveedor, tope diario, el
 * interruptor— vive en `ProveedorVoz` y en `ConfiguracionEmpresa`.
 *
 * Valida al importar: un valor mal escrito tiene que tumbar el arranque del
 * worker, no degradar la transcripción en silencio.
 */

const EsquemaEntorno = z.object({
  // Techo de la transcripción EN LÍNEA de un mensaje entrante. Vencido, el
  // mensaje se publica igual y la fila queda PENDIENTE para el barrido: la IA
  // nunca espera a un tercero (FR-028, research R5).
  //
  // 12 s sale del perfil real de los audios: p90 de 26 s de duración y 66 s de
  // máximo, con transcripción de unos pocos segundos.
  VOZ_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
  VOZ_BARRIDO_INTERVALO_MS: z.coerce.number().int().min(1000).default(60_000),
  VOZ_LOTE: z.coerce.number().int().min(1).max(50).default(5),
  // Lease del reclamo. Tiene que ser holgadamente mayor que el timeout de una
  // transcripción, o dos procesos tomarían el mismo audio y se facturaría dos
  // veces (FR-020).
  VOZ_LEASE_MS: z.coerce.number().int().min(10_000).default(3 * 60_000),
  // Tope por archivo. Al bitrate observado (~65 kbps) son más de 50 minutos de
  // audio: existe para que un envío atípico no genere un cargo desproporcionado,
  // no para recortar casos legítimos (research R8).
  VOZ_MAX_BYTES: z.coerce.number().int().min(1024).default(25 * 1024 * 1024),
});

export interface ConfigEntornoVoz {
  timeoutMs: number;
  barridoIntervaloMs: number;
  lote: number;
  leaseMs: number;
  maxBytes: number;
}

export function leerConfigEntornoVoz(
  env: Record<string, string | undefined> = process.env,
): ConfigEntornoVoz {
  const vacioComoAusente = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const r = EsquemaEntorno.safeParse(vacioComoAusente);
  if (!r.success) {
    throw new Error(
      `[voz] Configuración de entorno inválida: ${r.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const e = r.data;
  const config = Object.freeze({
    timeoutMs: e.VOZ_TIMEOUT_MS,
    barridoIntervaloMs: e.VOZ_BARRIDO_INTERVALO_MS,
    lote: e.VOZ_LOTE,
    leaseMs: e.VOZ_LEASE_MS,
    maxBytes: e.VOZ_MAX_BYTES,
  });

  if (config.leaseMs <= config.timeoutMs) {
    throw new Error(
      "[voz] VOZ_LEASE_MS debe ser mayor que VOZ_TIMEOUT_MS: con un lease más corto " +
        "que la propia transcripción, dos procesos tomarían el mismo audio y se facturaría dos veces.",
    );
  }

  return config;
}

let cache: ConfigEntornoVoz | null = null;

/** Cache perezoso: se lee una vez por proceso. `reset` es solo para tests. */
export function configEntornoVoz(): ConfigEntornoVoz {
  cache ??= leerConfigEntornoVoz();
  return cache;
}

export function resetConfigEntornoVoz(): void {
  cache = null;
}
