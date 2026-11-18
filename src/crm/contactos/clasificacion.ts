import { prisma } from "@/shared/db/prisma";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import type { NivelInteresValor } from "./segmentacion/recomendacion";

/**
 * 041 — Único punto de escritura del interés y de la preferencia "No
 * contactar". Las reglas de transición viven ACÁ y no en las acciones, para
 * que ningún llamador automático (la IA de 042, un Workflow) pueda saltarlas:
 *
 *  - Un interés fijado a mano no lo cambia ningún proceso automático.
 *  - De "No contactar" a "Contactable" solo vuelve una persona.
 *
 * Cada cambio escribe el contacto y su fila de historial en la misma
 * transacción, y publica el evento después del commit.
 */

export type OrigenClasificacion = "MANUAL" | "REGLA" | "IA";

export type AccionInteres =
  | { tipo: "FIJAR"; nivel: NivelInteresValor }
  | { tipo: "LIBERAR" };

export type ResultadoClasificacion =
  | { ok: true; cambiado: boolean }
  | { ok: false; codigo: "NO_ENCONTRADO" | "FIJADO" | "PROHIBIDO"; error: string };

const NO_ENCONTRADO = { ok: false, codigo: "NO_ENCONTRADO", error: "Contacto no encontrado" } as const;

export async function actualizarInteres(p: {
  instanciaId: string;
  contactoId: string;
  accion: AccionInteres;
  origen: OrigenClasificacion;
  usuarioInstanciaId: string | null;
}): Promise<ResultadoClasificacion> {
  const manual = p.origen === "MANUAL";
  if (!manual && p.accion.tipo === "LIBERAR") {
    return { ok: false, codigo: "PROHIBIDO", error: "Solo una persona puede liberar un interés fijado" };
  }

  const nivelNuevo: NivelInteresValor = p.accion.tipo === "FIJAR" ? p.accion.nivel : "SIN_EVALUAR";
  const fijadoNuevo = manual && p.accion.tipo === "FIJAR";

  const resultado = await prisma.$transaction(async (tx) => {
    const actual = await tx.contacto.findFirst({
      where: { id: p.contactoId, instanciaId: p.instanciaId },
      select: { nivelInteres: true, nivelInteresFijado: true },
    });
    if (!actual) return NO_ENCONTRADO;
    if (!manual && actual.nivelInteresFijado) {
      return { ok: false, codigo: "FIJADO", error: "El interés fue fijado manualmente" } as const;
    }
    if (actual.nivelInteres === nivelNuevo && actual.nivelInteresFijado === fijadoNuevo) {
      return { ok: true, cambiado: false, anterior: actual.nivelInteres } as const;
    }

    await tx.contacto.update({
      where: { id: p.contactoId },
      data: {
        nivelInteres: nivelNuevo,
        nivelInteresOrigen: p.origen,
        nivelInteresFijado: fijadoNuevo,
        nivelInteresActualizadoEn: new Date(),
      },
    });
    await tx.contactoClasificacionHistorial.create({
      data: {
        dimension: "INTERES",
        valorAnterior: actual.nivelInteres,
        valorNuevo: nivelNuevo,
        fijado: fijadoNuevo,
        origen: p.origen,
        usuarioInstanciaId: p.usuarioInstanciaId,
        contactoId: p.contactoId,
        instanciaId: p.instanciaId,
      },
    });
    return { ok: true, cambiado: true, anterior: actual.nivelInteres } as const;
  });

  if (!resultado.ok) return resultado;
  if (resultado.cambiado) {
    void publicadorEventos.publicar(EventosSistema.ContactoInteresActualizado, p.instanciaId, {
      instanciaId: p.instanciaId,
      contactoId: p.contactoId,
      nivelAnterior: resultado.anterior,
      nivelNuevo,
      fijado: fijadoNuevo,
      origen: p.origen,
      usuarioInstanciaId: p.usuarioInstanciaId,
    });
  }
  return { ok: true, cambiado: resultado.cambiado };
}

export async function actualizarPreferenciaContacto(p: {
  instanciaId: string;
  contactoId: string;
  noContactar: boolean;
  origen: "MANUAL" | "IA";
  usuarioInstanciaId: string | null;
}): Promise<ResultadoClasificacion> {
  const resultado = await prisma.$transaction(async (tx) => {
    const actual = await tx.contacto.findFirst({
      where: { id: p.contactoId, instanciaId: p.instanciaId },
      select: { noContactarDesde: true },
    });
    if (!actual) return NO_ENCONTRADO;
    const estabaBloqueado = actual.noContactarDesde !== null;
    if (estabaBloqueado === p.noContactar) return { ok: true, cambiado: false } as const;
    if (!p.noContactar && p.origen !== "MANUAL") {
      return { ok: false, codigo: "PROHIBIDO", error: "Solo una persona puede volver a habilitar el contacto" } as const;
    }

    await tx.contacto.update({
      where: { id: p.contactoId },
      data: p.noContactar
        ? { noContactarDesde: new Date(), noContactarOrigen: p.origen, noContactarPorId: p.usuarioInstanciaId }
        : { noContactarDesde: null, noContactarOrigen: null, noContactarPorId: null },
    });
    await tx.contactoClasificacionHistorial.create({
      data: {
        dimension: "PREFERENCIA_CONTACTO",
        valorAnterior: estabaBloqueado ? "NO_CONTACTAR" : "CONTACTABLE",
        valorNuevo: p.noContactar ? "NO_CONTACTAR" : "CONTACTABLE",
        fijado: false,
        origen: p.origen,
        usuarioInstanciaId: p.usuarioInstanciaId,
        contactoId: p.contactoId,
        instanciaId: p.instanciaId,
      },
    });
    return { ok: true, cambiado: true } as const;
  });

  if (resultado.ok && resultado.cambiado) {
    void publicadorEventos.publicar(EventosSistema.ContactoPreferenciaContactoActualizada, p.instanciaId, {
      instanciaId: p.instanciaId,
      contactoId: p.contactoId,
      noContactar: p.noContactar,
      origen: p.origen,
      usuarioInstanciaId: p.usuarioInstanciaId,
    });
  }
  return resultado;
}
