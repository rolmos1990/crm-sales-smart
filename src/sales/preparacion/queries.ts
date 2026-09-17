import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { asegurarFlujoPreparacion } from "./servicios/asegurar-flujo-preparacion";
import { asegurarPreparacionesPedidos } from "./servicios/asegurar-preparacion-pedido";
import { construirWhereEntrada, detectarEntradasInvalidas } from "./utils/entrada";
import {
  estaAtrasado,
  filtroAtrasados,
  filtroFechaEntrega,
  inicioDeHoyEnZona,
  resolverRango,
} from "./utils/rangos";
import { lineaCompleta, pedidoCompleto, totalizarAvance } from "./utils/avance";
import type {
  ColumnaTablero,
  ConfiguracionPreparacion,
  MovimientoPreparacion,
  ResumenProducto,
  Tablero,
  TarjetaPreparacion,
} from "./types";
import type { FiltrosTableroInput } from "./schema";

const SELECT_PEDIDO_TABLERO = {
  id: true,
  numero: true,
  fechaPedido: true,
  fechaEntrega: true,
  nombre: true,
  apellido: true,
  empresaNombre: true,
  contacto: { select: { nombre: true, apellido: true } },
  empresa: { select: { nombre: true } },
  flujoVentaEtapa: { select: { nombre: true, color: true } },
  preparacion: {
    select: {
      estadoId: true,
      iniciadaEn: true,
      completadaEn: true,
      notas: true,
      asignadaA: { select: { nombre: true } },
    },
  },
  lineas: {
    orderBy: { orden: "asc" as const },
    select: {
      id: true,
      descripcion: true,
      cantidad: true,
      cantidadPreparada: true,
      producto: { select: { id: true, nombre: true } },
    },
  },
} as const;

type PedidoTablero = Prisma.PedidoGetPayload<{ select: typeof SELECT_PEDIDO_TABLERO }>;

/** El cliente del pedido: contacto del CRM o, si no hay, el comprador
 *  registrado en las columnas del propio pedido (FR-021). */
function resolverCliente(p: PedidoTablero): string {
  if (p.contacto) return `${p.contacto.nombre} ${p.contacto.apellido}`.trim();
  const persona = [p.nombre, p.apellido].map((v) => v?.trim()).filter(Boolean).join(" ");
  return persona || p.empresa?.nombre || p.empresaNombre?.trim() || "—";
}

function aTarjeta(p: PedidoTablero, estadoIdFallback: string, zonaHoraria: string): TarjetaPreparacion {
  const lineas = p.lineas.map((l) => {
    const cantidad = Number(l.cantidad);
    const cantidadPreparada = Number(l.cantidadPreparada);
    return {
      id: l.id,
      descripcion: l.descripcion ?? l.producto?.nombre ?? "—",
      producto: l.producto,
      cantidad,
      cantidadPreparada,
      completa: lineaCompleta({ cantidad, cantidadPreparada }),
    };
  });
  const totales = totalizarAvance(lineas);

  return {
    pedidoId: p.id,
    numero: p.numero,
    cliente: resolverCliente(p),
    fechaPedido: p.fechaPedido,
    fechaEntrega: p.fechaEntrega,
    etapaVenta: p.flujoVentaEtapa,
    estadoPreparacionId: p.preparacion?.estadoId ?? estadoIdFallback,
    iniciadaEn: p.preparacion?.iniciadaEn ?? null,
    completadaEn: p.preparacion?.completadaEn ?? null,
    asignadaA: p.preparacion?.asignadaA?.nombre ?? null,
    notas: p.preparacion?.notas ?? null,
    lineas,
    totalUnidades: totales.unidadesRequeridas,
    totalProductos: lineas.length,
    avanceCompleto: pedidoCompleto(lineas),
    atrasado: estaAtrasado(p.fechaEntrega, zonaHoraria),
    sinFechaEntrega: p.fechaEntrega === null,
  };
}

