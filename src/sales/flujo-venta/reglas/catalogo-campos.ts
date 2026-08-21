import type { PrismaClient } from "@/generated/prisma/client";
import type { CampoRegla, HechosPedido } from "./tipos";

// ── Catálogo de campos evaluables en reglas de validación ──────────────────
//
// Cada entrada describe un campo: su tipo de dato (que determina qué
// operadores puede usar en el constructor de condiciones) y un `resolver`
// que lo lee del objeto de "hechos" armado por resolver-hechos.ts.
//
// Compatibilidad: `total`, `metadata.estadoPago`, `metadata.metodoEnvio`,
// `metadata.tipoPedido` y `metadata.canalOrigen` son las claves que ya usaban
// las reglas creadas antes de este catálogo (ver CAMPOS_EVALUABLES en
// ../types.ts) — se mantienen tal cual, apuntando a los mismos datos, para
// que esas reglas se sigan evaluando exactamente igual.
//
// Extender el catálogo es agregar una entrada a este array — no hace falta
// tocar el evaluador.

const CATEGORIA = {
  GENERAL: "General",
  MONTOS: "Montos",
  PAGO: "Pago",
  PRODUCTOS: "Productos",
  CONTACTO_EMPRESA: "Contacto y empresa",
  FACTURACION: "Facturación",
  ENTREGA: "Entrega",
  RELACIONES: "Relaciones",
} as const;

const leer = (key: string) => (hechos: HechosPedido) => hechos[key];

