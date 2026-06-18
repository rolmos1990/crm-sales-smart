export interface EventoEnvelope<P = Record<string, unknown>> {
  eventId: string;
  instanciaId: string;
  tipo: string;
  ocurridoEn: string;
  version: number;
  payload: P;
}
