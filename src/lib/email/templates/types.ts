export interface EmailTemplate {
  subject: string
  html: string
  text?: string
}

export interface PayloadBienvenida {
  nombreUsuario: string
  email: string
  urlLogin: string
}

export interface PayloadNotificacion {
  titulo: string
  cuerpo: string
  urlAccion?: string
  textoAccion?: string
}

export type TemplatePayload =
  | { tipo: "BIENVENIDA"; data: PayloadBienvenida }
  | { tipo: "NOTIFICACION"; data: PayloadNotificacion }

export type TipoTemplate = TemplatePayload["tipo"]
