import { prisma } from "@/shared/db/prisma";
import type { PerfilCliente, DatosObjetivos, DatosInterpretados } from "./tipos";
import type { TipoRelacionCliente } from "@/ai/estrategia/tipos";

/** Lee el snapshot vigente de un contacto, scoped a instancia (FR-008). `null` si no existe todavía o no pertenece a la instancia. */
export async function obtenerSnapshotVigente(
  contactoId: string,
  instanciaId: string,
): Promise<PerfilCliente | null> {
  const snapshot = await prisma.perfilClienteSnapshot.findFirst({
    where: { contactoId, instanciaId },
  });
  if (!snapshot) return null;

  return {
    contactoId,
    tipoRelacion: snapshot.tipoRelacion as TipoRelacionCliente,
    datosObjetivos: snapshot.datosObjetivos as unknown as DatosObjetivos,
    datosInterpretados: (snapshot.datosInterpretados as unknown as DatosInterpretados | null) ?? null,
    senalesObjetivas: snapshot.senalesObjetivas as unknown as string[],
    calculadoEn: snapshot.calculadoEn.toISOString(),
    disparadoPor: snapshot.disparadoPor,
  };
}
