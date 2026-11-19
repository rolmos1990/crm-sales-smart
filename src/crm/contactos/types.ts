import type { EstadoContacto } from "@/generated/prisma/enums";
import type { EstadoSeguimiento, TipoComercial } from "./segmentacion/condiciones";
import type { Recomendacion, NivelInteresValor } from "./segmentacion/recomendacion";
import type { GrupoCanal } from "./segmentacion/canales";

export type { EstadoContacto };

export interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefonoPrincipal: string | null;
  telefonoSecundario: string | null;
  cargo: string | null;
  notas: string | null;
  estado: EstadoContacto;
  avatarUrl: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  usuarioId: string | null;
}

export interface ContactoConRelaciones extends Contacto {
  _count?: {
    oportunidades: number;
    actividades: number;
  };
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };

// ── 041 — Vista comercial ──────────────────────────────────────────────────

export type { EstadoSeguimiento, TipoComercial, Recomendacion, NivelInteresValor, GrupoCanal };

export interface IndicadoresContactos {
  total: number;
  clientes: number;
  interesados: number;
  porRecuperar: number;
  leads: number;
}

export interface FilaContacto {
  id: string;
  nombre: string;
  apellido: string;
  avatarUrl: string | null;
  /** Teléfono principal o, si no hay, email. */
  datoSecundario: string | null;
  tipo: TipoComercial;
  /** También es true para un Cliente interesado. */
  esInteresado: boolean;
  interes: NivelInteresValor;
  interesFijado: boolean;
  noContactar: boolean;
  /** ISO UTC; se formatea con <FechaHora>. */
  ultimaInteraccionEn: string | null;
  canal: GrupoCanal | null;
  seguimiento: EstadoSeguimiento;
  recomendacion: Recomendacion;
  /** 042 — puntaje comercial 0–100; null si todavía no se analizó. */
  puntaje: number | null;
}

export interface VistaContactos {
  /** Sobre toda la cuenta: no dependen de los filtros de la barra. */
  indicadores: IndicadoresContactos;
  filas: FilaContacto[];
  /** Contactos que cumplen segmento + filtros. */
  total: number;
  pagina: number;
  tamanoPagina: number;
  hayFiltrosActivos: boolean;
}
