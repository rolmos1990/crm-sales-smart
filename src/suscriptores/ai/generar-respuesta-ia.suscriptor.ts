import "@/ai/tools/inicializar"; // registra todos los providers de herramientas

import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoGenerarRespuestaIAPayload } from "@/eventos/contratos/generar-respuesta-ia.comando";
import type { MensajeIATool, ContenidoToolResult } from "@/ai/proveedores/types";

const MAX_ITERACIONES_TOOL = 5;

export class GenerarRespuestaIASuscriptor extends ConsumidorBase<ComandoGenerarRespuestaIAPayload> {
  readonly queue = QUEUES.AI_RESPUESTA;
  readonly routingKeys = [RK.COMANDO_AI_GENERAR_RESPUESTA];

  async manejar(envelope: EventoEnvelope<ComandoGenerarRespuestaIAPayload>): Promise<void> {
    const { conversacionId, instanciaId, agenteIAConfigId } = envelope.payload;

    const { generarRespuesta, generarConHerramientas } = await import("@/ai/gateway/gateway");
    const { construirContexto, serializarContextoComoMensajes } = await import(
      "@/ai/contexto/constructor"
    );
    const { prisma } = await import("@/shared/db/prisma");
    const { enviarMensaje } = await import("@/conversaciones/actions");

    const conversacion = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { contactoId: true, instanciaId: true, oportunidades: { select: { oportunidadId: true }, take: 1 } },
    });

    if (!conversacion || conversacion.instanciaId !== instanciaId) {
      console.warn(`[GenerarRespuestaIA] Conversación ${conversacionId} no encontrada o instancia incorrecta`);
      return;
    }

    const oportunidadId = conversacion.oportunidades[0]?.oportunidadId;

    // Resolver agenteIAConfig — del payload o el default COMERCIAL de la instancia
    const agenteId =
      agenteIAConfigId ??
      (
        await prisma.agenteIAConfig.findFirst({
          where: { instanciaId, tipo: "COMERCIAL" },
          select: { id: true },
        })
      )?.id;

    const contexto = await construirContexto({
      instanciaId,
      conversacionId,
      contactoId: conversacion.contactoId,
      oportunidadId,
      agenteIAConfigId: agenteId,
    });

    const mensajesBase = serializarContextoComoMensajes(contexto);

    if (!mensajesBase.some((m) => m.rol === "system")) {
      mensajesBase.unshift({
        rol: "system",
        contenido:
          "Eres un asistente de atención al cliente profesional y amigable. Responde siempre en el mismo idioma que el cliente. Sé conciso y útil.",
      });
    }

    // Verificar si el agente tiene herramientas habilitadas
    const herramientasPermitidas = agenteId
      ? await obtenerHerramientasPermitidas(agenteId)
      : [];

    let contenidoFinal: string;
    // 017-aprendizaje-supervisado-auditoria — metadata de trazabilidad
    // acumulada durante la generación, para el registro de la respuesta.
    let usoIAId: string | undefined;
    let herramientasEjecutadas: string[] = [];
    let motivoTransferencia: string | undefined;
    let productoIdentificadoId: string | undefined;

    if (herramientasPermitidas.length > 0) {
      const resultadoTools = await ejecutarConTools({
        instanciaId,
        agenteId,
        conversacionId,
        contactoId: conversacion.contactoId ?? undefined,
        oportunidadId,
        herramientasPermitidas,
        mensajesBase,
        generarConHerramientas,
      });
      contenidoFinal = resultadoTools.contenido;
      usoIAId = resultadoTools.usoIAId;
      herramientasEjecutadas = resultadoTools.herramientasEjecutadas;
      motivoTransferencia = resultadoTools.motivoTransferencia;
      productoIdentificadoId = resultadoTools.productoIdentificadoId;
    } else {
      // Sin herramientas: flujo original
      const respuesta = await generarRespuesta({
        instanciaId,
        agenteIAConfigId: agenteId,
        tarea: "CHAT",
        mensajes: [
          ...mensajesBase,
          {
            rol: "user",
            contenido:
              "Redacta la siguiente respuesta para enviar al cliente. Solo el texto del mensaje, sin explicaciones.",
          },
        ],
        entidadTipo: "conversacion",
        entidadId: conversacionId,
      });
      contenidoFinal = respuesta.contenido;
      usoIAId = respuesta.usoIAId;
    }

    // 016-niveles-autonomia-automatizacion — gate de autonomía antes de
    // enviar. Sin ninguna fila de AutonomiaIntencionConfig para el agente,
    // decidirAutonomia devuelve ENVIAR sin necesidad de clasificar
    // (research.md Decisión 3) — cero cambio de comportamiento ni de costo
    // para agentes que no configuraron nada.
    const { obtenerAutonomiaPorAgente } = await import("@/ai/autonomia/queries");
    const { clasificarCategoriaIntencion } = await import("@/ai/autonomia/clasificador");
    const { decidirAutonomia } = await import("@/ai/autonomia/gate");
    const { ensamblarYPersistirRegistro } = await import("@/ai/autonomia/registro");

    const configsAutonomia = agenteId ? await obtenerAutonomiaPorAgente(agenteId) : null;
    const ultimoMensajeCliente = (await obtenerUltimoMensajeCliente(conversacionId)) ?? "";

    let decision: import("@/ai/autonomia/tipos").DecisionAutonomia = {
      accion: "ENVIAR",
      motivo: "Sin configuración de autonomía — comportamiento por defecto",
    };
    let confianzaDetectada: number | undefined;

    if (configsAutonomia !== null) {
      const clasificacion = ultimoMensajeCliente
        ? await clasificarCategoriaIntencion(ultimoMensajeCliente, instanciaId)
        : null;

      let perfilCliente = null;
      if (conversacion.contactoId) {
        try {
          const { obtenerPerfil } = await import("@/ai/perfil-cliente/servicio");
          perfilCliente = await obtenerPerfil(conversacion.contactoId, instanciaId);
        } catch (err) {
          console.error("[GenerarRespuestaIA] Error al obtener perfil de cliente para el gate:", err);
        }
      }

      decision = decidirAutonomia(configsAutonomia, clasificacion, perfilCliente);
      confianzaDetectada = clasificacion?.categorias.find((c) => c.categoria === decision.categoriaAplicada)?.confianza;
    }

    // 017-aprendizaje-supervisado-auditoria — metadata común a ambos
    // caminos del registro (ENVIADA_AUTOMATICAMENTE y PENDIENTE); FR-010:
    // ensamblarYPersistirRegistro nunca propaga un error.
    const datosRegistroComunes = {
      instanciaId,
      agenteIAConfigId: agenteId ?? "",
      conversacionId,
      mensajeCliente: ultimoMensajeCliente,
      categoriaDetectada: decision.categoriaAplicada,
      usoIAId,
      estrategiaUtilizadaId: contexto.estrategiaSeleccionada?.id,
      ejemplosUtilizadosIds: contexto.ejemplosUtilizadosIds,
      herramientasEjecutadas,
      confianza: confianzaDetectada,
      motivoTransferencia,
      productoIdentificadoId,
    };

    if (decision.accion === "NO_GENERAR") {
      console.log(
        `[GenerarRespuestaIA] Categoría ${decision.categoriaAplicada ?? "?"} es HumanOnly — no se genera respuesta automática`,
      );
      return;
    }

    if (decision.accion === "PENDIENTE") {
      if (agenteId) {
        await ensamblarYPersistirRegistro({
          ...datosRegistroComunes,
          agenteIAConfigId: agenteId,
          respuestaPropuesta: contenidoFinal,
          estadoInicial: "PENDIENTE",
          motivo: decision.motivo,
        });
      }
      console.log(`[GenerarRespuestaIA] Respuesta pendiente de revisión — motivo: ${decision.motivo}`);
      return;
    }

    const resultado = await enviarMensaje({
      conversacionId,
      contenido: contenidoFinal,
      tipo: "TEXTO",
      esNotaInterna: false,
      // Este worker no tiene sesión de usuario (corre en cola, sin request
      // HTTP) — el instanciaId ya se validó contra la conversación arriba
      // (línea ~29), así que se pasa explícitamente para que enviarMensaje
      // no intente resolverlo por sesión (ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md, hallazgo #2).
      instanciaId,
    });

    if (!resultado.ok) {
      console.error(`[GenerarRespuestaIA] Error enviando respuesta: ${resultado.error}`);
    } else {
      console.log(`[GenerarRespuestaIA] Respuesta enviada → mensajeId: ${resultado.mensaje.id}`);
    }

    // Registro de trazabilidad — solo si la respuesta efectivamente se
    // generó desde un agente conocido (agenteId); nunca bloquea el envío
    // ya realizado arriba, sea cual sea el resultado de enviarMensaje.
    if (agenteId) {
      await ensamblarYPersistirRegistro({
        ...datosRegistroComunes,
        agenteIAConfigId: agenteId,
        respuestaPropuesta: contenidoFinal,
        estadoInicial: "ENVIADA_AUTOMATICAMENTE",
        motivo: decision.motivo,
      });
    }
  }
}

