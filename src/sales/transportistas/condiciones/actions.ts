"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CondicionesTransportistaSchema } from "./schema";
import type { ResultadoAccion, CondicionesTransportista } from "../types";

// 022-transportistas-zonas-tarifas (Historia 4, T050) — completa el CRUD que
// había quedado pendiente: crearTransportista() ya siembra condiciones por
// defecto, pero hasta ahora no existía forma de editarlas — la pestaña
// "Condiciones" era de solo lectura.
export async function guardarCondicionesTransportista(datos: unknown): Promise<ResultadoAccion<CondicionesTransportista>> {
  const validado = CondicionesTransportistaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { transportistaId, ...campos } = validado.data;

  const transportista = await prisma.transportista.findFirst({
    where: { id: transportistaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true, condiciones: true },
  });
  if (!transportista) return { exito: false, error: "Transportista no encontrado" };

  const datosGuardar = {
    diasEntrega: campos.diasEntrega,
    horaLimiteMismoDia: campos.horaLimiteMismoDia || null,
    tiempoPreparacionDias: campos.tiempoPreparacionDias,
    permiteEntregaMismoDia: campos.permiteEntregaMismoDia,
    pesoMaximoKg: campos.pesoMaximoKg ?? null,
    requiereDireccionCompleta: campos.requiereDireccionCompleta,
    permiteArticulosFragiles: campos.permiteArticulosFragiles,
    permitePagoContraEntrega: campos.permitePagoContraEntrega,
    observaciones: campos.observaciones || null,
    metodoPagoTransportista: campos.metodoPagoTransportista || null,
    frecuenciaFacturacion: campos.frecuenciaFacturacion || null,
    responsableCoordinacion: campos.responsableCoordinacion || null,
    instruccionesCoordinacion: campos.instruccionesCoordinacion || null,
  };

  const condiciones = await prisma.condicionesTransportista.upsert({
    where: { transportistaId },
    create: { transportistaId, ...datosGuardar },
    update: datosGuardar,
  });

  await prisma.transportistaHistorial.create({
    data: {
      instanciaId: auth.sesion.instanciaId,
      entidadTipo: "CONDICIONES",
      entidadId: transportistaId,
      accion: transportista.condiciones ? "editado" : "creado",
      valorAnterior: transportista.condiciones ? (transportista.condiciones as object) : undefined,
      valorNuevo: datosGuardar as object,
      usuarioId: auth.sesion.usuarioId,
      usuarioNombre: auth.sesion.nombre,
    },
  });

  revalidatePath("/sales/transportistas");
  revalidatePath(`/sales/transportistas/${transportistaId}`);
  return { exito: true, data: condiciones };
}
