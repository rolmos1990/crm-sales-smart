"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { CrearCotizacionSchema, ActualizarCotizacionSchema } from "./schema";
import type { CrearCotizacionInput } from "./schema";
import { generarNumeroCotizacion, obtenerCotizacionesPorOportunidad, obtenerCotizacionPorId } from "./queries";
import { generarPedidoDesdeCotizacion } from "./services/generar-pedido-desde-cotizacion.service";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerMonedaPrincipal, obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { isoDesdePais } from "@/shared/lib/pais-iso";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { resolverCodigoEfectivo, ocultarCodigo } from "@/shared/lib/codigo-sensible";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { ProductoCatalogo, TipoProducto } from "@/shared/productos/types";
import type { ResultadoAccion, Cotizacion } from "./types";
import type { LineaCotizacionInput, EntregaDigitalCotizacionInput } from "./schema";

/**
 * Determina qué bloque de cumplimiento corresponde (Físico/Servicio/
 * Digital) a partir de la primera línea con un producto vinculado — así lo
 * decidió el usuario (no es elegible a mano, ni se recalcula en cada
 * lectura: se resuelve acá una sola vez y se guarda en Cotizacion/Pedido).
 * Sin producto vinculado en ninguna línea, por defecto es FISICO.
 */
async function resolverTipoCumplimiento(lineas: LineaCotizacionInput[]): Promise<TipoProducto> {
  const productoIds = lineas.map(l => l.productoId).filter((id): id is string => !!id);
  if (productoIds.length === 0) return "FISICO";

  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, tipo: true },
  });
  const tipoPorId = new Map(productos.map(p => [p.id, p.tipo]));

  const primeraConProducto = lineas.find(l => l.productoId && tipoPorId.has(l.productoId));
  if (!primeraConProducto?.productoId) return "FISICO";
  return tipoPorId.get(primeraConProducto.productoId) as TipoProducto;
}

const SELECT_PRODUCTO_ENTREGA_DIGITAL = {
  metodo: true, url: true, archivo: true, codigo: true, usuarioAcceso: true,
  instrucciones: true, observaciones: true, requiereSeguimiento: true, tipoSeguimiento: true,
} as const;

/**
 * Trae, por productoId, la plantilla de entrega digital (incluido el
 * código real — esto es servidor↔servidor, nunca sale de acá) — solo tiene
 * sentido llamarlo cuando tipoCumplimiento = DIGITAL. Batch, mismo criterio
 * que resolverTipoCumplimiento.
 */
async function obtenerPlantillasEntregaDigital(productoIds: string[]) {
  if (productoIds.length === 0) return new Map<string, { tipo: TipoProducto; entregaDigital: { codigo: string | null } | null }>();
  const productos = await prisma.producto.findMany({
    where: { id: { in: [...new Set(productoIds)] } },
    select: { id: true, tipo: true, entregaDigital: { select: SELECT_PRODUCTO_ENTREGA_DIGITAL } },
  });
  return new Map(productos.map(p => [p.id, p]));
}

/** true si el agente tocó algo, o el producto ya trae un código configurado
 *  para heredar — evita crear una fila EntregaDigitalCotizacion vacía. */
function hayDatosEntregaDigitalLinea(
  entregaLinea: EntregaDigitalCotizacionInput | undefined,
  productoTieneCodigo: boolean,
): boolean {
  return !!(entregaLinea && (
    entregaLinea.metodo || entregaLinea.email || entregaLinea.url || entregaLinea.archivo ||
    entregaLinea.usuarioAcceso || entregaLinea.fechaEntrega || entregaLinea.fechaExpiracion ||
    entregaLinea.instrucciones || entregaLinea.observaciones ||
    (entregaLinea.codigoAccion === "REEMPLAZAR" && entregaLinea.codigoNuevo)
  )) || productoTieneCodigo;
}

/** Datos listos para el `create` de EntregaDigitalCotizacion de una línea —
 *  `codigo` resuelto server-side vía resolverCodigoEfectivo, nunca
 *  confiando en un valor crudo del cliente salvo REEMPLAZAR explícito. */
