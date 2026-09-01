export interface MensajeContexto {
  rol: "user" | "assistant";
  contenido: string;
  creadoEn: Date;
}

export interface ContextoConversacion {
  id: string;
  contactoNombre?: string;
  canal?: string;
  mensajes: MensajeContexto[];
  resumenPrevio?: string;
}

export interface ContextoContacto {
  id: string;
  nombre: string;
  email?: string | null;
  empresa?: string | null;
  etiquetas?: string[];
}

export interface ContextoOportunidad {
  id: string;
  titulo: string;
  etapa: string;
  valor?: number | null;
}

export interface ContextoIA {
  conversacion?: ContextoConversacion;
  contacto?: ContextoContacto;
  oportunidad?: ContextoOportunidad;
  sistemaPrompt?: string;

  // 013-context-builder-capas-precedencia — metadata opcional (debug/UI),
  // no cambia el shape para quien ya consume ContextoIA sin leerlos.
  estrategiaSeleccionada?: { id: string; nombre: string } | null;
  perfilClienteUsado?: boolean;
  // 017-aprendizaje-supervisado-auditoria — ids de EjemploPrompt (014)
  // usados en esta generación, para el registro de trazabilidad.
  ejemplosUtilizadosIds?: string[];
}
