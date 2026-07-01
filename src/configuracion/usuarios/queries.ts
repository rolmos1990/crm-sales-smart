import { prisma } from "@/shared/db/prisma";
import type { UsuarioInstanciaDetalle } from "./types";

export async function obtenerUsuariosInstancia(
  instanciaId: string,
): Promise<UsuarioInstanciaDetalle[]> {
  const registros = await prisma.usuarioInstancia.findMany({
    where: { instanciaId },
    include: {
      usuario: {
        select: {
          id: true,
          nombre: true,
          email: true,
          tipo: true,
          cargo: true,
          telefono: true,
          estado: true,
          ultimoLogin: true,
          agenteIAConfig: { select: { id: true, tipo: true } },
        },
      },
    },
    orderBy: { creadoEn: "asc" },
  });

  return registros
    .sort((a, b) => {
      if (a.usuario.tipo !== b.usuario.tipo) return a.usuario.tipo === "USUARIO" ? -1 : 1;
      return a.usuario.nombre.localeCompare(b.usuario.nombre, "es");
    })
    .map((ui) => ({
      id: ui.id,
      usuarioId: ui.usuarioId,
      nombre: ui.usuario.nombre,
      email: ui.usuario.email,
      tipo: ui.usuario.tipo,
      rol: ui.rol,
      cargo: ui.usuario.cargo,
      telefono: ui.usuario.telefono,
      estado: ui.usuario.estado,
      activo: ui.activo,
      ultimoLogin: ui.usuario.ultimoLogin,
      agenteIAConfig: ui.usuario.agenteIAConfig ?? null,
    }));
}
