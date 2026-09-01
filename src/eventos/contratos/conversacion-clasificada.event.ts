// 012-perfil-dinamico-cliente — emitido cuando Conversacion.clasificacion
// cambia (hoy solo desde transfer.tool.ts). Permite invalidar el perfil del
// cliente (incidencia activa) sin sondeo.
export interface ConversacionClasificadaPayload {
  instanciaId: string;
  conversacionId: string;
  contactoId: string | null;
  clasificacion: "NINGUNA" | "POSTVENTA" | "SOPORTE" | "COMERCIAL";
  clasificadoEn: string;
}
