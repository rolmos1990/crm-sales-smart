"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { resolverCodigoEfectivo, ocultarCodigo } from "@/shared/lib/codigo-sensible";
import { CrearProductoSchema, ActualizarProductoSchema } from "./schema";
import type { ResultadoAccion, Producto } from "./types";

/** true si el usuario tocó algún campo de la plantilla — evita crear una
 *  fila ProductoEntregaDigital vacía por defecto (mismo patrón "hayX" ya
 *  usado en Cotización/Pedido para entrega/servicio/entregaDigital). */
function hayEntregaDigital(e: { metodo?: string; url?: string; archivo?: string; usuarioAcceso?: string; instrucciones?: string; observaciones?: string; requiereSeguimiento?: boolean; tipoSeguimiento?: string; codigoAccion?: string; codigoNuevo?: string } | undefined): boolean {
  if (!e) return false;
  return !!(e.metodo || e.url || e.archivo || e.usuarioAcceso || e.instrucciones || e.observaciones || e.requiereSeguimiento || e.tipoSeguimiento || (e.codigoAccion === "REEMPLAZAR" && e.codigoNuevo));
}

// Búsqueda server-side para combos/filtros (ej. filtro de producto en
// Oportunidades) — mismo patrón que buscarContactosAction
// (src/crm/contactos/actions.ts): capada (ver buscarProductos, take: 20),
// no trae el catálogo completo.
export async function buscarProductosAction(query: string) {
  if (!query.trim()) return [];
  const sesion = await requireSesion();
  const { buscarProductos } = await import("./queries");
  return buscarProductos(query, sesion.instanciaId);
}

export async function crearProducto(datos: unknown): Promise<ResultadoAccion<Producto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  const validado = CrearProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, sku, imagenUrl, manejaStock, cantidadDisponible, entregaDigital, ...resto } = validado.data;
    const debeCrearEntregaDigital = resto.tipo === "DIGITAL" && hayEntregaDigital(entregaDigital);
    const producto = await prisma.producto.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        moneda: resto.moneda ?? "PEN",
        activo: resto.activo ?? true,
        descripcion: descripcion || null,
        categoria: categoria || null,
        unidad: unidad || undefined,
        sku: sku || null,
        imagenUrl: imagenUrl || null,
        manejaStock: manejaStock ?? false,
        cantidadDisponible: cantidadDisponible ?? 0,
        entregaDigital: debeCrearEntregaDigital ? {
          create: {
            metodo: entregaDigital!.metodo || null,
            url: entregaDigital!.url || null,
            archivo: entregaDigital!.archivo || null,
            usuarioAcceso: entregaDigital!.usuarioAcceso || null,
            instrucciones: entregaDigital!.instrucciones || null,
            observaciones: entregaDigital!.observaciones || null,
            requiereSeguimiento: entregaDigital!.requiereSeguimiento ?? false,
            tipoSeguimiento: entregaDigital!.tipoSeguimiento || null,
            // Nada existente todavía — CONSERVAR sin acción previa equivale a null.
            codigo: resolverCodigoEfectivo(entregaDigital!, null),
          },
        } : undefined,
      },
      include: { entregaDigital: { select: { metodo: true, url: true, archivo: true, codigo: true, usuarioAcceso: true, instrucciones: true, observaciones: true, requiereSeguimiento: true, tipoSeguimiento: true } } },
    });

    await publicadorEventos.publicar(EventosSistema.ProductoCreado, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      productoId: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
    });
    revalidatePath("/productos");
    const { entregaDigital: entregaDigitalCreada, ...productoResto } = producto;
    return { exito: true, datos: { ...productoResto, precio: Number(producto.precio), cantidadDisponible: Number(producto.cantidadDisponible), entregaDigital: ocultarCodigo(entregaDigitalCreada) } as Producto };
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes("Unique constraint") && e.message.includes("sku")
      ? "Ya existe un producto con ese SKU"
      : "Error al crear el producto";
    return { exito: false, error: msg };
  }
}

