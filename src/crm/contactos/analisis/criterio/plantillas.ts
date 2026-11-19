import type { CriterioContenido, PlantillaCriterio } from "./schema";

/**
 * 042 — Plantillas de criterio por rubro (contracts/criterio.md). Viven en
 * código, como las plantillas de estrategia de la 011: una cuenta sin criterio
 * propio usa GENERAL en memoria y no hay nada que sembrar.
 */

const PESOS_GENERAL = {
  compras: 0.3,
  recencia: 0.25,
  documentosAbiertos: 0.2,
  actividadAgendada: 0.1,
  esperaRespuesta: 0.15,
};

export const PLANTILLAS: Record<PlantillaCriterio, { nombre: string; descripcion: string; contenido: CriterioContenido }> = {
  GENERAL: {
    nombre: "General",
    descripcion: "Punto de partida para cualquier negocio.",
    contenido: {
      instrucciones: "",
      senalesCompra: [
        "Consulta el precio de un producto o servicio",
        "Pregunta por disponibilidad o stock",
        "Pregunta por formas de pago o de envío",
        "Menciona una fecha en la que lo necesita",
      ],
      objecionesTipicas: ["Considera que el precio es alto", "Lo está comparando con otra opción"],
      umbrales: { comprasRecurrente: 2, diasInactivo: 90 },
      pesos: PESOS_GENERAL,
    },
  },
  RETAIL: {
    nombre: "Comercio minorista",
    descripcion: "Tiendas con compras frecuentes y ticket bajo o medio.",
    contenido: {
      instrucciones: "",
      senalesCompra: [
        "Pregunta por talle, color o variante",
        "Consulta si hay stock",
        "Pregunta por costo o tiempo de envío",
        "Pide fotos o detalles del producto",
      ],
      objecionesTipicas: ["Costo de envío", "Tiempo de entrega", "Prefiere ver el producto en persona"],
      umbrales: { comprasRecurrente: 3, diasInactivo: 60 },
      pesos: { compras: 0.25, recencia: 0.35, documentosAbiertos: 0.15, actividadAgendada: 0.05, esperaRespuesta: 0.2 },
    },
  },
  SERVICIOS: {
    nombre: "Servicios / citas",
    descripcion: "Negocios que trabajan con turnos, reservas o visitas.",
    contenido: {
      instrucciones: "",
      senalesCompra: [
        "Pide un turno o una cita",
        "Consulta horarios disponibles",
        "Pregunta cuánto dura o qué incluye el servicio",
      ],
      objecionesTipicas: ["No encuentra un horario que le sirva", "Duda sobre el resultado del servicio"],
      umbrales: { comprasRecurrente: 2, diasInactivo: 120 },
      pesos: { compras: 0.25, recencia: 0.2, documentosAbiertos: 0.15, actividadAgendada: 0.25, esperaRespuesta: 0.15 },
    },
  },
  B2B: {
    nombre: "Venta B2B",
    descripcion: "Venta a empresas, con cotizaciones formales y ciclos largos.",
    contenido: {
      instrucciones: "",
      senalesCompra: [
        "Pide una cotización formal",
        "Consulta precios por volumen",
        "Pregunta por condiciones de crédito o facturación",
      ],
      objecionesTipicas: ["Necesita aprobación interna", "No tiene presupuesto asignado todavía"],
      umbrales: { comprasRecurrente: 2, diasInactivo: 180 },
      pesos: { compras: 0.25, recencia: 0.15, documentosAbiertos: 0.35, actividadAgendada: 0.1, esperaRespuesta: 0.15 },
    },
  },
};

export const PLANTILLA_POR_DEFECTO: PlantillaCriterio = "GENERAL";
