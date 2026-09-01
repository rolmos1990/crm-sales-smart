"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { listarCoberturaGeografica } from "./queries";
import { CrearTransportistaSchema, EditarTransportistaSchema, CoberturaGeograficaSchema } from "./schema";
import type { ResultadoAccion, Transportista, TransportistaCoberturaGeografica } from "./types";

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

// 019-cobertura-geografica-envios — FR-001/FR-002/FR-016

// Entrypoint client-callable de la query de solo lectura (dialog-transportista
// es Client Component) — misma separación query/action que el resto del
// proyecto, la lectura vive en queries.ts.
export async function listarCoberturaGeograficaAction(transportistaId: string) {
  const auth = await requirePermisoAction("configuracion", "ver");
  if (!auth.ok) return [];

  const transportista = await prisma.transportista.findFirst({
    where: { id: transportistaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!transportista) return [];

  return listarCoberturaGeografica(transportistaId);
}

export async function guardarCoberturaGeografica(datos: unknown): Promise<ResultadoAccion<TransportistaCoberturaGeografica>> {
  const validado = CoberturaGeograficaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const transportista = await prisma.transportista.findFirst({
    where: { id: validado.data.transportistaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!transportista) return { exito: false, error: "Transportista no encontrado en esta instancia" };

  // En modo UN_SOLO_PAIS, el país de la zona lo determina la instancia, no
  // el formulario (FR-011 aplicado también a la configuración de cobertura).
  const config = await obtenerConfiguracionEmpresa(auth.sesion.instanciaId);
  const paisId = config?.modoGeografico === "UN_SOLO_PAIS" && config.paisOperacionId
    ? config.paisOperacionId
    : validado.data.paisId;

  const estadoProvincia = await prisma.estadoProvincia.findUnique({
    where: { id: validado.data.estadoProvinciaId },
    select: { paisId: true },
  });
  if (!estadoProvincia) return { exito: false, error: "Estado/provincia no encontrado" };
  if (estadoProvincia.paisId !== paisId) {
    return { exito: false, error: "El estado/provincia elegido no pertenece al país seleccionado" };
  }

  const cobertura = await prisma.transportistaCoberturaGeografica.upsert({
    where: {
      transportistaId_estadoProvinciaId: {
        transportistaId: validado.data.transportistaId,
        estadoProvinciaId: validado.data.estadoProvinciaId,
      },
    },
    create: {
      transportistaId: validado.data.transportistaId,
      paisId,
      estadoProvinciaId: validado.data.estadoProvinciaId,
      costoEnvio: validado.data.costoEnvio,
      activo: validado.data.activo,
    },
    update: {
      costoEnvio: validado.data.costoEnvio,
      activo: validado.data.activo,
    },
  });

  revalidatePath("/sales/transportistas");
  return { exito: true, data: cobertura };
}

export async function eliminarCoberturaGeografica(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const cobertura = await prisma.transportistaCoberturaGeografica.findFirst({
    where: { id, transportista: { instanciaId: auth.sesion.instanciaId } },
    select: { id: true },
  });
  if (!cobertura) return { exito: false, error: "Cobertura no encontrada en esta instancia" };

  await prisma.transportistaCoberturaGeografica.delete({ where: { id } });

  revalidatePath("/sales/transportistas");
  return { exito: true };
}
