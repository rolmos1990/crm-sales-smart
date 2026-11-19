// 042 — Terminó una evaluación de un contacto (por reglas o con IA).
// No lleva señales, objeciones ni motivos: son texto generado a partir de
// conversaciones y no deben viajar por el bus de eventos.
export interface ContactoAnalizadoPayload {
  instanciaId: string;
  contactoId: string;
  ejecucionId: string;
  origen: "REGLA" | "IA";
  puntaje: number;
  puntajeAnterior: number | null;
  intencion: "ALTA" | "MEDIA" | "BAJA" | "DESCONOCIDA" | null;
  relacionComercial: "PROSPECTO" | "CLIENTE" | "CLIENTE_RECURRENTE" | "CLIENTE_INACTIVO";
  accionSugerida: string;
  /** true si el modo "Aplicar automáticamente" cambió el nivel de interés. */
  interesAplicado: boolean;
}
