import type {
  TipoMensaje,
  RemitenteMsg,
  EstadoMensaje,
  EstadoConversacion,
  ClasificacionConversacion,
  ModoAtencionConversacion,
} from "@/generated/prisma/enums";

export type {
  TipoMensaje,
  RemitenteMsg,
  EstadoMensaje,
  EstadoConversacion,
  ClasificacionConversacion,
  ModoAtencionConversacion,
};

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
  // Info funcional del fallo cuando estado = FALLIDO — ver EnvioMensajeError.
  // codigoError es el slug estable (ej. "HUMAN_AGENT_NO_APROBADO"); motivoError
  // es el texto pensado para mostrarle al usuario, no el crudo de Meta.
  codigoError?: string | null;
  motivoError?: string | null;
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

/** 035 — Una identidad del contacto en un canal: la dirección, el número o el
 *  id externo por el que esa persona está registrada ahí. Ya venía en el
 *  `select` del Inbox (contactoSelect.identificadoresCanal) y se descartaba al
 *  mapear; mostrarla no cuesta una consulta nueva. */
export interface IdentidadCanalResumen {
  canal: string;
  identificador: string;
  /** @usuario visible, si el canal lo expone (ej. Instagram). */
  handle: string | null;
}

export interface ContactoResumen {
  id: string;
  nombre: string;
  apellido: string;
  telefonoPrincipal: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** 035 — Todas las identidades de canal registradas del contacto. */
  identificadoresCanal: IdentidadCanalResumen[];
}

/** Última oportunidad FINALIZADA del contacto (ganada o perdida) — el nombre
 *  quedó del campo original `oportunidadGanadaRelId`, pero desde que el
 *  flujo de clasificación del Inbox trata ambos cierres igual, también
 *  puede apuntar a una perdida (ver stage.esPerdido / fechaPerdida). */
export interface OportunidadGanadaResumen {
  id: string;
  titulo: string;
  fechaGanada: Date | null;
  fechaPerdida: Date | null;
  etapa: string;
  stage: { esGanado: boolean; esPerdido: boolean } | null;
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
  modoAtencion?: ModoAtencionConversacion;
  atencionMotivo?: string | null;
  /** Borradores de la IA esperando aprobación humana. Con modoAtencion
   *  alimenta el filtro "Atención humana" del Inbox. */
  pendientesIA?: number;
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
  /** 034 — Solo correo: el remitente todavía no fue aprobado, así que nadie
   *  —ni humano, ni IA, ni Workflow— puede responder esta conversación. */
  bloqueadaPorAprobacion?: boolean;
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
  /** 034 — Solo correo: asunto del mensaje. Alimenta Conversacion.asunto, de
   *  donde sale el "Re: …" de la respuesta. Los canales de mensajería no lo
   *  traen y queda undefined. */
  asunto?: string;
  /** 034 — Solo correo: raíz del hilo (Message-ID normalizado), para la
   *  agrupación por hilo. */
  hiloExterno?: string;
}

// ── 035-inbox-agrupado-contacto ──────────────────────────────────────────────
// Modelo derivado del Inbox: se arma en memoria a partir de las conversaciones
// ya cargadas y no se persiste en ningún lado. Vive acá, junto al resto de los
// tipos del módulo, para que `agrupacion.ts` (puro) y los componentes compartan
// una sola definición.

/** Una persona con las conversaciones suyas que pasan el filtro activo. */
export interface GrupoContacto {
  contactoId: string;
  contacto: ContactoResumen;
  /** Solo las conversaciones VISIBLES bajo el filtro/búsqueda, ya ordenadas. */
  conversaciones: ConversacionResumen[];
  /** La más prioritaria: define el orden del grupo y lo que muestra colapsado. */
  lider: ConversacionResumen;
  /** Cantidad de conversaciones visibles — no el total del contacto. */
  totalConversaciones: number;
  /** Canales distintos entre las conversaciones visibles. */
  totalCanales: number;
  /** Conversaciones visibles con mensajes del contacto sin leer. */
  noLeidos: number;
  requiereAtencionHumana: boolean;
  /** true cuando hay una sola conversación: se pinta como fila simple. */
  esSimple: boolean;
}

/** Lo que el chat abierto debe avisar sobre otro canal del mismo contacto. */
export interface AvisoOtroCanal {
  /** La OTRA conversación, a la que lleva el salto. */
  conversacionId: string;
  canal: string;
  nombreCanal: string;
  /** Mensaje que motiva el aviso — es la clave con la que se descarta. */
  mensajeId: string;
  fecha: Date;
}

/** Identidad del contacto más la conversación cargada que le corresponde. */
export interface IdentidadConAcceso extends IdentidadCanalResumen {
  conversacionId: string | null;
  ultimaActividad: Date | null;
}
