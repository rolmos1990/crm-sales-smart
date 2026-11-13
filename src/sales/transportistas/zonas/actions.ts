"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CrearZonaEntregaSchema, EditarZonaEntregaSchema } from "./schema";
import { construirNombreVisible, calcularNombreNormalizado } from "./normalizar";
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
          create: validado.data.ubicaciones.map((u) => {
            // 024-alias-ubicaciones-transportistas — nombreVisible/nombreNormalizado
            // se calculan siempre en el servidor, nunca se reciben del cliente.
            const nombreVisible = construirNombreVisible(u);
            return {
              paisId: u.paisId,
              provinciaEstado: u.provinciaEstado || null,
              distritoCiudad: u.distritoCiudad || null,
              corregimiento: u.corregimiento || null,
              sectorOCodigoPostal: u.sectorOCodigoPostal || null,
              nombreVisible,
              nombreNormalizado: calcularNombreNormalizado(nombreVisible),
            };
          }),
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

  const { id, nombre, descripcion, ubicaciones } = validado.data;

  const zona = await prisma.zonaEntrega.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true, ubicaciones: { select: { id: true } } },
  });
  if (!zona) return { exito: false, error: "Zona no encontrada" };

  const duplicada = await prisma.zonaEntrega.findFirst({
    where: {
      instanciaId: auth.sesion.instanciaId,
      nombre: { equals: nombre, mode: "insensitive" },
      NOT: { id },
    },
    select: { id: true },
  });
  if (duplicada) return { exito: false, error: "Ya existe una zona con ese nombre" };

  // Reconciliación por id: las ubicaciones que siguen estando se actualizan en
  // su sitio y solo se borran las que el usuario quitó. Borrarlas todas y
  // recrearlas sería más corto, pero AliasUbicacion cae en cascada con cada
  // ZonaEntregaUbicacion — se perderían los alias de destinos que ni se
  // tocaron. Un id ajeno a esta zona se ignora y la ubicación se crea.
  const idsDeLaZona = new Set(zona.ubicaciones.map((u) => u.id));
  const idsConservados = new Set(
    ubicaciones.map((u) => u.id).filter((valor): valor is string => !!valor && idsDeLaZona.has(valor)),
  );
  const idsAEliminar = [...idsDeLaZona].filter((valor) => !idsConservados.has(valor));

  try {
    const actualizada = await prisma.$transaction(async (tx) => {
      if (idsAEliminar.length > 0) {
        await tx.zonaEntregaUbicacion.deleteMany({ where: { id: { in: idsAEliminar }, zonaEntregaId: id } });
      }

      for (const u of ubicaciones) {
        // 024-alias-ubicaciones-transportistas — nombreVisible/nombreNormalizado
        // se calculan siempre en el servidor, nunca se reciben del cliente.
        const nombreVisible = construirNombreVisible(u);
        const campos = {
          paisId: u.paisId,
          provinciaEstado: u.provinciaEstado || null,
          distritoCiudad: u.distritoCiudad || null,
          corregimiento: u.corregimiento || null,
          sectorOCodigoPostal: u.sectorOCodigoPostal || null,
          nombreVisible,
          nombreNormalizado: calcularNombreNormalizado(nombreVisible),
        };
        if (u.id && idsConservados.has(u.id)) {
          await tx.zonaEntregaUbicacion.update({ where: { id: u.id }, data: campos });
        } else {
          await tx.zonaEntregaUbicacion.create({ data: { ...campos, zonaEntregaId: id } });
        }
      }

      return tx.zonaEntrega.update({
        where: { id },
        data: { nombre, descripcion: descripcion || null },
      });
    });

    revalidatePath("/sales/transportistas");
    return { exito: true, data: actualizada };
  } catch {
    return { exito: false, error: "No se pudieron guardar los cambios de la zona" };
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
