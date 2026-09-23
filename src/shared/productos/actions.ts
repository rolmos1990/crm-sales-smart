"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { resolverCodigoEfectivo, ocultarCodigo } from "@/shared/lib/codigo-sensible";
import { CrearProductoSchema, ActualizarProductoSchema, type ComponenteComboInput } from "./schema";
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

/** Une repetidos sumando cantidades: agregar dos veces el mismo producto
 *  equivale a subir su cantidad, nunca a duplicarlo. */
function normalizarComponentes(componentes: ComponenteComboInput[]): ComponenteComboInput[] {
  const porId = new Map<string, number>();
  for (const c of componentes) porId.set(c.productoId, (porId.get(c.productoId) ?? 0) + c.cantidad);
  return [...porId].map(([productoId, cantidad]) => ({ productoId, cantidad }));
}

/**
 * 029-combos-productos-compuestos — reglas de composición. Solo un nivel: un
 * componente nunca es combo y un producto que ya es componente no puede
 * volverse combo, así que un combo no puede contenerse a sí mismo ni directa
 * ni indirectamente (sin necesidad de recorrer un grafo).
 */
async function validarComposicion(params: {
  instanciaId: string;
  comboId?: string;
  componentes: ComponenteComboInput[];
}): Promise<string | null> {
  const { instanciaId, comboId, componentes } = params;
  if (componentes.length === 0) return "Un combo necesita al menos un componente";
  if (comboId && componentes.some((c) => c.productoId === comboId)) return "Un combo no puede incluirse a sí mismo";

  const ids = componentes.map((c) => c.productoId);
  const encontrados = await prisma.producto.findMany({
    where: { id: { in: ids }, instanciaId },
    select: { id: true, esCombo: true },
  });
  if (encontrados.length !== ids.length) return "Componente no encontrado";
  if (encontrados.some((p) => p.esCombo)) return "Un combo solo puede tener productos simples como componentes";

  if (comboId) {
    const usadoEn = await prisma.productoComponente.findFirst({
      where: { componenteId: comboId, combo: { instanciaId } },
      select: { combo: { select: { nombre: true } } },
    });
    if (usadoEn) return `Este producto es componente de «${usadoEn.combo.nombre}» y no puede convertirse en combo`;
  }
  return null;
}

export async function crearProducto(datos: unknown): Promise<ResultadoAccion<Producto>> {
  const auth = await requirePermisoAction("productos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;
  const validado = CrearProductoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { descripcion, categoria, unidad, sku, imagenUrl, manejaStock, cantidadDisponible, entregaDigital, componentes, ...resto } = validado.data;
    const esCombo = resto.esCombo ?? false;
    const componentesCombo = esCombo ? normalizarComponentes(componentes ?? []) : [];
    if (esCombo) {
      const error = await validarComposicion({ instanciaId: sesion.instanciaId, componentes: componentesCombo });
      if (error) return { exito: false, error };
    }
    const debeCrearEntregaDigital = resto.tipo === "DIGITAL" && hayEntregaDigital(entregaDigital);
    const producto = await prisma.producto.create({
      data: {
        ...resto,
        esCombo,
        componentes: esCombo
          ? { create: componentesCombo.map((c) => ({ componenteId: c.productoId, cantidad: c.cantidad })) }
          : undefined,
        instanciaId: sesion.instanciaId,
        moneda: resto.moneda ?? "PEN",
        activo: resto.activo ?? true,
        descripcion: descripcion || null,
        categoria: categoria || null,
        unidad: unidad || undefined,
        sku: sku || null,
        imagenUrl: imagenUrl || null,
        // Un combo no tiene stock propio: su disponibilidad sale de los componentes.
        manejaStock: esCombo ? false : (manejaStock ?? false),
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
    const { descripcion, categoria, unidad, sku, imagenUrl, manejaStock, cantidadDisponible, entregaDigital, componentes, ...resto } = validado.data;
    const productoAntes = await prisma.producto.findUnique({
      where: { id, instanciaId: sesion.instanciaId },
      select: {
        precio: true, tipo: true, esCombo: true, entregaDigital: { select: { codigo: true } },
        componentes: { select: { componenteId: true, cantidad: true } },
      },
    });

    // 029 — sin `componentes` en el payload se conservan los guardados.
    const esCombo = resto.esCombo ?? productoAntes?.esCombo ?? false;
    const componentesCombo = esCombo
      ? normalizarComponentes(
          componentes ?? (productoAntes?.componentes ?? []).map((c) => ({ productoId: c.componenteId, cantidad: c.cantidad })),
        )
      : [];
    if (esCombo) {
      const error = await validarComposicion({ instanciaId: sesion.instanciaId, comboId: id, componentes: componentesCombo });
      if (error) return { exito: false, error };
    }
    const tocaComponentes = esCombo ? componentes !== undefined || resto.esCombo !== undefined : productoAntes?.esCombo === true;
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
        ...(esCombo && { manejaStock: false }),
        ...(cantidadDisponible !== undefined && { cantidadDisponible }),
        // Reemplazo completo dentro del mismo update (atómico). Dejar de ser
        // combo borra la composición; los pedidos ya creados no se ven
        // afectados porque cada línea guardó la suya (composicionCombo).
        componentes: tocaComponentes
          ? {
              deleteMany: {},
              ...(esCombo && { create: componentesCombo.map((c) => ({ componenteId: c.productoId, cantidad: c.cantidad })) }),
            }
          : undefined,
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
