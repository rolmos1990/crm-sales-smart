import { prisma } from "@/shared/db/prisma";
import type { CriteriosRecuperacion, EjemploRecuperado, IRecuperadorEjemplos, ContenidoAnonimizado } from "./tipos";

const MAXIMO_EJEMPLOS = 4;
const MINIMO_EJEMPLOS = 2;

function puntuar(
  ejemplo: { intencion: string | null; tipoCliente: string | null; playbookEstrategiaId: string | null; productoId: string | null },
  criterios: CriteriosRecuperacion,
): number {
  let puntaje = 0;
  if (criterios.intencion && ejemplo.intencion === criterios.intencion) puntaje++;
  if (criterios.tipoCliente && ejemplo.tipoCliente === criterios.tipoCliente) puntaje++;
  if (criterios.playbookEstrategiaId && ejemplo.playbookEstrategiaId === criterios.playbookEstrategiaId) puntaje++;
  if (criterios.productoId && ejemplo.productoId === criterios.productoId) puntaje++;
  return puntaje;
}

/**
 * Implementación por filtro de etiquetas estructuradas (research.md
 * Decisión 2). Reemplazable — cuando exista una capacidad de embeddings,
 * se agrega otra implementación de IRecuperadorEjemplos sin tocar
 * ningún consumidor (mismo patrón de src/ai/proveedores/registro.ts).
 */
class RecuperadorEjemplosPorFiltro implements IRecuperadorEjemplos {
  async recuperar(criterios: CriteriosRecuperacion): Promise<EjemploRecuperado[]> {
    const candidatos = await prisma.ejemploPrompt.findMany({
      where: {
        instanciaId: criterios.instanciaId,
        activo: true,
        OR: [{ agenteIAConfigId: criterios.agenteIAConfigId }, { agenteIAConfigId: null }],
        // FR-013 — nunca un ejemplo cuya piloto de origen fue excluida del
        // perfil. La otra mitad de FR-013 (nunca desde una recomendación
        // rechazada) se garantiza en el origen: convertirRecomendacionEnEjemplo
        // (actions.ts) rechaza convertir una RecomendacionComportamiento en
        // estado RECHAZADA — EjemploPrompt no tiene FK propia a esa tabla.
        conversacionPilotoOrigen: { incluidaEnPerfil: true },
      },
      select: {
        id: true,
        contenido: true,
        intencion: true,
        tipoCliente: true,
        playbookEstrategiaId: true,
        productoId: true,
        calidad: true,
        creadoEn: true,
      },
      orderBy: { creadoEn: "desc" },
    });

    const puntuados = candidatos
      .map((c) => ({ ...c, puntaje: puntuar(c, criterios) }))
      .filter((c) => c.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje || b.calidad - a.calidad || b.creadoEn.getTime() - a.creadoEn.getTime());

    if (puntuados.length < MINIMO_EJEMPLOS) {
      // FR-011 — nunca rellena con irrelevantes (puntaje 0) solo para llegar a 2.
      return puntuados.map((c) => ({ id: c.id, contenido: c.contenido as unknown as ContenidoAnonimizado, etiquetasCoincidentes: c.puntaje }));
    }

    return puntuados.slice(0, MAXIMO_EJEMPLOS).map((c) => ({
      id: c.id,
      contenido: c.contenido as unknown as ContenidoAnonimizado,
      etiquetasCoincidentes: c.puntaje,
    }));
  }
}

export const recuperadorEjemplos: IRecuperadorEjemplos = new RecuperadorEjemplosPorFiltro();
