import { prisma } from "@/shared/db/prisma";
import { construirContextoCompuesto } from "@/ai/contexto/context-builder";
import type { ConfigAgenteParaPrompt } from "@/ai/prompt/builder";
import { recuperadorEjemplos } from "@/ai/piloto/recuperador-ejemplos";
import { obtenerAutonomiaPorAgente } from "@/ai/autonomia/queries";
import { clasificarCategoriaIntencion } from "@/ai/autonomia/clasificador";
import { decidirAutonomia } from "@/ai/autonomia/gate";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";
import type { EscenarioSimulacion, DiagnosticoRespuestaSimulada, HerramientaEjecutadaDiagnostico } from "./tipos";

// 018-simulador-agente (research.md Decisión 2) — perfil 100% simulado, sin
// llamar a PerfilClienteService (que requiere un contactoId real).
function construirPerfilSimulado(cliente: EscenarioSimulacion["cliente"]): PerfilCliente {
  return {
    contactoId: "__simulado__",
    tipoRelacion: cliente.tipoRelacion,
    datosObjetivos: {
      numeroPedidosCompletados: 0,
      fechaPrimeraInteraccion: new Date().toISOString(),
      fechaUltimaCompra: null,
      productosComprados: [],
      oportunidadesAbiertas: [],
      cotizacionesActivas: [],
      incidenciasActivas: 0,
      metodoEntregaHabitual: null,
    },
    datosInterpretados: {
      intencionComercialActual: cliente.intencion,
      productosConsultados: [],
      preferenciasIdentificadas: [],
      presupuestoConocido: null,
      ocasionActual: null,
      fechaRequerida: null,
      confianza: 1,
      extraidoEn: new Date().toISOString(),
    },
    senalesObjetivas: [`Cliente simulado — tipo de relación: ${cliente.tipoRelacion}, intención: ${cliente.intencion}`],
    calculadoEn: new Date().toISOString(),
    disparadoPor: "simulacion",
  };
}

// research.md Decisión 4 — publicada vigente por default; borrador (009) si
// escenario.usarBorrador === true. Nunca escribe nada.
async function resolverConfigAgente(agenteIAConfigId: string, usarBorrador: boolean): Promise<ConfigAgenteParaPrompt | null> {
  if (usarBorrador) {
    const borrador = await prisma.agenteIAConfigVersion.findFirst({
      where: { agenteIAConfigId, estado: "BORRADOR" },
      orderBy: { creadoEn: "desc" },
      select: { contenido: true },
    });
    if (borrador) return borrador.contenido as unknown as ConfigAgenteParaPrompt;
    // Sin borrador todavía — degrada a la publicada vigente, nunca inventa datos.
  }

  const agente = await prisma.agenteIAConfig.findUnique({ where: { id: agenteIAConfigId } });
  return agente as unknown as ConfigAgenteParaPrompt | null;
}

function resumirReglasAplicadas(config: ConfigAgenteParaPrompt): string[] {
  const reglas: string[] = [];
  const listar = (valor: unknown): string[] => (Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : []);
  reglas.push(...listar(config.reglasPersonalizadas).map((r) => `Regla personalizada: ${r}`));
  reglas.push(...listar(config.comportamientosProhibidos).map((r) => `Prohibido: ${r}`));
  reglas.push(...listar(config.condicionesTransferenciaHumano).map((r) => `Transferir si: ${r}`));
  return reglas;
}

async function detectarInformacionFaltante(instanciaId: string): Promise<string[]> {
  const faltante: string[] = [];
  const metodosEntrega = await prisma.metodoEntregaConfig.count({ where: { instanciaId, activo: true } });
  if (metodosEntrega === 0) faltante.push("Sin métodos de entrega configurados — el agente no puede informar costos/plazos de envío reales.");
  return faltante;
}

interface MensajeSim {
  rol: "system" | "user" | "assistant";
  contenido: string;
}

