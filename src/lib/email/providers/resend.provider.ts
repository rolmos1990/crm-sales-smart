import { Resend } from "resend"
import { EMAIL_CONFIG } from "../config"
import type { IEmailProvider, EnviarEmailParams, EnviarEmailResult } from "../types"

export class ResendProvider implements IEmailProvider {
  readonly nombre = "resend" as const
  private client: Resend

  constructor() {
    if (!EMAIL_CONFIG.resendApiKey) {
      throw new Error("[ResendProvider] RESEND_API_KEY no configurado")
    }
    this.client = new Resend(EMAIL_CONFIG.resendApiKey)
  }

  async enviar(params: EnviarEmailParams): Promise<EnviarEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: params.from ?? EMAIL_CONFIG.from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
    })

    if (error || !data) {
      throw new Error(
        `[ResendProvider] Error enviando email: ${error?.message ?? "sin respuesta"}`
      )
    }

    return { idExterno: data.id }
  }
}
