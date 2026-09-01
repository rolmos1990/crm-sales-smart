import { prisma } from "@/shared/db/prisma";
import type { ChatResult } from "@/ai/proveedores/types";
import type { TareaIA } from "@/generated/prisma/enums";

interface RegistrarUsoParams {
  instanciaId: string;
  proveedorIAId: string;
  agenteIAConfigId?: string;
  // 009-perfil-agente-estructurado-versionado (FR-012) — versión exacta de
  // AgenteIAConfig que generó esta respuesta, para trazabilidad.
  agenteIAConfigVersionId?: string;
  tarea: TareaIA;
  resultado: ChatResult;
  exito: boolean;
  error?: string;
  entidadTipo?: string;
  entidadId?: string;
  costoEstimado?: number;
}

export async function registrarUsoIA(params: RegistrarUsoParams): Promise<string> {
  const registro = await prisma.usoIA.create({
    data: {
      instanciaId: params.instanciaId,
      proveedorIAId: params.proveedorIAId,
      agenteIAConfigId: params.agenteIAConfigId,
      agenteIAConfigVersionId: params.agenteIAConfigVersionId,
      tarea: params.tarea,
      modelo: params.resultado.modelo,
      tokensInput: params.resultado.tokensInput,
      tokensOutput: params.resultado.tokensOutput,
      tiempoMs: params.resultado.tiempoMs,
      exito: params.exito,
      error: params.error,
      entidadTipo: params.entidadTipo,
      entidadId: params.entidadId,
      costoEstimado: params.costoEstimado,
    },
    select: { id: true },
  });
  return registro.id;
}

export function calcularCosto(
  tokensInput: number,
  tokensOutput: number,
  costoInputPorMil: number | null,
  costoOutputPorMil: number | null,
): number | undefined {
  if (costoInputPorMil == null || costoOutputPorMil == null) return undefined;
  return (tokensInput / 1000) * costoInputPorMil + (tokensOutput / 1000) * costoOutputPorMil;
}