// Texto del último mensaje del cliente en la conversación — insumo para el
// clasificador del gate de autonomía (016).
async function obtenerUltimoMensajeCliente(conversacionId: string): Promise<string | null> {
  const { prisma } = await import("@/shared/db/prisma");
  const mensaje = await prisma.mensajeConversacion.findFirst({
    where: { conversacionId, remitente: "CONTACTO" },
    orderBy: { creadoEn: "desc" },
    select: { contenido: true },
  });
  return mensaje?.contenido?.trim() || null;
}

// Extrae la lista de nombres de herramientas habilitadas para el agente
async function obtenerHerramientasPermitidas(agenteId: string): Promise<string[]> {
  const { prisma } = await import("@/shared/db/prisma");
  const config = await prisma.agenteIAConfig.findUnique({
    where: { id: agenteId },
    select: { herramientas: true },
  });
  return parsearListaHerramientas(config?.herramientas);
}

function parsearListaHerramientas(valor: unknown): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter((h): h is string => typeof h === "string");
  if (typeof valor === "object" && valor !== null) {
    const obj = valor as Record<string, unknown>;
    const lista = obj["habilitadas"] ?? obj["lista"];
    if (Array.isArray(lista)) return lista.filter((h): h is string => typeof h === "string");
  }
  return [];
}

