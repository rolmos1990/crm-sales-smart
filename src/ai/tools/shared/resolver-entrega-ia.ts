import { z } from "zod";
import { generarSlug } from "@/shared/lib/slug";
import {
  camposRequeridosFaltantes,
  describirCamposFaltantes,
  type CampoRequerido,
} from "@/shared/entregas/requisitos-transportista";
import {
  nucleoAdministrativo,
  obtenerOpcionesEnvioConConfianza,
  resolverPaisId,
  type OpcionEnvioConConfianza,
} from "@/shared/entregas/resolver-costo-envio";

// Traduce el bloque `entrega` que manda el agente —todo en texto, nunca
// IDs— al snapshot que persisten EntregaCotizacion/EntregaPedido, el mismo
// que arma un humano desde el formulario.
//
// El agente no puede mandar IDs por diseño: consultar_opciones_envio
// construye su respuesta campo por campo justamente para que
// transportistaId/tarifaId/costoInterno nunca lleguen al modelo (FR-009 de
// 024-alias-ubicaciones-transportistas). Así que acá se vuelve a resolver el
// destino contra el mismo motor que usó el agente al cotizar
// (obtenerOpcionesEnvioConConfianza) y se identifica la opción por nombre.
// Consecuencia buscada: el precio que se persiste es por construcción el
// mismo que el agente le informó al cliente, no uno que el modelo haya
// repetido de memoria.

/** Métodos que no pasan por un transportista — no tienen costo de envío ni tarifa que resolver. */
const METODOS_SIN_TRANSPORTISTA = ["RETIRO_TIENDA", "DIGITAL", "INSTALACION_SERVICIO"] as const;

export const METODOS_ENTREGA_VALIDOS = [
  "COURIER_EXTERNO",
  "MENSAJERO_PROPIO",
  "RETIRO_TIENDA",
  "DIGITAL",
  "INSTALACION_SERVICIO",
] as const;

export type MetodoEntregaIA = (typeof METODOS_ENTREGA_VALIDOS)[number];

/** Bloque `entrega` de los args — idéntico en crear_cotizacion y crear_pedido. */
export const EntregaIASchema = z.object({
  metodoEntrega: z.enum(METODOS_ENTREGA_VALIDOS).optional(),
  pais: z.string().optional(),
  estadoProvincia: z.string().optional(),
  distritoCiudad: z.string().optional(),
  corregimiento: z.string().optional(),
  sectorOCodigoPostal: z.string().optional(),
  // Exigidos por las condiciones del transportista elegido. El agente los
  // pide en la conversación; si no los tiene, el documento se crea igual y
  // la tool le devuelve qué falta (ver camposRequeridosFaltantes).
  direccionEntrega: z.string().max(400).optional(),
  identificacion: z.string().max(60).optional(),
  transportista: z.string().optional(),
  servicio: z.string().optional(),
  nombreDestinatario: z.string().max(200).optional(),
  observaciones: z.string().max(500).optional(),
});

export type EntregaIAArgs = z.infer<typeof EntregaIASchema>;

/** Campos del `create` anidado de EntregaCotizacion/EntregaPedido — ambos modelos los comparten. */
export interface DatosEntregaPersistibles {
  metodoEntrega: MetodoEntregaIA;
  estadoEntrega: "PENDIENTE";
  transportistaId: string | null;
  nombreDestinatario: string | null;
  observaciones: string | null;
  paisId: string | null;
  estadoProvinciaId: string | null;
  ciudad: string | null;
  direccionEntrega: string | null;
  identificacion: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
  zonaEntregaId: string | null;
  zonaAsignadaManualmente: false;
  servicioTransportistaId: string | null;
  tarifaTransportistaZonaId: string | null;
  costoInternoEnvio: number | null;
  costoEnvioConfirmado: boolean;
}

