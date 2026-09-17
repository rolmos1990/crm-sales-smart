import type { AgrupacionPreparacion, RangoPreparacion, TipoMovimientoEtapa } from "@/generated/prisma/enums";

export type { AgrupacionPreparacion, RangoPreparacion };

export interface EstadoPreparacion {
  id: string;
  nombre: string;
  color: string | null;
  orden: number;
  esInicial: boolean;
  marcaInicio: boolean;
  esFinal: boolean;
  activo: boolean;
}

/** Estado + cuántos pedidos tiene asignados — la UI lo usa para bloquear el
 *  borrado y exigir estado destino al desactivar (FR-004). */
export interface EstadoPreparacionConUso extends EstadoPreparacion {
  pedidosAsignados: number;
}

export interface EtapaEntrada {
  etapaId: string;
  nombre: string;
  color: string | null;
  activa: boolean;
}

export interface ConfiguracionPreparacion {
  id: string;
  nombre: string;
  agrupacionDefecto: AgrupacionPreparacion;
  rangoDefecto: RangoPreparacion;
  estados: EstadoPreparacionConUso[];
  etapasEntrada: EtapaEntrada[];
  etapasDisponibles: Array<{ id: string; nombre: string; color: string | null }>;
  /** Etapas configuradas como entrada que ya no existen o están inactivas —
   *  el tablero sigue funcionando y lo avisa en la configuración (FR-009). */
  entradasInvalidas: string[];
}

export interface LineaPreparacion {
  id: string;
  descripcion: string;
  producto: { id: string; nombre: string } | null;
  cantidad: number;
  cantidadPreparada: number;
  completa: boolean;
}

export interface TarjetaPreparacion {
  pedidoId: string;
  numero: string;
  /** Contacto del CRM o, si el pedido no tiene contacto, el comprador
   *  registrado en el propio pedido (FR-021). */
  cliente: string;
  fechaPedido: Date;
  fechaEntrega: Date | null;
  etapaVenta: { nombre: string; color: string | null } | null;
  estadoPreparacionId: string;
  iniciadaEn: Date | null;
  completadaEn: Date | null;
  asignadaA: string | null;
  notas: string | null;
  lineas: LineaPreparacion[];
  totalUnidades: number;
  totalProductos: number;
  avanceCompleto: boolean;
  /** Entrega vencida (fechaEntrega anterior a hoy). Se muestra en cualquier
   *  rango: los rangos miran hacia adelante y un pedido atrasado quedaría
   *  invisible justo cuando más urge. */
  atrasado: boolean;
}

export interface ColumnaTablero {
  estado: EstadoPreparacion;
  tarjetas: TarjetaPreparacion[];
}

export interface Tablero {
  columnas: ColumnaTablero[];
  /** Pedidos sin fecha de entrega — visibles en cualquier rango (FR-019). */
  sinFecha: TarjetaPreparacion[];
  contadores: { hoy: number; manana: number; semana: number; atrasados: number };
  configuracion: ConfiguracionPreparacion;
}

export interface ResumenProducto {
  productoId: string | null;
  nombre: string;
  unidadesRequeridas: number;
  unidadesPreparadas: number;
}

export interface MovimientoPreparacion {
  id: string;
  pedidoId: string;
  pedidoNumero: string;
  estadoAnteriorNombre: string | null;
  estadoNombre: string;
  estadoColor: string | null;
  tipo: TipoMovimientoEtapa;
  usuarioNombre: string | null;
  creadoEn: Date;
}

export type MotivoFalloMovimiento = "CONFLICTO" | "ESTADO_INVALIDO" | "NO_ENCONTRADO";

export type ResultadoMovimiento =
  | { ok: true; estadoId: string }
  | { ok: false; motivo: MotivoFalloMovimiento };

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
