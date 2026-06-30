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
}
