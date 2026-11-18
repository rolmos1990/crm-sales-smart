import { describe, expect, it } from "vitest";

import type { EtapaParaKpis } from "@/sales/pedidos/condicion-venta";
import {
  ESTADOS_SEGUIMIENTO,
  TRAMOS,
  condicionCliente,
  condicionInteresado,
  condicionLead,
  condicionSegmento,
  condicionSeguimiento,
  condicionTipo,
  condicionTramo,
} from "./condiciones";
import { UMBRALES_SEGUIMIENTO_DEFECTO, calcularCortes, filtroUltimaActividad } from "./cortes";
import { cumple } from "./evaluar-where.test-util";
import { calcularSeguimientoFila } from "./recomendacion";

// 041 — Las reglas comerciales de Contactos son árboles `where` puros. Se
// evalúan acá contra filas en memoria con lógica de tres valores de SQL, de
// modo que la trampa de NULL bajo NOT falla igual que fallaría en PostgreSQL.

const ZONA = "America/Panama"; // UTC-5 todo el año
const AHORA = new Date("2026-11-18T15:00:00Z"); // 10:00 en Panamá
const CORTES = calcularCortes(ZONA, UMBRALES_SEGUIMIENTO_DEFECTO, AHORA);
const DIA = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => new Date(AHORA.getTime() - n * DIA);

type Fila = Record<string, unknown>;

function contacto(p: Partial<Fila> = {}): Fila {
  return {
    creadoEn: haceDias(400),
    ultimaInteraccionEn: null,
    esperandoRespuestaDesde: null,
    nivelInteres: "SIN_EVALUAR",
    nivelInteresFijado: false,
    noContactarDesde: null,
    pedidos: [],
    oportunidades: [],
    cotizaciones: [],
    actividades: [],
    ...p,
  };
}

const oportunidadAbierta = { oportunidad: { fechaGanada: null, fechaPerdida: null } };

function etapa(id: string, flags: Partial<Omit<EtapaParaKpis, "id">> = {}): EtapaParaKpis {
  return { id, esFinal: false, esCancelacion: false, cuentaComoVenta: false, ...flags };
}
const FLUJO: EtapaParaKpis[] = [
  etapa("nuevo"),
  etapa("entregado", { esFinal: true, cuentaComoVenta: true }),
  etapa("cancelado", { esCancelacion: true }),
];

describe("Cliente (derivado de cuentaComoVenta)", () => {
  it("un pedido en una etapa que no cuenta no hace cliente", () => {
    const c = contacto({ pedidos: [{ estado: "PENDIENTE", flujoVentaEtapaId: "nuevo" }] });
    expect(cumple(condicionCliente(FLUJO), c)).toBe(false);
  });

  it("un pedido en una etapa que cuenta sí", () => {
    const c = contacto({ pedidos: [{ estado: "PENDIENTE", flujoVentaEtapaId: "entregado" }] });
    expect(cumple(condicionCliente(FLUJO), c)).toBe(true);
  });

  it("un pedido cancelado no hace cliente", () => {
    const c = contacto({ pedidos: [{ estado: "CANCELADO", flujoVentaEtapaId: "cancelado" }] });
    expect(cumple(condicionCliente(FLUJO), c)).toBe(false);
  });

  it("flujo dinámico sin ninguna etapa marcada: nadie es cliente (no 'todos')", () => {
    const sinMarcar = FLUJO.map((e) => ({ ...e, cuentaComoVenta: false }));
    const c = contacto({ pedidos: [{ estado: "ENTREGADO", flujoVentaEtapaId: "entregado" }] });
    expect(cumple(condicionCliente(sinMarcar), c)).toBe(false);
  });

  it("sin flujo dinámico cae al estado clásico ENTREGADO", () => {
    expect(cumple(condicionCliente([]), contacto({ pedidos: [{ estado: "ENTREGADO", flujoVentaEtapaId: null }] }))).toBe(true);
    expect(cumple(condicionCliente([]), contacto({ pedidos: [{ estado: "PENDIENTE", flujoVentaEtapaId: null }] }))).toBe(false);
  });
});