interface EjecutarConToolsParams {
  instanciaId: string;
  agenteId?: string;
  conversacionId: string;
  contactoId?: string;
  oportunidadId?: string;
  herramientasPermitidas: string[];
  mensajesBase: Array<{ rol: "system" | "user" | "assistant"; contenido: string }>;
  generarConHerramientas: typeof import("@/ai/gateway/gateway")["generarConHerramientas"];
}

interface ResultadoEjecutarConTools {
  contenido: string;
  usoIAId: string | undefined;
  // 017-aprendizaje-supervisado-auditoria
  herramientasEjecutadas: string[];
  motivoTransferencia: string | undefined;
  productoIdentificadoId: string | undefined;
}

async function ejecutarConTools(params: EjecutarConToolsParams): Promise<ResultadoEjecutarConTools> {
  const { registroHerramientas } = await import("@/ai/tools/registry");
  const { ejecutarHerramienta } = await import("@/ai/tools/executor");

  const definiciones = registroHerramientas.obtenerDefiniciones(params.herramientasPermitidas);

  // Convertir mensajesBase (string-only) a MensajeIATool[]
  const mensajes: MensajeIATool[] = params.mensajesBase.map((m) => ({
    rol: m.rol,
    contenido: m.contenido,
  }));

  const toolCtx = {
    instanciaId: params.instanciaId,
    agenteId: params.agenteId,
    conversacionId: params.conversacionId,
    contactoId: params.contactoId,
    oportunidadId: params.oportunidadId,
    herramientasPermitidas: params.herramientasPermitidas,
  };

  const herramientasEjecutadas: string[] = [];
  let motivoTransferencia: string | undefined;
  let productoIdentificadoId: string | undefined;
  let usoIAId: string | undefined;

  for (let i = 0; i < MAX_ITERACIONES_TOOL; i++) {
    const resultado = await params.generarConHerramientas({
      instanciaId: params.instanciaId,
      agenteIAConfigId: params.agenteId,
      tarea: "CHAT",
      mensajes,
      herramientas: definiciones,
      entidadTipo: "conversacion",
      entidadId: params.conversacionId,
    });
    usoIAId = resultado.usoIAId;

    if (resultado.tipo === "texto") {
      return { contenido: resultado.contenido ?? "", usoIAId, herramientasEjecutadas, motivoTransferencia, productoIdentificadoId };
    }

    // Hay tool calls — ejecutarlos y agregar al historial
    const llamadas = resultado.herramientasLlamadas ?? [];

    // Agregar la respuesta del asistente (con tool_use blocks) al historial
    mensajes.push({
      rol: "assistant",
      contenido: resultado.contenidoAsistente ?? [],
    } as MensajeIATool);

    // Ejecutar cada herramienta y recopilar resultados
    const toolResults: ContenidoToolResult[] = await Promise.all(
      llamadas.map(async (llamada) => {
        const res = await ejecutarHerramienta(llamada.name, llamada.input, toolCtx);
        herramientasEjecutadas.push(llamada.name);

        // research.md Decisión 3 — motivo de transferencia de ESTA respuesta.
        if (llamada.name === "transferir_a_humano" && res.ok) {
          const motivo = (res.data as Record<string, unknown> | undefined)?.motivo;
          if (typeof motivo === "string") motivoTransferencia = motivo;
        }
        // research.md Decisión 2 — mejor esfuerzo: primer producto que
        // buscar_productos devolvió, sin inferir cuál es "el" relevante.
        if (llamada.name === "buscar_productos" && res.ok && !productoIdentificadoId) {
          const productos = (res.data as Record<string, unknown> | undefined)?.productos;
          if (Array.isArray(productos) && productos.length > 0) {
            const primero = productos[0] as Record<string, unknown>;
            if (typeof primero.id === "string") productoIdentificadoId = primero.id;
          }
        }

        return {
          type: "tool_result" as const,
          tool_use_id: llamada.id,
          content: JSON.stringify(res),
        };
      }),
    );

    // Agregar resultados de tools como mensaje de usuario
    mensajes.push({
      rol: "user",
      contenido: toolResults,
    } as MensajeIATool);
  }

  // Si se agotaron las iteraciones, devolver fallback
  console.warn(`[GenerarRespuestaIA] Máximo de iteraciones de tool calling alcanzado (${MAX_ITERACIONES_TOOL})`);
  return {
    contenido: "Lo siento, no pude completar tu solicitud en este momento. ¿Puedo ayudarte con algo más?",
    usoIAId,
    herramientasEjecutadas,
    motivoTransferencia,
    productoIdentificadoId,
  };
}
