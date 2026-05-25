"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearCotizacionSchema } from "./schema";
import { generarNumeroCotizacion } from "./queries";
import type { ResultadoAccion, Cotizacion } from "./types";

export async function crearCotizacion(datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = CrearCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { lineas, contactoId, empresaId, notas, impuesto, ...resto } = validado.data;
    const numero = await generarNumeroCotizacion();

    const subtotal = lineas.reduce((acc, l) => {
      const base = l.cantidad * l.precioUnitario;
      return acc + base * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const total = subtotal + impuestoMonto;

    const cotizacion = await prisma.cotizacion.create({
      data: {
        ...resto,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        notas: notas || null,
        contactoId: contactoId || null,
        empresaId: empresaId || null,
        lineas: {
          create: lineas.map(l => ({
            productoId: l.productoId || null,
            descripcion: l.descripcion || null,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            descuento: l.descuento,
            subtotal: l.cantidad * l.precioUnitario * (1 - l.descuento / 100),
          })),
        },
      },
      include: { contacto: { select: { id: true, nombre: true, apellido: true } }, empresa: { select: { id: true, nombre: true } } },
    });

    busEventos.publicar(TIPOS_EVENTO.COTIZACION_CREADA, { cotizacionId: cotizacion.id, numero: cotizacion.numero, total });
    revalidatePath("/sales/cotizaciones");
    return { exito: true, datos: { ...cotizacion, subtotal, total, impuesto: impuestoMonto } as unknown as Cotizacion };
  } catch {
    return { exito: false, error: "Error al crear la cotización" };
  }
}

export async function cambiarEstadoCotizacion(id: string, estado: string): Promise<ResultadoAccion> {
  try {
    await prisma.cotizacion.update({
      where: { id },
      data: { estado: estado as "BORRADOR" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "VENCIDA" },
    });

    if (estado === "ENVIADA") {
      busEventos.publicar(TIPOS_EVENTO.COTIZACION_ENVIADA, { cotizacionId: id, numero: "" });
    }

    revalidatePath("/sales/cotizaciones");
    revalidatePath(`/sales/cotizaciones/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al cambiar el estado" };
  }
}

export async function eliminarCotizacion(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.cotizacion.delete({ where: { id } });
    revalidatePath("/sales/cotizaciones");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la cotización" };
  }
}