export const CATALOGO_CAMPOS_BASE: CampoRegla[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    key: "general.etapaActual", label: "Etapa actual del pedido", category: CATEGORIA.GENERAL,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("general.etapaActual"),
  },
  {
    key: "metadata.tipoPedido", label: "Tipo de pedido", category: CATEGORIA.GENERAL,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "CONTIENE", "NO_CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("metadata.tipoPedido"),
  },
  {
    key: "metadata.canalOrigen", label: "Canal de origen", category: CATEGORIA.GENERAL,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "CONTIENE", "NO_CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("metadata.canalOrigen"),
  },
  {
    key: "general.moneda", label: "Moneda", category: CATEGORIA.GENERAL,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("general.moneda"),
  },
  {
    key: "general.fechaCreacion", label: "Fecha de creación", category: CATEGORIA.GENERAL,
    dataType: "FECHA", allowedOperators: ["ANTES_DE", "DESPUES_DE", "IGUAL", "ENTRE_FECHAS", "ES_HOY"],
    resolver: leer("general.fechaCreacion"),
  },
  {
    key: "general.fechaEntrega", label: "Fecha de entrega", category: CATEGORIA.GENERAL,
    dataType: "FECHA", allowedOperators: ["ANTES_DE", "DESPUES_DE", "IGUAL", "ENTRE_FECHAS", "ESTA_VENCIDA", "ES_HOY", "PROXIMOS_N_DIAS"],
    resolver: leer("general.fechaEntrega"),
  },
  {
    key: "general.fechaExpiracion", label: "Fecha de expiración", category: CATEGORIA.GENERAL,
    dataType: "FECHA", allowedOperators: ["ANTES_DE", "DESPUES_DE", "IGUAL", "ESTA_VENCIDA", "ES_HOY", "PROXIMOS_N_DIAS"],
    resolver: leer("general.fechaExpiracion"),
  },
  {
    key: "general.observaciones", label: "Observaciones", category: CATEGORIA.GENERAL,
    dataType: "TEXTO", allowedOperators: ["CONTIENE", "NO_CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("general.observaciones"),
  },

  // ── Montos ───────────────────────────────────────────────────────────────
  {
    key: "montos.subtotal", label: "Subtotal", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.subtotal"),
  },
  {
    key: "montos.descuento", label: "Descuento", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.descuento"),
  },
  {
    key: "montos.porcentajeDescuento", label: "Porcentaje de descuento", category: CATEGORIA.MONTOS,
    dataType: "NUMERO", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.porcentajeDescuento"),
  },
  {
    key: "montos.impuesto", label: "Impuesto", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.impuesto"),
  },
  {
    key: "montos.costoEnvio", label: "Costo de envío", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.costoEnvio"),
  },
  {
    key: "total", label: "Total del pedido", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("total"),
  },
  {
    key: "montos.montoPagado", label: "Monto pagado", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.montoPagado"),
  },
  {
    key: "montos.saldoPendiente", label: "Saldo pendiente", category: CATEGORIA.MONTOS,
    dataType: "MONEDA", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
    resolver: leer("montos.saldoPendiente"),
  },

  // ── Pago (informal, vive en Pedido.metadata — no hay modelo de Pago aún) ──
  {
    key: "metadata.estadoPago", label: "Estado de pago", category: CATEGORIA.PAGO,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("metadata.estadoPago"),
    allowedValues: [
      { valor: "PENDIENTE", etiqueta: "Pendiente" },
      { valor: "PARCIAL", etiqueta: "Parcial" },
      { valor: "PAGADO", etiqueta: "Pagado" },
    ],
  },
  {
    key: "metadata.pago.metodo", label: "Método de pago", category: CATEGORIA.PAGO,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("metadata.pago.metodo"),
  },
  {
    key: "metadata.pago.referencia", label: "Referencia de pago", category: CATEGORIA.PAGO,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("metadata.pago.referencia"),
  },
  {
    key: "metadata.pago.comprobanteUrl", label: "Comprobante", category: CATEGORIA.PAGO,
    dataType: "ARCHIVO", allowedOperators: ["ADJUNTO", "NO_ADJUNTO"],
    resolver: leer("metadata.pago.comprobanteUrl"),
  },
  {
    key: "metadata.pago.fecha", label: "Fecha de pago", category: CATEGORIA.PAGO,
    dataType: "FECHA", allowedOperators: ["ANTES_DE", "DESPUES_DE", "IGUAL", "ES_HOY"],
    resolver: leer("metadata.pago.fecha"),
  },
  {
    key: "metadata.pago.parcial", label: "Pago parcial", category: CATEGORIA.PAGO,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("metadata.pago.parcial"),
  },
  {
    key: "metadata.pago.cantidadPagos", label: "Cantidad de pagos registrados", category: CATEGORIA.PAGO,
    dataType: "NUMERO", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL"],
    resolver: leer("metadata.pago.cantidadPagos"),
  },

  // ── Productos ────────────────────────────────────────────────────────────
  {
    key: "productos.tiene", label: "Tiene productos", category: CATEGORIA.PRODUCTOS,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("productos.tiene"),
  },
  {
    key: "productos.cantidadLineas", label: "Cantidad de productos", category: CATEGORIA.PRODUCTOS,
    dataType: "NUMERO", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL"],
    resolver: leer("productos.cantidadLineas"),
  },
  {
    key: "productos.unidadesTotales", label: "Cantidad total de unidades", category: CATEGORIA.PRODUCTOS,
    dataType: "NUMERO", allowedOperators: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL"],
    resolver: leer("productos.unidadesTotales"),
  },
  {
    key: "productos.ids", label: "Contiene producto", category: CATEGORIA.PRODUCTOS,
    dataType: "COLECCION", allowedOperators: ["CONTIENE_ALGUNO", "CONTIENE_TODOS", "NO_CONTIENE_COLECCION"],
    resolver: leer("productos.ids"),
  },
  {
    key: "productos.categorias", label: "Contiene categoría", category: CATEGORIA.PRODUCTOS,
    dataType: "COLECCION", allowedOperators: ["CONTIENE_ALGUNO", "NO_CONTIENE_COLECCION", "COLECCION_VACIA", "COLECCION_NO_VACIA"],
    resolver: leer("productos.categorias"),
  },
  {
    key: "productos.skus", label: "Contiene SKU", category: CATEGORIA.PRODUCTOS,
    dataType: "COLECCION", allowedOperators: ["CONTIENE_ALGUNO", "NO_CONTIENE_COLECCION"],
    resolver: leer("productos.skus"),
  },
  {
    key: "productos.todosConInventario", label: "Todos tienen inventario", category: CATEGORIA.PRODUCTOS,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("productos.todosConInventario"),
  },

  // ── Contacto y empresa ───────────────────────────────────────────────────
  {
    key: "contacto.asignado", label: "Contacto asignado", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("contacto.asignado"),
  },
  {
    key: "empresa.asignada", label: "Empresa asignada", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("empresa.asignada"),
  },
  {
    key: "contacto.nombre", label: "Nombre del contacto", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("contacto.nombre"),
  },
  {
    key: "contacto.telefono", label: "Teléfono", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO", "CONTIENE"],
    resolver: leer("contacto.telefono"),
  },
  {
    key: "contacto.email", label: "Correo", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO", "CONTIENE"],
    resolver: leer("contacto.email"),
  },
  {
    key: "empresa.razonSocial", label: "Razón social", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO", "CONTIENE"],
    resolver: leer("empresa.razonSocial"),
  },
  {
    key: "contacto.tags", label: "Etiquetas", category: CATEGORIA.CONTACTO_EMPRESA,
    dataType: "COLECCION", allowedOperators: ["CONTIENE_ALGUNO", "NO_CONTIENE_COLECCION", "COLECCION_VACIA", "COLECCION_NO_VACIA"],
    resolver: leer("contacto.tags"),
  },

  // ── Facturación (informal — Pedido no tiene modelo fiscal propio) ────────
  {
    key: "facturacion.documento", label: "Documento fiscal", category: CATEGORIA.FACTURACION,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("facturacion.documento"),
  },
  {
    key: "facturacion.datosCompletos", label: "Datos de facturación completos", category: CATEGORIA.FACTURACION,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("facturacion.datosCompletos"),
  },
  {
    key: "metadata.facturacion.tipoComprobante", label: "Tipo de comprobante", category: CATEGORIA.FACTURACION,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("metadata.facturacion.tipoComprobante"),
  },
  {
    key: "metadata.facturacion.ordenCompra", label: "Orden de compra", category: CATEGORIA.FACTURACION,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO", "IGUAL"],
    resolver: leer("metadata.facturacion.ordenCompra"),
  },

  // ── Entrega ──────────────────────────────────────────────────────────────
  {
    key: "entrega.metodo", label: "Método de entrega", category: CATEGORIA.ENTREGA,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("entrega.metodo"),
  },
  {
    key: "metadata.metodoEnvio", label: "Método de envío (legado)", category: CATEGORIA.ENTREGA,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("metadata.metodoEnvio"),
  },
  {
    key: "entrega.estado", label: "Estado de entrega", category: CATEGORIA.ENTREGA,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("entrega.estado"),
  },
  {
    key: "entrega.transportista", label: "Transportista", category: CATEGORIA.ENTREGA,
    dataType: "TEXTO", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("entrega.transportista"),
  },
  {
    key: "entrega.numeroGuia", label: "Número de guía", category: CATEGORIA.ENTREGA,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("entrega.numeroGuia"),
  },
  {
    key: "entrega.urlSeguimiento", label: "URL de seguimiento", category: CATEGORIA.ENTREGA,
    dataType: "ARCHIVO", allowedOperators: ["ADJUNTO", "NO_ADJUNTO"],
    resolver: leer("entrega.urlSeguimiento"),
  },
  {
    key: "entrega.fechaEstimada", label: "Fecha estimada", category: CATEGORIA.ENTREGA,
    dataType: "FECHA", allowedOperators: ["ANTES_DE", "DESPUES_DE", "IGUAL", "ESTA_VENCIDA", "ES_HOY", "PROXIMOS_N_DIAS"],
    resolver: leer("entrega.fechaEstimada"),
  },
  {
    key: "entrega.direccion", label: "Dirección de entrega", category: CATEGORIA.ENTREGA,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO"],
    resolver: leer("entrega.direccion"),
  },
  {
    key: "entrega.observaciones", label: "Observaciones de entrega", category: CATEGORIA.ENTREGA,
    dataType: "TEXTO", allowedOperators: ["ESTA_VACIO", "NO_ESTA_VACIO", "CONTIENE"],
    resolver: leer("entrega.observaciones"),
  },

  // ── Relaciones ───────────────────────────────────────────────────────────
  {
    key: "relaciones.tieneCotizacion", label: "Tiene cotización", category: CATEGORIA.RELACIONES,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("relaciones.tieneCotizacion"),
  },
  {
    key: "relaciones.estadoCotizacion", label: "Estado de la cotización", category: CATEGORIA.RELACIONES,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("relaciones.estadoCotizacion"),
  },
  {
    key: "relaciones.tieneOportunidad", label: "Tiene oportunidad", category: CATEGORIA.RELACIONES,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("relaciones.tieneOportunidad"),
  },
  {
    key: "relaciones.etapaOportunidad", label: "Estado de la oportunidad", category: CATEGORIA.RELACIONES,
    dataType: "LISTA", allowedOperators: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
    resolver: leer("relaciones.etapaOportunidad"),
  },
  {
    key: "relaciones.vendedorAsignado", label: "Vendedor asignado", category: CATEGORIA.RELACIONES,
    dataType: "BOOLEANO", allowedOperators: ["ES_VERDADERO", "ES_FALSO"],
    resolver: leer("relaciones.vendedorAsignado"),
  },
];

