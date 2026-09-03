"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { normalizarUbicacion } from "@/shared/entregas/normalizar-ubicacion";
import { CrearAliasUbicacionSchema } from "./alias-schema";
import type { ResultadoAccion } from "../types";
import type { AliasUbicacionModel } from "@/generated/prisma/models/AliasUbicacion";
import type { CampoUbicacion } from "@/generated/prisma/client";

interface NivelesUbicacion {
  provinciaEstado: string | null;
  distritoCiudad: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
}

const CAMPO_A_PROPIEDAD: Record<CampoUbicacion, keyof NivelesUbicacion> = {
  PROVINCIA_ESTADO: "provinciaEstado",
  DISTRITO_CIUDAD: "distritoCiudad",
  CORREGIMIENTO: "corregimiento",
  SECTOR_O_CODIGO_POSTAL: "sectorOCodigoPostal",
};

// 024-alias-ubicaciones-transportistas (FR-002) — nivel más específico no
// vacío, mismo orden de especificidad que construirNombreVisible.
function inferirCampoMasEspecifico(u: NivelesUbicacion): CampoUbicacion | null {
  if (u.sectorOCodigoPostal) return "SECTOR_O_CODIGO_POSTAL";
  if (u.corregimiento) return "CORREGIMIENTO";
  if (u.distritoCiudad) return "DISTRITO_CIUDAD";
  if (u.provinciaEstado) return "PROVINCIA_ESTADO";
  return null;
}

function esErrorAliasDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function listarAliasUbicacion(zonaEntregaUbicacionId: string): Promise<AliasUbicacionModel[]> {
  const auth = await requirePermisoAction("transportistas", "ver");
  if (!auth.ok) return [];

  return prisma.aliasUbicacion.findMany({
    where: { zonaEntregaUbicacionId, instanciaId: auth.sesion.instanciaId },
    orderBy: { creadoEn: "asc" },
  });
}

// 024-alias-ubicaciones-transportistas — entrypoint client-callable usado por
// DialogAliasUbicacion: una zona puede tener varias ZonaEntregaUbicacion, así
// que el diálogo necesita conocerlas (con sus alias ya incluidos) antes de
// poder listar/agregar por cada una.
export async function listarUbicacionesConAlias(zonaEntregaId: string) {
  const auth = await requirePermisoAction("transportistas", "ver");
  if (!auth.ok) return [];

  return prisma.zonaEntregaUbicacion.findMany({
    where: { zonaEntregaId, zonaEntrega: { instanciaId: auth.sesion.instanciaId } },
    include: { aliases: { orderBy: { creadoEn: "asc" } } },
  });
}

export async function agregarAliasUbicacion(datos: unknown): Promise<ResultadoAccion<AliasUbicacionModel>> {
  const validado = CrearAliasUbicacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const ubicacion = await prisma.zonaEntregaUbicacion.findFirst({
    where: { id: validado.data.zonaEntregaUbicacionId, zonaEntrega: { instanciaId: auth.sesion.instanciaId } },
    select: { provinciaEstado: true, distritoCiudad: true, corregimiento: true, sectorOCodigoPostal: true },
  });
  if (!ubicacion) return { exito: false, error: "Destino no encontrado" };

  const campo = validado.data.campo ?? inferirCampoMasEspecifico(ubicacion);
  if (!campo) return { exito: false, error: "Este destino no tiene ningún nivel geográfico configurado para asignarle un alias" };
  if (!ubicacion[CAMPO_A_PROPIEDAD[campo]]) {
    return { exito: false, error: "El nivel elegido para el alias no está configurado en este destino" };
  }

  const valorNormalizado = normalizarUbicacion(validado.data.valor);

  // FR-003 — rechazo explícito antes de tocar Prisma; el índice único de BD
  // (@@unique([instanciaId, campo, valorNormalizado])) queda como resguardo
  // ante condiciones de carrera, capturado más abajo (mismo patrón que
  // 021-alias-proveedores-ia).
  const duplicado = await prisma.aliasUbicacion.findFirst({
    where: { instanciaId: auth.sesion.instanciaId, campo, valorNormalizado },
  });
  if (duplicado) return { exito: false, error: `Ya existe un alias "${validado.data.valor.trim()}" para otro destino` };

  try {
    const alias = await prisma.aliasUbicacion.create({
      data: {
        zonaEntregaUbicacionId: validado.data.zonaEntregaUbicacionId,
        campo,
        valor: validado.data.valor.trim(),
        valorNormalizado,
        instanciaId: auth.sesion.instanciaId,
      },
    });

    revalidatePath("/sales/transportistas");
    return { exito: true, data: alias };
  } catch (err) {
    if (esErrorAliasDuplicado(err)) {
      return { exito: false, error: `Ya existe un alias "${validado.data.valor.trim()}" para otro destino` };
    }
    return { exito: false, error: "No se pudo crear el alias" };
  }
}

export async function eliminarAliasUbicacion(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const alias = await prisma.aliasUbicacion.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!alias) return { exito: false, error: "Alias no encontrado" };

  await prisma.aliasUbicacion.delete({ where: { id } });
  revalidatePath("/sales/transportistas");
  return { exito: true };
}