class SimuladorService {
  async ejecutar(escenario: EscenarioSimulacion): Promise<DiagnosticoRespuestaSimulada[]> {
    const configAgente = await resolverConfigAgente(escenario.agenteIAConfigId, escenario.usarBorrador);
    if (!configAgente) return [];

    const perfilCliente = construirPerfilSimulado(escenario.cliente);
    const informacionFaltante = await detectarInformacionFaltante(escenario.instanciaId);
    const reglasAplicadas = resumirReglasAplicadas(configAgente);

    const contexto = await construirContextoCompuesto(
      {
        instanciaId: escenario.instanciaId,
        agenteIAConfigId: escenario.agenteIAConfigId,
        perfilClienteOverride: perfilCliente,
      },
      { configAgente, contextoDinamico: {} },
    );

    const ejemplosRecuperados = await recuperadorEjemplos.recuperar({
      instanciaId: escenario.instanciaId,
      agenteIAConfigId: escenario.agenteIAConfigId,
      intencion: escenario.cliente.intencion,
      tipoCliente: escenario.cliente.tipoRelacion,
      playbookEstrategiaId: contexto.estrategiaSeleccionada?.id,
    });

    const agenteFull = await prisma.agenteIAConfig.findUnique({
      where: { id: escenario.agenteIAConfigId },
      select: { herramientas: true },
    });
    // 024-alias-ubicaciones-transportistas (research.md §6) — mismo fix que
    // generar-respuesta-ia.suscriptor.ts: sin unir las herramientas "siempre
    // disponibles" acá, el simulador mostraría un resultado distinto al de
    // una conversación real con el mismo agente.
    const { HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES } = await import("@/ai/tools/constantes");
    const herramientasPermitidas = [
      ...new Set([...parsearListaHerramientas(agenteFull?.herramientas), ...HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES]),
    ];

    const configsAutonomia = await obtenerAutonomiaPorAgente(escenario.agenteIAConfigId);

    const mensajes: MensajeSim[] = [{ rol: "system", contenido: contexto.systemPrompt }];
    const diagnosticos: DiagnosticoRespuestaSimulada[] = [];

    for (const mensajeCliente of escenario.mensajes) {
      mensajes.push({ rol: "user", contenido: mensajeCliente });

      const { contenido: respuesta, herramientasEjecutadas, informacionOperativaConsultada } = await this.generarTurno(
        escenario.instanciaId,
        escenario.agenteIAConfigId,
        mensajes,
        herramientasPermitidas,
      );

      mensajes.push({ rol: "assistant", contenido: respuesta });

      let nivelConfianza: number | null = null;
      let decisionAutonomia: DiagnosticoRespuestaSimulada["decisionAutonomia"] = null;
      if (configsAutonomia !== null) {
        const clasificacion = await clasificarCategoriaIntencion(mensajeCliente, escenario.instanciaId);
        const decision = decidirAutonomia(configsAutonomia, clasificacion, perfilCliente);
        nivelConfianza = clasificacion?.categorias.find((c) => c.categoria === decision.categoriaAplicada)?.confianza ?? null;
        decisionAutonomia = { accion: decision.accion, motivo: decision.motivo };
      }

      diagnosticos.push({
        respuesta,
        perfilClienteUsado: escenario.cliente,
        estrategiaSeleccionada: contexto.estrategiaSeleccionada
          ? {
              ...contexto.estrategiaSeleccionada,
              motivo: `Seleccionada por coincidencia de condiciones (tipo: ${escenario.cliente.tipoRelacion}, intención: ${escenario.cliente.intencion}).`,
            }
          : null,
        ejemplosRecuperados: ejemplosRecuperados.map((e) => ({ id: e.id, etiquetasCoincidentes: e.etiquetasCoincidentes })),
        herramientasEjecutadas,
        informacionOperativaConsultada,
        reglasAplicadas,
        nivelConfianza,
        informacionFaltante,
        decisionAutonomia,
      });
    }

    return diagnosticos;
  }

  private async generarTurno(
    instanciaId: string,
    agenteId: string,
    mensajesBase: MensajeSim[],
    herramientasPermitidas: string[],
  ): Promise<{ contenido: string; herramientasEjecutadas: HerramientaEjecutadaDiagnostico[]; informacionOperativaConsultada: string[] }> {
    const { generarRespuesta, generarConHerramientas } = await import("@/ai/gateway/gateway");

    if (herramientasPermitidas.length === 0) {
      const respuesta = await generarRespuesta({
        instanciaId,
        agenteIAConfigId: agenteId,
        tarea: "CHAT",
        mensajes: mensajesBase,
        entidadTipo: "simulacion",
      });
      return { contenido: respuesta.contenido, herramientasEjecutadas: [], informacionOperativaConsultada: [] };
    }

    const { registroHerramientas } = await import("@/ai/tools/registry");
    const { ejecutarHerramienta } = await import("@/ai/tools/executor");
    const definiciones = registroHerramientas.obtenerDefiniciones(herramientasPermitidas);

    const mensajes = [...mensajesBase];
    const toolCtx = {
      instanciaId,
      agenteId,
      conversacionId: "__simulacion__",
      herramientasPermitidas,
      // FR-006/FR-007 — nunca escribe datos reales, propagado a cada tool.
      modoSimulacion: true,
    };

    const herramientasEjecutadas: HerramientaEjecutadaDiagnostico[] = [];
    const informacionOperativaConsultada: string[] = [];
    const HERRAMIENTAS_QUE_ESCRIBEN = new Set([
      "crear_cotizacion",
      "crear_pedido",
      "agregar_productos_oportunidad",
      "transferir_a_humano",
      "actualizar_info_contacto",
      "agregar_etiqueta_contacto",
    ]);

    for (let i = 0; i < 5; i++) {
      const resultado = await generarConHerramientas({
        instanciaId,
        agenteIAConfigId: agenteId,
        tarea: "CHAT",
        mensajes: mensajes as never,
        herramientas: definiciones,
        entidadTipo: "simulacion",
      });

      if (resultado.tipo === "texto") {
        return { contenido: resultado.contenido ?? "", herramientasEjecutadas, informacionOperativaConsultada };
      }

      const llamadas = resultado.herramientasLlamadas ?? [];
      mensajes.push({ rol: "assistant", contenido: (resultado.contenidoAsistente ?? []) as never });

      const toolResults = await Promise.all(
        llamadas.map(async (llamada) => {
          const res = await ejecutarHerramienta(llamada.name, llamada.input, toolCtx);
          const escribe = HERRAMIENTAS_QUE_ESCRIBEN.has(llamada.name);
          herramientasEjecutadas.push({ nombre: llamada.name, resultado: res.data ?? res.error, previsualizado: escribe });
          if (!escribe) informacionOperativaConsultada.push(llamada.name);
          return { type: "tool_result" as const, tool_use_id: llamada.id, content: JSON.stringify(res) };
        }),
      );

      mensajes.push({ rol: "user", contenido: toolResults as never });
    }

    return {
      contenido: "[Simulación] Se agotaron las iteraciones de herramientas sin una respuesta final de texto.",
      herramientasEjecutadas,
      informacionOperativaConsultada,
    };
  }
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

export const simuladorService = new SimuladorService();
