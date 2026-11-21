import { describe, it, expect, vi, beforeEach } from "vitest";

const aggregate = vi.fn(async (..._a: unknown[]) => ({ _sum: { segundos: 0 } }));

vi.mock("@/shared/db/prisma", () => ({
  prisma: { usoVoz: { aggregate: (...a: unknown[]) => aggregate(...a) } },
}));

const obtenerZonaNegocio = vi.fn(async (..._a: unknown[]) => "America/Lima");
vi.mock("@/shared/fechas/negocio", () => ({
  obtenerZonaNegocio: (...a: unknown[]) => obtenerZonaNegocio(...a),
}));

const { verificarLimiteDiario, registrarConsumoLocal, resetCacheLimites } =
  await import("./limites");

beforeEach(() => {
  vi.clearAllMocks();
  resetCacheLimites();
  aggregate.mockResolvedValue({ _sum: { segundos: 0 } });
});

describe("verificarLimiteDiario", () => {
  it("sin tope configurado no consulta siquiera el consumo", async () => {
    const r = await verificarLimiteDiario("i1", null);

    expect(r.permitido).toBe(true);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("un tope de 0 o negativo se trata como 'sin tope', no como 'todo bloqueado'", async () => {
    await expect(verificarLimiteDiario("i1", 0)).resolves.toMatchObject({ permitido: true });
    await expect(verificarLimiteDiario("i1", -5)).resolves.toMatchObject({ permitido: true });
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("permite mientras el consumo esté por debajo del tope", async () => {
    aggregate.mockResolvedValue({ _sum: { segundos: 540 } }); // 9 min

    const r = await verificarLimiteDiario("i1", 10);

    expect(r.permitido).toBe(true);
  });

  it("corta al alcanzar el tope, informando consumo y límite", async () => {
    aggregate.mockResolvedValue({ _sum: { segundos: 600 } }); // 10 min exactos

    const r = await verificarLimiteDiario("i1", 10);

    expect(r).toMatchObject({ permitido: false, motivo: "LIMITE_MINUTOS_DIA", limite: 10 });
  });

  it("el corte del día usa la zona del NEGOCIO, no la del servidor", async () => {
    // Si usara la del servidor, el tope se reiniciaría a una hora que al
    // comercio no le dice nada (regla 7 de CLAUDE.md).
    aggregate.mockResolvedValue({ _sum: { segundos: 60 } });

    await verificarLimiteDiario("i1", 10);

    expect(obtenerZonaNegocio).toHaveBeenCalledWith("i1");
  });

  it("cachea el consumo: no agrega una vez por audio", async () => {
    aggregate.mockResolvedValue({ _sum: { segundos: 60 } });

    await verificarLimiteDiario("i1", 10);
    await verificarLimiteDiario("i1", 10);
    await verificarLimiteDiario("i1", 10);

    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it("la suma local evita que un lote entero pase el tope con el valor cacheado", async () => {
    aggregate.mockResolvedValue({ _sum: { segundos: 540 } }); // 9 de 10 min

    await expect(verificarLimiteDiario("i1", 10)).resolves.toMatchObject({ permitido: true });

    // Un audio de 2 minutos en ese mismo lote cruza el tope.
    registrarConsumoLocal("i1", 120);

    await expect(verificarLimiteDiario("i1", 10)).resolves.toMatchObject({ permitido: false });
    // Y sin volver a consultar la base.
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it("el tope es por instancia: una cuenta no consume el de otra", async () => {
    aggregate.mockResolvedValue({ _sum: { segundos: 600 } });

    await verificarLimiteDiario("i1", 10);
    registrarConsumoLocal("i1", 600);

    aggregate.mockResolvedValue({ _sum: { segundos: 0 } });
    const otra = await verificarLimiteDiario("i2", 10);

    expect(otra.permitido).toBe(true);
  });
});
