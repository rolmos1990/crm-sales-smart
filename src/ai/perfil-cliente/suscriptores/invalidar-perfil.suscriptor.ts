import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";

// 012-perfil-dinamico-cliente (Historia 3) — invalida/recalcula el perfil de
// un contacto en reacción a eventos de dominio ya existentes, en vez de en
// cada mensaje (FR-005, FR-006). Corrección respecto a research.md
// Decisión 1 de la spec: los contratos de Pedido/Cotización/Oportunidad NO
// siempre incluyen `contactoId` directamente — este suscriptor lo resuelve
// con un lookup mínimo cuando el payload no lo trae.
export class InvalidarPerfilSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.PERFIL_CLIENTE_INVALIDAR;
  readonly routingKeys = [
    RK.EVENTO_PEDIDO_CREADO,
    RK.EVENTO_PEDIDO_ACTUALIZADO,
    RK.EVENTO_PEDIDO_ENTREGADO,
    RK.EVENTO_COTIZACION_CREADA,
    RK.EVENTO_COTIZACION_ACTUALIZADA,
    RK.EVENTO_COTIZACION_APROBADA,
    RK.EVENTO_OPORTUNIDAD_CREADA,
    RK.EVENTO_OPORTUNIDAD_ACTUALIZADA,
    RK.EVENTO_OPORTUNIDAD_GANADA,
    RK.EVENTO_OPORTUNIDAD_PERDIDA,
    RK.EVENTO_ETAPA_CAMBIADA,
    RK.EVENTO_CONVERSACION_CLASIFICADA,
  ];

  async manejar(envelope: EventoEnvelope): Promise<void> {
    const contactoId = await this.resolverContactoId(envelope);
    if (!contactoId) return; // pedido/cotización/oportunidad sin contacto (ej. venta manual) — nada que invalidar

    const { recalcular } = await import("@/ai/perfil-cliente/servicio");
    await recalcular(contactoId, envelope.instanciaId, envelope.tipo);
  }

  private async resolverContactoId(envelope: EventoEnvelope): Promise<string | null> {
    const payload = envelope.payload as Record<string, unknown>;

    // Ya viene en el payload (evento propio de 012, o los de Oportunidad que sí lo incluyen)
    if (typeof payload.contactoId === "string") return payload.contactoId;

    const { prisma } = await import("@/shared/db/prisma");

    if (payload.pedidoId) {
      const pedido = await prisma.pedido.findUnique({
        where: { id: payload.pedidoId as string },
        select: { contactoId: true },
      });
      return pedido?.contactoId ?? null;
    }

    if (payload.cotizacionId) {
      const cotizacion = await prisma.cotizacion.findUnique({
        where: { id: payload.cotizacionId as string },
        select: { contactoId: true },
      });
      return cotizacion?.contactoId ?? null;
    }

    if (payload.oportunidadId) {
      const relacion = await prisma.oportunidadContacto.findFirst({
        where: { oportunidadId: payload.oportunidadId as string },
        select: { contactoId: true },
      });
      return relacion?.contactoId ?? null;
    }

    return null;
  }
}
