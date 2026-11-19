import type { Prisma } from "@/generated/prisma/client";
import type {
  EstadoEjecucionAnalisis,
  EstadoItemAnalisis,
  ModoEjecucionAnalisis,
  PrioridadAnalisis,
  TipoEjecucionAnalisis,
} from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";

/**
 * 042 — Registro de cada atención del motor (FR-037 a FR-042, research D13).
 *
 * Una fila por INTENTO. Nunca guarda claves, prompts ni texto de
 * conversaciones (FR-041): `configAplicada` lleva solo parámetros y versiones,
 * y `errorMensaje` pasa por `sanitizarErrorMensaje`.
 *
 * Si cerrar la atención falla, se registra y se sigue: la cola es la fuente de
 * verdad del trabajo y la recuperación marca la atención como ABANDONADA
 * (FR-042).
 */

export type CodigoErrorAnalisis =
  | "PROVEEDOR_TIMEOUT"
  | "PROVEEDOR_LIMITE"
  | "PROVEEDOR_ERROR"
  | "RESPUESTA_INVALIDA"
  | "SIN_PRESUPUESTO"
  | "INTERRUMPIDA"
  | "ERROR_INTERNO";

const LARGO_MAXIMO_ERROR = 300;
const PATRONES_SECRETOS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g, // OpenAI / DeepSeek / Anthropic (sk-ant-…)
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^\s"',;]+/gi,
  /[A-Za-z0-9_-]{32,}/g, // cualquier secuencia larga con forma de token
];

export function sanitizarErrorMensaje(err: unknown): string {
  let texto = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "");
  for (const patron of PATRONES_SECRETOS) texto = texto.replace(patron, "[oculto]");
  texto = texto.replace(/\s+/g, " ").trim();
  return texto.length > LARGO_MAXIMO_ERROR ? `${texto.slice(0, LARGO_MAXIMO_ERROR - 1)}…` : texto;
}

/** Normaliza un error del proveedor a un código estable para consultas operativas. */
export function codigoDeError(err: unknown): CodigoErrorAnalisis {
  const e = err as { status?: number; code?: string; name?: string; message?: string } | null;
  const mensaje = (e?.message ?? "").toLowerCase();
  if (e?.name === "AbortError" || e?.code === "ETIMEDOUT" || mensaje.includes("timeout") || mensaje.includes("timed out")) {
    return "PROVEEDOR_TIMEOUT";
  }
  if (e?.status === 429 || mensaje.includes("rate limit")) return "PROVEEDOR_LIMITE";
  if (typeof e?.status === "number" || mensaje.includes("proveedor")) return "PROVEEDOR_ERROR";
  return "ERROR_INTERNO";
}

/** Copia segura de la configuración aplicada: solo claves de esta lista llegan a la base. */
const CLAVES_CONFIG_PERMITIDAS = [
  "tamanoLote",
  "criterioVersionId",
  "criterioNumero",
  "plantillaAplicada",
  "promptVersion",
  "temperatura",
  "proveedorAlias",
  "modoInteres",
  "division",
] as const;

export function configAplicadaSegura(config: Record<string, unknown>): Prisma.InputJsonValue {
  const limpio: Record<string, string | number | boolean | null> = {};
  for (const clave of CLAVES_CONFIG_PERMITIDAS) {
    const v = config[clave];
    if (v === undefined) continue;
    limpio[clave] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null ? v : String(v);
  }
  return limpio;
}

export async function abrirEjecucion(p: {
  instanciaId: string;
  loteId: string;
  loteRaizId?: string | null;
  intento: number;
  tipo: TipoEjecucionAnalisis;
  prioridad: PrioridadAnalisis;
  modo: ModoEjecucionAnalisis;
  contactosPedidos: number;
  leaseMs: number;
  esperaColaMs: number | null;
  configAplicada: Record<string, unknown>;
}): Promise<string> {
  const fila = await prisma.ejecucionAnalisisContactos.create({
    data: {
      instanciaId: p.instanciaId,
      loteId: p.loteId,
      loteRaizId: p.loteRaizId ?? null,
      intento: p.intento,
      tipo: p.tipo,
      prioridad: p.prioridad,
      modo: p.modo,
      estado: "EN_CURSO",
      contactosPedidos: p.contactosPedidos,
      leaseHasta: new Date(Date.now() + p.leaseMs),
      esperaColaMs: p.esperaColaMs,
      configAplicada: configAplicadaSegura(p.configAplicada),
    },
    select: { id: true },
  });
  return fila.id;
}

export interface CierreEjecucion {
  estado: EstadoEjecucionAnalisis;
  contactosProcesados: number;
  contactosExitosos: number;
  contactosFallidos: number;
  tokensEntrada?: number;
  tokensSalida?: number;
  tokensCacheados?: number;
  costoEstimado?: number | null;
  usoIAId?: string | null;
  proveedorIAId?: string | null;
  proveedor?: string | null;
  modelo?: string | null;
  inicio: number;
  error?: unknown;
  errorCodigo?: CodigoErrorAnalisis;
}

/** Estado final según los conteos: todo bien, parcial, o nada. */
export function estadoPorConteos(exitosos: number, pedidos: number): EstadoEjecucionAnalisis {
  if (pedidos > 0 && exitosos === pedidos) return "COMPLETADA";
  if (exitosos > 0) return "PARCIAL";
  return "FALLIDA";
}

export async function cerrarEjecucion(id: string, c: CierreEjecucion): Promise<void> {
  try {
    await prisma.ejecucionAnalisisContactos.update({
      where: { id },
      data: {
        estado: c.estado,
        contactosProcesados: c.contactosProcesados,
        contactosExitosos: c.contactosExitosos,
        contactosFallidos: c.contactosFallidos,
        tokensEntrada: c.tokensEntrada ?? 0,
        tokensSalida: c.tokensSalida ?? 0,
        tokensCacheados: c.tokensCacheados ?? 0,
        costoEstimado: c.costoEstimado ?? null,
        usoIAId: c.usoIAId ?? null,
        proveedorIAId: c.proveedorIAId ?? null,
        proveedor: c.proveedor ?? null,
        modelo: c.modelo ?? null,
        duracionMs: Date.now() - c.inicio,
        finalizadoEn: new Date(),
        errorCodigo: c.error !== undefined ? (c.errorCodigo ?? codigoDeError(c.error)) : (c.errorCodigo ?? null),
        errorMensaje: c.error !== undefined ? sanitizarErrorMensaje(c.error) : null,
      },
    });
  } catch (err) {
    console.error("[worker:analisis] No se pudo cerrar la atención; la recuperación la marcará ABANDONADA", { id, err });
  }
}

export interface ItemEjecucion {
  contactoId: string;
  estado: EstadoItemAnalisis;
  antes?: Prisma.InputJsonValue | null;
  despues?: Prisma.InputJsonValue | null;
  motivo?: string | null;
  errorCodigo?: string | null;
}

export async function registrarItems(
  db: Pick<Prisma.TransactionClient, "ejecucionAnalisisContactosItem">,
  instanciaId: string,
  ejecucionId: string,
  items: ItemEjecucion[],
): Promise<void> {
  if (items.length === 0) return;
  await db.ejecucionAnalisisContactosItem.createMany({
    data: items.map((i) => ({
      ejecucionId,
      instanciaId,
      contactoId: i.contactoId,
      estado: i.estado,
      antes: i.antes ?? undefined,
      despues: i.despues ?? undefined,
      motivo: i.motivo ?? null,
      errorCodigo: i.errorCodigo ?? null,
    })),
  });
}
