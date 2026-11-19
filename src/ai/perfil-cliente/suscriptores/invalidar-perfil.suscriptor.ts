import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { MotivoMarcado } from "@/crm/contactos/analisis/types";

// 012-perfil-dinamico-cliente (Historia 3) — invalida/recalcula el perfil de
// un contacto en reacción a eventos de dominio ya existentes, en vez de en
// cada mensaje (FR-005, FR-006). Corrección respecto a research.md
// Decisión 1 de la spec: los contratos de Pedido/Cotización/Oportunidad NO
// siempre incluyen `contactoId` directamente — este suscriptor lo resuelve
// con un lookup mínimo cuando el payload no lo trae.
//
// 042 — Además marca el contacto para el análisis inteligente. Los eventos
// del propio contacto (creado/actualizado) solo marcan: no recalculan el
// perfil 012, para no cambiar cuándo se crea su snapshot. Este suscriptor
// NUNCA debe escuchar CONTACTO_ANALIZADO ni CONTACTO_INTERES_ACTUALIZADO:
// cada evaluación provocaría otra (riesgo R3).

const SOLO_MARCAR = new Set(["CONTACTO_CREADO", "CONTACTO_ACTUALIZADO"]);

function motivoDeEvento(tipo: string): MotivoMarcado {
  if (tipo.startsWith("PEDIDO_")) return "PEDIDO";
  if (tipo.startsWith("COTIZACION_")) return "COTIZACION";
  if (tipo.startsWith("OPORTUNIDAD_") || tipo === "ETAPA_CAMBIADA") return "OPORTUNIDAD";
  if (tipo.startsWith("CONTACTO_")) return tipo === "CONTACTO_CREADO" ? "INICIAL" : "CONTACTO";
  return "MENSAJE";
}

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
    // 042
    RK.EVENTO_CONTACTO_CREADO,
    RK.EVENTO_CONTACTO_ACTUALIZADO,
  ];

  async manejar(envelope: EventoEnvelope): Promise<void> {
    const contactoId = await this.resolverContactoId(envelope);
    if (!contactoId) return; // pedido/cotización/oportunidad sin contacto (ej. venta manual) — nada que invalidar

    const { marcarPendienteSinFallar } = await import("@/crm/contactos/analisis/cola");
    const marcar = (prioridad: "P0" | "P1" | "P2", inmediato = false) =>
      marcarPendienteSinFallar({
        instanciaId: envelope.instanciaId,
        contactoId,
        prioridad,
        motivo: motivoDeEvento(envelope.tipo),
        inmediato,
      });

    if (SOLO_MARCAR.has(envelope.tipo)) {
      await marcar(envelope.tipo === "CONTACTO_CREADO" ? "P2" : "P1");
      return;
    }

    if (envelope.tipo === "CONVERSACION_CLASIFICADA") {
      await this.manejarConversacion(envelope, contactoId, marcar);
      return;
    }

    const { recalcular } = await import("@/ai/perfil-cliente/servicio");
    await recalcular(contactoId, envelope.instanciaId, envelope.tipo);
    await marcar("P1");
  }

  /**
   * 042 (FR-022, research D3) — Si el análisis con IA está activo y
   * disponible, él produce la interpretación del contacto: el perfil se
   * recalcula sin IA y el contacto pasa a urgente (P0, sin ventana) para que
   * la interpretación no llegue más tarde que hoy. Si no, la extracción por
   * evento sigue exactamente como antes de la 042.
   */
  private async manejarConversacion(
    envelope: EventoEnvelope,
    contactoId: string,
    marcar: (prioridad: "P0" | "P1" | "P2", inmediato?: boolean) => Promise<void>,
  ): Promise<void> {
    const { recalcular } = await import("@/ai/perfil-cliente/servicio");
    const { analisisIAActivo } = await import("@/crm/contactos/analisis/motor/disponibilidad");
    if (await analisisIAActivo(envelope.instanciaId)) {
      await recalcular(contactoId, envelope.instanciaId);
      await marcar("P0", true);
      return;
    }
    await recalcular(contactoId, envelope.instanciaId, envelope.tipo);
    await marcar("P1");
  }

  private async resolverContactoId(envelope: EventoEnvelope): Promise<string | null> {
    const payload = envelope.payload as Record<string, unknown>;

    // Ya viene en el payload (evento propio de 012, o los de Oportunidad que sí lo incluyen)
    if (typeof payload.contactoId === "string") return payload.contactoId;

    const { prisma } = await import("@/shared/db/prisma");
    // 042 — Siempre acotado a la cuenta del evento (antes era findUnique por id).
    const instanciaId = envelope.instanciaId;

    if (payload.pedidoId) {
      const pedido = await prisma.pedido.findFirst({
        where: { id: payload.pedidoId as string, instanciaId },
        select: { contactoId: true },
      });
      return pedido?.contactoId ?? null;
    }

    if (payload.cotizacionId) {
      const cotizacion = await prisma.cotizacion.findFirst({
        where: { id: payload.cotizacionId as string, instanciaId },
        select: { contactoId: true },
      });
      return cotizacion?.contactoId ?? null;
    }

    if (payload.oportunidadId) {
      const relacion = await prisma.oportunidadContacto.findFirst({
        where: { oportunidadId: payload.oportunidadId as string, oportunidad: { instanciaId } },
        select: { contactoId: true },
      });
      return relacion?.contactoId ?? null;
    }

    return null;
  }
}
