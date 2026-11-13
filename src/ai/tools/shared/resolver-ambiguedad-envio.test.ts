import { describe, expect, it, vi, beforeEach } from "vitest";

// El caso real: "¿hacen envíos a Chiriquí?" terminaba en "lo confirma un
// compañero del equipo" aunque Chiriquí estuviera cubierta, solo porque el
// cliente no había dicho el distrito.

const listarCiudadesCubiertasMock = vi.fn();
const transferirAHumanoInternoMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/shared/entregas/resolver-costo-envio", () => ({
  listarCiudadesCubiertasPorProvincia: (...a: unknown[]) => listarCiudadesCubiertasMock(...a),
}));
vi.mock("@/ai/tools/shared/transferir-a-humano-interno", () => ({
  transferirAHumanoInterno: (...a: unknown[]) => transferirAHumanoInternoMock(...a),
}));

const { resolverSinCoincidenciaClara } = await import("./resolver-ambiguedad-envio");

const ctx = { instanciaId: "inst-1", conversacionId: "conv-1", herramientasPermitidas: [] };

const resolver = (destino: { estadoProvincia: string; ciudad?: string; pais?: string }) =>
  resolverSinCoincidenciaClara({
    ctx,
    destino,
    motivo: "motivo interno",
    mensajeEscalacion: "Transferido a un asesor.",
  });

beforeEach(() => {
  listarCiudadesCubiertasMock.mockReset().mockResolvedValue([]);
  transferirAHumanoInternoMock.mockClear();
});

describe("resolverSinCoincidenciaClara", () => {
  it("provincia cubierta por distritos: pide la ciudad en vez de escalar", async () => {
    listarCiudadesCubiertasMock.mockResolvedValue(["David", "Boquete", "Bugaba"]);

    const r = await resolver({ estadoProvincia: "Chiriquí" });
    const data = r.data as { requiereCiudad: boolean; ciudades: string[]; mensaje: string };

    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
    expect(data.requiereCiudad).toBe(true);
    expect(data.ciudades).toEqual(["David", "Boquete", "Bugaba"]);
    expect(data.mensaje).toContain("David, Boquete, Bugaba");
  });

  it("le dice al modelo explícitamente que no dé precio ni transfiera todavía", async () => {
    listarCiudadesCubiertasMock.mockResolvedValue(["David"]);

    const { mensaje } = (await resolver({ estadoProvincia: "Chiriquí" })).data as { mensaje: string };

    expect(mensaje).toContain("No des todavía un precio");
    expect(mensaje).toContain("no transfieras a un asesor");
  });

  it("sin ningún distrito cubierto sí escala — el comportamiento previo se mantiene", async () => {
    listarCiudadesCubiertasMock.mockResolvedValue([]);

    const r = await resolver({ estadoProvincia: "Marte" });

    expect(transferirAHumanoInternoMock).toHaveBeenCalledWith(ctx, "motivo interno");
    expect(r.data).toMatchObject({ transferidoAHumano: true, mensaje: "Transferido a un asesor." });
  });

  it("si el cliente YA dijo la ciudad, preguntar de nuevo no aporta: escala directo", async () => {
    const r = await resolver({ estadoProvincia: "Chiriquí", ciudad: "David" });

    expect(listarCiudadesCubiertasMock).not.toHaveBeenCalled();
    expect(transferirAHumanoInternoMock).toHaveBeenCalledOnce();
    expect((r.data as { transferidoAHumano: boolean }).transferidoAHumano).toBe(true);
  });

  it("consulta los distritos dentro de la instancia del contexto, no de los argumentos del modelo", async () => {
    listarCiudadesCubiertasMock.mockResolvedValue(["David"]);

    await resolver({ estadoProvincia: "Chiriquí", pais: "Panamá" });

    expect(listarCiudadesCubiertasMock).toHaveBeenCalledWith(
      expect.objectContaining({ instanciaId: "inst-1", estadoProvincia: "Chiriquí", pais: "Panamá" }),
    );
  });
});
