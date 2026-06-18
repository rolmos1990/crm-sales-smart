export type EmailProveedor = "resend" | "sendgrid" | "smtp" | "console"

export interface EnviarEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface EnviarEmailResult {
  idExterno: string
}

export interface IEmailProvider {
  readonly nombre: EmailProveedor
  enviar(params: EnviarEmailParams): Promise<EnviarEmailResult>
}
