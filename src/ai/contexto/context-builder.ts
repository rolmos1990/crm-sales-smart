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
//   9. Ejemplos piloto relevantes                           ← placeholder (014)
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
import {
  producirCapaDatosConocidosFaltantes,
  producirCapaInfoOperativa,
  producirCapaEjemplosPiloto,
} from "./capas/placeholders";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

export interface InsumosContexto {
  instanciaId: string;
  agenteIAConfigId?: string;
  conversacionId?: string;
  contactoId?: string;
  oportunidadId?: string;
}

export interface ContextoCompuesto {
  systemPrompt: string;
  estrategiaSeleccionada: { id: string; nombre: string } | null;
  perfilClienteUsado: boolean;
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
    return { systemPrompt: "", estrategiaSeleccionada: null, perfilClienteUsado: false };
  }

  // Capa 5 primero (en cómputo, no en precedencia textual): la capa 4
  // necesita las señales del perfil para elegir la estrategia.
  let perfilCliente: PerfilCliente | null = null;
  if (insumos.contactoId) {
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

  // Capas 7-9 — reservadas (FR-008), siempre null en esta spec. Se invocan
  // igual para que su posición en el pipeline quede fijada desde ahora.
  const [capaDatosFaltantes, capaInfoOperativa, capaEjemplosPiloto] = await Promise.all([
    producirCapaDatosConocidosFaltantes(),
    producirCapaInfoOperativa(),
    producirCapaEjemplosPiloto(),
  ]);
  const contenidoReservado = [capaDatosFaltantes, capaInfoOperativa, capaEjemplosPiloto]
    .filter((c): c is string => Boolean(c))
    .join("\n\n");

  const systemPrompt = construirSystemPrompt(datos.configAgente, datos.contextoDinamico, {
    contenidoEstrategia,
    contenidoPerfilCliente,
    contenidoReservado: contenidoReservado || null,
  });

  return { systemPrompt, estrategiaSeleccionada, perfilClienteUsado: perfilCliente !== null };
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
