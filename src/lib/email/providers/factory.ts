import { EMAIL_CONFIG } from "../config"
import type { IEmailProvider } from "../types"
import { ResendProvider } from "./resend.provider"

let _instance: IEmailProvider | null = null

export function getEmailProvider(): IEmailProvider {
  if (_instance) return _instance

  switch (EMAIL_CONFIG.provider) {
    case "resend":
      _instance = new ResendProvider()
      break
    default:
      throw new Error(
        `[getEmailProvider] Proveedor "${EMAIL_CONFIG.provider}" no soportado`
      )
  }

  return _instance
}

export function resetEmailProvider(): void {
  _instance = null
}
