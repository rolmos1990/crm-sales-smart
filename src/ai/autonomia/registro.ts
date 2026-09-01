import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";

export interface DatosRegistroRespuesta {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId: string;
  mensajeCliente: string;
  respuestaPropuesta: string;
  estadoInicial: "ENVIADA_AUTOMATICAMENTE" | "PENDIENTE";
  // Motivo de la decisión del gate — se persiste en ambos caminos (016 solo
  // lo pedía para PENDIENTE; acá se generaliza porque decidirAutonomia
  // siempre devuelve un motivo, sea cual sea la acción).
  motivo: string;
  categoriaDetectada?: CategoriaIntencionAutonomia;
  usoIAId?: string;
  estrategiaUtilizadaId?: string;
  ejemplosUtilizadosIds?: string[];
  herramientasEjecutadas?: string[];
  confianza?: number;
  motivoTransferencia?: string;
  productoIdentificadoId?: string;
}

/**
 * FR-010 — nunca propaga un error: cualquier fallo al persistir la traza se
 * loguea y devuelve `null`, sin interrumpir el envío/generación real de la
 * respuesta que ya ocurrió (o va a ocurrir) en el suscriptor.
 */
export async function ensamblarYPersistirRegistro(datos: DatosRegistroRespuesta): Promise<string | null> {
  try {
    const creado = await prisma.respuestaPendienteRevision.create({
      data: {
        instanciaId: datos.instanciaId,
        agenteIAConfigId: datos.agenteIAConfigId,
        conversacionId: datos.conversacionId,
        mensajeCliente: datos.mensajeCliente,
        respuestaPropuesta: datos.respuestaPropuesta,
        motivoPendiente: datos.motivo,
        estado: datos.estadoInicial,
        categoriaDetectada: datos.categoriaDetectada,
        usoIAId: datos.usoIAId,
        estrategiaUtilizadaId: datos.estrategiaUtilizadaId,
        ejemplosUtilizadosIds: (datos.ejemplosUtilizadosIds ?? undefined) as unknown as Prisma.InputJsonValue,
        herramientasEjecutadas: (datos.herramientasEjecutadas ?? undefined) as unknown as Prisma.InputJsonValue,
        confianza: datos.confianza,
        motivoTransferencia: datos.motivoTransferencia,
        productoIdentificadoId: datos.productoIdentificadoId,
      },
      select: { id: true },
    });
    return creado.id;
  } catch (err) {
    console.error("[Autonomia] Error al persistir el registro de respuesta (no bloquea el envío):", err);
    return null;
  }
}
