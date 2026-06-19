export interface ComandoMarcarLeidoPayload extends Record<string, unknown> {
  instanciaId: string;
  mensajeIds: string[];
  conversacionId: string;
}