export interface EntregaResueltaIA {
  datos: DatosEntregaPersistibles;
  /** Precio al cliente — vive en Cotizacion.costoEnvio / Pedido.costoEnvio, no en la entrega (ver schema.prisma). */
  costoEnvio: number;
  /** false ⇒ "costo de entrega por confirmar": aprobarCotizacion lo bloquea hasta que un humano lo resuelva (FR-040). */
  confirmado: boolean;
  transportistaNombre: string | null;
  servicioNombre: string | null;
  /** Motivo por el que no se pudo fijar transportista/tarifa, para devolvérselo al agente. */
  motivoSinConfirmar: string | null;
  /**
   * Campos que el transportista resuelto exige y el agente no aportó. El
   * documento se crea igual (decisión de producto: no trabar al agente) pero
   * la tool le avisa qué pedirle al cliente, y aprobarCotizacion lo bloquea
   * después. Vacío cuando no hay transportista resuelto: sin transportista no
   * se sabe qué exige.
   */
  camposFaltantes: CampoRequerido[];
}

/** Transportistas y servicios se comparan por nombre literal — no son nombres administrativos. */
function coincideNombre(nombreConfigurado: string, nombreDelAgente: string): boolean {
  return generarSlug(nombreConfigurado) === generarSlug(nombreDelAgente);
}

/** "Bocas del Toro" ≡ "Bocas del Toro Province" — mismo criterio que evaluarNivel en el resolver de costos. */
function coincideUbicacion(nombreCatalogo: string, nombreDelAgente: string): boolean {
  const catalogo = generarSlug(nombreCatalogo);
  const delAgente = generarSlug(nombreDelAgente);
  return catalogo === delAgente || nucleoAdministrativo(catalogo) === nucleoAdministrativo(delAgente);
}

async function resolverEstadoProvinciaId(
  prisma: typeof import("@/shared/db/prisma").prisma,
  paisId: string | null,
  estadoProvincia?: string
): Promise<string | null> {
  if (!paisId || !estadoProvincia) return null;
  const estados = await prisma.estadoProvincia.findMany({ where: { paisId }, select: { id: true, nombre: true } });
  return estados.find((e) => coincideUbicacion(e.nombre, estadoProvincia))?.id ?? null;
}

/** true si el agente no aportó nada de entrega — el documento se crea sin fila de entrega, igual que antes de este cambio. */
export function sinDatosDeEntrega(entrega: EntregaIAArgs | undefined): entrega is undefined {
  return !entrega || !(entrega.metodoEntrega || entrega.estadoProvincia || entrega.distritoCiudad || entrega.transportista);
}

/**
 * Resuelve el bloque de entrega. Nunca inventa un transportista: si el
 * destino no resuelve a una única opción de alta confianza, devuelve la
 * entrega con el destino que sí se conoce y `confirmado: false`, que es el
 * camino de "costo de entrega por confirmar" que ya existe para la UI
 * humana (022-transportistas-zonas-tarifas, FR-039/FR-040).
 */
