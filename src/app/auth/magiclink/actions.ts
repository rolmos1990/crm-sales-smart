"use server";

import { prisma } from "@/shared/db/prisma";

export async function activarSesionUsuario(authUserId: string): Promise<{ activado: boolean }> {
  const resultado = await prisma.usuario.updateMany({
    where: { authUserId, estado: "INVITADO" },
    data: { estado: "ACTIVO", ultimoLogin: new Date() },
  });
  return { activado: resultado.count > 0 };
}
