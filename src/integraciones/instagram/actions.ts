"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";

export async function desconectarCuentaInstagram(id: string): Promise<{ exito: boolean; error?: string }> {
  try {
    await prisma.cuentaCanal.update({ where: { id }, data: { activa: false } });
    revalidatePath("/integraciones/instagram");
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al desconectar la cuenta" };
  }
}

export async function eliminarCuentaInstagram(id: string): Promise<{ exito: boolean; error?: string }> {
  try {
    await prisma.cuentaCanal.delete({ where: { id } });
    revalidatePath("/integraciones/instagram");
    return { exito: true };
  } catch {
    return { exito: false, error: "Error al eliminar la cuenta" };
  }
}
