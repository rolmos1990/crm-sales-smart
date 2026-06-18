import { prisma } from "@/shared/db/prisma"
import { getEmailProvider } from "@/lib/email/providers/factory"
import { renderTemplate } from "@/lib/email/templates/index"
import type { TemplatePayload } from "@/lib/email/templates/types"

const TICK_MS = 5_000
const LOTE = 5

type JobEmailRow = {
  id: string
  tipo: string
  intentos: number
  maxIntentos: number
  instanciaId: string | null
  payload: unknown
}

class WorkerEmail {
  private procesando = false

  iniciar() {
    const g = globalThis as Record<string, unknown>
    if (g._workerEmailActivo) return
    g._workerEmailActivo = true
    console.log("[WorkerEmail] Iniciado")
    setInterval(() => this.tick(), TICK_MS)
  }

  private async tick() {
    if (this.procesando) return
    this.procesando = true
    try {
      await this.procesarLote()
    } catch (e) {
      console.error("[WorkerEmail] Error en tick:", e)
    } finally {
      this.procesando = false
    }
  }

  private async procesarLote() {
    const jobs = await prisma.$transaction(async (tx) => {
      return tx.$queryRaw<JobEmailRow[]>`
        UPDATE "JobEmail"
        SET estado = 'PROCESANDO'::"EstadoJobEmail", intentos = intentos + 1
        WHERE id IN (
          SELECT id FROM "JobEmail"
          WHERE estado = 'PENDIENTE'::"EstadoJobEmail"
          ORDER BY "creadoEn" ASC
          LIMIT ${LOTE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, tipo, intentos, "maxIntentos", "instanciaId", payload
      `
    })

    for (const job of jobs) {
      await this.ejecutarJob(job)
    }
  }

  private async ejecutarJob(job: JobEmailRow) {
    const sufijo = job.instanciaId ? ` | instanciaId: ${job.instanciaId}` : ""
    console.log(`[WorkerEmail] ${job.tipo}${sufijo}`)
    try {
      const p = job.payload as { destinatario: string[]; data: unknown }
      const templateInput: TemplatePayload = {
        tipo: job.tipo as TemplatePayload["tipo"],
        data: p.data as never,
      }
      const rendered = renderTemplate(templateInput)
      const provider = getEmailProvider()
      const result = await provider.enviar({
        to: p.destinatario,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
      console.log(`[WorkerEmail] Enviado OK → idExterno: ${result.idExterno}`)
      await prisma.jobEmail.update({
        where: { id: job.id },
        data: { estado: "COMPLETADO", procesadoEn: new Date(), error: null },
      })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      const agotado = job.intentos >= job.maxIntentos
      await prisma.jobEmail.update({
        where: { id: job.id },
        data: { estado: agotado ? "FALLIDO" : "PENDIENTE", error },
      })
      if (agotado) {
        console.error(
          `[WorkerEmail] Job ${job.id} FALLIDO tras ${job.intentos} intentos:`,
          error
        )
      }
    }
  }
}

const g = globalThis as Record<string, unknown>
export const workerEmail: WorkerEmail =
  (g._workerEmailInstance as WorkerEmail) ?? new WorkerEmail()
g._workerEmailInstance = workerEmail
