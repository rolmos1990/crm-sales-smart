export interface ComandoEnviarEmailPayload extends Record<string, unknown> {
  instanciaId: string;
  tipo: string;
  destinatario: string[];
  data: unknown;
}
