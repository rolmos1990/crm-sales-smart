// Marca de posición de lectura de un buzón (research.md R3).
//
// Dos garantías:
//   1. Al activar un buzón, la marca se ancla al UID más alto que ya existe en
//      la casilla, para que el historial previo no entre al CRM (FR-023).
//   2. La marca avanza SOLO después de encolar los correos del ciclo. Si el
//      proceso muere a mitad de camino, el peor caso es releer —y de eso se
//      ocupa la deduplicación por Message-ID (FR-019)—, nunca saltear.
import { prisma } from "@/shared/db/prisma";
import type { CodigoErrorCorreo } from "../errores";

export interface MarcaLectura {
  uidValidity: bigint | null;
  ultimoUid: bigint | null;
}

export async function obtenerMarca(cuentaCanalId: string): Promise<MarcaLectura | null> {
  const estado = await prisma.buzonCorreoEstado.findUnique({
    where: { cuentaCanalId },
    select: { uidValidity: true, ultimoUid: true },
  });
  return estado ?? null;
}

/** Crea la fila de estado del buzón, sin anclar todavía. */
export async function crearEstadoBuzon(cuentaCanalId: string, instanciaId: string): Promise<void> {
  await prisma.buzonCorreoEstado.upsert({
    where: { cuentaCanalId },
    create: { cuentaCanalId, instanciaId },
    update: {},
  });
}

/** Ancla la marca a una posición concreta de la casilla (activación o re-anclaje). */
export async function anclarMarca(
  cuentaCanalId: string,
  instanciaId: string,
  posicion: { uidValidity: bigint; ultimoUid: bigint },
): Promise<void> {
  await prisma.buzonCorreoEstado.upsert({
    where: { cuentaCanalId },
    create: {
      cuentaCanalId,
      instanciaId,
      uidValidity: posicion.uidValidity,
      ultimoUid: posicion.ultimoUid,
    },
    update: { uidValidity: posicion.uidValidity, ultimoUid: posicion.ultimoUid },
  });
}

/**
 * Decide desde qué UID leer.
 *
 * Si `uidValidity` cambió, el servidor renumeró la casilla y los UID viejos ya
 * no significan nada: se re-ancla a la posición actual en vez de reimportar
 * todo el buzón, que es lo que pasaría si se empezara de cero.
 */
export function resolverPuntoDePartida(
  marca: MarcaLectura | null,
  uidValidityActual: bigint,
): { desdeUid: bigint | null; reanclar: boolean } {
  if (!marca || marca.ultimoUid === null || marca.uidValidity === null) {
    return { desdeUid: null, reanclar: true };
  }
  if (marca.uidValidity !== uidValidityActual) {
    return { desdeUid: null, reanclar: true };
  }
  return { desdeUid: marca.ultimoUid, reanclar: false };
}

/** Avanza la marca y registra el ciclo exitoso. Se llama DESPUÉS de encolar. */
export async function registrarLecturaOk(
  cuentaCanalId: string,
  datos: { uidValidity: bigint; ultimoUid: bigint; correos: number },
): Promise<void> {
  const ahora = new Date();
  await prisma.buzonCorreoEstado.update({
    where: { cuentaCanalId },
    data: {
      uidValidity: datos.uidValidity,
      ultimoUid: datos.ultimoUid,
      ultimaLecturaEn: ahora,
      ultimaLecturaOkEn: ahora,
      correosLeidos: { increment: datos.correos },
      errorCodigo: null,
      errorMensaje: null,
      errorDesde: null,
      fallosSeguidos: 0,
    },
  });
}

/** Registra un ciclo fallido sin tocar la marca: lo no leído se reintenta. */
export async function registrarLecturaFallida(
  cuentaCanalId: string,
  error: { codigo: CodigoErrorCorreo; mensaje: string },
): Promise<void> {
  const ahora = new Date();
  const previo = await prisma.buzonCorreoEstado.findUnique({
    where: { cuentaCanalId },
    select: { errorDesde: true },
  });

  await prisma.buzonCorreoEstado.update({
    where: { cuentaCanalId },
    data: {
      ultimaLecturaEn: ahora,
      errorCodigo: error.codigo,
      errorMensaje: error.mensaje,
      errorDesde: previo?.errorDesde ?? ahora,
      fallosSeguidos: { increment: 1 },
    },
  });
}
