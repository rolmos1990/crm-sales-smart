// 041 — El contacto pasó a "No contactar" o volvió a "Contactable".
export interface ContactoPreferenciaContactoActualizadaPayload {
  instanciaId: string;
  contactoId: string;
  /** Estado nuevo. */
  noContactar: boolean;
  origen: "MANUAL" | "IA";
  usuarioInstanciaId: string | null;
}
