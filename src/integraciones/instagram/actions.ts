"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";

export async function desconectarCuentaInstagram(id: string): Promise<{ exito: boolean; error?: string }> {
  try {
    const sesion = await requireSesion();
    if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
      return { exito: false, error: "No tienes permisos para realizar esta acción" };
    }

    // Filtrar por instanciaId además del id — evita que un usuario
    // desconecte una cuenta de otra organización aunque adivine su id.
    const { count } = await prisma.cuentaCanal.updateMany({
      where: { id, instanciaId: sesion.instanciaId, canal: "instagram" },
      data: { activa: false },
    });
    if (count === 0) return { exito: false, error: "Cuenta no encontrada" };

    revalidatePath("/integraciones/instagram");
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al desconectar la cuenta" };
  }
}

export async function eliminarCuentaInstagram(id: string): Promise<{ exito: boolean; error?: string }> {
  try {
    const sesion = await requireSesion();
    if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
      return { exito: false, error: "No tienes permisos para realizar esta acción" };
    }

    const { count } = await prisma.cuentaCanal.deleteMany({
      where: { id, instanciaId: sesion.instanciaId, canal: "instagram" },
    });
    if (count === 0) return { exito: false, error: "Cuenta no encontrada" };

    revalidatePath("/integraciones/instagram");
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al eliminar la cuenta" };
  }
}
