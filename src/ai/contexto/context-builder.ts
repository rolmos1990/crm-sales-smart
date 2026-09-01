// 013-context-builder-capas-precedencia — compone el contexto de IA en
// capas con precedencia fija:
//
//   1. Políticas globales de seguridad de Karia
//   2. Identidad y comportamiento del agente
//   3. Reglas específicas del negocio (incluye el comportamiento natural fijo)
//   4. Playbook/estrategia comercial activa               ← 011, conectado acá
//   5. Perfil dinámico del cliente                         ← 012, conectado acá
//   6. Estado actual de la conversación
//   7. Datos conocidos y faltantes                         ← placeholder (spec futura)
//   8. Información operativa verificada                    ← placeholder (015)
//   9. Ejemplos piloto relevantes                           ← 014, conectado acá
//  10. Herramientas permitidas                              ← metadata, no texto de prompt
//  11. Instrucción final                                    ← responsabilidad del llamador (ver instruccion-final.ts)
//
// research.md de esta spec documenta por qué la capa 1 (el bloque fijo
// anti prompt-injection) permanece física/textualmente al final del prompt
// — como ya lo hacía antes de esta spec — en vez de ir primera: moverla
// rompería SC-001 (retrocompatibilidad byte a byte) sin ganar nada, porque
// su efectividad viene de reforzar la instrucción al final, no de aparecer
// primero. La precedencia real (FR-002/FR-006) se logra posicionando el
// contenido de menor precedencia (estrategia, perfil) SIEMPRE después de
// las reglas obligatorias (capas 1-3), nunca antes ni mezclado con ellas.

import { construirSystemPrompt, type ConfigAgenteParaPrompt, type ContextoDinamicoPrompt } from "@/ai/prompt/builder";
import { producirCapaEstrategia } from "./capas/estrategia-activa";
import { producirCapaPerfilCliente } from "./capas/perfil-cliente";
import { producirCapaDatosConocidosFaltantes, producirCapaInfoOperativa } from "./capas/placeholders";
import { producirCapaEjemplosPiloto } from "./capas/ejemplos-piloto";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

export interface InsumosContexto {
  instanciaId: string;
  agenteIAConfigId?: string;
  conversacionId?: string;
  contactoId?: string;
  oportunidadId?: string;
  // 018-simulador-agente (research.md Decisión 2) — cuando viene definido
  // (incluso `null`), reemplaza la resolución vía producirCapaPerfilCliente
  // (que requiere un contactoId real). El simulador arma un PerfilCliente
  // 100% simulado sin depender de PerfilClienteService.
  perfilClienteOverride?: PerfilCliente | null;
}

export interface ContextoCompuesto {
  systemPrompt: string;
  estrategiaSeleccionada: { id: string; nombre: string } | null;
  perfilClienteUsado: boolean;
  // 017-aprendizaje-supervisado-auditoria — ids de EjemploPrompt usados en
  // esta generación, para el registro de trazabilidad.
  ejemplosUtilizadosIds: string[];
}

interface DatosParaComponer {
  configAgente: ConfigAgenteParaPrompt | null;
  contextoDinamico: ContextoDinamicoPrompt;
}

/**
 * Orquesta las capas 4 y 5 (estrategia y perfil, ambas tolerantes a fallo —
 * FR-009) y compone el `systemPrompt` final llamando a
 * `construirSystemPrompt` (capas 1-3 + override libre + seguridad,
 * inalterado desde 009 salvo por los 2 parámetros nuevos de inserción).
 */
export async function construirContextoCompuesto(
  insumos: InsumosContexto,
  datos: DatosParaComponer,
): Promise<ContextoCompuesto> {
  if (!datos.configAgente) {
    return { systemPrompt: "", estrategiaSeleccionada: null, perfilClienteUsado: false, ejemplosUtilizadosIds: [] };
  }

  // Capa 5 primero (en cómputo, no en precedencia textual): la capa 4
  // necesita las señales del perfil para elegir la estrategia.
  let perfilCliente: PerfilCliente | null = null;
  if (insumos.perfilClienteOverride !== undefined) {
    perfilCliente = insumos.perfilClienteOverride;
  } else if (insumos.contactoId) {
    perfilCliente = await producirCapaPerfilCliente(insumos.contactoId, insumos.instanciaId);
  }

  let contenidoEstrategia: string | null = null;
  let estrategiaSeleccionada: { id: string; nombre: string } | null = null;
  if (insumos.agenteIAConfigId) {
    const resultado = await producirCapaEstrategia({
      instanciaId: insumos.instanciaId,
      agenteIAConfigId: insumos.agenteIAConfigId,
      conversacionId: insumos.conversacionId,
      perfilCliente,
    });
    contenidoEstrategia = resultado.texto;
    estrategiaSeleccionada = resultado.estrategiaSeleccionada;
  }

  const contenidoPerfilCliente = perfilCliente ? formatearPerfilComoTexto(perfilCliente) : null;

  // Capas 7-8 siguen reservadas (FR-008 de 013), siempre null. Capa 9
  // (014-conversaciones-piloto-ejemplos-relevantes) ya tiene fuente real.
  const [capaDatosFaltantes, capaInfoOperativa, resultadoCapaEjemplosPiloto] = await Promise.all([
    producirCapaDatosConocidosFaltantes(),
    producirCapaInfoOperativa(),
    producirCapaEjemplosPiloto({
      instanciaId: insumos.instanciaId,
      agenteIAConfigId: insumos.agenteIAConfigId,
      perfilCliente,
      playbookEstrategiaId: estrategiaSeleccionada?.id,
    }),
  ]);
  const contenidoReservado = [capaDatosFaltantes, capaInfoOperativa, resultadoCapaEjemplosPiloto.texto]
    .filter((c): c is string => Boolean(c))
    .join("\n\n");

  const systemPrompt = construirSystemPrompt(datos.configAgente, datos.contextoDinamico, {
    contenidoEstrategia,
    contenidoPerfilCliente,
    contenidoReservado: contenidoReservado || null,
  });

  return {
    systemPrompt,
    estrategiaSeleccionada,
    perfilClienteUsado: perfilCliente !== null,
    ejemplosUtilizadosIds: resultadoCapaEjemplosPiloto.ejemplosIds,
  };
}

// Capa 5 (texto) — separa objetivo de interpretado, nunca los mezcla
// (mismo criterio de 012).
function formatearPerfilComoTexto(perfil: PerfilCliente): string {
  const lineas: string[] = [];
  if (perfil.senalesObjetivas.length > 0) {
    lineas.push("Datos objetivos del cliente:\n" + perfil.senalesObjetivas.map((s) => `- ${s}`).join("\n"));
  }
  if (perfil.datosInterpretados) {
    const interpretadas: string[] = [];
    if (perfil.datosInterpretados.intencionComercialActual) {
      interpretadas.push(`Intención actual (interpretada, no confirmada): ${perfil.datosInterpretados.intencionComercialActual}`);
    }
    if (perfil.datosInterpretados.presupuestoConocido) {
      interpretadas.push(`Presupuesto mencionado (interpretado, no confirmado): ${perfil.datosInterpretados.presupuestoConocido}`);
    }
    if (perfil.datosInterpretados.ocasionActual) {
      interpretadas.push(`Ocasión (interpretada, no confirmada): ${perfil.datosInterpretados.ocasionActual}`);
    }
    if (interpretadas.length > 0) {
      lineas.push(interpretadas.join("\n"));
    }
  }
  return lineas.join("\n\n");
}
