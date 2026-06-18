export { encolarEmail } from "./encolar-email"
export type { EncolarEmailOpciones } from "./encolar-email"
export { getEmailProvider, resetEmailProvider } from "./providers/factory"
export { renderTemplate } from "./templates/index"
export type {
  IEmailProvider,
  EnviarEmailParams,
  EnviarEmailResult,
  EmailProveedor,
} from "./types"
export type {
  TemplatePayload,
  TipoTemplate,
  EmailTemplate,
} from "./templates/types"