// ── Merge con campos personalizados de Pedido (dinámico por instancia) ────

export async function obtenerCatalogoCampos(db: PrismaClient, instanciaId: string): Promise<CampoRegla[]> {
  const personalizados = await db.campoPersonalizado.findMany({
    where: { instanciaId, entidad: "PEDIDO", activo: true },
    orderBy: { orden: "asc" },
  });

  const camposPersonalizados: CampoRegla[] = personalizados.map((campo) => ({
    key: `custom.${campo.id}`,
    label: campo.nombre,
    category: "Campos personalizados",
    dataType: mapearTipoCampoPersonalizado(campo.tipo),
    allowedOperators: OPERADORES_POR_TIPO[mapearTipoCampoPersonalizado(campo.tipo)],
    resolver: leer(`custom.${campo.id}`),
    isCustomField: true,
    allowedValues: Array.isArray(campo.opciones)
      ? (campo.opciones as Array<{ valor: string; etiqueta: string }>)
      : undefined,
  }));

  return [...CATALOGO_CAMPOS_BASE, ...camposPersonalizados];
}

function mapearTipoCampoPersonalizado(tipo: string): CampoRegla["dataType"] {
  switch (tipo) {
    case "NUMERO":
    case "DECIMAL":
      return "NUMERO";
    case "FECHA":
      return "FECHA";
    case "BOOLEANO":
      return "BOOLEANO";
    case "SELECT":
      return "LISTA";
    case "MULTISELECT":
      return "COLECCION";
    default:
      return "TEXTO";
  }
}

