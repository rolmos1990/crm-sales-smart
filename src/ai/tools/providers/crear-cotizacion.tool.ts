import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { registroHerramientas } from "@/ai/tools/registry";
import {
  ENTREGA_INPUT_SCHEMA,
  EntregaIASchema,
  describirEntrega,
  hayDestinoEnArgs,
  resolverEntregaIA,
  sinDatosDeEntrega,
} from "@/ai/tools/shared/resolver-entrega-ia";
import {
  describirFaltantesDocumento,
  faltantesDocumentoIA,
} from "@/ai/tools/shared/datos-obligatorios-documento";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

/** true si el error es el unique constraint (instanciaId, numero) — ver el
 *  mismo problema resuelto en generarNumeroCotizacion (sales/cotizaciones/queries.ts). */
function esErrorNumeroDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const MAX_INTENTOS_NUMERO = 3;

const LineaSchema = z.object({
  productoId: z.string().optional(),
  descripcion: z.string().min(1),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  descuento: z.number().min(0).max(100).optional(),
});

const ArgsSchema = z.object({
  lineas: z.array(LineaSchema).min(1),
  notas: z.string().optional(),
  impuesto: z.number().min(0).max(100).optional(),
  entrega: EntregaIASchema.optional(),
});

const CrearCotizacionTool: IProveedorTool = {
  name: "crear_cotizacion",
  definition: {
    name: "crear_cotizacion",
    description:
      "Crea una cotización con los productos solicitados por el cliente. Usar cuando el cliente pide un presupuesto o cotización formal. Antes de llamarla necesitás tener confirmados: el nombre del cliente, los productos con cantidades, si es por envío o por retiro y —si es envío— el destino más los datos que exija el transportista, que conocés por consultar_opciones_envio. Incluí SIEMPRE el bloque `entrega` con esos datos. Si falta alguno, la cotización NO se crea y te devuelve cuáles faltan para que se los pidas al cliente.",
    input_schema: {
      type: "object",
      properties: {
        lineas: {
          type: "array",
          description: "Líneas de la cotización",
          items: {
            type: "object",
            properties: {
              productoId: { type: "string", description: "ID del producto del catálogo (si aplica)" },
              descripcion: { type: "string", description: "Descripción del ítem" },
              cantidad: { type: "number", description: "Cantidad" },
              precioUnitario: { type: "number", description: "Precio por unidad" },
              descuento: { type: "number", description: "Porcentaje de descuento 0-100 (opcional)" },
            },
            required: ["descripcion", "cantidad", "precioUnitario"],
          },
        },
        notas: { type: "string", description: "Notas adicionales para el cliente" },
        impuesto: { type: "number", description: "Porcentaje de impuesto (default 18)" },
        entrega: ENTREGA_INPUT_SCHEMA,
      },
      // `entrega` es obligatorio en el contrato que ve el modelo, pero sigue
      // siendo `.optional()` en Zod a propósito: si el modelo igual la omite,
      // conviene que falle en la compuerta —que le dice exactamente qué
      // pedirle al cliente— y no en el parseo, cuyo "Argumentos inválidos" no
      // le sirve para corregirse.
      required: ["lineas", "entrega"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para crear_cotizacion" };

    if (!ctx.contactoId) return { ok: false, error: "Se requiere un contacto activo para crear la cotización" };

    const { prisma } = await import("@/shared/db/prisma");
    // El mismo generador que usa crearCotizacion: la numeracion es una sola
    // serie COT-<anio>-<consecutivo>, venga de un usuario o del agente.
    const { generarNumeroCotizacion } = await import("@/sales/cotizaciones/queries");
    const { obtenerMonedaPrincipal } = await import("@/configuracion/empresa/queries");
    const moneda = await obtenerMonedaPrincipal(ctx.instanciaId);
    const impuestoPct = parsed.data.impuesto ?? 18;

    const lineasConCalculo = parsed.data.lineas.map((l, i) => {
      const descuentoFactor = 1 - (l.descuento ?? 0) / 100;
      const subtotal = l.cantidad * l.precioUnitario * descuentoFactor;
      return { ...l, subtotal, orden: i };
    });

    const subtotal = lineasConCalculo.reduce((acc, l) => acc + l.subtotal, 0);
    const impuestoMonto = subtotal * (impuestoPct / 100);

    // El destino se vuelve a resolver contra el mismo motor que usó el
    // agente al cotizar el envío, así el costo que se persiste es por
    // construcción el que ya se le informó al cliente — ver
    // resolver-entrega-ia.ts. Sin bloque `entrega` no se crea ninguna fila,
    // que es el comportamiento que tenía esta tool antes.
    const entregaArgs = parsed.data.entrega;
    const entregaResuelta = sinDatosDeEntrega(entregaArgs)
      ? null
      : await resolverEntregaIA(ctx.instanciaId, entregaArgs);

    // Compuerta de datos obligatorios. Va después de resolver la entrega
    // —porque los campos que exige el transportista solo se conocen ahí— y
    // antes de cualquier escritura, incluida la previsualización del
    // simulador: lo que se simula tiene que ser lo que pasaría de verdad.
    const contacto = await prisma.contacto.findUnique({
      where: { id: ctx.contactoId },
      select: { nombre: true },
    });
    const faltantes = faltantesDocumentoIA({
      nombreContacto: contacto?.nombre,
      nombreDestinatario: entregaArgs?.nombreDestinatario,
      // El método resuelto manda sobre el de los args: resolverEntregaIA lo
      // deriva del transportista elegido justamente para no depender de lo
      // que el modelo haya supuesto. Solo si no hubo entrega que resolver
      // —el caso que antes creaba el documento en silencio— queda sin valor.
      metodoEntrega: entregaResuelta?.datos.metodoEntrega ?? entregaArgs?.metodoEntrega,
      hayDestino: hayDestinoEnArgs(entregaArgs),
      camposTransportista: entregaResuelta?.camposFaltantes,
    });
    if (faltantes.length > 0) {
      return {
        ok: false,
        error: describirFaltantesDocumento(faltantes),
        // El resultado completo viaja al modelo como JSON, así que la lista
        // estructurada le llega además del texto.
        data: { datosFaltantes: faltantes },
      };
    }

    const costoEnvio = entregaResuelta?.costoEnvio ?? 0;
    const total = subtotal + impuestoMonto + costoEnvio;
    const resumenEntrega = entregaResuelta ? describirEntrega(entregaResuelta, moneda) : {};

    // 018-simulador-agente — misma lógica de cálculo de arriba, sin tocar
    // Prisma (FR-006/FR-007): reutiliza el 100% de la validación/cálculo.
    if (ctx.modoSimulacion) {
      return {
        ok: true,
        data: {
          subtotal,
          impuesto: impuestoMonto,
          costoEnvio,
          total,
          moneda,
          lineas: lineasConCalculo.length,
          ...resumenEntrega,
          generadoPorIA: true,
          pendienteConfirmacion: true,
          previsualizado: true,
          mensaje: `[Simulación] Cotización por ${moneda} ${total.toFixed(2)} — no se creó ningún registro real.`,
        },
      };
    }

    const datosCotizacion = {
      instanciaId: ctx.instanciaId,
      contactoId: ctx.contactoId,
      oportunidadId: ctx.oportunidadId ?? null,
      subtotal,
      impuesto: impuestoMonto,
      costoEnvio,
      total,
      moneda,
      entrega: entregaResuelta ? { create: entregaResuelta.datos } : undefined,
      notas: parsed.data.notas ?? null,
      generadoPorIA: true,
      // Una cotización que armó la IA nunca nace dada por válida: queda
      // pendiente de que un humano la confirme desde la lista
      // (confirmarCotizacionGeneradaPorIA), que es lo que la UI muestra como
      // "generado por IA · pendiente".
      confirmadoPorHumano: false,
      lineas: {
        create: lineasConCalculo.map((l) => ({
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: l.descuento ?? 0,
          subtotal: l.subtotal,
          total: l.subtotal,
          orden: l.orden,
          productoId: l.productoId ?? null,
        })),
      },
    };

    // Basado en el último número emitido con este formato (no en `count`):
    // con `count`, borrar una cotización en borrador reduce el conteo y el
    // próximo número generado puede volver a caer en uno que ya existe,
    // disparando el unique constraint (instanciaId, numero) — se reintenta
    // con un número fresco por si dos creaciones concurrentes coinciden.
    let cotizacion: Awaited<ReturnType<typeof prisma.cotizacion.create<{ data: typeof datosCotizacion & { numero: string } }>>> | undefined;
    for (let intento = 1; intento <= MAX_INTENTOS_NUMERO; intento++) {
      const numero = await generarNumeroCotizacion(ctx.instanciaId);
      try {
        cotizacion = await prisma.cotizacion.create({ data: { ...datosCotizacion, numero } });
        break;
      } catch (e) {
        if (!esErrorNumeroDuplicado(e) || intento === MAX_INTENTOS_NUMERO) throw e;
      }
    }
    if (!cotizacion) throw new Error("No se pudo generar un número de cotización único");

    return {
      ok: true,
      data: {
        cotizacionId: cotizacion.id,
        numero: cotizacion.numero,
        subtotal,
        impuesto: impuestoMonto,
        costoEnvio,
        total,
        moneda,
        lineas: lineasConCalculo.length,
        ...resumenEntrega,
        generadoPorIA: true,
        pendienteConfirmacion: true,
        mensaje: `Cotización #${cotizacion.numero} preparada por ${moneda} ${total.toFixed(2)} — queda sujeta a confirmación antes de enviarse.`,
      },
    };
  },
};

registroHerramientas.register(CrearCotizacionTool);
