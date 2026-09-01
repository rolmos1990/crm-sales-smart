"use server";

import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";

// 019-cobertura-geografica-envios — Pais/EstadoProvincia son catálogo global
// (no scoped por instanciaId, contracts/selector-geografico.md), pero se
// exigen sesión autenticada igual que el resto de queries del proyecto.

export async function listarPaises() {
  await requireSesion();
  return prisma.pais.findMany({
    select: {
      id: true,
      codigo: true,
      codigoAlpha3: true,
      nombre: true,
      banderaEmoji: true,
      indicativoTelefonico: true,
    },
    orderBy: { nombre: "asc" },
  });
}

export async function listarEstadosProvincia(paisId: string) {
  await requireSesion();
  return prisma.estadoProvincia.findMany({
    where: { paisId },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}
