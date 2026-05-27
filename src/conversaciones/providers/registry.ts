import type { ICanalProvider } from "./types";
import { WhatsAppLiteProvider } from "./whatsapp-lite";
import { EmailProvider } from "./email";

const providers = new Map<string, ICanalProvider>([
  ["whatsapp_lite", new WhatsAppLiteProvider()],
  ["email", new EmailProvider()],
]);

export function obtenerProvider(canal: string): ICanalProvider | undefined {
  return providers.get(canal);
}

export function registrarProvider(provider: ICanalProvider): void {
  providers.set(provider.canal, provider);
}

export function obtenerCapacidadesCanal(canal: string) {
  return providers.get(canal)?.capacidades ?? null;
}
