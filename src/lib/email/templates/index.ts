import type { TemplatePayload, EmailTemplate } from "./types"
import { renderBienvenida } from "./bienvenida.template"
import { renderNotificacion } from "./notificacion.template"

export function renderTemplate(input: TemplatePayload): EmailTemplate {
  switch (input.tipo) {
    case "BIENVENIDA":
      return renderBienvenida(input.data)
    case "NOTIFICACION":
      return renderNotificacion(input.data)
    default: {
      const _never: never = input
      throw new Error(
        `[renderTemplate] Tipo desconocido: ${(_never as { tipo: string }).tipo}`
      )
    }
  }
}

export type { TemplatePayload, TipoTemplate, EmailTemplate } from "./types"
