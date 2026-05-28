import { prisma } from "@/shared/db/prisma";
import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";
import { obtenerProvider } from "@/conversaciones/providers/registry";

const TICK_MS = 2_000;
const LOTE = 5;

class WorkerMensajes {
  private procesando = false;

  iniciar() {
    const g = globalThis as Record<string, unknown>;
    if (g._workerMensajesActivo) return;
    g._workerMensajesActivo = true;
    console.log("[WorkerMensajes] Iniciado");
    setInterval(() => this.tick(), TICK_MS);
  }

  private async tick() {
    if (this.procesando) return;
    this.procesando = true;
    try {
      await this.procesarLote();
    } catch (e) {
      console.error("[WorkerMensajes] Error en tick:", e);
    } finally {
      this.procesando = false;
    }
  }

  private async procesarLote() {
    // Claim: leer PENDIENTE y marcar como PROCESANDO
    const pendientes = await prisma.jobMensaje.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { creadoEn: "asc" },
      take: LOTE,
    });
    if (pendientes.length === 0) return;
    await prisma.jobMensaje.updateMany({
      where: { id: { in: pendientes.map((j) => j.id) } },
      data: { estado: "PROCESANDO", intentos: { increment: 1 } },
    });
    const jobs = pendientes;

    for (const job of jobs) {
      await this.ejecutarJob(job);
    }
  }

  private async ejecutarJob(job: {
    id: string; tipo: string; intentos: number; maxIntentos: number; instanciaId: string; payload: unknown;
  }) {
    try {
      if (job.tipo === "ENVIAR_MENSAJE") {
        await this.procesarEnvio(job.instanciaId, job.payload as Record<string, unknown>);
      } else if (job.tipo === "PROCESAR_ENTRANTE") {
        await this.procesarEntrante(job.payload as Record<string, unknown>);
      }
      await prisma.jobMensaje.update({
        where: { id: job.id },
        data: { estado: "COMPLETADO", procesadoEn: new Date(), error: null },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const agotado = job.intentos >= job.maxIntentos;
      await prisma.jobMensaje.update({
        where: { id: job.id },
        data: { estado: agotado ? "FALLIDO" : "PENDIENTE", error },
      });
      if (agotado) console.error(`[WorkerMensajes] Job ${job.id} FALLIDO:`, error);
    }
  }

  private async procesarEnvio(instanciaId: string, p: Record<string, unknown>) {
    const mensajeId   = p.mensajeId   as string;
    const conversacionId = p.conversacionId as string;
    const cuentaCanalId  = p.cuentaCanalId  as string;
    const contenido   = p.contenido   as string | undefined;
    const tipo        = p.tipo        as string;
    const destinatario = p.destinatario as string;

    const cuentaCanal = await prisma.cuentaCanal.findUniqueOrThrow({ where: { id: cuentaCanalId } });
    const provider = obtenerProvider(cuentaCanal.canal);

    if (provider) {
      const result = await provider.enviarMensaje({
        destinatario,
        contenido: contenido ?? "",
        tipo: tipo as Parameters<typeof provider.enviarMensaje>[0]["tipo"],
        configuracion: cuentaCanal.configuracion as Record<string, unknown>,
      });
      // Actualizar mensaje con ID externo del canal y marcar entregado
      await prisma.mensajeConversacion.update({
        where: { id: mensajeId },
        data: { estado: "ENTREGADO", idExterno: result.idExterno, enviadoEn: new Date() },
      });
    }

    // Notificar SSE para que otros agentes conectados vean el mensaje
    busEventos.publicar(TIPOS_EVENTO.MENSAJE_ENVIADO, {
      mensajeId,
      conversacionId,
      instanciaId,
    });
  }

  private async procesarEntrante(p: Record<string, unknown>) {
    // Reutilizamos la acción existente (no es circular: las server actions son funciones normales en imports server-side)
    const { procesarMensajeEntrante } = await import("@/conversaciones/actions");
    await procesarMensajeEntrante({
      canal: p.canal as string,
      identificadorContacto: p.identificadorContacto as string,
      cuentaCanalId: p.cuentaCanalId as string,
      instanciaId: p.instanciaId as string,
      contenido: p.contenido as string | undefined,
      tipo: (p.tipo ?? "TEXTO") as Parameters<typeof procesarMensajeEntrante>[0]["tipo"],
      idExterno: p.idExterno as string | undefined,
    });
  }
}

const g = globalThis as Record<string, unknown>;
export const workerMensajes: WorkerMensajes =
  (g._workerMensajesInstance as WorkerMensajes) ?? new WorkerMensajes();
g._workerMensajesInstance = workerMensajes;
