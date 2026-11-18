// 041 — Cambió el nivel de interés vigente de un contacto (manual, regla o IA).
export interface ContactoInteresActualizadoPayload {
  instanciaId: string;
  contactoId: string;
  nivelAnterior: "ALTO" | "MEDIO" | "BAJO" | "SIN_EVALUAR";
  nivelNuevo: "ALTO" | "MEDIO" | "BAJO" | "SIN_EVALUAR";
  /** true si el valor quedó fijado a mano (ningún proceso automático lo pisa). */
  fijado: boolean;
  origen: "MANUAL" | "REGLA" | "IA";
  usuarioInstanciaId: string | null;
}
