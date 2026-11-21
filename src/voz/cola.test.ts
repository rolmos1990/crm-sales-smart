import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * La semántica fina de la cola (SKIP LOCKED, el lease, el EXISTS de alcance)
 * vive en SQL y se prueba contra PostgreSQL con el quickstart. Acá se prueba
 * lo que decide TypeScript, más que el SQL contenga las cláusulas que no
 * pueden faltar.
 */

const executeRaw = vi.fn(async (..._a: unknown[]) => 1);
const queryRaw = vi.fn(async (..._a: unknown[]) => []);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));

const {
  calcularBackoffMs,
  MAX_INTENTOS,
  marcarPendiente,
  marcarPendienteSinFallar,
  reclamarLote,
  devolverConBackoff,
  marcarNoAplica,
} = await import("./cola");

type MockLaxo = { mock: { calls: unknown[][] } };

/** Junta el SQL del último template etiquetado, con sus valores. */
function ultimoSql(mock: MockLaxo): string {
  const call = mock.mock.calls.at(-1);
  if (!call) return "";
  return call.flat().map(String).join(" ");
}

/** Valores interpolados en el último template, para asertar el scope. */
function ultimosValores(mock: MockLaxo): unknown[] {
  return (mock.mock.calls.at(-1) ?? []).flat();
}

beforeEach(() => vi.clearAllMocks());

describe("calcularBackoffMs", () => {
  it("crece exponencialmente desde 30 s", () => {
    expect(calcularBackoffMs(0, 0.5)).toBe(30_000);
    expect(calcularBackoffMs(1, 0.5)).toBe(60_000);
    expect(calcularBackoffMs(2, 0.5)).toBe(120_000);
    expect(calcularBackoffMs(3, 0.5)).toBe(240_000);
  });

  it("topea en 30 minutos por muchos intentos que haya", () => {
    expect(calcularBackoffMs(10, 0.5)).toBe(30 * 60 * 1000);
    expect(calcularBackoffMs(100, 0.5)).toBe(30 * 60 * 1000);
  });

  it("aplica jitter entre 0,8 y 1,2 — para que una caída no devuelva todo a la vez", () => {
    expect(calcularBackoffMs(0, 0)).toBe(24_000);
    expect(calcularBackoffMs(0, 1)).toBe(36_000);
  });

  it("intentos negativos no rompen la fórmula", () => {
    expect(calcularBackoffMs(-5, 0.5)).toBe(30_000);
  });

  it("MAX_INTENTOS acota el gasto de un fallo persistente", () => {
    expect(MAX_INTENTOS).toBe(5);
  });
});

