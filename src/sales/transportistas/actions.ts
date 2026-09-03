"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CrearTransportistaSchema, EditarTransportistaSchema } from "./schema";
import { SERVICIOS_TRANSPORTISTA_INICIALES, CONDICIONES_POR_DEFECTO } from "./types";
import type { ResultadoAccion, Transportista } from "./types";

async function registrarHistorialTransportista(params: {
  instanciaId: string;
  entidadId: string;
  accion: string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  usuarioId?: string | null;
  usuarioNombre?: string | null;
}) {
  await prisma.transportistaHistorial.create({
    data: {
      instanciaId: params.instanciaId,
      entidadTipo: "TRANSPORTISTA",
      entidadId: params.entidadId,
      accion: params.accion,
      valorAnterior: params.valorAnterior == null ? undefined : (params.valorAnterior as object),
      valorNuevo: params.valorNuevo == null ? undefined : (params.valorNuevo as object),
      usuarioId: params.usuarioId ?? null,
      usuarioNombre: params.usuarioNombre ?? null,
    },
  });
}

export async function crearTransportista(datos: unknown): Promise<ResultadoAccion<Transportista>> {
  const validado = CrearTransportistaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  // 022-transportistas-zonas-tarifas — corrige la inconsistencia detectada
  // en research.md: este módulo chequeaba "configuracion" en vez de
  // "transportistas" (que ya existe en Modulo y ya se usa en la página).
  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const transportista = await prisma.transportista.create({
    data: {
      ...validado.data,
      instanciaId: auth.sesion.instanciaId,
      servicios: { create: SERVICIOS_TRANSPORTISTA_INICIALES.map((nombre) => ({ nombre })) },
      condiciones: { create: CONDICIONES_POR_DEFECTO },
    },
  });

  await registrarHistorialTransportista({
    instanciaId: auth.sesion.instanciaId,
    entidadId: transportista.id,
    accion: "creado",
    valorNuevo: { nombre: transportista.nombre, tipo: transportista.tipo, paisId: transportista.paisId },
    usuarioId: auth.sesion.usuarioId,
    usuarioNombre: auth.sesion.nombre,
  });

  revalidatePath("/sales/transportistas");
  return { exito: true, data: transportista };
}

export async function editarTransportista(datos: unknown): Promise<ResultadoAccion<Transportista>> {
  const validado = EditarTransportistaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { id, ...campos } = validado.data;

  const anterior = await prisma.transportista.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId } });
  if (!anterior) return { exito: false, error: "Transportista no encontrado" };

  // 023-transportistas-por-pais — research.md Decisión 3: el país queda de
  // solo lectura en cuanto el transportista tiene alguna tarifa configurada
  // (activa o no) — evita dejar zonas/tarifas asociadas a un país distinto
  // al vigente (FR-010).
  if (campos.paisId !== undefined && campos.paisId !== anterior.paisId) {
    const totalTarifas = await prisma.tarifaTransportistaZona.count({ where: { transportistaId: id } });
    if (totalTarifas > 0) {
      return {
        exito: false,
        error: "No se puede cambiar el país de un transportista con tarifas configuradas. Crea un transportista nuevo para operar en otro país.",
      };
    }
  }

  const transportista = await prisma.transportista.update({
    where: { id },
    data: {
      ...campos,
      personaContacto: campos.personaContacto || null,
      telefono: campos.telefono || null,
      correoElectronico: campos.correoElectronico || null,
      notasInternas: campos.notasInternas || null,
    },
  });

  await registrarHistorialTransportista({
    instanciaId: auth.sesion.instanciaId,
    entidadId: id,
    accion: "editado",
    valorAnterior: { nombre: anterior.nombre, tipo: anterior.tipo, paisId: anterior.paisId },
    valorNuevo: { nombre: transportista.nombre, tipo: transportista.tipo, paisId: transportista.paisId },
    usuarioId: auth.sesion.usuarioId,
    usuarioNombre: auth.sesion.nombre,
  });

  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${id}`);
  return { exito: true, data: transportista };
}

export async function toggleTransportista(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("transportistas", "modificar");
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

  await registrarHistorialTransportista({
    instanciaId: auth.sesion.instanciaId,
    entidadId: id,
    accion: actual.activo ? "desactivado" : "activado",
    usuarioId: auth.sesion.usuarioId,
    usuarioNombre: auth.sesion.nombre,
  });

  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${id}`);
  return { exito: true };
}
