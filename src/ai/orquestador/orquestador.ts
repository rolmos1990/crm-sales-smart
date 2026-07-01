import "@/ai/proveedores/inicializar";
import { crearProveedor } from "@/ai/proveedores/registro";
import type { IProveedorIA } from "@/ai/proveedores/types";
import type { TipoAgenteIA } from "@/generated/prisma/enums";
import { obtenerProveedoresActivos } from "@/ai/queries";

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
}

export async function seleccionarProveedor(
  instanciaId: string,
  tipoAgente?: TipoAgenteIA,
): Promise<SeleccionProveedor> {
  const proveedores = await obtenerProveedoresActivos(instanciaId);

  if (proveedores.length === 0) {
    throw new Error(`No hay proveedores IA activos para la instancia ${instanciaId}`);
  }

  // Prioridad: proveedor con scope exacto al tipo de agente → proveedor general (null) → resto
  const ordenados = tipoAgente
    ? [
        ...proveedores.filter((p) => p.tipoAgenteIA === tipoAgente),
        ...proveedores.filter((p) => p.tipoAgenteIA === null),
      ]
    : proveedores;

  for (const config of ordenados) {
    if (estaCircuitBreakerAbierto(config.id)) continue;
    if (!config.apiKeyEncriptada && config.proveedor !== "LOCAL") continue;

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
      };
    } catch {
      registrarFalla(config.id);
    }
  }

  throw new Error(`No se pudo seleccionar un proveedor IA disponible para ${instanciaId}`);
}

export { registrarFalla, registrarExito };
