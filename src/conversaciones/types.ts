import type {
  TipoMensaje,
  RemitenteMsg,
  EstadoMensaje,
  EstadoConversacion,
} from "@/generated/prisma/enums";

export type { TipoMensaje, RemitenteMsg, EstadoMensaje, EstadoConversacion };

export interface MensajeConMeta {
  id: string;
  conversacionId: string;
  contenido: string | null;
  tipo: TipoMensaje;
  remitente: RemitenteMsg;
  estado: EstadoMensaje;
  esNotaInterna: boolean;
  idExterno: string | null;
  usuarioId: string | null;
  creadoEn: Date;
  enviadoEn: Date | null;
  leidoEn: Date | null;
}

export interface CuentaCanalResumen {
  id: string;
  canal: string;
  nombre: string;
  identificador: string;
  instanciaId?: string;
}

export interface ContactoResumen {
  id: string;
  nombre: string;
  apellido: string;
  telefonoPrincipal: string | null;
  email: string | null;
}

export interface ConversacionResumen {
  id: string;
  instanciaId: string | null;
  contactoId: string;
  cuentaCanalId: string | null;
  asunto: string | null;
  estado: EstadoConversacion;
  creadoEn: Date;
  actualizadoEn: Date;
  contacto: ContactoResumen;
  cuentaCanal: CuentaCanalResumen | null;
  ultimoMensaje?: MensajeConMeta | null;
  oportunidades: { id: string; oportunidadId: string; conversacionId: string; esActiva: boolean; creadoEn: Date }[];
  _count?: { mensajes: number };
}

export interface MensajeEntranteNormalizado {
  canal: string;
  identificadorContacto: string;
  cuentaCanalId: string;
  contenido?: string;
  tipo: TipoMensaje;
  idExterno?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaNombre?: string;
  mediaBytes?: number;
}
