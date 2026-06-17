"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import {
  SchemaCrearCampoImport,
  SchemaImportarRegistros,
} from "./schema";
import { obtenerCamposPersonalizadosPorEntidad } from "./queries";
import type { EntidadImportable } from "./types";

function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function obtenerCamposEntidadAction(entidad: EntidadImportable) {
  const sesion = await requireSesion();
  return obtenerCamposPersonalizadosPorEntidad(sesion.instanciaId, entidad);
}

export async function crearCampoPersonalizadoAction(
  entidad: EntidadImportable,
  datos: unknown,
) {
  const sesion = await requireSesion();

  if (entidad === "ACTIVIDAD") {
    return {
      exito: false as const,
      error: "Las actividades no admiten campos personalizados",
    };
  }

  const parsed = SchemaCrearCampoImport.safeParse(datos);
  if (!parsed.success) {
    return {
      exito: false as const,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const clave = slugificar(parsed.data.nombre);

  const existe = await prisma.campoPersonalizado.findFirst({
    where: {
      instanciaId: sesion.instanciaId,
      clave,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entidad: entidad as any,
      activo: true,
    },
  });

  if (existe) {
    return {
      exito: false as const,
      error: `Ya existe un campo con la clave "${clave}"`,
    };
  }

  const ultimo = await prisma.campoPersonalizado.findFirst({
    where: {
      instanciaId: sesion.instanciaId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entidad: entidad as any,
      activo: true,
    },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  try {
    const campo = await prisma.campoPersonalizado.create({
      data: {
        nombre: parsed.data.nombre,
        clave,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tipo: parsed.data.tipo as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entidad: entidad as any,
        requerido: parsed.data.requerido,
        instanciaId: sesion.instanciaId,
        orden: (ultimo?.orden ?? -1) + 1,
      },
      select: { id: true, nombre: true, clave: true, tipo: true },
    });

    return { exito: true as const, campo };
  } catch {
    return { exito: false as const, error: "Error al crear el campo" };
  }
}

type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

async function insertar(
  tx: PrismaTransactionClient,
  entidad: EntidadImportable,
  datos: Record<string, unknown>,
  instanciaId: string,
) {
  switch (entidad) {
    case "CONTACTO":
      await tx.contacto.create({
        data: {
          nombre: String(datos.nombre ?? ""),
          apellido: String(datos.apellido ?? ""),
          email: datos.email ? String(datos.email) : null,
          telefonoPrincipal: datos.telefonoPrincipal
            ? String(datos.telefonoPrincipal)
            : null,
          cargo: datos.cargo ? String(datos.cargo) : null,
          notas: datos.notas ? String(datos.notas) : null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          estado: (datos.estado as any) ?? "LEAD",
          instanciaId,
        },
      });
      break;

    case "EMPRESA":
      await tx.empresa.create({
        data: {
          nombre: String(datos.nombre ?? ""),
          ruc: datos.ruc ? String(datos.ruc) : null,
          industria: datos.industria ? String(datos.industria) : null,
          tamano: datos.tamano ? String(datos.tamano) : null,
          sitioWeb: datos.sitioWeb ? String(datos.sitioWeb) : null,
          telefono: datos.telefono ? String(datos.telefono) : null,
          email: datos.email ? String(datos.email) : null,
          notas: datos.notas ? String(datos.notas) : null,
          instanciaId,
        },
      });
      break;

    case "PRODUCTO":
      await tx.producto.create({
        data: {
          nombre: String(datos.nombre ?? ""),
          precio: Number(datos.precio ?? 0),
          sku: datos.sku ? String(datos.sku) : null,
          descripcion: datos.descripcion ? String(datos.descripcion) : null,
          categoria: datos.categoria ? String(datos.categoria) : null,
          unidad: datos.unidad ? String(datos.unidad) : "unidad",
          cantidadDisponible: Number(datos.cantidadDisponible ?? 0),
          instanciaId,
        },
      });
      break;

    case "OPORTUNIDAD":
      await tx.oportunidad.create({
        data: {
          titulo: String(datos.titulo ?? ""),
          valor: Number(datos.valor ?? 0),
          probabilidad: Number(datos.probabilidad ?? 20),
          fechaCierre: datos.fechaCierre
            ? new Date(String(datos.fechaCierre))
            : null,
          notas: datos.notas ? String(datos.notas) : null,
          instanciaId,
        },
      });
      break;

    case "PEDIDO":
      await tx.pedido.create({
        data: {
          numero: `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          nombre: datos.nombre ? String(datos.nombre) : null,
          apellido: datos.apellido ? String(datos.apellido) : null,
          telefono: datos.telefono ? String(datos.telefono) : null,
          email: datos.email ? String(datos.email) : null,
          empresaNombre: datos.empresaNombre
            ? String(datos.empresaNombre)
            : null,
          instanciaId,
        },
      });
      break;

    case "ACTIVIDAD":
      await tx.actividad.create({
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tipo: (datos.tipo as any) ?? "TAREA",
          titulo: String(datos.titulo ?? ""),
          fecha: new Date(String(datos.fecha ?? new Date().toISOString())),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prioridad: (datos.prioridad as any) ?? "MEDIA",
          descripcion: datos.descripcion ? String(datos.descripcion) : null,
          instanciaId,
        },
      });
      break;
  }
}

export async function importarRegistrosAction(datos: unknown) {
  const sesion = await requireSesion();

  const parsed = SchemaImportarRegistros.safeParse(datos);
  if (!parsed.success) {
    return {
      exito: false as const,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const {
    entidad,
    archivoNombre,
    archivoTipo,
    archivoPeso,
    registros,
  } = parsed.data;

  const historial = await prisma.historialImportacion.create({
    data: {
      instanciaId: sesion.instanciaId,
      usuarioId: sesion.usuarioId,
      entidad,
      archivoNombre,
      archivoTipo,
      archivoPeso,
      totalRegistros: registros.length,
      registrosExitosos: 0,
      registrosConError: 0,
      errores: [],
      estado: "EN_PROCESO",
    },
  });

  const CHUNK = 100;
  let exitosos = 0;
  const erroresImport: Array<{
    fila: number;
    campo: string;
    mensaje: string;
  }> = [];

  for (let i = 0; i < registros.length; i += CHUNK) {
    const chunk = registros.slice(i, i + CHUNK);
    try {
      await prisma.$transaction(async (tx) => {
        for (let j = 0; j < chunk.length; j++) {
          await insertar(
            tx,
            entidad as EntidadImportable,
            chunk[j] as Record<string, unknown>,
            sesion.instanciaId,
          );
          exitosos++;
        }
      });
    } catch (e) {
      erroresImport.push({
        fila: i + 2,
        campo: "batch",
        mensaje: e instanceof Error ? e.message : "Error desconocido en lote",
      });
    }
  }

  const estado =
    erroresImport.length === 0
      ? "COMPLETADO"
      : exitosos > 0
        ? "COMPLETADO_CON_ERRORES"
        : "FALLIDO";

  await prisma.historialImportacion.update({
    where: { id: historial.id },
    data: {
      registrosExitosos: exitosos,
      registrosConError: erroresImport.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errores: erroresImport as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      estado: estado as any,
    },
  });

  revalidatePath("/datos");

  return {
    exito: true as const,
    datos: {
      exitosos,
      conError: erroresImport.length,
      errores: erroresImport,
      historialId: historial.id,
    },
  };
}