describe("Interesado y Lead", () => {
  it("interés Alto o Medio es Interesado", () => {
    expect(cumple(condicionInteresado(), contacto({ nivelInteres: "ALTO" }))).toBe(true);
    expect(cumple(condicionInteresado(), contacto({ nivelInteres: "MEDIO" }))).toBe(true);
  });

  it("una oportunidad abierta o una cotización activa lo hacen Interesado", () => {
    expect(cumple(condicionInteresado(), contacto({ oportunidades: [oportunidadAbierta] }))).toBe(true);
    expect(cumple(condicionInteresado(), contacto({ cotizaciones: [{ estado: "ENVIADA" }] }))).toBe(true);
    expect(cumple(condicionInteresado(), contacto({ cotizaciones: [{ estado: "RECHAZADA" }] }))).toBe(false);
    const ganada = { oportunidad: { fechaGanada: haceDias(3), fechaPerdida: null } };
    expect(cumple(condicionInteresado(), contacto({ oportunidades: [ganada] }))).toBe(false);
  });

  it("Bajo FIJADO a mano anula la señal objetiva; Bajo no fijado no", () => {
    const fijado = contacto({ nivelInteres: "BAJO", nivelInteresFijado: true, oportunidades: [oportunidadAbierta] });
    const noFijado = contacto({ nivelInteres: "BAJO", nivelInteresFijado: false, oportunidades: [oportunidadAbierta] });
    expect(cumple(condicionInteresado(), fijado)).toBe(false);
    expect(cumple(condicionInteresado(), noFijado)).toBe(true);
  });

  it("un cliente con interés Alto es Cliente e Interesado; su tipo principal es Cliente", () => {
    const c = contacto({ nivelInteres: "ALTO", pedidos: [{ estado: "X", flujoVentaEtapaId: "entregado" }] });
    expect(cumple(condicionCliente(FLUJO), c)).toBe(true);
    expect(cumple(condicionInteresado(), c)).toBe(true);
    expect(cumple(condicionTipo("CLIENTE", FLUJO), c)).toBe(true);
    expect(cumple(condicionTipo("INTERESADO", FLUJO), c)).toBe(false);
    expect(cumple(condicionLead(FLUJO), c)).toBe(false);
  });

  it("sin compras ni señales ni interés es Lead", () => {
    expect(cumple(condicionLead(FLUJO), contacto())).toBe(true);
  });
});

describe("Seguimiento con umbrales por defecto (3 / 7 / 60)", () => {
  const interesado = { nivelInteres: "ALTO" };

  const casos: Array<[string, Fila, string]> = [
    ["Interesado, 2 días", contacto({ ...interesado, ultimaInteraccionEn: haceDias(2) }), "AL_DIA"],
    ["Interesado, 4 días", contacto({ ...interesado, ultimaInteraccionEn: haceDias(4) }), "PENDIENTE"],
    ["Interesado, 9 días", contacto({ ...interesado, ultimaInteraccionEn: haceDias(9) }), "POR_RECUPERAR"],
    [
      "Interesado, 9 días con actividad futura",
      contacto({ ...interesado, ultimaInteraccionEn: haceDias(9), actividades: [{ completada: false, fecha: haceDias(-2) }] }),
      "AL_DIA",
    ],
    [
      "Actividad vencida",
      contacto({ ultimaInteraccionEn: haceDias(1), actividades: [{ completada: false, fecha: haceDias(1) }] }),
      "PENDIENTE",
    ],
    [
      "Mensaje sin responder, aunque sea de hace mucho",
      contacto({ ultimaInteraccionEn: haceDias(100), esperandoRespuestaDesde: haceDias(100) }),
      "PENDIENTE",
    ],
    ["Lead sin señales, 70 días", contacto({ ultimaInteraccionEn: haceDias(70) }), "INACTIVO"],
    ["Lead sin señales, 9 días", contacto({ ultimaInteraccionEn: haceDias(9) }), "AL_DIA"],
    [
      "Interesado No contactar, 9 días",
      contacto({ ...interesado, ultimaInteraccionEn: haceDias(9), noContactarDesde: haceDias(1) }),
      "AL_DIA",
    ],
    ["Sin interacción: usa creadoEn (70 días)", contacto({ creadoEn: haceDias(70) }), "INACTIVO"],
    ["Interesado sin interacción, creado hace 9 días", contacto({ ...interesado, creadoEn: haceDias(9) }), "POR_RECUPERAR"],
  ];

  it.each(casos)("%s → %s", (_n, fila, esperado) => {
    const coincidencias = ESTADOS_SEGUIMIENTO.filter((e) => cumple(condicionSeguimiento(e, CORTES), fila));
    expect(coincidencias).toEqual([esperado]);
  });

  it("el borde exacto del corte cae del lado 'más reciente'", () => {
    const enElCorte = contacto({ nivelInteres: "ALTO", ultimaInteraccionEn: CORTES.recuperar });
    const unMsAntes = contacto({ nivelInteres: "ALTO", ultimaInteraccionEn: new Date(CORTES.recuperar.getTime() - 1) });
    expect(cumple(condicionSeguimiento("PENDIENTE", CORTES), enElCorte)).toBe(true);
    expect(cumple(condicionSeguimiento("POR_RECUPERAR", CORTES), unMsAntes)).toBe(true);
  });
});

