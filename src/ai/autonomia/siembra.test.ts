import { describe, expect, it, vi, beforeEach } from "vitest";

const createManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { autonomiaIntencionConfig: { createMany: (...a: unknown[]) => createManyMock(...a) } },
}));

const { sembrarAutonomiaDefault } = await import("./siembra");

describe("sembrarAutonomiaDefault (016)", () => {
  beforeEach(() => createManyMock.mockReset());

  it("crea las 16 filas con skipDuplicates (idempotente)", async () => {
    await sembrarAutonomiaDefault("instancia-1", "agente-1");
    expect(createManyMock).toHaveBeenCalledTimes(1);
    const args = createManyMock.mock.calls[0][0];
    expect(args.data).toHaveLength(16);
    expect(args.skipDuplicates).toBe(true);
    expect(args.data.every((f: { instanciaId: string; agenteIAConfigId: string }) => f.instanciaId === "instancia-1" && f.agenteIAConfigId === "agente-1")).toBe(true);
  });
});