export async function resolverEntregaIA(
  instanciaId: string,
  entrega: EntregaIAArgs
): Promise<EntregaResueltaIA> {
  const { prisma } = await import("@/shared/db/prisma");

  const paisId = await resolverPaisId(prisma, instanciaId, entrega.pais);
  const estadoProvinciaId = await resolverEstadoProvinciaId(prisma, paisId, entrega.estadoProvincia);

  const base = {
    estadoEntrega: "PENDIENTE" as const,
    nombreDestinatario: entrega.nombreDestinatario ?? null,
    observaciones: entrega.observaciones ?? null,
    paisId,
    estadoProvinciaId,
    ciudad: entrega.distritoCiudad ?? null,
    direccionEntrega: entrega.direccionEntrega ?? null,
    identificacion: entrega.identificacion ?? null,
    corregimiento: entrega.corregimiento ?? null,
    sectorOCodigoPostal: entrega.sectorOCodigoPostal ?? null,
    zonaAsignadaManualmente: false as const,
  };

  // Retiro en tienda / digital / instalación no pasan por transportista: no
  // hay tarifa que resolver y el costo de envío es 0 — se dan por
  // confirmados para no bloquear la conversión a pedido.
  if (entrega.metodoEntrega && (METODOS_SIN_TRANSPORTISTA as readonly string[]).includes(entrega.metodoEntrega)) {
    return {
      datos: {
        ...base,
        metodoEntrega: entrega.metodoEntrega,
        transportistaId: null,
        zonaEntregaId: null,
        servicioTransportistaId: null,
        tarifaTransportistaZonaId: null,
        costoInternoEnvio: null,
        costoEnvioConfirmado: true,
      },
      costoEnvio: 0,
      confirmado: true,
      transportistaNombre: null,
      servicioNombre: null,
      motivoSinConfirmar: null,
      camposFaltantes: [],
    };
  }

  const porConfirmar = (motivo: string): EntregaResueltaIA => ({
    datos: {
      ...base,
      metodoEntrega: entrega.metodoEntrega ?? "COURIER_EXTERNO",
      transportistaId: null,
      zonaEntregaId: null,
      servicioTransportistaId: null,
      tarifaTransportistaZonaId: null,
      costoInternoEnvio: null,
      costoEnvioConfirmado: false,
    },
    costoEnvio: 0,
    confirmado: false,
    transportistaNombre: null,
    servicioNombre: null,
    motivoSinConfirmar: motivo,
    camposFaltantes: [],
  });

  const resultado = await obtenerOpcionesEnvioConConfianza({
    instanciaId,
    pais: entrega.pais,
    estadoProvincia: entrega.estadoProvincia,
    distritoCiudad: entrega.distritoCiudad,
    corregimiento: entrega.corregimiento,
    sectorOCodigoPostal: entrega.sectorOCodigoPostal,
  });

  if (resultado.opciones.length === 0) {
    return porConfirmar("No hay transportistas configurados para ese destino");
  }

  // Mismo criterio que consultar_opciones_envio para decidir si se puede
  // cotizar directo: EXACTA y ALIAS sí, PROBABLE/AMBIGUA piden que un humano
  // confirme la ubicación antes de fijar tarifa (requerimiento-transportista.md §8).
  const candidatos: OpcionEnvioConConfianza[] = resultado.opciones.filter(
    (o) => o.confianza === "EXACTA" || o.confianza === "ALIAS"
  );
  if (candidatos.length === 0) {
    return porConfirmar("La ubicación no coincide con precisión suficiente con ningún destino configurado");
  }

  const filtrados = candidatos.filter(
    (o) =>
      (!entrega.transportista || coincideNombre(o.transportistaNombre, entrega.transportista)) &&
      (!entrega.servicio || coincideNombre(o.servicioNombre, entrega.servicio)) &&
      (!entrega.metodoEntrega || o.transportistaTipo === entrega.metodoEntrega)
  );

  if (filtrados.length === 0) {
    return porConfirmar("Ningún transportista configurado para ese destino coincide con el indicado");
  }
  if (filtrados.length > 1) {
    return porConfirmar("Más de un transportista cubre ese destino — hace falta indicar cuál");
  }

  const opcion = filtrados[0];

  return {
    // Los requisitos viajan en la opción ya resuelta — misma fuente que vio el
    // agente al cotizar con consultar_opciones_envio, sin una query extra.
    camposFaltantes: camposRequeridosFaltantes(opcion, base),
    datos: {
      ...base,
      // El tipo de transportista usa el mismo enum que MetodoEntrega (ver
      // form-entrega.tsx) — el método se deriva del transportista elegido,
      // nunca de lo que el modelo haya supuesto.
      metodoEntrega: opcion.transportistaTipo as MetodoEntregaIA,
      transportistaId: opcion.transportistaId,
      zonaEntregaId: opcion.zonaEntregaId,
      servicioTransportistaId: opcion.servicioTransportistaId,
      tarifaTransportistaZonaId: opcion.tarifaId,
      costoInternoEnvio: opcion.costoInterno,
      costoEnvioConfirmado: true,
    },
    costoEnvio: opcion.precioCliente,
    confirmado: true,
    transportistaNombre: opcion.transportistaNombre,
    servicioNombre: opcion.servicioNombre,
    motivoSinConfirmar: null,
  };
}

/**
 * Resumen de la entrega para el `data` que vuelve al agente. Campo por campo
 * (nunca spread de `datos`) para que costoInternoEnvio y los IDs internos
 * nunca lleguen al modelo — mismo criterio que consultar_opciones_envio (FR-009).
 */