describe("marcarPendiente", () => {
  it("exige en SQL que el archivo lo referencie un mensaje AUDIO o NOTA_VOZ", async () => {
    await marcarPendiente({ instanciaId: "i1", mediaArchivoId: "ma1" });

    const sql = ultimoSql(executeRaw as unknown as MockLaxo);
    // Primer corte de alcance. Si esto desaparece, se encolan videos.
    expect(sql).toContain("AUDIO");
    expect(sql).toContain("NOTA_VOZ");
    expect(sql).toContain("EXISTS");
  });

  it("acota por instanciaId — garantía de tenant aunque el llamador se equivoque", async () => {
    await marcarPendiente({ instanciaId: "i1", mediaArchivoId: "ma1" });

    expect(ultimoSql(executeRaw as unknown as MockLaxo)).toContain("instanciaId");
    expect(ultimosValores(executeRaw as unknown as MockLaxo)).toContain("i1");
  });

  it("no pisa estados terminales: solo reabre desde NO_APLICA o ERROR", async () => {
    await marcarPendiente({ instanciaId: "i1", mediaArchivoId: "ma1" });

    const sql = ultimoSql(executeRaw as unknown as MockLaxo);
    expect(sql).toContain("NO_APLICA");
    expect(sql).toContain("ERROR");
    // INAUDIBLE y LISTO no están: volver a marcarlos sería pagar de nuevo.
    expect(sql).not.toContain("INAUDIBLE");
  });

  // 051 — El contador de intentos.
  it("NO reinicia los intentos por defecto", async () => {
    // Si este default quedara invertido, el tope de MAX_INTENTOS deja de
    // existir para todos los llamadores y nadie lo nota hasta que un proveedor
    // caído genera llamadas sin fin. No se borra.
    await marcarPendiente({ instanciaId: "i1", mediaArchivoId: "ma1" });

    expect(ultimosValores(executeRaw as unknown as MockLaxo)).toContain(false);
    expect(ultimosValores(executeRaw as unknown as MockLaxo)).not.toContain(true);
  });

  it("reinicia los intentos solo si se lo piden explícitamente", async () => {
    // Lo usa la recuperación de 051: los intentos previos fallaron por una
    // causa que ya no existe, y contarlos en contra dejaría al audio a un
    // tropiezo real de volver a ERROR.
    await marcarPendiente({ instanciaId: "i1", mediaArchivoId: "ma1", reiniciarIntentos: true });

    expect(ultimosValores(executeRaw as unknown as MockLaxo)).toContain(true);
  });

  it("el reinicio no afloja ninguna guardia", async () => {
    // Una sola sentencia para los dos casos; si alguien la partiera en dos
    // UPDATE, este test seguiría pasando para uno y fallando para el otro.
    for (const reiniciarIntentos of [false, true]) {
      await marcarPendiente({ instanciaId: "i1", mediaArchivoId: "ma1", reiniciarIntentos });

      const sql = ultimoSql(executeRaw as unknown as MockLaxo);
      expect(sql).toContain("AUDIO");
      expect(sql).toContain("NOTA_VOZ");
      expect(sql).toContain("instanciaId");
      expect(sql).toContain("NO_APLICA");
      expect(sql).not.toContain("INAUDIBLE");
      expect(ultimosValores(executeRaw as unknown as MockLaxo)).toContain("i1");
    }
  });
});

describe("marcarPendienteSinFallar", () => {
  it("se traga el error: encolar no puede tumbar la recepción del mensaje", async () => {
    executeRaw.mockRejectedValueOnce(new Error("base caída"));

    await expect(
      marcarPendienteSinFallar({ instanciaId: "i1", mediaArchivoId: "ma1" }),
    ).resolves.toBeUndefined();
  });
});

describe("reclamarLote", () => {
  it("usa FOR UPDATE SKIP LOCKED y toma el lease", async () => {
    await reclamarLote({ limite: 5, leaseMs: 180_000 });

    const sql = ultimoSql(queryRaw as unknown as MockLaxo);
    // Sin esto, dos workers tomarían el mismo audio y se facturaría dos veces.
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("PROCESANDO");
  });

  it("repite el filtro de alcance en el reclamo, no confía en el marcado", async () => {
    await reclamarLote({ limite: 5, leaseMs: 180_000 });

    const sql = ultimoSql(queryRaw as unknown as MockLaxo);
    expect(sql).toContain("AUDIO");
    expect(sql).toContain("NOTA_VOZ");
  });

  it("solo toma filas cuyo lease venció o nunca se tomó", async () => {
    await reclamarLote({ limite: 5, leaseMs: 180_000 });

    expect(ultimoSql(queryRaw as unknown as MockLaxo)).toContain("transcripcionBloqueadoHasta");
  });
});

describe("devolverConBackoff", () => {
  it("no hace nada con lista vacía", async () => {
    await devolverConBackoff([]);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("replica la fórmula del backoff en SQL para resolver el lote de una", async () => {
    await devolverConBackoff(["ma1", "ma2"]);

    const sql = ultimoSql(executeRaw as unknown as MockLaxo);
    expect(sql).toContain("make_interval");
    expect(sql).toContain("random()");
  });

  it("al llegar a MAX_INTENTOS la fila pasa a ERROR, no vuelve a PENDIENTE", async () => {
    await devolverConBackoff(["ma1"]);

    const sql = ultimoSql(executeRaw as unknown as MockLaxo);
    expect(sql).toContain("ERROR");
    expect(ultimosValores(executeRaw as unknown as MockLaxo)).toContain(MAX_INTENTOS);
  });
});

describe("marcarNoAplica", () => {
  it("saca la fila de la cola para que el barrido no la tome en bucle", async () => {
    await marcarNoAplica("ma1");

    expect(ultimoSql(executeRaw as unknown as MockLaxo)).toContain("NO_APLICA");
  });
});
