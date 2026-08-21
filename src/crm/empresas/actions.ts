"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { CrearEmpresaSchema, ActualizarEmpresaSchema } from "./schema";
import type { ResultadoAccion, Empresa } from "./types";

// Búsqueda server-side para combos/filtros (ej. filtro de empresa en
// Oportunidades) — mismo patrón que buscarContactosAction/buscarProductosAction.
export async function buscarEmpresasAction(query: string) {
  if (!query.trim()) return [];
  const sesion = await requireSesion();
  const { buscarEmpresas } = await import("./queries");
  return buscarEmpresas(query, sesion.instanciaId);
}

export async function crearEmpresa(datos: unknown): Promise<ResultadoAccion<Empresa>> {
  const validado = CrearEmpresaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("empresas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const { ruc, industria, tamano, sitioWeb, telefono, email, notas, ...resto } = validado.data;
    const empresa = await prisma.empresa.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        ruc: ruc || null,
        industria: industria || null,
        tamano: tamano || null,
        sitioWeb: sitioWeb || null,
        telefono: telefono || null,
        email: email || null,
        notas: notas || null,
      },
    });

    await publicadorEventos.publicar(EventosSistema.EmpresaCreada, sesion.instanciaId, { instanciaId: sesion.instanciaId, empresaId: empresa.id, nombre: empresa.nombre });
    revalidatePath("/crm/empresas");
    return { exito: true, datos: empresa as Empresa };
  } catch {
    return { exito: false, error: "Error al crear la empresa" };
  }
}

export async function actualizarEmpresa(id: string, datos: unknown): Promise<ResultadoAccion<Empresa>> {
  const validado = ActualizarEmpresaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("empresas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const existe = await prisma.empresa.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!existe) return { exito: false, error: "Empresa no encontrada" };

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

    await publicadorEventos.publicar(EventosSistema.EmpresaActualizada, sesion.instanciaId, { instanciaId: sesion.instanciaId, empresaId: id, cambios: validado.data as Record<string, unknown> });
    revalidatePath("/crm/empresas");
    revalidatePath(`/crm/empresas/${id}`);
    return { exito: true, datos: empresa as Empresa };
  } catch {
    return { exito: false, error: "Error al actualizar la empresa" };
  }
}

export async function obtenerEmpresaAction(id: string) {
  const sesion = await requireSesion();
  return prisma.empresa.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
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
  const auth = await requirePermisoAction("empresas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const existe = await prisma.empresa.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!existe) return { exito: false, error: "Empresa no encontrada" };

    await prisma.empresa.update({ where: { id }, data: { activo: false } });
    revalidatePath("/crm/empresas");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la empresa" };
  }
}
