"use server";

import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { agruparCoberturaPorProvincia, type CoberturaProvincia } from "@/shared/entregas/cobertura-provincia";

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

/**
 * Por cada provincia del país, qué lugares concretos tiene cubiertos según las
 * zonas de entrega cargadas (de cualquier transportista), incluidos sus alias.
 *
 * Sirve para que el selector de provincia encuentre "Boquete" o "Changuinola"
 * —que son distritos, no provincias— y ofrezca Chiriquí o Bocas del Toro. Sin
 * esto hay que saber de antemano a qué provincia pertenece cada lugar, que es
 * justo lo que uno no recuerda al cotizar.
 *
 * No se filtra por transportista a propósito: al elegir la provincia todavía
 * no se sabe cuál va a repartir — las opciones de envío se resuelven después.
 */
export async function listarCoberturaPorProvincia(paisId: string): Promise<CoberturaProvincia[]> {
  const sesion = await requireSesion();

  const [ubicaciones, estados] = await Promise.all([
    prisma.zonaEntregaUbicacion.findMany({
      where: { paisId, zonaEntrega: { instanciaId: sesion.instanciaId, activa: true } },
      select: {
        provinciaEstado: true,
        distritoCiudad: true,
        corregimiento: true,
        sectorOCodigoPostal: true,
        aliases: { select: { valor: true } },
      },
    }),
    prisma.estadoProvincia.findMany({ where: { paisId }, select: { id: true, nombre: true } }),
  ]);

  return agruparCoberturaPorProvincia(ubicaciones, estados);
}
