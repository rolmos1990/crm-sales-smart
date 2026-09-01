import type { TipoRelacionCliente, IntencionComercial } from "@/ai/estrategia/tipos";

export interface DatosObjetivos {
  numeroPedidosCompletados: number;
  fechaPrimeraInteraccion: string; // ISO date
  fechaUltimaCompra: string | null;
  productosComprados: Array<{ productoId: string; nombre: string }>;
  oportunidadesAbiertas: Array<{ id: string; titulo: string; etapa: string }>;
  cotizacionesActivas: Array<{ id: string; numero: string; estado: string }>;
  incidenciasActivas: number;
  metodoEntregaHabitual: string | null;
}

export interface DatosInterpretados {
  intencionComercialActual: IntencionComercial | null;
  productosConsultados: string[];
  preferenciasIdentificadas: string[];
  presupuestoConocido: string | null;
  ocasionActual: string | null;
  fechaRequerida: string | null;
  confianza: number;
  extraidoEn: string; // ISO datetime
}

export interface PerfilCliente {
  contactoId: string;
  tipoRelacion: TipoRelacionCliente;
  datosObjetivos: DatosObjetivos;
  datosInterpretados: DatosInterpretados | null;
  senalesObjetivas: string[];
  calculadoEn: string; // ISO datetime
  disparadoPor: string | null;
}

export type { TipoRelacionCliente, IntencionComercial };
