"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import type { ResultadoAccion } from "@/crm/contactos/types";
import { invalidarParametrosCola, reintentarFallidos } from "../cola";
import { ConfiguracionAnalisisSchema, InterruptoresAnalisisSchema } from "./schema";

/**
 * 042 — Configuración del análisis por cuenta. Solo administración (`ia` /
 * modificar), validada en el servidor (FR-049). `instanciaId` sale de la
 * sesión; `peso` no se acepta desde acá.
 */

function revalidar() {
  revalidatePath("/configuracion");
  revalidatePath("/crm/contactos");
}

/** Activar/desactivar el análisis con IA y pausar el histórico (FR-030a). */
export async function guardarInterruptoresAnalisisAction(entrada: unknown): Promise<ResultadoAccion> {
  const validado = InterruptoresAnalisisSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId } = auth.sesion;

  try {
    await prisma.configuracionAnalisisContactos.upsert({
      where: { instanciaId },
      create: { instanciaId, ...validado.data },
      update: validado.data,
    });
    revalidar();
    return { exito: true, datos: undefined };
  } catch (err) {
    console.error("[guardarInterruptoresAnalisisAction]", err);
    return { exito: false, error: "No se pudo guardar la configuración" };
  }
}

/**
 * Configuración completa (Historia 6). Cambiar el modo de interés registra
 * quién y cuándo (FR-050a) y NO reescribe intereses existentes: solo cambia
 * qué hacen las evaluaciones siguientes.
 */
export async function guardarConfiguracionAnalisisAction(entrada: unknown): Promise<ResultadoAccion> {
  const validado = ConfiguracionAnalisisSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId, usuarioInstanciaId } = auth.sesion;

  try {
    const actual = await prisma.configuracionAnalisisContactos.findUnique({ where: { instanciaId }, select: { modoInteres: true } });
    const cambioModo = (actual?.modoInteres ?? "SOLO_SUGERIR") !== validado.data.modoInteres;
    const datos = {
      ...validado.data,
      ...(cambioModo ? { modoInteresCambiadoPorId: usuarioInstanciaId, modoInteresCambiadoEn: new Date() } : {}),
    };
    await prisma.configuracionAnalisisContactos.upsert({
      where: { instanciaId },
      create: { instanciaId, ...datos },
      update: datos,
    });
    invalidarParametrosCola(instanciaId);
    revalidar();
    return { exito: true, datos: undefined };
  } catch (err) {
    console.error("[guardarConfiguracionAnalisisAction]", err);
    return { exito: false, error: "No se pudo guardar la configuración" };
  }
}

/** Devuelve a la cola los contactos que agotaron sus reintentos (FR-035). */
export async function reintentarFallidosAction(): Promise<ResultadoAccion<{ reintentados: number }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  try {
    const reintentados = await reintentarFallidos(auth.sesion.instanciaId);
    console.log("[analisis-contactos] Reintento manual de fallidos", {
      instanciaId: auth.sesion.instanciaId,
      usuarioInstanciaId: auth.sesion.usuarioInstanciaId,
      reintentados,
    });
    revalidar();
    return { exito: true, datos: { reintentados } };
  } catch (err) {
    console.error("[reintentarFallidosAction]", err);
    return { exito: false, error: "No se pudieron reintentar los contactos" };
  }
}
