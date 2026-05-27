"use server";

import { vincularMediaArchivo as _vincularMediaArchivo } from "./services/media.service";

export async function vincularMediaArchivo(
  mediaId: string,
  entidadId: string,
  entidadTipo: string
): Promise<void> {
  await _vincularMediaArchivo(mediaId, entidadId, entidadTipo);
}
