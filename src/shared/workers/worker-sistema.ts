import { prisma } from "@/shared/db/prisma";
import { crearPipelineDefault } from "@/shared/inicializacion/pipeline-default";

const TICK_MS = 5_000;
const LOTE = 5;

type JobSistemaRow = {
  id: string;
  tipo: string;
  intentos: number;
  maxIntentos: number;
  instanciaId: string;
  payload: unknown;
};

class WorkerSistema {
  private procesando = false;

  iniciar() {
    const g = globalThis as Record<string, unknown>;
    if (g._workerSistemaActivo) return;
    g._workerSistemaActivo = true;
    console.log("[WorkerSistema] Iniciado");
    setInterval(() => this.tick(), TICK_MS);
  }

  private async tick() {
    if (this.procesando) return;
    this.procesando = true;
    try {
      await this.procesarLote();
    } catch (e) {
      console.error("[WorkerSistema] Error en tick:", e);
    } finally {
      this.procesando = false;
    }
  }

  private async procesarLote() {
    const jobs = await prisma.$transaction(async (tx) => {
      return tx.$queryRaw<JobSistemaRow[]>`
        UPDATE "JobSistema"
        SET estado = 'PROCESANDO'::"EstadoJobSistema", intentos = intentos + 1
        WHERE id IN (
          SELECT id FROM "JobSistema"
          WHERE estado = 'PENDIENTE'::"EstadoJobSistema"
          ORDER BY "creadoEn" ASC
          LIMIT ${LOTE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, tipo, intentos, "maxIntentos", "instanciaId", payload
      `;
    });

    for (const job of jobs) {
      await this.ejecutarJob(job);
    }
  }

  private async ejecutarJob(job: JobSistemaRow) {
    console.log(`[WorkerSistema] ${job.tipo} | instanciaId: ${job.instanciaId}`);
    try {
      if (job.tipo === "INICIALIZAR_INSTANCIA") {
        await crearPipelineDefault(job.instanciaId);
      }
      await prisma.jobSistema.update({
        where: { id: job.id },
        data: { estado: "COMPLETADO", procesadoEn: new Date(), error: null },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const agotado = job.intentos >= job.maxIntentos;
      await prisma.jobSistema.update({
        where: { id: job.id },
        data: { estado: agotado ? "FALLIDO" : "PENDIENTE", error },
      });
      if (agotado) {
        console.error(`[WorkerSistema] Job ${job.id} FALLIDO tras ${job.intentos} intentos:`, error);
      }
    }
  }
}

const g = globalThis as Record<string, unknown>;
export const workerSistema: WorkerSistema =
  (g._workerSistemaInstance as WorkerSistema) ?? new WorkerSistema();
g._workerSistemaInstance = workerSistema;
