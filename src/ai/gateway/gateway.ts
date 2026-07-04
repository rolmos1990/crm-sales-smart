import { seleccionarProveedor, registrarFalla, registrarExito } from "@/ai/orquestador/orquestador";
import { registrarUsoIA, calcularCosto } from "@/ai/auditoria/logger";
import { obtenerConfiguracionIA, obtenerAgenteIAConfig } from "@/ai/queries";
import { SolicitudIASchema } from "./schema";
import type { SolicitudIA, RespuestaIA } from "./types";
import type {
  ChatResult,
  ChatConHerramientasResult,
  MensajeIATool,
  DefinicionHerramienta,
} from "@/ai/proveedores/types";
import type { TareaIA } from "@/generated/prisma/enums";

export interface SolicitudConHerramientas {
  instanciaId: string;
  agenteIAConfigId?: string;
  tarea: TareaIA;
  mensajes: MensajeIATool[];
  herramientas: DefinicionHerramienta[];
  temperatura?: number;
  maxTokens?: number;
  entidadTipo?: string;
  entidadId?: string;
}

export type RespuestaConHerramientas = ChatConHerramientasResult & { usoIAId: string };

export async function generarRespuesta(solicitud: SolicitudIA): Promise<RespuestaIA> {
  const validado = SolicitudIASchema.parse(solicitud);

  const config = await obtenerConfiguracionIA(validado.instanciaId);
  if (!config?.habilitado) {
    throw new Error("IA no habilitada para esta instancia");
  }

  const agente = validado.agenteIAConfigId
    ? await obtenerAgenteIAConfig(validado.agenteIAConfigId)
    : null;

  const { proveedor, proveedorId, costoInputPorMil, costoOutputPorMil, modeloDefault: proveedorModelo } =
    await seleccionarProveedor(
      validado.instanciaId,
      agente?.tipo ?? undefined,
    );

  const modelo =
    agente?.modeloPreferido ?? proveedorModelo ?? config.modeloDefault ?? "claude-sonnet-4-6";

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

// Variante del gateway con soporte de tool calling (Anthropic only por ahora).
// Cada llamada se audita por separado en UsoIA ya que cada iteración consume tokens.
export async function generarConHerramientas(
  solicitud: SolicitudConHerramientas,
): Promise<RespuestaConHerramientas> {
  const config = await obtenerConfiguracionIA(solicitud.instanciaId);
  if (!config?.habilitado) throw new Error("IA no habilitada para esta instancia");

  const agente = solicitud.agenteIAConfigId
    ? await obtenerAgenteIAConfig(solicitud.agenteIAConfigId)
    : null;

  const { proveedor, proveedorId, costoInputPorMil, costoOutputPorMil, modeloDefault: proveedorModelo } =
    await seleccionarProveedor(solicitud.instanciaId, agente?.tipo ?? undefined);

  if (!proveedor.chatConHerramientas) {
    throw new Error(`Proveedor ${proveedor.nombre} no soporta tool calling`);
  }

  const modelo = agente?.modeloPreferido ?? proveedorModelo ?? config.modeloDefault ?? "claude-sonnet-4-6";
  const temperatura = agente?.temperaturaOverride ?? solicitud.temperatura ?? config.temperaturaDefault ?? 0.7;

  let resultado: ChatConHerramientasResult;
  try {
    resultado = await proveedor.chatConHerramientas({
      mensajes: solicitud.mensajes,
      herramientas: solicitud.herramientas,
      modelo,
      temperatura,
      maxTokens: solicitud.maxTokens,
    });
    registrarExito(proveedorId);
  } catch (err) {
    registrarFalla(proveedorId);
    const errorMsg = err instanceof Error ? err.message : String(err);
    await registrarUsoIA({
      instanciaId: solicitud.instanciaId,
      proveedorIAId: proveedorId,
      agenteIAConfigId: solicitud.agenteIAConfigId,
      tarea: solicitud.tarea,
      resultado: { contenido: "", tokensInput: 0, tokensOutput: 0, modelo, proveedor: proveedor.nombre, tiempoMs: 0 },
      exito: false,
      error: errorMsg,
      entidadTipo: solicitud.entidadTipo,
      entidadId: solicitud.entidadId,
    });
    throw err;
  }

  const costo = calcularCosto(resultado.tokensInput, resultado.tokensOutput, costoInputPorMil, costoOutputPorMil);

  const usoIAId = await registrarUsoIA({
    instanciaId: solicitud.instanciaId,
    proveedorIAId: proveedorId,
    agenteIAConfigId: solicitud.agenteIAConfigId,
    tarea: solicitud.tarea,
    resultado: {
      contenido: resultado.contenido ?? "",
      tokensInput: resultado.tokensInput,
      tokensOutput: resultado.tokensOutput,
      modelo: resultado.modelo,
      proveedor: resultado.proveedor,
      tiempoMs: resultado.tiempoMs,
    },
    exito: true,
    entidadTipo: solicitud.entidadTipo,
    entidadId: solicitud.entidadId,
    costoEstimado: costo,
  });

  return { ...resultado, usoIAId };
}
