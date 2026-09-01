import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CondicionesEstrategia } from "./selector";

// 011-playbook-estrategia-comercial — las 7 plantillas precargadas del
// pedido original. Sembradas inactivas: el negocio decide cuáles usar
// (FR-001, research.md Decisión 5).
const PLANTILLAS: Array<{ nombre: string; descripcion: string; reglas: string[]; condiciones: CondicionesEstrategia }> = [
  {
    nombre: "Venta consultiva suave",
    descripcion: "Comprender antes de recomendar, sin presionar el cierre.",
    reglas: [
      "Comprender antes de recomendar",
      "Responder primero lo que el cliente preguntó",
      "Hacer solamente las preguntas necesarias",
      "Recomendar máximo tres opciones",
      "Explicar brevemente por qué cada opción puede servir",
      "Evitar intentar cerrar demasiado pronto",
    ],
    condiciones: { tiposRelacion: [], intenciones: [] },
  },
  {
    nombre: "Cliente nuevo",
    descripcion: "Generar confianza sin asumir conocimiento previo.",
    reglas: [
      "Generar confianza",
      "No asumir conocimiento previo",
      "Explicar productos de manera sencilla",
      "Hacer una pregunta breve para entender la necesidad",
      "No solicitar demasiada información al inicio",
    ],
    condiciones: { tiposRelacion: ["NUEVO_CONTACTO", "CLIENTE_NUEVO"], intenciones: [] },
  },
  {
    nombre: "Cliente regular",
    descripcion: "Usar el historial sin fingir familiaridad excesiva.",
    reglas: [
      "Utilizar el historial cuando sea relevante",
      "No volver a preguntar datos conocidos",
      "Reconocer compras o preferencias anteriores naturalmente",
      "Ofrecer repetir una configuración previa cuando tenga sentido",
      "No fingir familiaridad excesiva",
    ],
    condiciones: { tiposRelacion: ["CLIENTE_REGULAR"], intenciones: [] },
  },
  {
    nombre: "Cliente explorando",
    descripcion: "Orientar sin presión, sin insistir con el cierre.",
    reglas: [
      "Orientar sin presión",
      "Mostrar pocas alternativas",
      "No insistir con el cierre",
      "Dejar una acción sencilla para continuar",
    ],
    condiciones: { tiposRelacion: [], intenciones: ["EXPLORANDO"] },
  },
  {
    nombre: "Cliente con intención alta",
    descripcion: "Eliminar pasos innecesarios y avanzar hacia la cotización o el pedido.",
    reglas: [
      "Eliminar pasos innecesarios",
      "Confirmar producto, variante, cantidad y entrega",
      "Consultar disponibilidad y precio actual",
      "Preparar cotización o pedido cuando corresponda",
    ],
    condiciones: { tiposRelacion: [], intenciones: ["LISTO_PARA_COTIZAR", "LISTO_PARA_COMPRAR"] },
  },
  {
    nombre: "Cliente inactivo",
    descripcion: "Retomar desde el último interés conocido, sin reclamar el silencio.",
    reglas: [
      "Retomar desde el último interés conocido",
      "Confirmar si la necesidad sigue vigente",
      "Informar únicamente cambios relevantes",
      "No reclamar que dejó de responder",
    ],
    condiciones: { tiposRelacion: ["CLIENTE_INACTIVO"], intenciones: [] },
  },
  {
    nombre: "Recomendación basada en ocasión",
    descripcion: "Identificar la ocasión y recomendar pocas opciones relevantes.",
    reglas: [
      "Identificar la ocasión",
      "Identificar presupuesto solamente si es necesario",
      "Recomendar pocas opciones",
      "Explicar la relación entre producto y ocasión",
    ],
    condiciones: { tiposRelacion: [], intenciones: ["SOLICITANDO_RECOMENDACION"] },
  },
];

/** Siembra las 7 plantillas para una instancia si todavía no tiene ninguna — idempotente (mismo patrón que crearPipelineDefault). */
export async function asegurarPlantillasSembradas(instanciaId: string): Promise<void> {
  const existente = await prisma.playbookEstrategia.findFirst({
    where: { instanciaId, origen: "PLANTILLA" },
    select: { id: true },
  });
  if (existente) return;

  await prisma.playbookEstrategia.createMany({
    data: PLANTILLAS.map((p) => ({
      instanciaId,
      nombre: p.nombre,
      descripcion: p.descripcion,
      origen: "PLANTILLA" as const,
      activo: false,
      contenido: { reglas: p.reglas } as unknown as Prisma.InputJsonValue,
      condiciones: p.condiciones as unknown as Prisma.InputJsonValue,
      prioridad: 0,
    })),
  });
}
