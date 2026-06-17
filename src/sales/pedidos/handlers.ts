import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";
import type { PedidoCreadoPayload, PedidoActualizadoPayload } from "@/shared/eventos/registro";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

const g = globalThis as unknown as { handlersPedidosRegistrados?: boolean };

export function registrarHandlersPedidos() {
  if (g.handlersPedidosRegistrados) return;
  g.handlersPedidosRegistrados = true;

  busEventos.suscribir<PedidoCreadoPayload>(TIPOS_EVENTO.PEDIDO_CREADO, async (evento) => {
    try {
      const { pedidoId, numero, total, usuarioId, usuarioNombre } = evento.payload;
      await prisma.pedidoHistorial.create({
        data: {
          pedidoId,
          accion: "PEDIDO_CREADO",
          usuarioId: usuarioId ?? null,
          usuarioNombre: usuarioNombre ?? null,
          valorNuevo: { numero, total } as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      console.error("[Historial] Error al registrar PEDIDO_CREADO:", e);
    }
  });

  busEventos.suscribir<PedidoActualizadoPayload>(TIPOS_EVENTO.PEDIDO_ACTUALIZADO, async (evento) => {
    try {
      const { pedidoId, usuarioId, usuarioNombre, cambios } = evento.payload;
      if (!cambios.length) return;
      await prisma.pedidoHistorial.createMany({
        data: cambios.map((c) => ({
          pedidoId,
          accion: c.accion,
          usuarioId: usuarioId ?? null,
          usuarioNombre: usuarioNombre ?? null,
          ...(c.valorAnterior !== undefined && { valorAnterior: c.valorAnterior as Prisma.InputJsonValue }),
          ...(c.valorNuevo !== undefined && { valorNuevo: c.valorNuevo as Prisma.InputJsonValue }),
        })),
      });
    } catch (e) {
      console.error("[Historial] Error al registrar PEDIDO_ACTUALIZADO:", e);
    }
  });
}