function datosEntregaDigitalLinea(entregaLinea: EntregaDigitalCotizacionInput | undefined, codigoExistente: string | null) {
  const e = entregaLinea ?? {};
  return {
    metodo: e.metodo || null,
    email: e.email || null,
    url: e.url || null,
    archivo: e.archivo || null,
    usuarioAcceso: e.usuarioAcceso || null,
    fechaEntrega: e.fechaEntrega || null,
    fechaExpiracion: e.fechaExpiracion || null,
    instrucciones: e.instrucciones || null,
    observaciones: e.observaciones || null,
    codigo: resolverCodigoEfectivo(e, codigoExistente),
  };
}

export async function crearCotizacion(datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = CrearCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const { lineas, contactoId, empresaId, notas, impuesto, oportunidadId, destinatario, entrega, servicio, ...resto } = validado.data;
    const numero = await generarNumeroCotizacion(sesion.instanciaId);

    const subtotal = lineas.reduce((acc, l) => {
      const base = l.cantidad * l.precioUnitario;
      return acc + base * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const costoEnvio = entrega?.costoEnvio ?? 0;
    const total = subtotal + impuestoMonto + costoEnvio;

    const tipoCumplimiento = await resolverTipoCumplimiento(lineas);

    // Solo se registra el bloque de cumplimiento si el usuario realmente
    // tocó algo de esa sección Y coincide con el tipo resuelto — evita crear
    // una fila vacía por defecto, o de un bloque que no corresponde.
    const hayEntrega = tipoCumplimiento === "FISICO" && entrega && (entrega.metodoEntrega || entrega.fechaEstimada || entrega.observaciones || entrega.transportistaId || entrega.estadoProvinciaId);
    const hayServicio = tipoCumplimiento === "SERVICIO" && servicio && (servicio.modalidad || servicio.fecha || servicio.hora || servicio.duracion || servicio.ubicacion || servicio.direccion || servicio.responsable || servicio.instrucciones || servicio.observaciones);

    // Plantillas de entrega digital por producto — solo si esta cotización
    // es DIGITAL (mismo gate que hoy, generalizado a que cada línea DIGITAL
    // tenga su propia fila en vez de una sola global para todo el documento).
    const plantillasDigital = tipoCumplimiento === "DIGITAL"
      ? await obtenerPlantillasEntregaDigital(lineas.map(l => l.productoId).filter((id): id is string => !!id))
      : new Map();

    const cotizacion = await prisma.cotizacion.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        costoEnvio,
        total,
        tipoCumplimiento,
        notas: notas || null,
        contactoId, // requerido por el schema — la cotización siempre nace ligada a un contacto
        empresaId: empresaId || null,
        oportunidadId: oportunidadId || null,
        metadata: destinatario ? { destinatario } : undefined,
        lineas: {
          create: lineas.map(l => {
            const productoInfo = l.productoId ? plantillasDigital.get(l.productoId) : undefined;
            const esLineaDigital = productoInfo?.tipo === "DIGITAL";
            const codigoProducto = productoInfo?.entregaDigital?.codigo ?? null;
            const hayEntregaLinea = esLineaDigital && hayDatosEntregaDigitalLinea(l.entregaDigital, !!codigoProducto);
            return {
              productoId: l.productoId || null,
              descripcion: l.descripcion || null,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              descuento: l.descuento,
              subtotal: l.cantidad * l.precioUnitario * (1 - l.descuento / 100),
              entregaDigital: hayEntregaLinea ? { create: datosEntregaDigitalLinea(l.entregaDigital, codigoProducto) } : undefined,
            };
          }),
        },
        entrega: hayEntrega ? {
          create: {
            metodoEntrega: entrega!.metodoEntrega || "COURIER_EXTERNO",
            estadoEntrega: entrega!.estadoEntrega || "PENDIENTE",
            transportistaId: entrega!.transportistaId || null,
            fechaEstimada: entrega!.fechaEstimada || null,
            observaciones: entrega!.observaciones || null,
            // 019-cobertura-geografica-envios
            paisId: entrega!.paisId || null,
            estadoProvinciaId: entrega!.estadoProvinciaId || null,
            ciudad: entrega!.ciudad || null,
          },
        } : undefined,
        servicio: hayServicio ? {
          create: {
            modalidad: servicio!.modalidad || null,
            fecha: servicio!.fecha || null,
            hora: servicio!.hora || null,
            duracion: servicio!.duracion || null,
            ubicacion: servicio!.ubicacion || null,
            direccion: servicio!.direccion || null,
            responsable: servicio!.responsable || null,
            instrucciones: servicio!.instrucciones || null,
            observaciones: servicio!.observaciones || null,
          },
        } : undefined,
      },
      include: { contacto: { select: { id: true, nombre: true, apellido: true } }, empresa: { select: { id: true, nombre: true } } },
    });

    await publicadorEventos.publicar(EventosSistema.CotizacionCreada, sesion.instanciaId, { instanciaId: sesion.instanciaId, cotizacionId: cotizacion.id, numero: cotizacion.numero, total });
    revalidatePath("/sales/cotizaciones");
    if (oportunidadId) revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    return { exito: true, datos: { ...cotizacion, subtotal, total, impuesto: impuestoMonto, costoEnvio } as unknown as Cotizacion };
  } catch (e: unknown) {
    console.error("[crearCotizacion]", e);
    const detalle = e instanceof Error ? e.message : String(e);
    return { exito: false, error: `Error al crear la cotización: ${detalle}` };
  }
}

