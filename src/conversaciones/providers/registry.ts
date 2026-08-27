import type { ICanalProvider } from "./types";
import { WhatsAppLiteProvider } from "./whatsapp-lite";
import { EmailProvider } from "./email";
import { InstagramProvider } from "./instagram";
import { FacebookMessengerProvider } from "./facebook-messenger";

const providers = new Map<string, ICanalProvider>([
  ["whatsapp_lite", new WhatsAppLiteProvider()],
  ["email", new EmailProvider()],
  ["instagram", new InstagramProvider()],
  ["facebook_messenger", new FacebookMessengerProvider()],
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