describe("Coherencia entre las condiciones de base y el cálculo por fila", () => {
  // Matriz amplia: para cada fila, exactamente un estado y un tramo deben
  // cumplirse en la base, y el estado debe coincidir con el cálculo en memoria.
  const referencias: Array<Date | null> = [null, ...[0, 2, 3, 4, 6, 7, 8, 9, 59, 60, 61, 70].map(haceDias)];
  const interes: Fila[] = [
    { nivelInteres: "ALTO" },
    { nivelInteres: "BAJO", nivelInteresFijado: true, oportunidades: [oportunidadAbierta] },
    { nivelInteres: "SIN_EVALUAR" },
    { nivelInteres: "SIN_EVALUAR", cotizaciones: [{ estado: "BORRADOR" }] },
  ];
  const filas: Fila[] = [];
  for (const ref of referencias)
    for (const i of interes)
      for (const esperando of [false, true])
        for (const vencida of [false, true])
          for (const vigente of [false, true])
            for (const noContactar of [false, true]) {
              const actividades = [
                ...(vencida ? [{ completada: false, fecha: haceDias(1) }] : []),
                ...(vigente ? [{ completada: false, fecha: haceDias(-1) }] : []),
                { completada: true, fecha: haceDias(1) },
              ];
              filas.push(
                contacto({
                  ...i,
                  creadoEn: haceDias(30),
                  ultimaInteraccionEn: ref,
                  esperandoRespuestaDesde: esperando ? haceDias(5) : null,
                  noContactarDesde: noContactar ? haceDias(2) : null,
                  actividades,
                }),
              );
            }

  it(`cubre ${filas.length} filas sin huecos ni solapamientos`, () => {
    for (const fila of filas) {
      const estados = ESTADOS_SEGUIMIENTO.filter((e) => cumple(condicionSeguimiento(e, CORTES), fila));
      expect(estados).toHaveLength(1);

      const tramos = TRAMOS.filter((t) => cumple(condicionTramo(t, CORTES), fila));
      expect(tramos).toHaveLength(1);

      const enMemoria = calcularSeguimientoFila(
        {
          ultimaInteraccionEn: fila.ultimaInteraccionEn as Date | null,
          creadoEn: fila.creadoEn as Date,
          esperandoRespuesta: fila.esperandoRespuestaDesde !== null,
          tieneActividadVencida: (fila.actividades as Fila[]).some((a) => !a.completada && (a.fecha as Date) < AHORA),
          tieneActividadVigente: (fila.actividades as Fila[]).some((a) => !a.completada && (a.fecha as Date) >= AHORA),
          esInteresado: cumple(condicionInteresado(), fila),
          noContactar: fila.noContactarDesde !== null,
        },
        CORTES,
      );
      expect(enMemoria).toBe(estados[0]);
    }
  });

  it("los segmentos Clientes / Interesados / Leads cubren a todos; Clientes e Interesados se solapan", () => {
    const cliente = contacto({ nivelInteres: "ALTO", pedidos: [{ estado: "X", flujoVentaEtapaId: "entregado" }] });
    expect(cumple(condicionSegmento("CLIENTES", FLUJO, CORTES), cliente)).toBe(true);
    expect(cumple(condicionSegmento("INTERESADOS", FLUJO, CORTES), cliente)).toBe(true);
    expect(cumple(condicionSegmento("LEADS", FLUJO, CORTES), cliente)).toBe(false);
    for (const fila of filas) {
      const enAlguno = ["CLIENTES", "INTERESADOS", "LEADS"].some((s) =>
        cumple(condicionSegmento(s as "CLIENTES", FLUJO, CORTES), fila),
      );
      expect(enAlguno).toBe(true);
    }
  });
});

describe("Rangos de última actividad", () => {
  it("Hoy empieza a medianoche de la zona del negocio", () => {
    expect(filtroUltimaActividad("HOY", ZONA, AHORA)).toEqual({ gte: new Date("2026-11-18T05:00:00Z") });
  });
  it("Últimos 7 días incluye hoy", () => {
    expect(filtroUltimaActividad("ULTIMOS_7", ZONA, AHORA)).toEqual({ gte: new Date("2026-11-12T05:00:00Z") });
  });
  it("Más de 30 es el complemento exacto de Últimos 30", () => {
    expect(filtroUltimaActividad("MAS_DE_30", ZONA, AHORA)).toEqual({ lt: new Date("2026-10-20T05:00:00Z") });
    expect(filtroUltimaActividad("ULTIMOS_30", ZONA, AHORA)).toEqual({ gte: new Date("2026-10-20T05:00:00Z") });
  });
});
