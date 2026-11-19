import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — El marcado para el análisis se simula: acá importa que se llame (o no) y que nunca rompa.
const marcar = vi.fn(async (..._a: unknown[]) => {});
vi.mock("./analisis/cola", () => ({ marcarPendienteSinFallar: (...a: unknown[]) => marcar(...a) }));

import { registrarInteraccion, registrarMensajeEntrante, registrarRespuesta } from "./interaccion";
import { cumple } from "./segmentacion/evaluar-where.test-util";

// 041 — Los hechos materializados del contacto se escriben con updateMany
// condicional. Se simula la tabla en memoria aplicando el mismo `where`.

type Fila = { id: string; ultimaInteraccionEn: Date | null; esperandoRespuestaDesde: Date | null };

function tablaFalsa(inicial: Fila) {
  const fila = { ...inicial };
  const db = {
    contacto: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Fila> }) => {
        if (!cumple(where, fila as unknown as Record<string, unknown>)) return { count: 0 };
        Object.assign(fila, data);
        return { count: 1 };
      },
    },
  };
  return { fila, db: db as unknown as Parameters<typeof registrarInteraccion>[2] };
}

const t = (iso: string) => new Date(iso);

describe("registrarInteraccion", () => {
  it("avanza la fecha", async () => {
    const { fila, db } = tablaFalsa({ id: "c", ultimaInteraccionEn: t("2026-11-01"), esperandoRespuestaDesde: null });
    await registrarInteraccion("c", t("2026-11-10"), db);
    expect(fila.ultimaInteraccionEn).toEqual(t("2026-11-10"));
  });

  it("no retrocede con un evento más viejo", async () => {
    const { fila, db } = tablaFalsa({ id: "c", ultimaInteraccionEn: t("2026-11-10"), esperandoRespuestaDesde: null });
    await registrarInteraccion("c", t("2026-11-01"), db);
    expect(fila.ultimaInteraccionEn).toEqual(t("2026-11-10"));
  });

  it("escribe la primera vez", async () => {
    const { fila, db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: null });
    await registrarInteraccion("c", t("2026-11-01"), db);
    expect(fila.ultimaInteraccionEn).toEqual(t("2026-11-01"));
  });
});

describe("espera de respuesta", () => {
  it("conserva el primer mensaje sin respuesta", async () => {
    const { fila, db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: null });
    await registrarMensajeEntrante("c", t("2026-11-01"), db);
    await registrarMensajeEntrante("c", t("2026-11-02"), db);
    expect(fila.esperandoRespuestaDesde).toEqual(t("2026-11-01"));
    expect(fila.ultimaInteraccionEn).toEqual(t("2026-11-02"));
  });

  it("una respuesta cierra la espera", async () => {
    const { fila, db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: t("2026-11-01") });
    await registrarRespuesta("c", db);
    expect(fila.esperandoRespuestaDesde).toBeNull();
  });
});

describe("marcado para el análisis (042)", () => {
  beforeEach(() => marcar.mockClear());

  it("una interacción con instanciaId marca el contacto P1", async () => {
    const { db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: null });
    await registrarInteraccion("c", t("2026-11-10"), db, "inst-1");
    expect(marcar).toHaveBeenCalledWith({ instanciaId: "inst-1", contactoId: "c", prioridad: "P1", motivo: "INTERACCION" });
  });

  it("un mensaje entrante marca con motivo MENSAJE", async () => {
    const { db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: null });
    await registrarMensajeEntrante("c", t("2026-11-10"), db, "inst-1");
    expect(marcar).toHaveBeenLastCalledWith(expect.objectContaining({ motivo: "MENSAJE", prioridad: "P1" }));
  });

  it("sin instanciaId no marca (no se agrega una consulta por mensaje)", async () => {
    const { db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: null });
    await registrarInteraccion("c", t("2026-11-10"), db);
    expect(marcar).not.toHaveBeenCalled();
  });

  it("un error al marcar no impide registrar la interacción", async () => {
    // marcarPendienteSinFallar nunca lanza; si lo hiciera igual quedaría escrita la fecha antes.
    marcar.mockRejectedValueOnce(new Error("caída"));
    const { fila, db } = tablaFalsa({ id: "c", ultimaInteraccionEn: null, esperandoRespuestaDesde: null });
    await registrarInteraccion("c", t("2026-11-10"), db, "inst-1").catch(() => {});
    expect(fila.ultimaInteraccionEn).toEqual(t("2026-11-10"));
  });
});
