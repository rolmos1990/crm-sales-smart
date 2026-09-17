// 026-preparacion-pedidos — se publica al entrar al estado final.
// `avanceCompleto` viaja en el payload porque un suscriptor no puede derivarlo
// sin consultar todas las líneas, y porque marcar ítems no es requisito para
// cerrar la preparación.
export interface PreparacionCompletadaPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  estadoId: string;
  estadoNombre: string;
  iniciadaEn: string | null;
  completadaEn: string;
  asignadaAId: string | null;
  avanceCompleto: boolean;
}
