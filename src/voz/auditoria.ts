import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";

/**
 * 049 — Auditoría de uso y costo de voz. Único punto de escritura de `UsoVoz`.
 *
 * Se escribe una fila POR INTENTO, con éxito o sin él. Un fallo después de que
 * el proveedor ya procesó el audio igual se cobra, así que omitirlo dejaría el
 * gasto real por debajo de lo facturado.
 */

/**
 * Costo por tiempo de audio, no por tokens — esa es la razón de que voz tenga
 * su propia tabla y no reutilice `UsoIA`.
 *
 * Sin tarifa configurada devuelve `null` y no se estima nada: un costo
 * inventado contamina todos los agregados, que es justo lo que el comercio
 * mira para decidir si le conviene la feature.
 */
export function calcularCostoVoz(
  segundos: number,
  costoPorHora: Prisma.Decimal | number | null,
): Prisma.Decimal | null {
  if (costoPorHora === null || costoPorHora === undefined) return null;
  const tarifa = new Prisma.Decimal(costoPorHora.toString());
  return tarifa.mul(segundos).div(3600);
}

export async function registrarUsoVoz(p: {
  instanciaId: string;
  proveedorVozId: string | null;
  modelo: string;
  segundos: number;
  costoPorHora: Prisma.Decimal | number | null;
  tiempoMs: number;
  exito: boolean;
  /** Código funcional (ver CodigoErrorVoz). Nunca el stack ni la credencial. */
  error?: string | null;
  mediaArchivoId: string;
}): Promise<void> {
  try {
    await prisma.usoVoz.create({
      data: {
        instanciaId: p.instanciaId,
        proveedorVozId: p.proveedorVozId,
        modelo: p.modelo,
        segundos: p.segundos,
        costoEstimado: calcularCostoVoz(p.segundos, p.costoPorHora),
        tiempoMs: p.tiempoMs,
        exito: p.exito,
        error: p.error ?? null,
        entidadTipo: "MediaArchivo",
        entidadId: p.mediaArchivoId,
      },
    });
  } catch (e) {
    // La auditoría no puede tumbar la transcripción que ya se hizo y ya se
    // pagó: el texto vale más que su fila de registro.
    console.error("[voz] No se pudo registrar el uso:", e);
  }
}
