import { prisma } from "@/shared/db/prisma"
import type { TemplatePayload } from "./templates/types"

export interface EncolarEmailOpciones {
  destinatario: string | string[]
  instanciaId?: string
  maxIntentos?: number
}

export async function encolarEmail(
  template: TemplatePayload,
  opts: EncolarEmailOpciones
): Promise<void> {
  const destinatarios = Array.isArray(opts.destinatario)
    ? opts.destinatario
    : [opts.destinatario]

  await prisma.jobEmail.create({
    data: {
      tipo: template.tipo,
      ...(opts.instanciaId ? { instanciaId: opts.instanciaId } : {}),
      maxIntentos: opts.maxIntentos ?? 3,
      payload: {
        destinatario: destinatarios,
        data: template.data,
      },
    },
  })
}
