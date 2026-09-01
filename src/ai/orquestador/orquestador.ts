import "@/ai/proveedores/inicializar";
import { crearProveedor } from "@/ai/proveedores/registro";
import type { IProveedorIA, CasosDeUsoProveedor, ObjetivoEnrutamientoIA } from "@/ai/proveedores/types";
import type { TipoAgenteIA, TareaIA } from "@/generated/prisma/enums";
import { obtenerProveedoresActivos } from "@/ai/queries";

export type ProveedorActivo = Awaited<ReturnType<typeof obtenerProveedoresActivos>>[number];

// 010-enrutamiento-modelos-ia-por-objetivo
function parsearCasosDeUso(valor: unknown): CasosDeUsoProveedor | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const objetivos = (valor as Record<string, unknown>)["objetivos"];
  if (!Array.isArray(objetivos)) return null;
  return { objetivos: objetivos as ObjetivoEnrutamientoIA[] };
}

/**
 * Busca, entre los proveedores activos ya cargados, el asignado explícitamente
 * al objetivo de esta llamada (research.md Decisión 1). Devuelve `null` si
 * ninguno tiene una asignación para ese objetivo — el llamador cae entonces al
 * criterio de selección actual (prioridad + tipoAgenteIA), sin cambio de
 * comportamiento para instancias que no configuraron ningún enrutamiento.
 */
export function resolverProveedorPorObjetivo(
  proveedores: ProveedorActivo[],
  tarea: TareaIA,
  requiereRazonamientoSuperior?: boolean,
): ProveedorActivo | null {
  const objetivoBuscado: ObjetivoEnrutamientoIA =
    tarea === "CHAT" && requiereRazonamientoSuperior ? "CHAT_RAZONAMIENTO_SUPERIOR" : tarea;

  const candidatos = proveedores.filter((p) =>
    parsearCasosDeUso(p.casosDeUso)?.objetivos.includes(objetivoBuscado),
  );

  if (candidatos.length === 0) return null;

  // Invariante de aplicación (no de BD, ver data-model.md): si más de un
  // proveedor activo declara el mismo objetivo, gana el de mayor prioridad.
  return [...candidatos].sort((a, b) => b.prioridad - a.prioridad)[0];
}

// Estado del circuit breaker en memoria (en producción: Redis)
const estadoCircuitBreaker = new Map<string, { fallas: number; bloqueadoHasta?: Date }>();
const MAX_FALLAS = 3;
const BLOQUEO_MS = 5 * 60 * 1000; // 5 minutos

function estaCircuitBreakerAbierto(proveedorId: string): boolean {
  const estado = estadoCircuitBreaker.get(proveedorId);
  if (!estado) return false;
  if (estado.bloqueadoHasta && estado.bloqueadoHasta > new Date()) return true;
  if (estado.bloqueadoHasta && estado.bloqueadoHasta <= new Date()) {
    estadoCircuitBreaker.delete(proveedorId);
    return false;
  }
  return false;
}

function registrarFalla(proveedorId: string): void {
  const estado = estadoCircuitBreaker.get(proveedorId) ?? { fallas: 0 };
  estado.fallas += 1;
  if (estado.fallas >= MAX_FALLAS) {
    estado.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MS);
  }
  estadoCircuitBreaker.set(proveedorId, estado);
}

function registrarExito(proveedorId: string): void {
  estadoCircuitBreaker.delete(proveedorId);
}

export interface SeleccionProveedor {
  proveedor: IProveedorIA;
  proveedorId: string;
  costoInputPorMil: number | null;
  costoOutputPorMil: number | null;
  modeloDefault: string | undefined;
}

export async function seleccionarProveedor(
  instanciaId: string,
  tipoAgente?: TipoAgenteIA,
  tarea?: TareaIA,
  requiereRazonamientoSuperior?: boolean,
): Promise<SeleccionProveedor> {
  const proveedores = await obtenerProveedoresActivos(instanciaId);

  if (proveedores.length === 0) {
    throw new Error(`No hay proveedores IA activos para la instancia ${instanciaId}`);
  }

  // Prioridad: proveedor con scope exacto al tipo de agente → proveedor general (null) → cualquier otro activo
  const ordenadosPorTipoAgente = tipoAgente
    ? [
        ...proveedores.filter((p) => p.tipoAgenteIA === tipoAgente),
        ...proveedores.filter((p) => p.tipoAgenteIA === null),
        ...proveedores.filter((p) => p.tipoAgenteIA !== tipoAgente && p.tipoAgenteIA !== null),
      ]
    : proveedores;

  // 010-enrutamiento-modelos-ia-por-objetivo — el objetivo puntual de la
  // llamada tiene prioridad sobre el tipo de agente cuando ambos aplican
  // (research.md Decisión 2). Sin `tarea` o sin ninguna asignación explícita
  // para ella, `porObjetivo` es `null` y el orden queda exactamente igual
  // que antes de esta spec.
  const porObjetivo = tarea ? resolverProveedorPorObjetivo(proveedores, tarea, requiereRazonamientoSuperior) : null;
  const ordenados = porObjetivo
    ? [porObjetivo, ...ordenadosPorTipoAgente.filter((p) => p.id !== porObjetivo.id)]
    : ordenadosPorTipoAgente;

  for (const config of ordenados) {
    if (estaCircuitBreakerAbierto(config.id)) {
      console.warn(`[SeleccionarProveedor] ${config.proveedor} (${config.id}) — circuit breaker abierto, omitido`);
      continue;
    }
    if (!config.apiKeyEncriptada && config.proveedor !== "LOCAL") {
      console.warn(`[SeleccionarProveedor] ${config.proveedor} (${config.id}) — sin apiKeyEncriptada, omitido`);
      continue;
    }

    try {
      const instancia = crearProveedor(
        config.proveedor,
        config.apiKeyEncriptada ?? "",
        config.modelosDisponibles
          ? (config.modelosDisponibles as string[])[0]
          : undefined,
      );

      return {
        proveedor: instancia,
        proveedorId: config.id,
        costoInputPorMil: config.costoInputPorMilToken
          ? Number(config.costoInputPorMilToken)
          : null,
        costoOutputPorMil: config.costoOutputPorMilToken
          ? Number(config.costoOutputPorMilToken)
          : null,
        modeloDefault: config.modelosDisponibles
          ? (config.modelosDisponibles as string[])[0]
          : undefined,
      };
    } catch (err) {
      console.error(`[SeleccionarProveedor] ${config.proveedor} (${config.id}) — error al inicializar:`, err);
      registrarFalla(config.id);
    }
  }

  throw new Error(
    `No se pudo seleccionar un proveedor IA disponible para ${instanciaId}. ` +
    `Se evaluaron ${ordenados.length} proveedor(es) activo(s) — revisar logs del servidor para el motivo.`,
  );
}

export { registrarFalla, registrarExito };
