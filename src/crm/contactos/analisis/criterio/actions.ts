"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import type { ResultadoAccion } from "@/crm/contactos/types";
import { CriterioContenidoSchema, PLANTILLAS_CRITERIO } from "./schema";
import { PLANTILLAS } from "./plantillas";

/**
 * 042 (Historia 3, FR-046 a FR-049) — Criterio de análisis con versiones.
 * Solo administración (`ia` / modificar). A lo sumo un BORRADOR por cuenta;
 * publicar numera, archiva la publicada anterior y mueve el puntero en una
 * sola transacción. Las evaluaciones ya hechas conservan la versión con la
 * que se hicieron (`ContactoEvaluacion.criterioVersionId`).
 */

const PlantillaSchema = z.object({ plantilla: z.enum(PLANTILLAS_CRITERIO) });
const BorradorSchema = z.object({ contenido: CriterioContenidoSchema });
const PublicarSchema = z.object({ versionId: z.string().min(1), reevaluar: z.boolean() });

const LOTE_REEVALUACION = 1000;

function revalidar() {
  revalidatePath("/configuracion");
}

async function asegurarCriterio(tx: Prisma.TransactionClient, instanciaId: string): Promise<string> {
  const c = await tx.criterioAnalisisContactos.upsert({
    where: { instanciaId },
    create: { instanciaId },
    update: {},
    select: { id: true },
  });
  return c.id;
}

async function guardarBorrador(
  instanciaId: string,
  usuarioInstanciaId: string,
  contenido: z.infer<typeof CriterioContenidoSchema>,
  plantillaOrigen: string | null,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const criterioId = await asegurarCriterio(tx, instanciaId);
    const borrador = await tx.criterioAnalisisContactosVersion.findFirst({
      where: { criterioId, instanciaId, estado: "BORRADOR" },
      select: { id: true, plantillaOrigen: true },
    });
    const datos = { contenido: contenido as unknown as Prisma.InputJsonValue };
    if (borrador) {
      await tx.criterioAnalisisContactosVersion.update({
        where: { id: borrador.id },
        data: { ...datos, ...(plantillaOrigen ? { plantillaOrigen } : {}) },
      });
      return borrador.id;
    }
    const creado = await tx.criterioAnalisisContactosVersion.create({
      data: {
        ...datos,
        criterioId,
        instanciaId,
        estado: "BORRADOR",
        plantillaOrigen: plantillaOrigen ?? "GENERAL",
        creadaPorId: usuarioInstanciaId,
      },
      select: { id: true },
    });
    return creado.id;
  });
}

export async function crearBorradorDesdePlantillaAction(entrada: unknown): Promise<ResultadoAccion<{ versionId: string }>> {
  const validado = PlantillaSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: "Plantilla inválida" };
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  try {
    const { plantilla } = validado.data;
    const versionId = await guardarBorrador(auth.sesion.instanciaId, auth.sesion.usuarioInstanciaId, PLANTILLAS[plantilla].contenido, plantilla);
    revalidar();
    return { exito: true, datos: { versionId } };
  } catch (err) {
    console.error("[crearBorradorDesdePlantillaAction]", err);
    return { exito: false, error: "No se pudo crear el borrador" };
  }
}

export async function guardarBorradorCriterioAction(entrada: unknown): Promise<ResultadoAccion<{ versionId: string }>> {
  const validado = BorradorSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Criterio inválido" };
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  try {
    const versionId = await guardarBorrador(auth.sesion.instanciaId, auth.sesion.usuarioInstanciaId, validado.data.contenido, null);
    revalidar();
    return { exito: true, datos: { versionId } };
  } catch (err) {
    console.error("[guardarBorradorCriterioAction]", err);
    return { exito: false, error: "No se pudo guardar el borrador" };
  }
}

/**
 * Publica el borrador. Con `reevaluar`, encola como histórico (P2,
 * REEVALUACION) a los contactos de la cuenta que no tienen trabajo pendiente:
 * no adelanta ni desplaza a los urgentes ni a los incrementales (Historia 3,
 * escenario 7).
 */
export async function publicarCriterioAction(entrada: unknown): Promise<ResultadoAccion<{ numero: number; reevaluados: number }>> {
  const validado = PublicarSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId, usuarioInstanciaId } = auth.sesion;

  try {
    const numero = await prisma.$transaction(async (tx) => {
      const version = await tx.criterioAnalisisContactosVersion.findFirst({
        where: { id: validado.data.versionId, instanciaId, estado: "BORRADOR" },
        select: { id: true, criterioId: true, contenido: true },
      });
      if (!version) throw new ErrorCriterio("No hay un borrador para publicar");
      if (!CriterioContenidoSchema.safeParse(version.contenido).success) throw new ErrorCriterio("El borrador no es válido");

      const ultimo = await tx.criterioAnalisisContactosVersion.aggregate({
        where: { criterioId: version.criterioId },
        _max: { numero: true },
      });
      const siguiente = (ultimo._max.numero ?? 0) + 1;
      await tx.criterioAnalisisContactosVersion.updateMany({
        where: { criterioId: version.criterioId, estado: "PUBLICADA" },
        data: { estado: "ARCHIVADA" },
      });
      await tx.criterioAnalisisContactosVersion.update({
        where: { id: version.id },
        data: { estado: "PUBLICADA", numero: siguiente, publicadaEn: new Date(), publicadaPorId: usuarioInstanciaId },
      });
      await tx.criterioAnalisisContactos.update({ where: { id: version.criterioId }, data: { versionPublicadaId: version.id } });
      return siguiente;
    });

    const reevaluados = validado.data.reevaluar ? await encolarReevaluacion(instanciaId) : 0;
    revalidar();
    return { exito: true, datos: { numero, reevaluados } };
  } catch (err) {
    if (err instanceof ErrorCriterio) return { exito: false, error: err.message };
    console.error("[publicarCriterioAction]", err);
    return { exito: false, error: "No se pudo publicar el criterio" };
  }
}

class ErrorCriterio extends Error {}

/** Solo filas AL_DIA o FALLIDO: lo que ya está pendiente o en proceso conserva su prioridad. */
async function encolarReevaluacion(instanciaId: string): Promise<number> {
  let total = 0;
  for (;;) {
    const n = await prisma.$executeRaw`
      UPDATE "ContactoAnalisisCola" SET
        "estado" = 'PENDIENTE', "prioridad" = 'P2', "tipo" = 'REEVALUACION', "motivo" = 'CRITERIO',
        "versionDatos" = "versionDatos" + 1, "intentos" = 0, "primerMarcadoEn" = now(), "elegibleDesde" = now(), "actualizadoEn" = now()
      WHERE "id" IN (
        SELECT "id" FROM "ContactoAnalisisCola"
        WHERE "instanciaId" = ${instanciaId} AND "estado" IN ('AL_DIA', 'FALLIDO')
        LIMIT ${LOTE_REEVALUACION}
      )`;
    total += n;
    if (n < LOTE_REEVALUACION) break;
  }
  return total;
}