export async function actualizarCotizacion(id: string, datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = ActualizarCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacionExistente = await prisma.cotizacion.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!cotizacionExistente) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacionExistente.estado !== "BORRADOR") {
      return { exito: false, error: "Solo se pueden modificar cotizaciones en estado borrador" };
    }

    const { lineas, contactoId, empresaId, notas, impuesto, oportunidadId, destinatario, entrega, servicio, ...resto } = validado.data;

    // Si vienen líneas nuevas, el tipo de cumplimiento se vuelve a resolver
    // sobre ellas (puede cambiar si se reemplaza el producto de la línea);
    // si no vienen, se conserva el ya guardado.
    const tipoCumplimiento = lineas
      ? await resolverTipoCumplimiento(lineas as LineaCotizacionInput[])
      : (cotizacionExistente.tipoCumplimiento as TipoProducto);

    let updateData: Record<string, unknown> = {
      ...resto,
      tipoCumplimiento,
      notas: notas !== undefined ? notas || null : undefined,
      // contactoId nunca se limpia: el schema exige que, si viene, sea un id no vacío
      // (se puede cambiar de contacto, pero la cotización nunca se queda sin uno).
      contactoId: contactoId !== undefined ? contactoId : undefined,
      empresaId: empresaId !== undefined ? empresaId || null : undefined,
      oportunidadId: oportunidadId !== undefined ? oportunidadId || null : undefined,
    };

    if (destinatario !== undefined) {
      const metadataActual = (cotizacionExistente.metadata as Record<string, unknown>) ?? {};
      updateData.metadata = { ...metadataActual, destinatario };
    }

    if (entrega !== undefined) {
      const hayEntrega = tipoCumplimiento === "FISICO" && (entrega.metodoEntrega || entrega.fechaEstimada || entrega.observaciones || entrega.transportistaId || entrega.estadoProvinciaId);
      const datosEntrega = {
        metodoEntrega: entrega.metodoEntrega || "COURIER_EXTERNO",
        estadoEntrega: entrega.estadoEntrega || "PENDIENTE",
        transportistaId: entrega.transportistaId || null,
        fechaEstimada: entrega.fechaEstimada || null,
        observaciones: entrega.observaciones || null,
        // 019-cobertura-geografica-envios
        paisId: entrega.paisId || null,
        estadoProvinciaId: entrega.estadoProvinciaId || null,
        ciudad: entrega.ciudad || null,
      };
      updateData.entrega = hayEntrega ? {
        upsert: { create: datosEntrega, update: datosEntrega },
      } : undefined;
    }

    if (servicio !== undefined) {
      const hayServicio = tipoCumplimiento === "SERVICIO" && (servicio.modalidad || servicio.fecha || servicio.hora || servicio.duracion || servicio.ubicacion || servicio.direccion || servicio.responsable || servicio.instrucciones || servicio.observaciones);
      const datosServicio = {
        modalidad: servicio.modalidad || null,
        fecha: servicio.fecha || null,
        hora: servicio.hora || null,
        duracion: servicio.duracion || null,
        ubicacion: servicio.ubicacion || null,
        direccion: servicio.direccion || null,
        responsable: servicio.responsable || null,
        instrucciones: servicio.instrucciones || null,
        observaciones: servicio.observaciones || null,
      };
      updateData.servicio = hayServicio ? {
        upsert: { create: datosServicio, update: datosServicio },
      } : undefined;
    }

    // entregaDigital ya no es un campo de nivel-documento — se maneja por
    // línea, dentro del bloque `if (lineas)` de más abajo (ver §6 del plan:
    // las líneas se borran y recrean en cada edición, así que hay que leer
    // el código existente ANTES de borrar para poder "conservarlo").

    // El formulario siempre reenvía `lineas` junto con `entrega` al guardar
    // (es un único form), así que alcanza con recalcular el total acá — pero
    // igual cae al valor ya guardado si algún caller llega a mandar solo el
    // costo de envío sin tocar las líneas.
    const costoEnvioNuevo = entrega?.costoEnvio;
    if (lineas || costoEnvioNuevo !== undefined) {
      const subtotal = lineas
        ? lineas.reduce((acc, l) => {
            const base = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
            return acc + base * (1 - (l.descuento ?? 0) / 100);
          }, 0)
        : Number(cotizacionExistente.subtotal);
      const tasaImpuesto = impuesto ?? Number(cotizacionExistente.impuesto);
      const impuestoMonto = lineas ? subtotal * (tasaImpuesto / 100) : Number(cotizacionExistente.impuesto);
      const costoEnvio = costoEnvioNuevo ?? Number(cotizacionExistente.costoEnvio);
      const total = subtotal + impuestoMonto + costoEnvio;
      updateData = { ...updateData, subtotal, impuesto: impuestoMonto, costoEnvio, total };

      if (lineas) {
        // Plantillas de entrega digital por producto (para líneas nuevas o
        // sin código previo — mismo criterio que crearCotizacion).
        const plantillasDigital = tipoCumplimiento === "DIGITAL"
          ? await obtenerPlantillasEntregaDigital(lineas.map(l => l.productoId).filter((v): v is string => !!v))
          : new Map();

        // Leer el código ya guardado por producto ANTES de borrar las
        // líneas viejas — es lo único que permite que "conservar" sobreviva
        // al deleteMany+recreate de acá abajo (ver §6 del plan). Un Map, no
        // un objeto: `.has()` distingue "no había línea de este producto"
        // (usar el default del producto) de "había línea, código null"
        // (conservar null — no resucitar el default del producto).
        const codigoExistentePorProducto = new Map<string, string | null>();
        const lineasExistentes = await prisma.cotizacionLinea.findMany({
          where: { cotizacionId: id },
          select: { productoId: true, entregaDigital: { select: { codigo: true } } },
        });
        for (const le of lineasExistentes) {
          if (le.productoId && le.entregaDigital) codigoExistentePorProducto.set(le.productoId, le.entregaDigital.codigo);
        }

        await prisma.cotizacionLinea.deleteMany({ where: { cotizacionId: id } });
        await prisma.cotizacion.update({
          where: { id },
          data: {
            ...updateData,
            lineas: {
              create: lineas.map(l => {
                const productoInfo = l.productoId ? plantillasDigital.get(l.productoId) : undefined;
                const esLineaDigital = productoInfo?.tipo === "DIGITAL";
                const codigoExistente = l.productoId && codigoExistentePorProducto.has(l.productoId)
                  ? codigoExistentePorProducto.get(l.productoId)!
                  : (productoInfo?.entregaDigital?.codigo ?? null);
                const hayEntregaLinea = esLineaDigital && hayDatosEntregaDigitalLinea(l.entregaDigital, !!codigoExistente);
                return {
                  productoId: l.productoId || null,
                  descripcion: l.descripcion || null,
                  cantidad: l.cantidad ?? 1,
                  precioUnitario: l.precioUnitario ?? 0,
                  descuento: l.descuento ?? 0,
                  subtotal: (l.cantidad ?? 1) * (l.precioUnitario ?? 0) * (1 - (l.descuento ?? 0) / 100),
                  entregaDigital: hayEntregaLinea ? { create: datosEntregaDigitalLinea(l.entregaDigital, codigoExistente) } : undefined,
                };
              }),
            },
          },
        });
      } else {
        await prisma.cotizacion.update({ where: { id }, data: updateData });
      }
    } else {
      await prisma.cotizacion.update({ where: { id }, data: updateData });
    }

    const cotizacionActualizada = await prisma.cotizacion.findFirst({
      where: { id },
      include: { contacto: { select: { id: true, nombre: true, apellido: true } }, empresa: { select: { id: true, nombre: true } } },
    });

    revalidatePath("/sales/cotizaciones");
    revalidatePath(`/sales/cotizaciones/${id}`);
    if (oportunidadId) revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    const oId = oportunidadId ?? (cotizacionExistente as any).oportunidadId;
    if (oId) revalidatePath(`/crm/oportunidades/${oId}`);
    return { exito: true, datos: cotizacionActualizada as unknown as Cotizacion };
  } catch {
    return { exito: false, error: "Error al actualizar la cotización" };
  }
}

