import { seleccionarProveedor, registrarFalla, registrarExito } from "@/ai/orquestador/orquestador";
import { registrarUsoIA, calcularCosto } from "@/ai/auditoria/logger";
import { obtenerConfiguracionIA, obtenerAgenteIAConfig } from "@/ai/queries";
import { SolicitudIASchema } from "./schema";
import type { SolicitudIA, RespuestaIA } from "./types";
import type { ChatResult } from "@/ai/proveedores/types";

export async function generarRespuesta(solicitud: SolicitudIA): Promise<RespuestaIA> {
  const validado = SolicitudIASchema.parse(solicitud);

  const config = await obtenerConfiguracionIA(validado.instanciaId);
  if (!config?.habilitado) {
    throw new Error("IA no habilitada para esta instancia");
  }

  const agente = validado.agenteIAConfigId
    ? await obtenerAgenteIAConfig(validado.agenteIAConfigId)
    : null;

  const { proveedor, proveedorId, costoInputPorMil, costoOutputPorMil } =
    await seleccionarProveedor(
      validado.instanciaId,
      agente?.proveedorPreferido ?? validado.proveedorPreferido ?? undefined,
    );

  const modelo =
    agente?.modeloPreferido ?? config.modeloDefault ?? "claude-sonnet-4-6";

  const temperatura =
    agente?.temperaturaOverride ?? validado.temperatura ?? config.temperaturaDefault ?? 0.7;

  let resultado: ChatResult;

  try {
    resultado = await proveedor.chat({
      mensajes: validado.mensajes,
      modelo,
      temperatura,
      maxTokens: validado.maxTokens,
      tarea: validado.tarea,
    });
    registrarExito(proveedorId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    registrarFalla(proveedorId);

    await registrarUsoIA({
      instanciaId: validado.instanciaId,
      proveedorIAId: proveedorId,
      agenteIAConfigId: validado.agenteIAConfigId,
      tarea: validado.tarea,
      resultado: { contenido: "", tokensInput: 0, tokensOutput: 0, modelo, proveedor: proveedor.nombre, tiempoMs: 0 },
      exito: false,
      error: errorMsg,
      entidadTipo: validado.entidadTipo,
      entidadId: validado.entidadId,
    });

    throw err;
  }

  const costo = calcularCosto(
    resultado.tokensInput,
    resultado.tokensOutput,
    costoInputPorMil,
    costoOutputPorMil,
  );

  const usoIAId = await registrarUsoIA({
    instanciaId: validado.instanciaId,
    proveedorIAId: proveedorId,
    agenteIAConfigId: validado.agenteIAConfigId,
    tarea: validado.tarea,
    resultado,
    exito: true,
    entidadTipo: validado.entidadTipo,
    entidadId: validado.entidadId,
    costoEstimado: costo,
  });

  return {
    contenido: resultado.contenido,
    proveedor: resultado.proveedor,
    modelo: resultado.modelo,
    tokensInput: resultado.tokensInput,
    tokensOutput: resultado.tokensOutput,
    tiempoMs: resultado.tiempoMs,
    usoIAId,
  };
}
