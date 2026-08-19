import type {
  TipoMensaje,
  RemitenteMsg,
  EstadoMensaje,
  EstadoConversacion,
  ClasificacionConversacion,
} from "@/generated/prisma/enums";

export type { TipoMensaje, RemitenteMsg, EstadoMensaje, EstadoConversacion, ClasificacionConversacion };

export interface MensajeReaccionResumen {
  id: string;
  emoji: string;
  tipo: "CANAL" | "INTERNA";
  nombreUsuario: string | null;
  usuarioId: string | null;
  contactoId: string | null;
  creadoEn: Date;
}

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
  reacciones?: MensajeReaccionResumen[];
  // Media enriquecida (imágenes procesadas)
  mediaArchivoId: string | null;
  mediaEstado: "LISTO" | "PENDIENTE" | "PROCESANDO" | "ERROR" | null;
  mediaUrlOptimizada: string | null;
  mediaUrlThumbnail: string | null;
  mediaErrorMensaje: string | null;
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
  avatarUrl: string | null;
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
  fechaCierre: Date | null;
  notas: string | null;
  pipelineId: string | null;
  stageId: string | null;
  stage: { esGanado: boolean; esPerdido: boolean; nombre: string; color: string | null } | null;
  tags: { tagId: string; tag: { id: string; nombre: string; color: string | null } }[];
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
  /** @usuario visible del contacto en el canal (ej. Instagram), si el canal lo expone. */
  handleCanal?: string | null;
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
  mediaArchivoId?: string;
  pushName?: string;
  avatarUrl?: string;
  /** @usuario visible del contacto en el canal (ej. Instagram), si el canal lo expone. */
  handleCanal?: string;
}