export async function cambiarEstadoCotizacion(id: string, estado: string): Promise<ResultadoAccion> {
  // La transición a APROBADA solo puede pasar por aprobarCotizacion — es la
  // única que valida stock y publica CotizacionAprobada (que dispara la
  // generación del pedido). Si esto aceptara "APROBADA" también, un caller
  // podría dejar la cotización aprobada sin que nunca se genere el pedido.
  if (estado === "APROBADA") {
    return { exito: false, error: "Usa la acción de aprobar para generar el pedido correctamente" };
  }

  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;

  try {
    await prisma.cotizacion.update({
      where: { id, instanciaId: sesion.instanciaId },
      data: { estado: estado as "BORRADOR" | "REVISADA" | "ENVIADA" | "RECHAZADA" | "VENCIDA" },
    });

    if (estado === "ENVIADA") {
      await publicadorEventos.publicar(EventosSistema.CotizacionEnviada, sesion.instanciaId, { instanciaId: sesion.instanciaId, cotizacionId: id, numero: "" });
    }

    revalidatePath("/sales/cotizaciones");
    revalidatePath(`/sales/cotizaciones/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al cambiar el estado" };
  }
}

export async function obtenerCotizacionesPorOportunidadAction(oportunidadId: string) {
  const sesion = await requireSesion();
  const datos = await obtenerCotizacionesPorOportunidad(oportunidadId, sesion.instanciaId);
  return datos.map((c) => ({ ...c, total: Number(c.total) }));
}

/**
 * Aprobar una cotización — se encarga ÚNICAMENTE de validar, cambiar el
 * estado a APROBADA y publicar CotizacionAprobada. La generación real del
 * pedido (copiar datos de la oportunidad, campos personalizados, líneas,
 * entrega, etc.) vive en un único lugar: generarPedidoDesdeCotizacion,
 * disparado por el manejador del evento — así el resultado es idéntico sin
 * importar si se aprueba desde el Workspace de Oportunidades, el módulo de
 * Cotizaciones, o cualquier otro lugar futuro.
 *
 * La validación de stock se mantiene acá, síncrona: el botón "Aprobar" debe
 * seguir bloqueando al instante si falta stock, igual que antes. El manejador
 * del evento vuelve a revalidar el stock de forma defensiva antes de generar
 * el pedido (por si hay una condición de carrera entre el momento en que se
 * aprueba y el momento en que efectivamente se procesa el evento).
 */
export async function aprobarCotizacion(id: string): Promise<ResultadoAccion<void>> {
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id, instanciaId: sesion.instanciaId },
      include: {
        lineas: {
          include: {
            producto: { select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true } },
          },
        },
      },
    });

    if (!cotizacion) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacion.estado === "APROBADA") return { exito: false, error: "La cotización ya fue aprobada" };

    // Validar stock antes de hacer cualquier cambio
    const erroresStock: string[] = [];
    for (const linea of cotizacion.lineas) {
      if (!linea.producto?.manejaStock) continue;
      const disponible = Number(linea.producto.cantidadDisponible);
      const solicitado = Number(linea.cantidad);
      if (disponible < solicitado) {
        erroresStock.push(
          `"${linea.producto.nombre}": disponible ${disponible}, solicitado ${solicitado}`
        );
      }
    }
    if (erroresStock.length > 0) {
      return { exito: false, error: `Stock insuficiente — ${erroresStock.join(" · ")}` };
    }

    await prisma.cotizacion.update({ where: { id }, data: { estado: "APROBADA" } });

    await publicadorEventos.publicar(EventosSistema.CotizacionAprobada, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      cotizacionId: id,
      numero: cotizacion.numero,
      usuarioId: sesion.usuarioId,
    });

    revalidatePath("/sales/cotizaciones");
    revalidatePath(`/sales/cotizaciones/${id}`);
    if (cotizacion.oportunidadId) revalidatePath(`/crm/oportunidades/${cotizacion.oportunidadId}`);

    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al aprobar la cotización" };
  }
}

/**
 * Reintento manual de la generación del pedido — para el caso (raro, dado que
 * el stock ya se valida al aprobar) en que el manejador del evento haya
 * agotado sus reintentos automáticos de RabbitMQ. Llama al mismo servicio
 * centralizado de forma síncrona; es idempotente, así que no duplica el
 * pedido si ya se llegó a generar.
 */
export async function reintentarGenerarPedido(cotizacionId: string): Promise<ResultadoAccion<{ pedidoId: string; numeroPedido: string }>> {
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id: cotizacionId, instanciaId: sesion.instanciaId },
      select: { estado: true },
    });
    if (!cotizacion) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacion.estado !== "APROBADA") {
      return { exito: false, error: "Solo se puede generar el pedido de una cotización aprobada" };
    }

    const resultado = await generarPedidoDesdeCotizacion(cotizacionId, sesion.instanciaId, sesion.usuarioId);

    revalidatePath("/sales/cotizaciones");
    revalidatePath("/sales/pedidos");
    revalidatePath(`/sales/cotizaciones/${cotizacionId}`);

    return { exito: true, datos: { pedidoId: resultado.pedidoId, numeroPedido: resultado.numeroPedido } };
  } catch (e: unknown) {
    const detalle = e instanceof Error ? e.message : String(e);
    return { exito: false, error: `Error al generar el pedido: ${detalle}` };
  }
}

export async function eliminarCotizacion(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacion = await prisma.cotizacion.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!cotizacion) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacion.estado !== "BORRADOR") {
      return { exito: false, error: "Solo se pueden eliminar cotizaciones en estado borrador" };
    }

    await prisma.cotizacion.delete({ where: { id } });
    revalidatePath("/sales/cotizaciones");
    if (cotizacion.oportunidadId) revalidatePath(`/crm/oportunidades/${cotizacion.oportunidadId}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la cotización" };
  }
}

export async function obtenerDatosFormularioCotizacion(): Promise<{
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  contactosDetalle: Awaited<ReturnType<typeof buscarContactos>>;
  productos: ProductoCatalogo[];
  monedaDefault: string;
  transportistas: Awaited<ReturnType<typeof obtenerTransportistas>>;
  /** ISO alpha-2 del país configurado en Configuración → Empresa — para que
   *  <PhoneInput> preseleccione el prefijo correcto en vez de +51 (Perú). */
  defaultCountryCode: string;
}> {
  const sesion = await requireSesion();
  const [empresas, contactos, productos, monedaDefault, transportistas, config] = await Promise.all([
    buscarEmpresas("", sesion.instanciaId),
    buscarContactos("", sesion.instanciaId),
    obtenerProductosCatalogo(sesion.instanciaId),
    obtenerMonedaPrincipal(sesion.instanciaId),
    obtenerTransportistas(sesion.instanciaId),
    obtenerConfiguracionEmpresa(sesion.instanciaId),
  ]);
  return {
    empresas: empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
    contactos: contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` })),
    contactosDetalle: contactos,
    productos,
    monedaDefault,
    transportistas,
    defaultCountryCode: isoDesdePais(config?.pais),
  };
}

/**
 * `buscarContactos("", instanciaId)` trae solo los primeros registros (ver
 * su `take: 10`) — si el contacto ligado a la cotización que se está
 * editando no cayó en ese lote, el combo de contacto lo mostraría vacío
 * aunque el dato exista. Esto lo agrega al inicio del listado cuando falta,
 * para que siempre aparezca seleccionado correctamente.
 */
export async function asegurarContactoIncluido(
  contactoId: string,
  contactosDetalle: Awaited<ReturnType<typeof buscarContactos>>,
  contactosOpciones: OpcionCombobox[],
  instanciaId: string,
): Promise<{ contactosDetalle: Awaited<ReturnType<typeof buscarContactos>>; contactos: OpcionCombobox[] }> {
  if (!contactoId || contactosDetalle.some((c) => c.id === contactoId)) {
    return { contactosDetalle, contactos: contactosOpciones };
  }
  const extra = await prisma.contacto.findFirst({
    where: { id: contactoId, instanciaId },
    select: {
      id: true, nombre: true, apellido: true, email: true, telefonoPrincipal: true,
      empresa: { select: { id: true, nombre: true } },
    },
  });
  if (!extra) return { contactosDetalle, contactos: contactosOpciones };
  return {
    contactosDetalle: [extra, ...contactosDetalle],
    contactos: [{ valor: extra.id, etiqueta: `${extra.nombre} ${extra.apellido}`.trim() }, ...contactosOpciones],
  };
}

/**
 * Datos para editar una cotización dentro de un Sheet (mismo patrón que
 * "Nueva cotización" desde el Workspace de Oportunidades) — junta los datos
 * generales del formulario con los `defaultValues` de la cotización
 * existente, para no tener que navegar a /sales/cotizaciones/[id]/editar y
 * perder el contexto del workspace.
 */
export async function obtenerDatosEdicionCotizacionAction(cotizacionId: string): Promise<{
  editable: boolean;
  numero: string;
  defaultValues: Partial<CrearCotizacionInput>;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  contactosDetalle: Awaited<ReturnType<typeof buscarContactos>>;
  productos: ProductoCatalogo[];
  monedaDefault: string;
  transportistas: Awaited<ReturnType<typeof obtenerTransportistas>>;
  defaultCountryCode: string;
} | null> {
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return null;

  const [cotizacion, datosFormulario] = await Promise.all([
    obtenerCotizacionPorId(cotizacionId, auth.sesion.instanciaId),
    obtenerDatosFormularioCotizacion(),
  ]);
  if (!cotizacion) return null;

  // Mismo mapeo que la página /sales/cotizaciones/[id]/editar — mantenido acá
  // en paralelo porque esa página sigue existiendo como acceso directo fuera
  // del Workspace (ej. enlace desde el módulo de Cotizaciones).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata = (cotizacion as any).metadata as Record<string, unknown> | null;
  const destinatarioGuardado = metadata?.destinatario as Record<string, string> | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineasParaForm = ((cotizacion as any).lineas ?? []).map((l: any) => ({
    productoId: l.productoId ?? "",
    descripcion: l.descripcion ?? "",
    cantidad: Number(l.cantidad),
    precioUnitario: Number(l.precioUnitario),
    descuento: Number(l.descuento),
    // Por línea, no por documento — ver EntregaDigitalCotizacion. Sin
    // `codigo` real: solo si ya hay uno configurado (tieneCodigoConfigurado,
    // via ocultarCodigo en queries.ts), nunca el valor.
    entregaDigital: l.entregaDigital ? {
      metodo: l.entregaDigital.metodo ?? undefined,
      email: l.entregaDigital.email ?? "",
      url: l.entregaDigital.url ?? "",
      archivo: l.entregaDigital.archivo ?? "",
      usuarioAcceso: l.entregaDigital.usuarioAcceso ?? "",
      fechaEntrega: l.entregaDigital.fechaEntrega ? new Date(l.entregaDigital.fechaEntrega) : undefined,
      fechaExpiracion: l.entregaDigital.fechaExpiracion ? new Date(l.entregaDigital.fechaExpiracion) : undefined,
      instrucciones: l.entregaDigital.instrucciones ?? "",
      observaciones: l.entregaDigital.observaciones ?? "",
      codigoAccion: l.entregaDigital.tieneCodigoConfigurado ? "CONSERVAR" as const : undefined,
      codigoNuevo: "",
    } : undefined,
  }));

  const subtotalNum = Number(cotizacion.subtotal);
  const impuestoPorcentaje = subtotalNum > 0
    ? Math.round((Number(cotizacion.impuesto) / subtotalNum) * 1000) / 10
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entregaGuardada = (cotizacion as any).entrega as {
    metodoEntrega: string; estadoEntrega: string; transportistaId: string | null;
    fechaEstimada: Date | string | null; observaciones: string | null;
    paisId: string | null; estadoProvinciaId: string | null; ciudad: string | null;
  } | null;

  const defaultValues: Partial<CrearCotizacionInput> = {
    moneda: cotizacion.moneda,
    impuesto: impuestoPorcentaje,
    notas: cotizacion.notas ?? "",
    contactoId: cotizacion.contactoId ?? "",
    empresaId: cotizacion.empresaId ?? "",
    fechaVencimiento: cotizacion.fechaVencimiento ? new Date(cotizacion.fechaVencimiento) : undefined,
    lineas: lineasParaForm.length > 0 ? lineasParaForm : [{ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 }],
    destinatario: {
      nombre: destinatarioGuardado?.nombre ?? "",
      apellido: destinatarioGuardado?.apellido ?? "",
      telefono: destinatarioGuardado?.telefono ?? "",
      email: destinatarioGuardado?.email ?? "",
    },
    entrega: {
      metodoEntrega: entregaGuardada?.metodoEntrega ?? "COURIER_EXTERNO",
      estadoEntrega: entregaGuardada?.estadoEntrega ?? "PENDIENTE",
      transportistaId: entregaGuardada?.transportistaId ?? null,
      fechaEstimada: entregaGuardada?.fechaEstimada ? new Date(entregaGuardada.fechaEstimada) : undefined,
      observaciones: entregaGuardada?.observaciones ?? "",
      paisId: entregaGuardada?.paisId ?? null,
      estadoProvinciaId: entregaGuardada?.estadoProvinciaId ?? null,
      ciudad: entregaGuardada?.ciudad ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      costoEnvio: Number((cotizacion as any).costoEnvio ?? 0),
    } as CrearCotizacionInput["entrega"],
  };

  const { contactosDetalle, contactos } = await asegurarContactoIncluido(
    cotizacion.contactoId ?? "",
    datosFormulario.contactosDetalle,
    datosFormulario.contactos,
    auth.sesion.instanciaId,
  );

  return {
    // Solo se puede editar mientras siga en borrador (no enviada) — mismo
    // criterio que la página de edición standalone.
    editable: cotizacion.estado === "BORRADOR",
    numero: cotizacion.numero,
    defaultValues,
    ...datosFormulario,
    contactosDetalle,
    contactos,
  };
}

// 015-herramientas-operativas-inventario-envios-acciones — confirma un
// documento generado por IA en modo borrador (accionesComercialesModoBorrador).
// Idempotente: confirmar dos veces no es un error.
export async function confirmarCotizacionGeneradaPorIA(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true, confirmadoPorHumano: true },
  });
  if (!cotizacion) return { exito: false, error: "Cotización no encontrada" };

  if (!cotizacion.confirmadoPorHumano) {
    await prisma.cotizacion.update({
      where: { id },
      data: { confirmadoPorHumano: true, confirmadoPorUsuarioId: auth.sesion.usuarioId },
    });
  }

  revalidatePath("/sales/cotizaciones");
  revalidatePath(`/sales/cotizaciones/${id}`);
  return { exito: true, datos: undefined };
}
