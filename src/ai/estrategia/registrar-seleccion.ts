import { prisma } from "@/shared/db/prisma";
import type { ResultadoSeleccion, SenalesSeleccion } from "./selector";

interface RegistrarSeleccionParams {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId?: string;
  resultado: ResultadoSeleccion;
  senales: SenalesSeleccion;
}

/**
 * Persiste el resultado de una selección de estrategia para auditoría
 * (FR-009, SC-003). Tolerante a fallo — un error acá nunca debe abortar el
 * flujo de generación de respuesta que la invoca (Constitution III).
 */
export async function registrarSeleccionEstrategia(params: RegistrarSeleccionParams): Promise<void> {
  try {
    await prisma.seleccionEstrategiaLog.create({
      data: {
        instanciaId: params.instanciaId,
        agenteIAConfigId: params.agenteIAConfigId,
        conversacionId: params.conversacionId ?? null,
        motivo: params.resultado.motivo,
        tipoRelacionUsado: params.senales.tipoRelacion ?? null,
        intencionUsada: params.senales.intencion ?? null,
        playbookEstrategiaIdSeleccionado: params.resultado.estrategiaSeleccionada?.playbookEstrategiaId ?? null,
      },
    });
  } catch (err) {
    console.error("[Estrategia] Error al registrar selección:", err);
  }
}
