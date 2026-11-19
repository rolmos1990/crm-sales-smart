"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { actualizarInteres, actualizarPreferenciaContacto } from "@/crm/contactos/clasificacion";
import type { ResultadoAccion } from "@/crm/contactos/types";
import { marcarPendiente } from "./cola";
import { AnalizarContactoSchema, AnalizarSeleccionadosSchema, ResolverSugerenciaSchema } from "./schema";
import { FiltrosVistaContactosSchema } from "@/crm/contactos/schema";
import { construirWhereVista } from "@/crm/contactos/vista";
import { obtenerUmbralesSeguimiento } from "@/crm/contactos/queries";
import { calcularCortes } from "@/crm/contactos/segmentacion/cortes";
import { obtenerEtapasFlujoActivo } from "@/sales/flujo-venta/queries";

/**
 * 042 — Acciones del análisis desde el panel lateral (contracts/server-actions.md).
 * `instanciaId` sale SIEMPRE de la sesión; nunca de la entrada.
 */

async function iaDisponibleParaCuenta(instanciaId: string): Promise<boolean> {
  const [configIA, config, proveedores] = await Promise.all([
    prisma.configuracionIA.findUnique({ where: { instanciaId }, select: { habilitado: true } }),
    prisma.configuracionAnalisisContactos.findUnique({ where: { instanciaId }, select: { habilitado: true } }),
    prisma.proveedorIA.count({ where: { instanciaId, activo: true } }),
  ]);
  return Boolean(configIA?.habilitado) && config?.habilitado !== false && proveedores > 0;
}

function revalidar(contactoId: string) {
  revalidatePath("/crm/contactos");
  revalidatePath(`/crm/contactos/${contactoId}`);
}

