export interface ConfigEmpresa {
  id: string;
  nombreEmpresa: string | null;
  nombreComercial: string | null;
  razonSocial: string | null;
  ruc: string | null;
  tipoNegocio: string | null;
  industria: string | null;
  correoPrincipal: string | null;
  telefonoPrincipal: string | null;
  whatsappPrincipal: string | null;
  sitioWeb: string | null;
  pais: string | null;
  provincia: string | null;
  ciudad: string | null;
  direccion: string | null;
  zonaHoraria: string;
  monedaPrincipal: string;
  idiomaPrincipal: string;
  formatoFecha: string;
  formatoHora: string;
  activo: boolean;
  // 019-cobertura-geografica-envios
  modoGeografico: "UN_SOLO_PAIS" | "MULTIPAIS";
  paisOperacionId: string | null;
  instanciaId: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

export type ResultadoAccion<T = undefined> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