/** Búsqueda por número de pedido, cliente (contacto o comprador) o producto. */
function condicionBusqueda(busqueda?: string): Prisma.PedidoWhereInput {
  const q = busqueda?.trim();
  if (!q) return {};
  return {
    OR: [
      { numero: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { apellido: { contains: q, mode: "insensitive" } },
      { empresaNombre: { contains: q, mode: "insensitive" } },
      { contacto: { is: { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { apellido: { contains: q, mode: "insensitive" } }] } } },
      { empresa: { is: { nombre: { contains: q, mode: "insensitive" } } } },
      { lineas: { some: { OR: [
        { descripcion: { contains: q, mode: "insensitive" } },
        { producto: { is: { nombre: { contains: q, mode: "insensitive" } } } },
      ] } } },
    ],
  };
}

export async function obtenerConfiguracionPreparacion(instanciaId: string): Promise<ConfiguracionPreparacion> {
  const flujo = await asegurarFlujoPreparacion(instanciaId);

  const [usoPorEstado, etapasDisponibles] = await Promise.all([
    prisma.preparacionPedido.groupBy({
      by: ["estadoId"],
      where: { estado: { flujoPreparacionId: flujo.id } },
      _count: { _all: true },
    }),
    prisma.flujoVentaEtapa.findMany({
      where: { activo: true, flujoVenta: { instanciaId, activo: true } },
      orderBy: { orden: "asc" },
      // `descripcion` y las marcas alimentan el subtítulo de cada tarjeta en
      // el panel de configuración, para que se entienda qué se está eligiendo
      // sin tener que abrir el flujo de venta en otra pestaña.
      select: { id: true, nombre: true, color: true, descripcion: true, esFinal: true, esCancelacion: true },
    }),
  ]);

  const uso = new Map(usoPorEstado.map((u) => [u.estadoId, u._count._all]));

  return {
    id: flujo.id,
    nombre: flujo.nombre,
    agrupacionDefecto: flujo.agrupacionDefecto,
    rangoDefecto: flujo.rangoDefecto,
    estados: flujo.estados.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      color: e.color,
      orden: e.orden,
      esInicial: e.esInicial,
      marcaInicio: e.marcaInicio,
      esFinal: e.esFinal,
      activo: e.activo,
      pedidosAsignados: uso.get(e.id) ?? 0,
    })),
    etapasEntrada: flujo.etapasEntrada.map((en) => ({
      etapaId: en.flujoVentaEtapaId,
      nombre: en.flujoVentaEtapa?.nombre ?? "(etapa eliminada)",
      color: en.flujoVentaEtapa?.color ?? null,
      activa: Boolean(en.flujoVentaEtapa?.activo),
    })),
    etapasDisponibles,
    entradasInvalidas: detectarEntradasInvalidas(flujo.etapasEntrada),
  };
}

