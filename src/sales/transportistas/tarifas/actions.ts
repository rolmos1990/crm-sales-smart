"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CrearTarifaSchema, EditarTarifaSchema, CambioMasivoSchema } from "./schema";
import { obtenerOpcionesEnvio } from "./queries";
import type { ResultadoAccion } from "../types";
import type { TarifaTransportistaZonaModel } from "@/generated/prisma/models/TarifaTransportistaZona";

type Tarifa = TarifaTransportistaZonaModel;

function advertenciaMargen(costoInterno: number, precioCliente: number): string | undefined {
  return precioCliente < costoInterno ? "El precio al cliente es menor que el costo interno" : undefined;
}

async function registrarHistorial(params: {
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
      entidadTipo: "TARIFA",
      entidadId: params.entidadId,
      accion: params.accion,
      valorAnterior: params.valorAnterior == null ? undefined : (params.valorAnterior as object),
      valorNuevo: params.valorNuevo == null ? undefined : (params.valorNuevo as object),
      usuarioId: params.usuarioId ?? null,
      usuarioNombre: params.usuarioNombre ?? null,
    },
  });
}

export async function crearTarifa(datos: unknown): Promise<ResultadoAccion<Tarifa>> {
  const validado = CrearTarifaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const transportista = await prisma.transportista.findFirst({
    where: { id: validado.data.transportistaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!transportista) return { exito: false, error: "Transportista no encontrado en esta instancia" };

  const duplicada = await prisma.tarifaTransportistaZona.findFirst({
    where: {
      transportistaId: validado.data.transportistaId,
      zonaEntregaId: validado.data.zonaEntregaId,
      servicioTransportistaId: validado.data.servicioTransportistaId,
    },
    select: { id: true },
  });
  if (duplicada) return { exito: false, error: "Ya existe una tarifa para esta combinación de zona y servicio" };

  try {
    const tarifa = await prisma.tarifaTransportistaZona.create({
      data: { ...validado.data, instanciaId: auth.sesion.instanciaId },
    });

    await registrarHistorial({
      instanciaId: auth.sesion.instanciaId,
      entidadId: tarifa.id,
      accion: "creada",
      valorNuevo: { costoInterno: validado.data.costoInterno, precioCliente: validado.data.precioCliente },
      usuarioId: auth.sesion.usuarioId,
      usuarioNombre: auth.sesion.nombre,
    });

    revalidatePath("/sales/transportistas");
    revalidatePath(`/sales/transportistas/${validado.data.transportistaId}`);
    const advertencia = advertenciaMargen(validado.data.costoInterno, validado.data.precioCliente);
    return { exito: true, data: tarifa, ...(advertencia ? { advertencia } : {}) };
  } catch {
    return { exito: false, error: "Ya existe una tarifa para esta combinación de zona y servicio" };
  }
}

export async function editarTarifa(datos: unknown): Promise<ResultadoAccion<Tarifa>> {
  const validado = EditarTarifaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { id, ...campos } = validado.data;
  const anterior = await prisma.tarifaTransportistaZona.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId } });
  if (!anterior) return { exito: false, error: "Tarifa no encontrada" };

  const duplicada = await prisma.tarifaTransportistaZona.findFirst({
    where: {
      transportistaId: anterior.transportistaId,
      zonaEntregaId: campos.zonaEntregaId,
      servicioTransportistaId: campos.servicioTransportistaId,
      NOT: { id },
    },
    select: { id: true },
  });
  if (duplicada) return { exito: false, error: "Ya existe una tarifa para esta combinación de zona y servicio" };

  try {
    const tarifa = await prisma.tarifaTransportistaZona.update({ where: { id }, data: campos });

    await registrarHistorial({
      instanciaId: auth.sesion.instanciaId,
      entidadId: id,
      accion: "editada",
      valorAnterior: { costoInterno: Number(anterior.costoInterno), precioCliente: Number(anterior.precioCliente) },
      valorNuevo: { costoInterno: campos.costoInterno, precioCliente: campos.precioCliente },
      usuarioId: auth.sesion.usuarioId,
      usuarioNombre: auth.sesion.nombre,
    });

    revalidatePath("/sales/transportistas");
    revalidatePath(`/sales/transportistas/${anterior.transportistaId}`);
    const advertencia = advertenciaMargen(campos.costoInterno, campos.precioCliente);
    return { exito: true, data: tarifa, ...(advertencia ? { advertencia } : {}) };
  } catch {
    return { exito: false, error: "Ya existe una tarifa para esta combinación de zona y servicio" };
  }
}

export async function duplicarTarifa(
  id: string,
  destino?: { zonaEntregaId?: string; servicioTransportistaId?: string },
): Promise<ResultadoAccion<Tarifa>> {
  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const origen = await prisma.tarifaTransportistaZona.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId } });
  if (!origen) return { exito: false, error: "Tarifa no encontrada" };

  const zonaEntregaId = destino?.zonaEntregaId ?? origen.zonaEntregaId;
  const servicioTransportistaId = destino?.servicioTransportistaId ?? origen.servicioTransportistaId;

  const duplicada = await prisma.tarifaTransportistaZona.findFirst({
    where: { transportistaId: origen.transportistaId, zonaEntregaId, servicioTransportistaId },
    select: { id: true },
  });
  if (duplicada) return { exito: false, error: "Ya existe una tarifa para esta combinación de zona y servicio" };

  const copia = await prisma.tarifaTransportistaZona.create({
    data: {
      instanciaId: auth.sesion.instanciaId,
      transportistaId: origen.transportistaId,
      zonaEntregaId,
      servicioTransportistaId,
      costoInterno: origen.costoInterno,
      precioCliente: origen.precioCliente,
      tiempoMinimoDias: origen.tiempoMinimoDias,
      tiempoMaximoDias: origen.tiempoMaximoDias,
      vigenteDesde: origen.vigenteDesde,
      vigenteHasta: origen.vigenteHasta,
      activa: false,
    },
  });

  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${origen.transportistaId}`);
  return { exito: true, data: copia };
}

export async function toggleTarifa(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const actual = await prisma.tarifaTransportistaZona.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { activa: true, transportistaId: true },
  });
  if (!actual) return { exito: false, error: "Tarifa no encontrada" };

  await prisma.tarifaTransportistaZona.update({ where: { id }, data: { activa: !actual.activa } });

  await registrarHistorial({
    instanciaId: auth.sesion.instanciaId,
    entidadId: id,
    accion: actual.activa ? "desactivada" : "activada",
    usuarioId: auth.sesion.usuarioId,
    usuarioNombre: auth.sesion.nombre,
  });

  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${actual.transportistaId}`);
  return { exito: true };
}

