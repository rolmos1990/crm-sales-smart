import type { ContextoTool } from "@/ai/tools/types";

// 019-cobertura-geografica-envios — efecto secundario extraído de
// transfer.tool.ts para que las tools de envío (calcular_costo_envio,
// validar_cobertura, estimar_fecha_entrega) puedan forzar la escalación a
// humano ellas mismas cuando no hay coincidencia clara de costo/cobertura,
// sin depender de que el LLM decida invocar transferir_a_humano por su
// cuenta (research.md Decisión 4 — Principio IV de la constitución).
export async function transferirAHumanoInterno(ctx: ContextoTool, motivo: string): Promise<void> {
  // 018-simulador-agente — en simulación no se toca Prisma ni se publica el
  // evento (FR-006/FR-007).
  if (ctx.modoSimulacion) return;

  const { prisma } = await import("@/shared/db/prisma");

  await prisma.conversacion.updateMany({
    where: { id: ctx.conversacionId, instanciaId: ctx.instanciaId },
    data: { clasificacion: "SOPORTE", clasificadoEn: new Date() },
  });

  // 012-perfil-dinamico-cliente — un fallo al publicar no debe impedir la
  // transferencia misma.
  try {
    const { publicadorEventos } = await import("@/shared/rabbitmq");
    const { EventosSistema } = await import("@/eventos/catalogo");
    await publicadorEventos.publicar(EventosSistema.ConversacionClasificada, ctx.instanciaId, {
      instanciaId: ctx.instanciaId,
      conversacionId: ctx.conversacionId,
      contactoId: ctx.contactoId ?? null,
      clasificacion: "SOPORTE",
      clasificadoEn: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[transferirAHumanoInterno] Error al publicar ConversacionClasificada (motivo: ${motivo}):`, err);
  }
}
