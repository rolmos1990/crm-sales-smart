"use server";

import { obtenerSesionActual } from "./sesion";
import { verificarAcceso } from "./permisos";
import type { Modulo } from "./permisos";
import type { SesionActual } from "./sesion";

export async function requirePermisoAction(
  modulo: Modulo,
  tipo: "ver" | "modificar",
): Promise<{ ok: true; sesion: SesionActual } | { ok: false; error: string }> {
  const sesion = await obtenerSesionActual();
  if (!sesion) return { ok: false, error: "No autenticado" };
  const acceso = verificarAcceso(sesion, modulo, tipo);
  if (!acceso.permitido) return { ok: false, error: acceso.error ?? "Sin permiso" };
  return { ok: true, sesion };
}
