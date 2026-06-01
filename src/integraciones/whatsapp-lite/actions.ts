"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";

export async function crearCuentaWALite(input: {
  instanciaId: string;
  nombre: string;
  telefono: string;
}) {
  const cuenta = await prisma.cuentaCanal.create({
    data: {
      instanciaId: input.instanciaId,
      canal: "whatsapp_lite",
      nombre: input.nombre,
      identificador: input.telefono,
      configuracion: {},
      activa: true,
    },
  });
  revalidatePath("/integraciones/whatsapp-lite");
  return cuenta;
}

export async function actualizarNombreCuenta(id: string, nombre: string) {
  await prisma.cuentaCanal.update({ where: { id }, data: { nombre } });
  revalidatePath("/integraciones/whatsapp-lite");
}

export async function desactivarCuenta(id: string) {
  await prisma.cuentaCanal.update({ where: { id }, data: { activa: false } });
  revalidatePath("/integraciones/whatsapp-lite");
}

export async function activarCuenta(id: string) {
  await prisma.cuentaCanal.update({ where: { id }, data: { activa: true } });
  revalidatePath("/integraciones/whatsapp-lite");
}

export async function eliminarCuenta(id: string) {
  await prisma.cuentaCanal.delete({ where: { id } });
  revalidatePath("/integraciones/whatsapp-lite");
}

export async function configurarPipelineCuenta(id: string, pipelineId: string | null) {
  await prisma.cuentaCanal.update({ where: { id }, data: { pipelineId, stageId: null } });
  revalidatePath("/integraciones/whatsapp-lite");
}

export async function configurarStageCuenta(id: string, stageId: string | null) {
  await prisma.cuentaCanal.update({ where: { id }, data: { stageId } });
  revalidatePath("/integraciones/whatsapp-lite");
}

export async function configurarEtapaCuenta(id: string, pipelineId: string, stageId: string) {
  await prisma.cuentaCanal.update({ where: { id }, data: { pipelineId, stageId } });
  revalidatePath("/integraciones/whatsapp-lite");
}
