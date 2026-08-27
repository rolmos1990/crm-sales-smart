"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";

// Mismo patrón que integraciones/instagram/actions.ts — desconexión suave
// (activa: false, FR-009) y eliminación dura, ambas scoped por instanciaId
// para evitar que un usuario autenticado toque una cuenta de otra
// organización aunque adivine su id.

export async function desconectarCuentaFacebookMessenger(id: string): Promise<{ exito: boolean; error?: string }> {
  try {
    const sesion = await requireSesion();
    if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
      return { exito: false, error: "No tienes permisos para realizar esta acción" };
    }

    const { count } = await prisma.cuentaCanal.updateMany({
      where: { id, instanciaId: sesion.instanciaId, canal: "facebook_messenger" },
      data: { activa: false },
    });
    if (count === 0) return { exito: false, error: "Cuenta no encontrada" };

    revalidatePath("/integraciones/facebook-messenger");
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al desconectar la cuenta" };
  }
}

export async function eliminarCuentaFacebookMessenger(id: string): Promise<{ exito: boolean; error?: string }> {
  try {
    const sesion = await requireSesion();
    if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
      return { exito: false, error: "No tienes permisos para realizar esta acción" };
    }

    const { count } = await prisma.cuentaCanal.deleteMany({
      where: { id, instanciaId: sesion.instanciaId, canal: "facebook_messenger" },
    });
    if (count === 0) return { exito: false, error: "Cuenta no encontrada" };

    revalidatePath("/integraciones/facebook-messenger");
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al eliminar la cuenta" };
  }
}
