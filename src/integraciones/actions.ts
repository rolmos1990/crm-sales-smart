"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";

// instanciaId fijo por ahora — cuando se implemente auth multi-tenant,
// se obtiene del contexto de sesión.
const INSTANCIA_ID_DEFAULT = "default";

export async function instalarIntegracion(clave: string, instanciaId = INSTANCIA_ID_DEFAULT) {
  try {
    await prisma.integracionInstancia.upsert({
      where:  { instanciaId_clave: { instanciaId, clave } },
      update: { estado: "INSTALADA" },
      create: { clave, instanciaId, estado: "INSTALADA" },
    });
    revalidatePath("/integraciones");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al instalar la integración" };
  }
}

export async function activarIntegracion(id: string) {
  try {
    await prisma.integracionInstancia.update({
      where: { id },
      data:  { estado: "ACTIVA" },
    });
    revalidatePath("/integraciones");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al activar" };
  }
}

export async function desactivarIntegracion(id: string) {
  try {
    await prisma.integracionInstancia.update({
      where: { id },
      data:  { estado: "INACTIVA" },
    });
    revalidatePath("/integraciones");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al desactivar" };
  }
}

export async function desinstalarIntegracion(id: string) {
  try {
    await prisma.integracionInstancia.delete({ where: { id } });
    revalidatePath("/integraciones");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al desinstalar" };
  }
}

export async function guardarConfiguracionIntegracion(
  id: string,
  configuracion: Record<string, unknown>
) {
  try {
    await prisma.integracionInstancia.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  { configuracion: configuracion as any },
    });
    revalidatePath("/integraciones");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al guardar configuración" };
  }
}
