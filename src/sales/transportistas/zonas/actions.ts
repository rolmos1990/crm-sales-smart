"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { listarZonasEntrega } from "./queries";
import { CrearZonaEntregaSchema, EditarZonaEntregaSchema } from "./schema";
import type { ResultadoAccion } from "../types";
import type { ZonaEntregaModel } from "@/generated/prisma/models/ZonaEntrega";

export async function crearZonaEntrega(datos: unknown): Promise<ResultadoAccion<ZonaEntregaModel>> {
  const validado = CrearZonaEntregaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const existente = await prisma.zonaEntrega.findFirst({
    where: { instanciaId: auth.sesion.instanciaId, nombre: { equals: validado.data.nombre, mode: "insensitive" } },
    select: { id: true },
  });
  if (existente) return { exito: false, error: "Ya existe una zona con ese nombre" };

  try {
    const zona = await prisma.zonaEntrega.create({
      data: {
        nombre: validado.data.nombre,
        descripcion: validado.data.descripcion || null,
        instanciaId: auth.sesion.instanciaId,
        ubicaciones: {
          create: validado.data.ubicaciones.map((u) => ({
            paisId: u.paisId,
            provinciaEstado: u.provinciaEstado || null,
            distritoCiudad: u.distritoCiudad || null,
            corregimiento: u.corregimiento || null,
            sectorOCodigoPostal: u.sectorOCodigoPostal || null,
          })),
        },
      },
    });

    revalidatePath("/sales/transportistas");
    return { exito: true, data: zona };
  } catch {
    return { exito: false, error: "Ya existe una zona con ese nombre" };
  }
}

export async function editarZonaEntrega(datos: unknown): Promise<ResultadoAccion<ZonaEntregaModel>> {
  const validado = EditarZonaEntregaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { id, ubicaciones, ...campos } = validado.data;

  const zonaExistente = await prisma.zonaEntrega.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId }, select: { id: true } });
  if (!zonaExistente) return { exito: false, error: "Zona no encontrada" };

  if (campos.nombre) {
    const duplicada = await prisma.zonaEntrega.findFirst({
      where: { instanciaId: auth.sesion.instanciaId, nombre: { equals: campos.nombre, mode: "insensitive" }, NOT: { id } },
      select: { id: true },
    });
    if (duplicada) return { exito: false, error: "Ya existe una zona con ese nombre" };
  }

  try {
    const zona = await prisma.zonaEntrega.update({
      where: { id },
      data: {
        ...(campos.nombre !== undefined ? { nombre: campos.nombre } : {}),
        ...(campos.descripcion !== undefined ? { descripcion: campos.descripcion || null } : {}),
        ...(campos.activa !== undefined ? { activa: campos.activa } : {}),
        ...(ubicaciones
          ? {
              ubicaciones: {
                deleteMany: {},
                create: ubicaciones.map((u) => ({
                  paisId: u.paisId,
                  provinciaEstado: u.provinciaEstado || null,
                  distritoCiudad: u.distritoCiudad || null,
                  corregimiento: u.corregimiento || null,
                  sectorOCodigoPostal: u.sectorOCodigoPostal || null,
                })),
              },
            }
          : {}),
      },
    });

    revalidatePath("/sales/transportistas");
    return { exito: true, data: zona };
  } catch {
    return { exito: false, error: "Ya existe una zona con ese nombre" };
  }
}

export async function eliminarZonaEntrega(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const zona = await prisma.zonaEntrega.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true, _count: { select: { tarifas: true } } },
  });
  if (!zona) return { exito: false, error: "Zona no encontrada" };
  if (zona._count.tarifas > 0) {
    return { exito: false, error: "Esta zona tiene tarifas configuradas — desactívala en vez de eliminarla" };
  }

  await prisma.zonaEntrega.delete({ where: { id } });
  revalidatePath("/sales/transportistas");
  return { exito: true };
}

// Entrypoint client-callable de la query de solo lectura (mismo criterio que
// listarCoberturaGeograficaAction en 019 — la lectura vive en queries.ts).
export async function listarZonasEntregaAction(busqueda?: string) {
  const auth = await requirePermisoAction("transportistas", "ver");
  if (!auth.ok) return [];
  return listarZonasEntrega(auth.sesion.instanciaId, busqueda);
}
