"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearEmpresaSchema, ActualizarEmpresaSchema } from "./schema";
import type { ResultadoAccion, Empresa } from "./types";

export async function crearEmpresa(datos: unknown): Promise<ResultadoAccion<Empresa>> {
  const validado = CrearEmpresaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { ruc, industria, tamano, sitioWeb, telefono, email, notas, ...resto } = validado.data;
    const empresa = await prisma.empresa.create({
      data: {
        ...resto,
        ruc: ruc || null,
        industria: industria || null,
        tamano: tamano || null,
        sitioWeb: sitioWeb || null,
        telefono: telefono || null,
        email: email || null,
        notas: notas || null,
      },
    });

    busEventos.publicar(TIPOS_EVENTO.EMPRESA_CREADA, { empresaId: empresa.id, nombre: empresa.nombre });
    revalidatePath("/crm/empresas");
    return { exito: true, datos: empresa as Empresa };
  } catch {
    return { exito: false, error: "Error al crear la empresa" };
  }
}

export async function actualizarEmpresa(id: string, datos: unknown): Promise<ResultadoAccion<Empresa>> {
  const validado = ActualizarEmpresaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const empresa = await prisma.empresa.update({
      where: { id },
      data: {
        ...validado.data,
        ruc: validado.data.ruc || null,
        industria: validado.data.industria || null,
        tamano: validado.data.tamano || null,
        sitioWeb: validado.data.sitioWeb || null,
        telefono: validado.data.telefono || null,
        email: validado.data.email || null,
        notas: validado.data.notas || null,
      },
    });

    busEventos.publicar(TIPOS_EVENTO.EMPRESA_ACTUALIZADA, { empresaId: id, cambios: validado.data as Record<string, unknown> });
    revalidatePath("/crm/empresas");
    revalidatePath(`/crm/empresas/${id}`);
    return { exito: true, datos: empresa as Empresa };
  } catch {
    return { exito: false, error: "Error al actualizar la empresa" };
  }
}

export async function obtenerEmpresaAction(id: string) {
  return prisma.empresa.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      ruc: true,
      industria: true,
      tamano: true,
      sitioWeb: true,
      telefono: true,
      email: true,
      notas: true,
      activo: true,
    },
  });
}

export async function eliminarEmpresa(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.empresa.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/empresas");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la empresa" };
  }
}
