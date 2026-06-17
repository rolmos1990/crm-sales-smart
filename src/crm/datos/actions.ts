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

    case "OPORTUNIDAD": {
      const estrategia = String(datos._estrategiaContacto ?? "email_o_telefono");
      const email = datos.contactoEmail ? String(datos.contactoEmail).toLowerCase() : null;
      const telefono = datos.contactoTelefono ? String(datos.contactoTelefono) : null;

      let contactoId: string | null = null;

      // Buscar contacto existente según estrategia
      if (email && (estrategia === "email" || estrategia === "email_o_telefono")) {
        const c = await tx.contacto.findFirst({
          where: { instanciaId, email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        });
        if (c) contactoId = c.id;
      }
      if (!contactoId && telefono && (estrategia === "telefono" || estrategia === "email_o_telefono")) {
        const c = await tx.contacto.findFirst({
          where: { instanciaId, telefonoPrincipal: telefono },
          select: { id: true },
        });
        if (c) contactoId = c.id;
      }

      // Crear contacto nuevo si hay datos pero no hay match
      if (!contactoId && (email || telefono)) {
        const nuevo = await tx.contacto.create({
          data: {
            nombre: datos.contactoNombre ? String(datos.contactoNombre) : "Sin nombre",
            apellido: datos.contactoApellido ? String(datos.contactoApellido) : "",
            email,
            telefonoPrincipal: telefono,
            instanciaId,
          },
          select: { id: true },
        });
        contactoId = nuevo.id;
      }

      // Buscar o crear Empresa
      const estrategiaEmpresa = String(datos._estrategiaEmpresa ?? "ruc_o_email");
      const empresaRuc = datos.empresaRuc ? String(datos.empresaRuc).trim() : null;
      const empresaEmail = datos.empresaEmail ? String(datos.empresaEmail).toLowerCase() : null;
      const empresaTelefono = datos.empresaTelefono ? String(datos.empresaTelefono).trim() : null;
      const empresaNombre = datos.empresaNombre ? String(datos.empresaNombre).trim() : null;

      let empresaId: string | null = null;

      if (empresaRuc && (estrategiaEmpresa === "ruc" || estrategiaEmpresa === "ruc_o_email")) {
        const e = await tx.empresa.findFirst({
          where: { instanciaId, ruc: empresaRuc },
          select: { id: true },
        });
        if (e) empresaId = e.id;
      }
      if (!empresaId && empresaEmail && (estrategiaEmpresa === "email" || estrategiaEmpresa === "ruc_o_email")) {
        const e = await tx.empresa.findFirst({
          where: { instanciaId, email: { equals: empresaEmail, mode: "insensitive" } },
          select: { id: true },
        });
        if (e) empresaId = e.id;
      }
      if (!empresaId && empresaTelefono && estrategiaEmpresa === "telefono") {
        const e = await tx.empresa.findFirst({
          where: { instanciaId, telefono: empresaTelefono },
          select: { id: true },
        });
        if (e) empresaId = e.id;
      }

      if (!empresaId && empresaNombre) {
        const nueva = await tx.empresa.create({
          data: {
            nombre: empresaNombre,
            ruc: empresaRuc,
            email: empresaEmail,
            telefono: empresaTelefono,
            instanciaId,
          },
          select: { id: true },
        });
        empresaId = nueva.id;
      }

      // Crear Oportunidad
      const oportunidad = await tx.oportunidad.create({
        data: {
          titulo: String(datos.titulo ?? ""),
          valor: Number(datos.valor ?? 0),
          probabilidad: Number(datos.probabilidad ?? 20),
          fechaCierre: datos.fechaCierre ? new Date(String(datos.fechaCierre)) : null,
          notas: datos.notas ? String(datos.notas) : null,
          empresaId,
          instanciaId,
        },
        select: { id: true },
      });

      // Vincular contacto
      if (contactoId) {
        await tx.oportunidadContacto.create({
          data: { oportunidadId: oportunidad.id, contactoId, principal: true },
        });
      }
      break;
    }

    case "PEDIDO":
      // Los pedidos se insertan en lote agrupado via insertarPedidosAgrupados
      throw new Error("Use insertarPedidosAgrupados para la entidad PEDIDO");


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

async function insertarPedidosAgrupados(
  tx: PrismaTransactionClient,
  filas: Record<string, unknown>[],
  instanciaId: string,
  contadorBase: number,
): Promise<number> {
  const año = new Date().getFullYear();

  // Agrupar filas por idPedido preservando orden de aparición
  const grupos = new Map<string, Record<string, unknown>[]>();
  for (const fila of filas) {
    const idPedido = String(fila.idPedido ?? "").trim();
    if (!idPedido) continue;
    if (!grupos.has(idPedido)) grupos.set(idPedido, []);
    grupos.get(idPedido)!.push(fila);
  }

  let offset = 0;
  for (const [, lineas] of grupos) {
    const header = lineas[0]!;
    const numero = `PED-${año}-${String(contadorBase + offset + 1).padStart(4, "0")}`;
    offset++;

    const impuestoPct = Number(header.impuesto ?? 0);

    const lineasData: Array<{
      descripcion: string | null;
      cantidad: number;
      precioUnitario: number;
      descuento: number;
      subtotal: number;
      total: number;
      orden: number;
      productoId: string | null;
    }> = [];

    for (const [idx, linea] of lineas.entries()) {
      const cantidad = Number(linea.cantidad ?? 1);
      const precioUnitario = Number(linea.precioUnitario ?? 0);
      const descuento = Number(linea.descuento ?? 0);
      const subtotal = cantidad * precioUnitario * (1 - descuento / 100);

      let productoId: string | null = null;
      const sku = linea.skuProducto ? String(linea.skuProducto).trim() : null;
      if (sku) {
        const prod = await tx.producto.findFirst({
          where: { sku, instanciaId, activo: true },
          select: { id: true },
        });
        if (prod) productoId = prod.id;
      }

      lineasData.push({
        descripcion: linea.descripcion ? String(linea.descripcion) : null,
        cantidad,
        precioUnitario,
        descuento,
        subtotal,
        total: subtotal,
        orden: idx,
        productoId,
      });
    }

    const pedidoSubtotal = lineasData.reduce((acc, l) => acc + l.subtotal, 0);
    const impuestoMonto = pedidoSubtotal * (impuestoPct / 100);
    const total = pedidoSubtotal + impuestoMonto;

    await tx.pedido.create({
      data: {
        numero,
        nombre: header.nombre ? String(header.nombre) : null,
        apellido: header.apellido ? String(header.apellido) : null,
        ruc: header.ruc ? String(header.ruc) : null,
        email: header.email ? String(header.email) : null,
        telefono: header.telefono ? String(header.telefono) : null,
        empresaNombre: header.empresaNombre ? String(header.empresaNombre) : null,
        fechaEntrega: header.fechaEntrega ? new Date(String(header.fechaEntrega)) : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        estado: (header.estado as any) ?? "PENDIENTE",
        subtotal: pedidoSubtotal,
        impuesto: impuestoMonto,
        total,
        moneda: header.moneda ? String(header.moneda) : "PEN",
        notas: header.notas ? String(header.notas) : null,
        instanciaId,
        lineas: {
          createMany: { data: lineasData },
        },
      },
    });
  }

  return grupos.size;
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

  const esPedido = entidad === "PEDIDO";

  // Para pedidos, contar grupos únicos por idPedido para el historial
  const totalHistorial = esPedido
    ? new Set(
        registros
          .map((r) => String((r as Record<string, unknown>).idPedido ?? "").trim())
          .filter(Boolean),
      ).size
    : registros.length;

  const historial = await prisma.historialImportacion.create({
    data: {
      instanciaId: sesion.instanciaId,
      usuarioId: sesion.usuarioId,
      entidad,
      archivoNombre,
      archivoTipo,
      archivoPeso,
      totalRegistros: totalHistorial,
      registrosExitosos: 0,
      registrosConError: 0,
      errores: [],
      estado: "EN_PROCESO",
    },
  });

  let exitosos = 0;
  const erroresImport: Array<{
    fila: number;
    campo: string;
    mensaje: string;
  }> = [];

  if (esPedido) {
    // Insertar todos los pedidos en una única transacción agrupada
    try {
      const contadorBase = await prisma.pedido.count({
        where: { instanciaId: sesion.instanciaId },
      });
      await prisma.$transaction(async (tx) => {
        exitosos = await insertarPedidosAgrupados(
          tx,
          registros as Record<string, unknown>[],
          sesion.instanciaId,
          contadorBase,
        );
      });
    } catch (e) {
      erroresImport.push({
        fila: 2,
        campo: "batch",
        mensaje: e instanceof Error ? e.message : "Error desconocido al importar pedidos",
      });
    }
  } else {
    const CHUNK = 100;
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
