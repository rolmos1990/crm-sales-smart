"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CrearTransportistaSchema, EditarTransportistaSchema } from "./schema";
import type { ResultadoAccion, Transportista } from "./types";

export async function crearTransportista(datos: unknown): Promise<ResultadoAccion<Transportista>> {
  const validado = CrearTransportistaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const transportista = await prisma.transportista.create({
    data: {
      ...validado.data,
      instanciaId: auth.sesion.instanciaId,
    },
  });

  revalidatePath("/sales/transportistas");
  return { exito: true, data: transportista };
}

export async function editarTransportista(datos: unknown): Promise<ResultadoAccion<Transportista>> {
  const validado = EditarTransportistaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { id, ...campos } = validado.data;

  const transportista = await prisma.transportista.update({
    where: { id, instanciaId: auth.sesion.instanciaId },
    data: campos,
  });

  revalidatePath("/sales/transportistas");
  return { exito: true, data: transportista };
}

export async function toggleTransportista(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const actual = await prisma.transportista.findUnique({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { activo: true },
  });
  if (!actual) return { exito: false, error: "Transportista no encontrado" };

  await prisma.transportista.update({
    where: { id },
    data: { activo: !actual.activo },
  });

  revalidatePath("/sales/transportistas");
  return { exito: true };
}
