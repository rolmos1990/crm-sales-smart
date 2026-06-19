export interface EventoDominio<TDatos extends Record<string, unknown> = Record<string, unknown>> {
  idEvento: string;
  nombreEvento: string;
  version: number;
  fechaOcurrencia: Date;
  instanciaId: string;
  datos: TDatos;
}
