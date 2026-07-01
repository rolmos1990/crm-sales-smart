"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { ConfiguracionIASchema, ProveedorIASchema } from "./schema";

export async function guardarConfiguracionIA(datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const validado = ConfiguracionIASchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  await prisma.configuracionIA.upsert({
    where: { instanciaId: sesion.instanciaId },
    create: {
      instanciaId: sesion.instanciaId,
      ...validado.data,
    },
    update: validado.data,
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function crearProveedorIA(datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const validado = ProveedorIASchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const modelos = validado.data.modelosDisponibles
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  await prisma.proveedorIA.create({
    data: {
      instanciaId: sesion.instanciaId,
      proveedor: validado.data.proveedor,
      tipoAgenteIA: validado.data.tipoAgenteIA ?? null,
      apiKeyEncriptada: validado.data.apiKey || null,
      baseUrl: validado.data.baseUrl || null,
      modelosDisponibles: modelos,
      prioridad: validado.data.prioridad,
      limitePorMinuto: validado.data.limitePorMinuto ?? null,
      limitePorDia: validado.data.limitePorDia ?? null,
      timeoutMs: validado.data.timeoutMs,
      reintentosMax: validado.data.reintentosMax,
      activo: true,
    },
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function toggleProveedorIA(id: string, activo: boolean) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const proveedor = await prisma.proveedorIA.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
  });
  if (!proveedor) return { exito: false, error: "Proveedor no encontrado" };

  await prisma.proveedorIA.update({ where: { id }, data: { activo } });

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function eliminarProveedorIA(id: string) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const proveedor = await prisma.proveedorIA.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
  });
  if (!proveedor) return { exito: false, error: "Proveedor no encontrado" };

  await prisma.proveedorIA.delete({ where: { id } });

  revalidatePath("/configuracion");
  return { exito: true };
}