export async function obtenerTableroPreparacion(
  instanciaId: string,
  zonaHoraria: string,
  filtros: FiltrosTableroInput,
): Promise<Tablero> {
  const configuracion = await obtenerConfiguracionPreparacion(instanciaId);

  // La base está en otra región: cada consulta cuesta ~200 ms de ida y vuelta,
  // así que lo que importa es la CANTIDAD de consultas, no su tamaño. De ahí
  // que acá se reutilice la configuración ya leída en vez de volver a pedir el
  // flujo, se unifiquen las tres listas de tarjetas en una sola consulta, y los
  // cinco contadores se calculen en memoria sobre una proyección liviana.
  const entradas = configuracion.etapasEntrada.map((e) => ({
    flujoVentaEtapaId: e.etapaId,
    flujoVentaEtapa: { id: e.etapaId, nombre: e.nombre, color: e.color, activo: e.activa },
  }));

  const whereEntrada = construirWhereEntrada(instanciaId, entradas);
  const busqueda = condicionBusqueda(filtros.busqueda);
  const rango = resolverRango(filtros.rango, zonaHoraria, { desde: filtros.desde, hasta: filtros.hasta });
  const filtroFecha = filtroFechaEntrega(rango);

  // Se compone con AND: tanto `whereEntrada` como la búsqueda pueden traer su
  // propio OR, y mezclarlos al mismo nivel se pisaría uno con el otro.
  const condiciones: Prisma.PedidoWhereInput[] = [whereEntrada];
  if (busqueda.OR) condiciones.push(busqueda);
  const whereBase: Prisma.PedidoWhereInput = { AND: condiciones };

  // Ni los pedidos sin fecha (FR-019) ni los atrasados se ocultan por el filtro
  // de rango. Los atrasados importan especialmente: los rangos miran hacia
  // adelante, así que un pedido abierto con entrega vencida no cae en ninguno y
  // quedaría invisible justo el que más urge — contradiciendo FR-007.
  const whereVisible: Prisma.PedidoWhereInput = filtroFecha
    ? {
        AND: [
          ...condiciones,
          {
            OR: [
              { fechaEntrega: filtroFecha },
              { fechaEntrega: null },
              { fechaEntrega: filtroAtrasados(zonaHoraria) },
            ],
          },
        ],
      }
    : whereBase;

  const [visibles, livianos] = await Promise.all([
    prisma.pedido.findMany({
      where: whereVisible,
      select: SELECT_PEDIDO_TABLERO,
      orderBy: [{ fechaEntrega: "asc" }, { creadoEn: "asc" }],
    }),
    // Proyección mínima de TODOS los pedidos del tablero, solo para contar.
    prisma.pedido.findMany({ where: whereBase, select: { id: true, fechaEntrega: true } }),
  ]);

  const contadores = contarEnMemoria(livianos, zonaHoraria);

  const estadoInicial = configuracion.estados.find((e) => e.esInicial) ?? configuracion.estados[0];
  const estadoIdFallback = estadoInicial?.id ?? "";

  // Materializa las preparaciones que falten. No hace falta releer después: una
  // tarjeta sin preparación cae por defecto en la columna inicial, que es
  // exactamente donde la acaba de poner la materialización.
  const faltantes = visibles.filter((p) => !p.preparacion).map((p) => p.id);
  if (faltantes.length > 0) {
    await asegurarPreparacionesPedidos(instanciaId, faltantes);
  }

  const tarjetas = visibles.map((p) => aTarjeta(p, estadoIdFallback, zonaHoraria));

  // Cada tarjeta va a su columna de estado, sin excepciones: las columnas son
  // estados. Un pedido sin fecha o atrasado se distingue por su marca en la
  // tarjeta, no sacándolo de su columna — si estuviera en un grupo aparte no se
  // podría arrastrar, y el usuario tiene que poder moverlo libremente.
  const columnas: ColumnaTablero[] = configuracion.estados
    .filter((e) => e.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((estado) => ({
      estado,
      tarjetas: tarjetas.filter((t) => t.estadoPreparacionId === estado.id),
    }));

  return {
    columnas,
    contadores,
    configuracion,
  };
}

/**
 * Contadores de las pestañas, calculados en memoria sobre la proyección
 * liviana. Antes eran cinco `count` contra la base: cinco viajes de ~200 ms
 * para contar como mucho un par de cientos de filas que ya se podían traer en
 * uno solo.
 *
 * Se calculan sobre los rangos fijos, no sobre el filtro activo, para que cada
 * pestaña muestre exactamente lo que anuncia.
 */
function contarEnMemoria(
  pedidos: Array<{ fechaEntrega: Date | null }>,
  zonaHoraria: string,
): { hoy: number; manana: number; semana: number; atrasados: number; sinFecha: number } {
  const hoyR = resolverRango('HOY', zonaHoraria);
  const mananaR = resolverRango('MANANA', zonaHoraria);
  const semanaR = resolverRango('SEMANA', zonaHoraria);
  const inicioHoy = inicioDeHoyEnZona(zonaHoraria);

  const contadores = { hoy: 0, manana: 0, semana: 0, atrasados: 0, sinFecha: 0 };
  const dentro = (f: Date, r: { desde: Date; hasta: Date } | null) => !!r && f >= r.desde && f < r.hasta;

  for (const p of pedidos) {
    const f = p.fechaEntrega;
    if (!f) { contadores.sinFecha++; continue; }
    if (f < inicioHoy) contadores.atrasados++;
    if (dentro(f, hoyR)) contadores.hoy++;
    if (dentro(f, mananaR)) contadores.manana++;
    if (dentro(f, semanaR)) contadores.semana++;
  }
  return contadores;
}

export async function obtenerResumenPorProducto(
  instanciaId: string,
  zonaHoraria: string,
  filtros: FiltrosTableroInput,
): Promise<ResumenProducto[]> {
  const flujo = await asegurarFlujoPreparacion(instanciaId);
  const whereEntrada = construirWhereEntrada(instanciaId, flujo.etapasEntrada);
  const rango = resolverRango(filtros.rango, zonaHoraria, { desde: filtros.desde, hasta: filtros.hasta });
  const filtroFecha = filtroFechaEntrega(rango);

  const lineas = await prisma.pedidoLinea.findMany({
    where: {
      pedido: {
        ...whereEntrada,
        ...condicionBusqueda(filtros.busqueda),
        // Mismo criterio que el tablero: el rango, más los sin fecha y los
        // atrasados, que también hay que preparar.
        ...(filtroFecha
          ? {
              OR: [
                { fechaEntrega: filtroFecha },
                { fechaEntrega: null },
                { fechaEntrega: filtroAtrasados(zonaHoraria) },
              ],
            }
          : {}),
      },
    },
    select: {
      cantidad: true,
      cantidadPreparada: true,
      descripcion: true,
      productoId: true,
      producto: { select: { nombre: true } },
    },
  });

  // Agrupa por producto del catálogo; las líneas sueltas, por su descripción.
  const acumulado = new Map<string, ResumenProducto>();
  for (const l of lineas) {
    const clave = l.productoId ?? `libre:${(l.descripcion ?? "—").trim().toLowerCase()}`;
    const actual = acumulado.get(clave) ?? {
      productoId: l.productoId,
      nombre: l.producto?.nombre ?? l.descripcion?.trim() ?? "—",
      unidadesRequeridas: 0,
      unidadesPreparadas: 0,
    };
    const cantidad = Number(l.cantidad);
    actual.unidadesRequeridas += cantidad;
    actual.unidadesPreparadas += Math.min(Number(l.cantidadPreparada), cantidad);
    acumulado.set(clave, actual);
  }

  return [...acumulado.values()].sort((a, b) => b.unidadesRequeridas - a.unidadesRequeridas);
}

export async function obtenerActividadReciente(
  instanciaId: string,
  limite = 10,
): Promise<MovimientoPreparacion[]> {
  const historial = await prisma.preparacionHistorial.findMany({
    where: { preparacion: { pedido: { instanciaId } } },
    orderBy: { creadoEn: "desc" },
    take: limite,
    select: {
      id: true,
      estadoNombre: true,
      estadoAnteriorNombre: true,
      tipo: true,
      usuarioNombre: true,
      creadoEn: true,
      estado: { select: { color: true } },
      preparacion: { select: { pedidoId: true, pedido: { select: { numero: true } } } },
    },
  });

  return historial.map((h) => ({
    id: h.id,
    pedidoId: h.preparacion.pedidoId,
    pedidoNumero: h.preparacion.pedido.numero,
    estadoAnteriorNombre: h.estadoAnteriorNombre,
    estadoNombre: h.estadoNombre,
    // La columna puede haberse borrado después del movimiento: el nombre
    // sobrevive por snapshot, el color no.
    estadoColor: h.estado?.color ?? null,
    tipo: h.tipo,
    usuarioNombre: h.usuarioNombre,
    creadoEn: h.creadoEn,
  }));
}
