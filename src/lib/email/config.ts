import type { EmailProveedor } from "./types"

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM ?? "noreply@example.com",
  provider: (process.env.EMAIL_PROVIDER ?? "resend") as EmailProveedor,
  resendApiKey: process.env.RESEND_API_KEY ?? "",
}