export function describirEntrega(entrega: EntregaResueltaIA, moneda: string): Record<string, unknown> {
  return {
    entrega: {
      metodoEntrega: entrega.datos.metodoEntrega,
      nombreDestinatario: entrega.datos.nombreDestinatario,
      transportista: entrega.transportistaNombre,
      servicio: entrega.servicioNombre,
      costoEnvio: entrega.costoEnvio,
      costoEnvioConfirmado: entrega.confirmado,
    },
    ...(entrega.confirmado
      ? {}
      : {
          avisoEntrega: `${entrega.motivoSinConfirmar}. El documento quedó con el destino registrado y el costo de entrega por confirmar (${moneda} 0.00): no informes un costo de envío al cliente y avisale que un asesor se lo confirma.`,
        }),
    // El documento se creó, pero no se puede aprobar sin estos datos: se le
    // dice al agente exactamente qué pedir en la conversación.
    ...(entrega.camposFaltantes.length > 0
      ? {
          datosPendientes: entrega.camposFaltantes,
          avisoDatosPendientes: `${describirCamposFaltantes(entrega.camposFaltantes, entrega.transportistaNombre)} para poder entregar. Pedíselos al cliente en la conversación: sin eso, el documento no se puede aprobar.`,
        }
      : {}),
  };
}

/** Bloque `entrega` del input_schema — idéntico en crear_cotizacion y crear_pedido. */
export const ENTREGA_INPUT_SCHEMA = {
  type: "object",
  description:
    "Método de entrega del documento. Completalo con los mismos valores que devolvió consultar_opciones_envio (nombres, nunca IDs): el servidor vuelve a resolver el destino y asigna transportista, zona, tarifa y costo. Si no lo mandás, el documento queda sin entrega y un humano tiene que cargarla a mano. Algunos transportistas exigen además direccionEntrega y/o identificacion: consultar_opciones_envio te dice cuáles en `requiere`.",
  properties: {
    metodoEntrega: {
      type: "string",
      enum: [...METODOS_ENTREGA_VALIDOS],
      description:
        "Opcional para envíos con transportista (se deriva del transportista elegido). Obligatorio para RETIRO_TIENDA, DIGITAL o INSTALACION_SERVICIO, que no llevan transportista ni costo de envío.",
    },
    pais: { type: "string", description: "Nombre del país — opcional si el negocio opera en un solo país" },
    estadoProvincia: { type: "string", description: "Estado/provincia de destino" },
    distritoCiudad: { type: "string", description: "Distrito/ciudad de destino" },
    corregimiento: { type: "string", description: "Corregimiento de destino (opcional)" },
    sectorOCodigoPostal: { type: "string", description: "Sector o código postal (opcional)" },
    transportista: {
      type: "string",
      description: "Nombre del transportista tal como lo devolvió consultar_opciones_envio — necesario si más de uno cubre el destino",
    },
    servicio: { type: "string", description: "Nombre del servicio del transportista tal como lo devolvió consultar_opciones_envio" },
    nombreDestinatario: {
      type: "string",
      description:
        "Opcional — nombre de quien recibe el envío, si el cliente indicó que lo recibe otra persona (un familiar, recepción, el encargado del local). No lo completes con el nombre del cliente.",
    },
    direccionEntrega: {
      type: "string",
      description:
        "Dirección exacta de entrega (calle, número, edificio, referencias). Solo la exigen algunos transportistas — consultar_opciones_envio lo indica en `requiere`. Es distinta del distrito/ciudad: esto es la puerta a la que se entrega.",
    },
    identificacion: {
      type: "string",
      description:
        "Identificación de quien recibe (cédula, pasaporte o RUC, según el país). Solo la exigen algunos transportistas — consultar_opciones_envio lo indica en `requiere`. Texto libre, copiá tal cual lo que dio el cliente.",
    },
    observaciones: { type: "string", description: "Notas de entrega (referencias de dirección, horarios, etc.)" },
  },
  required: [],
} as const;
