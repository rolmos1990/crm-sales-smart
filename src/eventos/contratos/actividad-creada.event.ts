export interface ActividadCreadaPayload {
  instanciaId: string;
  actividadId: string;
  tipo: string;
  fecha: Date;
  entidadId?: string;
  entidadTipo?: string;
}
