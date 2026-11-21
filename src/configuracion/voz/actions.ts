"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { cifrarToken, descifrarToken } from "@/shared/lib/cifrado-tokens";
import { crearProveedorVoz as crearAdaptadorVoz } from "@/voz/proveedores/registro";
import { estaImplementadoVoz, mensajeProveedorVozNoImplementado } from "@/voz/proveedores/disponibles";
import { invalidarCacheTranscripcionVoz } from "@/configuracion/empresa/queries";
import { ProveedorVozSchema, ActualizarProveedorVozSchema } from "./schema";

type Resultado = { exito: true } | { exito: false; error: string };

// Insensible a mayúsculas y espacios de borde, calculado en el único punto de
// escritura (mismo criterio que el alias de proveedores de IA, feature 021).
function normalizarAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function esErrorAliasDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function mensajeAliasDuplicado(alias: string): string {
  return `Ya existe un proveedor de voz con el alias "${alias.trim()}"`;
}

async function autorizar() {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "voz", "modificar");
  return { sesion, permitido, error };
}

export async function crearProveedorVoz(datos: unknown): Promise<Resultado> {
  const { sesion, permitido, error } = await autorizar();
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = ProveedorVozSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const d = validado.data;

  if (!estaImplementadoVoz(d.proveedor)) {
    return { exito: false, error: mensajeProveedorVozNoImplementado(d.proveedor) };
  }

  const aliasNormalizado = normalizarAlias(d.alias);

  // Se chequea antes de escribir para dar un mensaje entendible; el índice
  // único de la base cubre la carrera entre dos altas simultáneas.
  const yaExiste = await prisma.proveedorVoz.findFirst({
    where: { instanciaId: sesion.instanciaId, aliasNormalizado },
    select: { id: true },
  });
  if (yaExiste) return { exito: false, error: mensajeAliasDuplicado(d.alias) };

  try {
    await prisma.proveedorVoz.create({
      data: {
        instanciaId: sesion.instanciaId,
        alias: d.alias.trim(),
        aliasNormalizado,
        proveedor: d.proveedor,
        apiKeyEncriptada: d.apiKey ? cifrarToken(d.apiKey) : null,
        baseUrl: d.baseUrl || null,
        modelo: d.modelo.trim(),
        prioridad: d.prioridad,
        costoPorHora: d.costoPorHora ?? null,
        limiteMinutosDia: d.limiteMinutosDia ?? null,
        timeoutMs: d.timeoutMs,
        reintentosMax: d.reintentosMax,
      },
    });
  } catch (err) {
    if (esErrorAliasDuplicado(err)) return { exito: false, error: mensajeAliasDuplicado(d.alias) };
    throw err;
  }

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function actualizarProveedorVoz(id: string, datos: unknown): Promise<Resultado> {
  const { sesion, permitido, error } = await autorizar();
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = ActualizarProveedorVozSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };
  const d = validado.data;

  const actual = await prisma.proveedorVoz.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!actual) return { exito: false, error: "Proveedor no encontrado" };

  const aliasNormalizado = normalizarAlias(d.alias);

  try {
    await prisma.proveedorVoz.update({
      where: { id },
      data: {
        alias: d.alias.trim(),
        aliasNormalizado,
        // API key vacía = conservar la vigente (FR-003). `undefined` es "no
        // tocar" en Prisma; `null` la borraría y dejaría la cuenta sin
        // transcripción sin que nadie lo pidiera.
        ...(d.apiKey ? { apiKeyEncriptada: cifrarToken(d.apiKey) } : {}),
        baseUrl: d.baseUrl || null,
        modelo: d.modelo.trim(),
        prioridad: d.prioridad,
        costoPorHora: d.costoPorHora ?? null,
        limiteMinutosDia: d.limiteMinutosDia ?? null,
        timeoutMs: d.timeoutMs,
        reintentosMax: d.reintentosMax,
      },
    });
  } catch (err) {
    if (esErrorAliasDuplicado(err)) return { exito: false, error: mensajeAliasDuplicado(d.alias) };
    throw err;
  }

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function toggleProveedorVoz(id: string, activo: boolean): Promise<Resultado> {
  const { sesion, permitido, error } = await autorizar();
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const existe = await prisma.proveedorVoz.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!existe) return { exito: false, error: "Proveedor no encontrado" };

  await prisma.proveedorVoz.update({ where: { id }, data: { activo } });
  revalidatePath("/configuracion");
  return { exito: true };
}

export async function eliminarProveedorVoz(id: string): Promise<Resultado> {
  const { sesion, permitido, error } = await autorizar();
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const existe = await prisma.proveedorVoz.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!existe) return { exito: false, error: "Proveedor no encontrado" };

  // El histórico de UsoVoz sobrevive con proveedorVozId en NULL: borrar un
  // proveedor no puede borrar el gasto que ya se facturó.
  await prisma.proveedorVoz.delete({ where: { id } });
  revalidatePath("/configuracion");
  return { exito: true };
}

/**
 * Verifica la credencial sin esperar a que llegue un audio real (FR-005).
 *
 * Devuelve un motivo entendible, nunca el error crudo del proveedor: el
 * detalle técnico queda en el log del servidor.
 */
export async function probarCredencialesVoz(
  id: string,
): Promise<{ exito: true; disponible: boolean } | { exito: false; error: string }> {
  const { sesion, permitido, error } = await autorizar();
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const config = await prisma.proveedorVoz.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
  });
  if (!config) return { exito: false, error: "Proveedor no encontrado" };
  if (!config.apiKeyEncriptada) {
    return { exito: false, error: "Este proveedor todavía no tiene una API key cargada." };
  }
  if (!estaImplementadoVoz(config.proveedor)) {
    return { exito: false, error: mensajeProveedorVozNoImplementado(config.proveedor) };
  }

  try {
    await import("@/voz/proveedores/inicializar");
    const adaptador = crearAdaptadorVoz(
      config.proveedor,
      descifrarToken(config.apiKeyEncriptada),
      config.modelo,
      config.baseUrl ?? undefined,
    );
    const disponible = await adaptador.estaDisponible();
    return { exito: true, disponible };
  } catch (e) {
    console.error("[voz] Error probando credenciales:", e);
    return { exito: false, error: "No se pudo verificar la credencial. Revisá la API key y la URL." };
  }
}

/**
 * Enciende o apaga la transcripción de la cuenta.
 *
 * No se puede encender sin un proveedor utilizable: el interruptor diría que
 * está activa y ningún audio se transcribiría.
 */
export async function guardarTranscripcionVozHabilitada(habilitada: boolean): Promise<Resultado> {
  const { sesion, permitido, error } = await autorizar();
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  if (habilitada) {
    const utilizables = await prisma.proveedorVoz.count({
      where: { instanciaId: sesion.instanciaId, activo: true, apiKeyEncriptada: { not: null } },
    });
    if (utilizables === 0) {
      return {
        exito: false,
        error: "Primero cargá un proveedor de voz activo con su API key.",
      };
    }
  }

  await prisma.configuracionEmpresa.update({
    where: { instanciaId: sesion.instanciaId },
    data: { transcripcionVozHabilitada: habilitada },
  });

  // Sin esto, el cambio tardaría hasta un minuto en notarse en el worker.
  invalidarCacheTranscripcionVoz(sesion.instanciaId);

  revalidatePath("/configuracion");
  return { exito: true };
}