export async function actualizarProducto(id: string, datos: unknown): Promise<ResultadoAccion<Producto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  const validado = ActualizarProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, sku, imagenUrl, manejaStock, cantidadDisponible, entregaDigital, ...resto } = validado.data;
    const productoAntes = await prisma.producto.findUnique({
      where: { id, instanciaId: sesion.instanciaId },
      select: { precio: true, tipo: true, entregaDigital: { select: { codigo: true } } },
    });
    const tipoEfectivo = resto.tipo ?? productoAntes?.tipo ?? "FISICO";
    const debeTocarEntregaDigital = tipoEfectivo === "DIGITAL" && entregaDigital !== undefined;
    const datosEntregaDigital = debeTocarEntregaDigital ? {
      metodo: entregaDigital!.metodo || null,
      url: entregaDigital!.url || null,
      archivo: entregaDigital!.archivo || null,
      usuarioAcceso: entregaDigital!.usuarioAcceso || null,
      instrucciones: entregaDigital!.instrucciones || null,
      observaciones: entregaDigital!.observaciones || null,
      requiereSeguimiento: entregaDigital!.requiereSeguimiento ?? false,
      tipoSeguimiento: entregaDigital!.tipoSeguimiento || null,
      codigo: resolverCodigoEfectivo(entregaDigital!, productoAntes?.entregaDigital?.codigo ?? null),
    } : null;

    const producto = await prisma.producto.update({
      where: { id, instanciaId: sesion.instanciaId },
      data: {
        ...resto,
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
        ...(categoria !== undefined && { categoria: categoria || null }),
        ...(unidad !== undefined && { unidad: unidad || undefined }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(imagenUrl !== undefined && { imagenUrl: imagenUrl || null }),
        ...(manejaStock !== undefined && { manejaStock }),
        ...(cantidadDisponible !== undefined && { cantidadDisponible }),
        entregaDigital: datosEntregaDigital ? {
          upsert: { create: datosEntregaDigital, update: datosEntregaDigital },
        } : undefined,
      },
      include: { entregaDigital: { select: { metodo: true, url: true, archivo: true, codigo: true, usuarioAcceso: true, instrucciones: true, observaciones: true, requiereSeguimiento: true, tipoSeguimiento: true } } },
    });

    if (productoAntes && validado.data.precio !== undefined && Number(productoAntes.precio) !== validado.data.precio) {
      await publicadorEventos.publicar(EventosSistema.PrecioActualizado, sesion.instanciaId, {
        instanciaId: sesion.instanciaId,
        productoId: id,
        precioAnterior: Number(productoAntes.precio),
        precioNuevo: validado.data.precio,
      });
    } else {
      // Sin codigoNuevo — este payload va a un evento de dominio (puede
      // terminar en logs de otros consumidores), nunca el código sensible.
      const { entregaDigital: _entregaDigitalCambio, ...cambiosSinCodigo } = validado.data;
      await publicadorEventos.publicar(EventosSistema.ProductoActualizado, sesion.instanciaId, { instanciaId: sesion.instanciaId, productoId: id, cambios: cambiosSinCodigo as Record<string, unknown> });
    }

    revalidatePath("/productos");
    revalidatePath(`/productos/${id}`);
    const { entregaDigital: entregaDigitalActualizada, ...productoResto } = producto;
    return { exito: true, datos: { ...productoResto, precio: Number(producto.precio), cantidadDisponible: Number(producto.cantidadDisponible), entregaDigital: ocultarCodigo(entregaDigitalActualizada) } as Producto };
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes("Unique constraint") && e.message.includes("sku")
      ? "Ya existe un producto con ese SKU"
      : "Error al actualizar el producto";
    return { exito: false, error: msg };
  }
}

export async function eliminarProducto(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  try {
    await prisma.producto.update({ where: { id, instanciaId: sesion.instanciaId }, data: { activo: false } });
    revalidatePath("/productos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar el producto" };
  }
}
