"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { eliminarMediaPorUrl } from "@/lib/media/services/media.service";
import { CrearPlantillaSchema, ActualizarPlantillaSchema, normalizarAlias } from "./schema";
import type { ResultadoAccion, Plantilla } from "./types";

async function requireAdminConfig() {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "configuracion", "modificar");
  return { acceso, sesion };
}

export async function crearPlantilla(datos: unknown): Promise<ResultadoAccion<Plantilla>> {
  const validado = CrearPlantillaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  const { acceso } = await requireAdminConfig();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  try {
    const plantilla = await prisma.plantillaCRM.create({
      data: {
        nombre: validado.data.nombre,
        alias: normalizarAlias(validado.data.alias),
        descripcion: validado.data.descripcion || null,
        tipo: validado.data.tipo,
        contenidoTexto: validado.data.contenidoTexto,
        imagenUrl: validado.data.imagenUrl || null,
        instanciaId: validado.data.instanciaId,
      },
    });
    revalidatePath("/configuracion");
    return { exito: true, datos: plantilla as Plantilla };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { exito: false, error: "Ya existe una plantilla con ese alias" };
    }
    return { exito: false, error: "Error al crear la plantilla" };
  }
}

export async function actualizarPlantilla(
  id: string,
  datos: unknown
): Promise<ResultadoAccion<Plantilla>> {
  const validado = ActualizarPlantillaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  const { acceso, sesion } = await requireAdminConfig();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  try {
    const anterior = await prisma.plantillaCRM.findUnique({
      where: { id },
      select: { imagenUrl: true },
    });

    const nuevaImagenUrl = validado.data.imagenUrl || null;

    const plantilla = await prisma.plantillaCRM.update({
      where: { id },
      data: {
        ...validado.data,
        alias: validado.data.alias ? normalizarAlias(validado.data.alias) : undefined,
        descripcion: validado.data.descripcion || null,
        imagenUrl: nuevaImagenUrl,
      },
    });

    // Si la imagen cambió o se quitó, borrar la anterior del storage —
    // que no quede huérfana ni la reutilice una futura deduplicación.
    if (anterior?.imagenUrl && anterior.imagenUrl !== nuevaImagenUrl) {
      await eliminarMediaPorUrl(anterior.imagenUrl, sesion.instanciaId).catch((e) =>
        console.error("[actualizarPlantilla] Error al borrar imagen anterior:", e)
      );
    }

    revalidatePath("/configuracion");
    return { exito: true, datos: plantilla as Plantilla };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { exito: false, error: "Ya existe una plantilla con ese alias" };
    }
    return { exito: false, error: "Error al actualizar la plantilla" };
  }
}

export async function togglePlantillaActiva(
  id: string,
  activo: boolean
): Promise<ResultadoAccion> {
  const { acceso } = await requireAdminConfig();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  try {
    await prisma.plantillaCRM.update({ where: { id }, data: { activo } });
    revalidatePath("/configuracion");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar el estado" };
  }
}

export async function eliminarPlantilla(id: string): Promise<ResultadoAccion> {
  const { acceso, sesion } = await requireAdminConfig();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  try {
    const existente = await prisma.plantillaCRM.findUnique({
      where: { id },
      select: { imagenUrl: true },
    });

    await prisma.plantillaCRM.delete({ where: { id } });

    if (existente?.imagenUrl) {
      await eliminarMediaPorUrl(existente.imagenUrl, sesion.instanciaId).catch((e) =>
        console.error("[eliminarPlantilla] Error al borrar imagen:", e)
      );
    }

    revalidatePath("/configuracion");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la plantilla" };
  }
}