// FR-020 — eliminar solo si nunca se usó en una cotización o pedido.
export async function eliminarTarifa(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const tarifa = await prisma.tarifaTransportistaZona.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId }, select: { id: true, transportistaId: true } });
  if (!tarifa) return { exito: false, error: "Tarifa no encontrada" };

  const [enCotizacion, enPedido] = await Promise.all([
    prisma.entregaCotizacion.findFirst({ where: { tarifaTransportistaZonaId: id }, select: { id: true } }),
    prisma.entregaPedido.findFirst({ where: { tarifaTransportistaZonaId: id }, select: { id: true } }),
  ]);
  if (enCotizacion || enPedido) {
    return { exito: false, error: "Esta tarifa ya fue usada — solo puede desactivarse" };
  }

  await prisma.tarifaTransportistaZona.delete({ where: { id } });
  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${tarifa.transportistaId}`);
  return { exito: true };
}

// FR-021 — aplica el mismo cambio a varias zonas a la vez para el mismo
// transportista y servicio.
export async function aplicarCambioMasivo(datos: unknown): Promise<ResultadoAccion<{ actualizadas: number; creadas: number }>> {
  const validado = CambioMasivoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { transportistaId, servicioTransportistaId, zonaEntregaIds, cambios, crearSiNoExiste } = validado.data;

  const transportista = await prisma.transportista.findFirst({ where: { id: transportistaId, instanciaId: auth.sesion.instanciaId }, select: { id: true } });
  if (!transportista) return { exito: false, error: "Transportista no encontrado en esta instancia" };

  const existentes = await prisma.tarifaTransportistaZona.findMany({
    where: { transportistaId, servicioTransportistaId, zonaEntregaId: { in: zonaEntregaIds } },
    select: { id: true, zonaEntregaId: true },
  });
  const zonasConTarifa = new Set(existentes.map((t) => t.zonaEntregaId));

  let actualizadas = 0;
  let creadas = 0;

  await prisma.$transaction(async (tx) => {
    if (existentes.length > 0) {
      const resultado = await tx.tarifaTransportistaZona.updateMany({
        where: { id: { in: existentes.map((t) => t.id) } },
        data: cambios,
      });
      actualizadas = resultado.count;
    }

    if (crearSiNoExiste) {
      const faltantes = zonaEntregaIds.filter((z) => !zonasConTarifa.has(z));
      if (faltantes.length > 0 && cambios.costoInterno !== undefined && cambios.precioCliente !== undefined) {
        const resultado = await tx.tarifaTransportistaZona.createMany({
          data: faltantes.map((zonaEntregaId) => ({
            instanciaId: auth.sesion.instanciaId,
            transportistaId,
            zonaEntregaId,
            servicioTransportistaId,
            costoInterno: cambios.costoInterno!,
            precioCliente: cambios.precioCliente!,
            activa: cambios.activa ?? true,
          })),
        });
        creadas = resultado.count;
      }
    }
  });

  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${transportistaId}`);
  return { exito: true, data: { actualizadas, creadas } };
}

// 022-transportistas-zonas-tarifas, Historia 2 (T039) — entrypoint
// client-callable (form-cotizacion.tsx es Client Component) de la
// resolución de opciones de envío por destino (FR-036); no exige el
// permiso "transportistas" porque cualquier usuario que pueda crear una
// cotización debe poder ver las opciones de envío para elegir una. Recibe
// IDs de catálogo (paisId/estadoProvinciaId, mismo criterio que
// obtenerCostoSugerido en shared/entregas/actions.ts) y los resuelve a
// texto acá — el motor de resolución matchea por nombre/slug.
export async function obtenerOpcionesEnvioAction(destino: {
  estadoProvinciaId?: string | null;
  paisId?: string | null;
  ciudad?: string | null;
  corregimiento?: string | null;
  sectorOCodigoPostal?: string | null;
  transportistaId?: string | null;
}) {
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return [];

  if (!destino.estadoProvinciaId && !destino.paisId) return [];

  const [pais, estado] = await Promise.all([
    destino.paisId ? prisma.pais.findUnique({ where: { id: destino.paisId }, select: { nombre: true } }) : null,
    destino.estadoProvinciaId ? prisma.estadoProvincia.findUnique({ where: { id: destino.estadoProvinciaId }, select: { nombre: true } }) : null,
  ]);

  return obtenerOpcionesEnvio(auth.sesion.instanciaId, {
    pais: pais?.nombre ?? null,
    estadoProvincia: estado?.nombre ?? null,
    distritoCiudad: destino.ciudad ?? null,
    corregimiento: destino.corregimiento ?? null,
    sectorOCodigoPostal: destino.sectorOCodigoPostal ?? null,
    transportistaId: destino.transportistaId ?? null,
  });
}