/** "Analizar con IA": el contacto pasa a urgente (P0) y salta la ventana de agrupación (FR-051). */
export async function analizarContactoAction(entrada: unknown): Promise<ResultadoAccion<{ encolado: true }>> {
  const validado = AnalizarContactoSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const auth = await requirePermisoAction("contactos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId } = auth.sesion;

  try {
    const contacto = await prisma.contacto.findFirst({ where: { id: validado.data.contactoId, instanciaId }, select: { id: true } });
    if (!contacto) return { exito: false, error: "Contacto no encontrado" };
    if (!(await iaDisponibleParaCuenta(instanciaId))) {
      return { exito: false, error: "El análisis con IA no está disponible para esta cuenta" };
    }
    await marcarPendiente({
      instanciaId,
      contactoId: contacto.id,
      prioridad: "P0",
      motivo: "MANUAL",
      inmediato: true,
      forzarIA: true,
    });
    return { exito: true, datos: { encolado: true } };
  } catch (err) {
    console.error("[analizarContactoAction]", err);
    return { exito: false, error: "No se pudo iniciar el análisis" };
  }
}

/**
 * Acepta o descarta el interés sugerido por la IA (FR-016, modo "Solo
 * sugerir"). Aceptar lo escribe con origen MANUAL por el punto único de la
 * 041. La resolución es condicional a PENDIENTE: un doble clic o dos personas
 * a la vez no aplican dos veces.
 */
export async function resolverSugerenciaInteresAction(entrada: unknown): Promise<ResultadoAccion> {
  const validado = ResolverSugerenciaSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const auth = await requirePermisoAction("contactos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId, usuarioInstanciaId } = auth.sesion;
  const { contactoId, decision } = validado.data;

  try {
    const ev = await prisma.contactoEvaluacion.findFirst({
      where: { contactoId, instanciaId, interesSugeridoEstado: "PENDIENTE" },
      select: { interesSugerido: true },
    });
    if (!ev?.interesSugerido || ev.interesSugerido === "SIN_EVALUAR") {
      return { exito: false, error: "La sugerencia ya no está disponible" };
    }
    const tomada = await prisma.contactoEvaluacion.updateMany({
      where: { contactoId, instanciaId, interesSugeridoEstado: "PENDIENTE" },
      data: {
        interesSugeridoEstado: decision === "ACEPTAR" ? "ACEPTADA" : "DESCARTADA",
        sugerenciaResueltaPorId: usuarioInstanciaId,
        sugerenciaResueltaEn: new Date(),
      },
    });
    if (tomada.count === 0) return { exito: false, error: "La sugerencia ya no está disponible" };

    if (decision === "ACEPTAR") {
      const r = await actualizarInteres({
        instanciaId,
        contactoId,
        accion: { tipo: "FIJAR", nivel: ev.interesSugerido },
        origen: "MANUAL",
        usuarioInstanciaId,
      });
      if (!r.ok) return { exito: false, error: r.error };
    }
    revalidar(contactoId);
    return { exito: true, datos: undefined };
  } catch (err) {
    console.error("[resolverSugerenciaInteresAction]", err);
    return { exito: false, error: "No se pudo resolver la sugerencia" };
  }
}

/**
 * Acepta o descarta la sugerencia de "No contactar" (FR-016a). La IA nunca
 * lo escribe: solo una persona, con origen MANUAL.
 */
export async function resolverSugerenciaNoContactarAction(entrada: unknown): Promise<ResultadoAccion> {
  const validado = ResolverSugerenciaSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const auth = await requirePermisoAction("contactos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId, usuarioInstanciaId } = auth.sesion;
  const { contactoId, decision } = validado.data;

  try {
    const ahora = new Date();
    const tomada = await prisma.contactoEvaluacion.updateMany({
      where: { contactoId, instanciaId, noContactarSugerido: true, noContactarSugeridoEstado: "PENDIENTE" },
      data: {
        noContactarSugeridoEstado: decision === "ACEPTAR" ? "ACEPTADA" : "DESCARTADA",
        noContactarResueltoEn: ahora,
        sugerenciaResueltaPorId: usuarioInstanciaId,
        sugerenciaResueltaEn: ahora,
      },
    });
    if (tomada.count === 0) return { exito: false, error: "La sugerencia ya no está disponible" };

    if (decision === "ACEPTAR") {
      const r = await actualizarPreferenciaContacto({
        instanciaId,
        contactoId,
        noContactar: true,
        origen: "MANUAL",
        usuarioInstanciaId,
      });
      if (!r.ok) return { exito: false, error: r.error };
      revalidatePath("/crm/inbox");
    }
    revalidar(contactoId);
    return { exito: true, datos: undefined };
  } catch (err) {
    console.error("[resolverSugerenciaNoContactarAction]", err);
    return { exito: false, error: "No se pudo resolver la sugerencia" };
  }
}

/**
 * 042 (Historia 7) — "Analizar seleccionados": hasta 100 contactos, P1 y
 * forzando IA (es un pedido explícito, aunque no hayan cambiado). Los ids que
 * no son de la cuenta se ignoran en silencio: `marcarPendiente` filtra por
 * instancia en el mismo INSERT.
 */
export async function analizarSeleccionadosAction(entrada: unknown): Promise<ResultadoAccion<{ encolados: number }>> {
  const validado = AnalizarSeleccionadosSchema.safeParse(entrada);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  const auth = await requirePermisoAction("contactos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId } = auth.sesion;

  try {
    const propios = await prisma.contacto.findMany({
      where: { id: { in: [...new Set(validado.data.contactoIds)] }, instanciaId },
      select: { id: true },
    });
    for (const c of propios) {
      await marcarPendiente({ instanciaId, contactoId: c.id, prioridad: "P1", motivo: "SELECCION", inmediato: true, forzarIA: true });
    }
    return { exito: true, datos: { encolados: propios.length } };
  } catch (err) {
    console.error("[analizarSeleccionadosAction]", err);
    return { exito: false, error: "No se pudo iniciar el análisis" };
  }
}

/**
 * Analizar todos los contactos del segmento y filtros actuales de la lista.
 * Solo administración (`ia` / modificar). Se encola como histórico (P2):
 * nunca desplaza a lo urgente ni a lo incremental. Usa la MISMA condición que
 * la lista (`construirWhereVista`), así se analiza exactamente lo que se ve.
 */
export async function analizarSegmentoAction(entrada: unknown): Promise<ResultadoAccion<{ encolados: number }>> {
  const validado = FiltrosVistaContactosSchema.safeParse((entrada as { filtros?: unknown } | null)?.filtros ?? {});
  if (!validado.success) return { exito: false, error: "Filtros inválidos" };
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const { instanciaId, zonaNegocio } = auth.sesion;

  try {
    const [etapas, umbrales] = await Promise.all([obtenerEtapasFlujoActivo(instanciaId), obtenerUmbralesSeguimiento(instanciaId)]);
    const where = construirWhereVista(instanciaId, zonaNegocio, validado.data, etapas, calcularCortes(zonaNegocio, umbrales));
    let cursor: string | undefined;
    let encolados = 0;
    for (;;) {
      const pagina = await prisma.contacto.findMany({
        where,
        select: { id: true },
        orderBy: { id: "asc" },
        take: LOTE_SEGMENTO,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const c of pagina) {
        await marcarPendiente({ instanciaId, contactoId: c.id, prioridad: "P2", motivo: "SEGMENTO", tipo: "REEVALUACION", forzarIA: true });
      }
      encolados += pagina.length;
      if (pagina.length < LOTE_SEGMENTO) break;
      cursor = pagina[pagina.length - 1].id;
    }
    return { exito: true, datos: { encolados } };
  } catch (err) {
    console.error("[analizarSegmentoAction]", err);
    return { exito: false, error: "No se pudo iniciar el análisis del segmento" };
  }
}

const LOTE_SEGMENTO = 500;
