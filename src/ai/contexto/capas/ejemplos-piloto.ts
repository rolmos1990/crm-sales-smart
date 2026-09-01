// 014-conversaciones-piloto-ejemplos-relevantes — capa 9 real, reemplaza el
// placeholder de 013. Delega en IRecuperadorEjemplos (reemplazable — FR-014).

import { recuperadorEjemplos } from "@/ai/piloto/recuperador-ejemplos";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

export interface InsumosCapaEjemplosPiloto {
  instanciaId: string;
  agenteIAConfigId?: string;
  perfilCliente?: PerfilCliente | null;
  playbookEstrategiaId?: string;
}

export interface ResultadoCapaEjemplosPiloto {
  texto: string | null;
  // 017-aprendizaje-supervisado-auditoria — ids de los EjemploPrompt
  // efectivamente usados en esta generación, para el registro de trazabilidad.
  ejemplosIds: string[];
}

// Tolerante a fallo (FR-009, mismo criterio que las capas 4/5 de 013): si
// la recuperación de ejemplos falla, la capa se omite sin bloquear la
// generación de la respuesta.
export async function producirCapaEjemplosPiloto(insumos: InsumosCapaEjemplosPiloto): Promise<ResultadoCapaEjemplosPiloto> {
  if (!insumos.agenteIAConfigId) return { texto: null, ejemplosIds: [] };

  try {
    const ejemplos = await recuperadorEjemplos.recuperar({
      instanciaId: insumos.instanciaId,
      agenteIAConfigId: insumos.agenteIAConfigId,
      intencion: insumos.perfilCliente?.datosInterpretados?.intencionComercialActual ?? undefined,
      tipoCliente: insumos.perfilCliente?.tipoRelacion,
      playbookEstrategiaId: insumos.playbookEstrategiaId,
    });

    if (ejemplos.length === 0) return { texto: null, ejemplosIds: [] };

    const texto =
      "Ejemplos de referencia de conversaciones anteriores:\n" +
      ejemplos
        .map((e, i) => `Ejemplo ${i + 1}:\n` + e.contenido.mensajes.map((m) => `${m.rol}: ${m.texto}`).join("\n"))
        .join("\n\n");

    return { texto, ejemplosIds: ejemplos.map((e) => e.id) };
  } catch (err) {
    console.error("[ContextBuilder] Error al resolver la capa de ejemplos piloto:", err);
    return { texto: null, ejemplosIds: [] };
  }
}
