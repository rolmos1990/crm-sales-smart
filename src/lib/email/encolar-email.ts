import { publicadorEventos } from "@/shared/rabbitmq"
import { TIPOS_COMANDO } from "@/shared/eventos/registro"
import type { TemplatePayload } from "./templates/types"

export interface EncolarEmailOpciones {
  destinatario: string | string[]
  instanciaId?: string
}

export async function encolarEmail(
  template: TemplatePayload,
  opts: EncolarEmailOpciones
): Promise<void> {
  const destinatarios = Array.isArray(opts.destinatario)
    ? opts.destinatario
    : [opts.destinatario]

  await publicadorEventos.publicar(TIPOS_COMANDO.ENVIAR_EMAIL, opts.instanciaId ?? "", {
    instanciaId: opts.instanciaId ?? "",
    tipo: template.tipo,
    destinatario: destinatarios,
    data: template.data,
  })
}
