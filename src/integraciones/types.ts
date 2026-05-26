export type EstadoIntegracion = "INSTALADA" | "ACTIVA" | "INACTIVA" | "ERROR";

export type CategoriaIntegracion =
  | "mensajeria"
  | "marketing"
  | "crm"
  | "pagos"
  | "productividad"
  | "analytics";

export interface IntegracionCatalogo {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaIntegracion;
  logoUrl?: string;
  logoEmoji: string;
  disponible: boolean;
  proximamente?: boolean;
  badges?: string[];
}

export interface IntegracionInstada {
  id: string;
  clave: string;
  estado: EstadoIntegracion;
  configuracion: Record<string, unknown> | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface IntegracionConEstado extends IntegracionCatalogo {
  instalada: IntegracionInstada | null;
}
