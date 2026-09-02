"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import {
  ConfiguracionIASchema,
  ProveedorIASchema,
  ActualizarProveedorIASchema,
  AsignacionesObjetivoIASchema,
  OBJETIVOS_ENRUTAMIENTO,
  type ObjetivoEnrutamiento,
} from "./schema";
import type { CasosDeUsoProveedor } from "@/ai/proveedores/types";

export async function guardarConfiguracionIA(datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const validado = ConfiguracionIASchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  await prisma.configuracionIA.upsert({
    where: { instanciaId: sesion.instanciaId },
    create: {
      instanciaId: sesion.instanciaId,
      ...validado.data,
    },
    update: validado.data,
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

// 021-alias-proveedores-ia — insensible a mayúsculas/espacios de borde
// (spec Edge Cases / FR-004), calculado en el único punto de escritura.
function normalizarAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function mensajeAliasDuplicado(alias: string): string {
  return `Ya existe un agente con el alias "${alias.trim()}"`;
}

function esErrorAliasDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function crearProveedorIA(datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const validado = ProveedorIASchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const aliasNormalizado = normalizarAlias(validado.data.alias);

  // FR-005 — rechazo explícito antes de tocar Prisma; el índice único de BD
  // (@@unique([instanciaId, aliasNormalizado])) queda como resguardo ante
  // condiciones de carrera, capturado más abajo.
  const duplicado = await prisma.proveedorIA.findFirst({
    where: { instanciaId: sesion.instanciaId, aliasNormalizado },
  });
  if (duplicado) return { exito: false, error: mensajeAliasDuplicado(validado.data.alias) };

  const modelos = validado.data.modelosDisponibles
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  try {
    await prisma.proveedorIA.create({
      data: {
        instanciaId: sesion.instanciaId,
        alias: validado.data.alias.trim(),
        aliasNormalizado,
        proveedor: validado.data.proveedor,
        tipoAgenteIA: validado.data.tipoAgenteIA ?? null,
        apiKeyEncriptada: validado.data.apiKey || null,
        baseUrl: validado.data.baseUrl || null,
        modelosDisponibles: modelos,
        prioridad: validado.data.prioridad,
        limitePorMinuto: validado.data.limitePorMinuto ?? null,
        limitePorDia: validado.data.limitePorDia ?? null,
        timeoutMs: validado.data.timeoutMs,
        reintentosMax: validado.data.reintentosMax,
        activo: true,
      },
    });
  } catch (err) {
    if (esErrorAliasDuplicado(err)) return { exito: false, error: mensajeAliasDuplicado(validado.data.alias) };
    throw err;
  }

  revalidatePath("/configuracion");
  return { exito: true };
}

// 021-alias-proveedores-ia — FR-006/FR-007. El proveedor subyacente es
// inmutable tras la creación (research.md Decisión 5): no forma parte del
// input de edición.
export async function actualizarProveedorIA(id: string, datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const existente = await prisma.proveedorIA.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
  });
  if (!existente) return { exito: false, error: "Proveedor no encontrado" };

  const validado = ActualizarProveedorIASchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const aliasNormalizado = normalizarAlias(validado.data.alias);

  // FR-007 — excluye el propio registro: conservar su alias no es "duplicado".
  const duplicado = await prisma.proveedorIA.findFirst({
    where: { instanciaId: sesion.instanciaId, aliasNormalizado, NOT: { id } },
  });
  if (duplicado) return { exito: false, error: mensajeAliasDuplicado(validado.data.alias) };

  const modelos = validado.data.modelosDisponibles
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  try {
    await prisma.proveedorIA.update({
      where: { id },
      data: {
        alias: validado.data.alias.trim(),
        aliasNormalizado,
        tipoAgenteIA: validado.data.tipoAgenteIA ?? null,
        // La API key nunca se devuelve al cliente (ver queries.ts) — un campo
        // vacío en edición significa "no cambiarla", no "borrarla".
        apiKeyEncriptada: validado.data.apiKey || existente.apiKeyEncriptada,
        baseUrl: validado.data.baseUrl || null,
        modelosDisponibles: modelos,
        prioridad: validado.data.prioridad,
        limitePorMinuto: validado.data.limitePorMinuto ?? null,
        limitePorDia: validado.data.limitePorDia ?? null,
        timeoutMs: validado.data.timeoutMs,
        reintentosMax: validado.data.reintentosMax,
      },
    });
  } catch (err) {
    if (esErrorAliasDuplicado(err)) return { exito: false, error: mensajeAliasDuplicado(validado.data.alias) };
    throw err;
  }

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function toggleProveedorIA(id: string, activo: boolean) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const proveedor = await prisma.proveedorIA.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
  });
  if (!proveedor) return { exito: false, error: "Proveedor no encontrado" };

  await prisma.proveedorIA.update({ where: { id }, data: { activo } });

  revalidatePath("/configuracion");
  return { exito: true };
}

// --- 010-enrutamiento-modelos-ia-por-objetivo ---

function parsearObjetivosExistentes(valor: unknown): ObjetivoEnrutamiento[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const objetivos = (valor as CasosDeUsoProveedor)["objetivos"];
  return Array.isArray(objetivos) ? (objetivos as ObjetivoEnrutamiento[]) : [];
}

export async function guardarAsignacionesObjetivoIA(datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const validado = AsignacionesObjetivoIASchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const proveedores = await prisma.proveedorIA.findMany({
    where: { instanciaId: sesion.instanciaId },
    select: { id: true, activo: true, casosDeUso: true },
  });
  const proveedoresPorId = new Map(proveedores.map((p) => [p.id, p]));

  // FR-003 — no se puede asignar un objetivo a un proveedor inactivo o de otra instancia
  for (const asignacion of validado.data) {
    if (asignacion.proveedorIAId === null) continue;
    const proveedor = proveedoresPorId.get(asignacion.proveedorIAId);
    if (!proveedor || !proveedor.activo) {
      return {
        exito: false,
        error: `El proveedor seleccionado para "${asignacion.objetivo}" no está activo`,
      };
    }
  }

  // Recalcular, por proveedor, la lista de objetivos que le corresponden — se
  // parte de los objetivos existentes fuera de los 7 gestionados acá (si
  // alguna vez hubiera otros) y se reemplazan solo los 7 de esta pantalla.
  const objetivosPorProveedor = new Map<string, Set<ObjetivoEnrutamiento>>();
  for (const p of proveedores) {
    const existentes = parsearObjetivosExistentes(p.casosDeUso).filter(
      (o) => !OBJETIVOS_ENRUTAMIENTO.includes(o),
    );
    objetivosPorProveedor.set(p.id, new Set(existentes));
  }
  for (const asignacion of validado.data) {
    if (asignacion.proveedorIAId === null) continue;
    objetivosPorProveedor.get(asignacion.proveedorIAId)?.add(asignacion.objetivo);
  }

  await prisma.$transaction(
    Array.from(objetivosPorProveedor.entries()).map(([proveedorId, objetivos]) =>
      prisma.proveedorIA.update({
        where: { id: proveedorId },
        data: {
          casosDeUso:
            objetivos.size > 0
              ? ({ objetivos: Array.from(objetivos) } as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      }),
    ),
  );

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function eliminarProveedorIA(id: string) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const proveedor = await prisma.proveedorIA.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
  });
  if (!proveedor) return { exito: false, error: "Proveedor no encontrado" };

  await prisma.proveedorIA.delete({ where: { id } });

  revalidatePath("/configuracion");
  return { exito: true };
}
