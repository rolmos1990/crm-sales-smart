// Fuente única de las etiquetas de MetodoEntrega — reusado por el formulario
// de entrega, el timeline de historial, los filtros del listado de pedidos y
// el bloque "Entrega y seguimiento" del formulario de cotizaciones.
export const METODO_ENTREGA_LABELS: Record<string, string> = {
  COURIER_EXTERNO: "Courier externo",
  MENSAJERO_PROPIO: "Mensajero propio",
  RETIRO_TIENDA: "Retiro en tienda",
  DIGITAL: "Entrega digital",
  INSTALACION_SERVICIO: "Instalación / Servicio",
};

export const ESTADO_ENTREGA_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PREPARANDO: "Preparando",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  FALLIDO: "Fallido",
  CANCELADO: "Cancelado",
  DEVUELTO: "Devuelto",
};

// Métodos de entrega para los que NO tiene sentido pedir número de guía / URL
// de seguimiento / transportista (no hay envío físico rastreable).
export const METODOS_SIN_RASTREO = new Set(["RETIRO_TIENDA", "DIGITAL"]);