const OPERADORES_POR_TIPO: Record<CampoRegla["dataType"], CampoRegla["allowedOperators"]> = {
  TEXTO: ["IGUAL", "DIFERENTE", "CONTIENE", "NO_CONTIENE", "ESTA_VACIO", "NO_ESTA_VACIO", "EMPIEZA_CON", "TERMINA_CON"],
  NUMERO: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
  MONEDA: ["IGUAL", "DIFERENTE", "MAYOR_QUE", "MAYOR_IGUAL", "MENOR_QUE", "MENOR_IGUAL", "ENTRE"],
  LISTA: ["IGUAL", "DIFERENTE", "ESTA_EN", "NO_ESTA_EN"],
  FECHA: ["ANTES_DE", "DESPUES_DE", "IGUAL", "ENTRE_FECHAS", "ESTA_VENCIDA", "ES_HOY", "PROXIMOS_N_DIAS"],
  BOOLEANO: ["ES_VERDADERO", "ES_FALSO"],
  COLECCION: ["CONTIENE_ALGUNO", "CONTIENE_TODOS", "NO_CONTIENE_COLECCION", "COLECCION_VACIA", "COLECCION_NO_VACIA", "CANTIDAD_IGUAL", "CANTIDAD_MAYOR", "CANTIDAD_MENOR"],
  ARCHIVO: ["ADJUNTO", "NO_ADJUNTO"],
};
