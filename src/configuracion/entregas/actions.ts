"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import {
  MetodoEntregaConfigSchema,
  ZonaCoberturaSchema,
  ZonaCoberturaMetodoSchema,
  UbicacionRetiroSchema,
} from "./schema";

type Resultado<T extends object = object> = ({ exito: true } & T) | { exito: false; error: string };

export async function guardarMetodoEntregaConfig(datos: unknown): Promise<Resultado<{ id: string }>> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = MetodoEntregaConfigSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const guardado = await prisma.metodoEntregaConfig.upsert({
    where: { instanciaId_metodoEntrega: { instanciaId: sesion.instanciaId, metodoEntrega: validado.data.metodoEntrega } },
    create: { instanciaId: sesion.instanciaId, ...validado.data },
    update: validado.data,
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, id: guardado.id };
}

export async function guardarZonaCobertura(datos: unknown): Promise<Resultado<{ id: string }>> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = ZonaCoberturaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const creada = await prisma.zonaCobertura.create({
    data: { instanciaId: sesion.instanciaId, ...validado.data },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, id: creada.id };
}

export async function guardarZonaCoberturaMetodo(datos: unknown): Promise<Resultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = ZonaCoberturaMetodoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const [zona, metodo] = await Promise.all([
    prisma.zonaCobertura.findFirst({ where: { id: validado.data.zonaCoberturaId, instanciaId: sesion.instanciaId } }),
    prisma.metodoEntregaConfig.findFirst({ where: { id: validado.data.metodoEntregaConfigId, instanciaId: sesion.instanciaId } }),
  ]);
  if (!zona || !metodo) return { exito: false, error: "Zona o método no encontrados en esta instancia" };

  await prisma.zonaCoberturaMetodo.upsert({
    where: {
      zonaCoberturaId_metodoEntregaConfigId: {
        zonaCoberturaId: validado.data.zonaCoberturaId,
        metodoEntregaConfigId: validado.data.metodoEntregaConfigId,
      },
    },
    create: validado.data,
    update: {
      cubierta: validado.data.cubierta,
      costoAdicional: validado.data.costoAdicional,
      diasAdicionales: validado.data.diasAdicionales,
      // 019-cobertura-geografica-envios
      esExcepcion: validado.data.esExcepcion,
    },
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function guardarUbicacionRetiro(datos: unknown): Promise<Resultado<{ id: string }>> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = UbicacionRetiroSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const creada = await prisma.ubicacionRetiro.create({
    data: { instanciaId: sesion.instanciaId, ...validado.data },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, id: creada.id };
}
