import type {
  TipoMensaje,
  RemitenteMsg,
  EstadoMensaje,
  EstadoConversacion,
  ClasificacionConversacion,
} from "@/generated/prisma/enums";

export type { TipoMensaje, RemitenteMsg, EstadoMensaje, EstadoConversacion, ClasificacionConversacion };

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
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaDuracion: number | null;
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

export interface OportunidadGanadaResumen {
  id: string;
  titulo: string;
  fechaGanada: Date | null;
  etapa: string;
}

export interface OportunidadActivaResumen {
  id: string;
  titulo: string;
  etapa: string;
  valor: number;
  moneda: string;
  stage: { esGanado: boolean; esPerdido: boolean; nombre: string; color: string | null } | null;
}

export interface OportunidadConversacionResumen {
  id: string;
  oportunidadId: string;
  conversacionId: string;
  esActiva: boolean;
  creadoEn: Date;
  oportunidad: OportunidadActivaResumen;
}

export interface ConversacionResumen {
  id: string;
  instanciaId: string | null;
  contactoId: string;
  cuentaCanalId: string | null;
  asunto: string | null;
  estado: EstadoConversacion;
  clasificacion: ClasificacionConversacion;
  oportunidadGanadaRel?: OportunidadGanadaResumen | null;
  creadoEn: Date;
  actualizadoEn: Date;
  contacto: ContactoResumen;
  cuentaCanal: CuentaCanalResumen | null;
  ultimoMensaje?: MensajeConMeta | null;
  oportunidades: OportunidadConversacionResumen[];
  _count?: { mensajes: number };
  identificadorCanal?: string | null;
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
  mediaDuracion?: number;
  mediaNombre?: string;
  mediaBytes?: number;
  pushName?: string;
  avatarUrl?: string;
}
