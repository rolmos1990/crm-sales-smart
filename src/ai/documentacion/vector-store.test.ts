import { beforeEach, describe, expect, it, vi } from "vitest";

// 033 — Un vector store por instancia, creado la primera vez que la cuenta
// sube un documento.
//
// El caso que puede romper de verdad es la CARRERA: dos subidas simultáneas de
// la misma cuenta podrían crear dos stores y dejar la mitad de los documentos
// en un índice que después nadie consulta. Esos tests son el motivo de este
// archivo.

const crearStoreMock = vi.fn();
const borrarStoreMock = vi.fn();
const findUniqueMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("./cliente-openai", () => ({
  obtenerConfiguracionDocumentacion: () => configuracionActual,
}));

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    instancia: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      updateMany: (...a: unknown[]) => updateManyMock(...a),
    },
  },
}));

const INSTANCIA = "clzInstanciaA000000";

let configuracionActual: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  configuracionActual = {
    client: {
      vectorStores: { create: crearStoreMock, delete: borrarStoreMock },
    },
    modelo: "gpt-6-luna",
    costoInputPorMil: null,
    costoOutputPorMil: null,
  };
});

async function asegurar() {
  const { asegurarVectorStoreInstancia } = await import("./vector-store");
  return asegurarVectorStoreInstancia(INSTANCIA);
}

describe("asegurarVectorStoreInstancia", () => {
  it("devuelve el store existente sin crear otro", async () => {
    findUniqueMock.mockResolvedValue({ vectorStoreDocumentacionId: "vs_ya_existe" });

    expect(await asegurar()).toEqual({ ok: true, vectorStoreId: "vs_ya_existe" });
    expect(crearStoreMock).not.toHaveBeenCalled();
  });

  it("crea el store la primera vez, con el tenant en el nombre y en metadata", async () => {
    findUniqueMock.mockResolvedValue({ vectorStoreDocumentacionId: null });
    crearStoreMock.mockResolvedValue({ id: "vs_nuevo" });
    updateManyMock.mockResolvedValue({ count: 1 });

    expect(await asegurar()).toEqual({ ok: true, vectorStoreId: "vs_nuevo" });

    expect(crearStoreMock).toHaveBeenCalledWith({
      name: `karia-${INSTANCIA}`,
      metadata: { app: "karia", instanciaId: INSTANCIA },
    });
  });

  it("solo escribe el id si la cuenta no tenía uno — el UPDATE es condicional", async () => {
    findUniqueMock.mockResolvedValue({ vectorStoreDocumentacionId: null });
    crearStoreMock.mockResolvedValue({ id: "vs_nuevo" });
    updateManyMock.mockResolvedValue({ count: 1 });

    await asegurar();

    // Sin el `vectorStoreDocumentacionId: null` en el where, dos requests
    // simultáneos se pisarían y uno de los stores quedaría huérfano con
    // documentos adentro.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: INSTANCIA, vectorStoreDocumentacionId: null },
      data: { vectorStoreDocumentacionId: "vs_nuevo" },
    });
  });

  it("CARRERA: el que pierde borra su store y se queda con el del ganador", async () => {
    findUniqueMock
      .mockResolvedValueOnce({ vectorStoreDocumentacionId: null }) // al entrar: vacío
      .mockResolvedValueOnce({ vectorStoreDocumentacionId: "vs_del_ganador" }); // tras perder
    crearStoreMock.mockResolvedValue({ id: "vs_del_perdedor" });
    updateManyMock.mockResolvedValue({ count: 0 }); // otro request llegó primero
    borrarStoreMock.mockResolvedValue({});

    const resultado = await asegurar();

    // Se queda con el del ganador: si no, sus documentos irían a un índice
    // que ninguna búsqueda de esta cuenta va a consultar.
    expect(resultado).toEqual({ ok: true, vectorStoreId: "vs_del_ganador" });
    // Y limpia el suyo, que quedó vacío y facturando.
    expect(borrarStoreMock).toHaveBeenCalledWith("vs_del_perdedor");
  });

  it("si falla el borrado del store perdedor igual devuelve el del ganador", async () => {
    findUniqueMock
      .mockResolvedValueOnce({ vectorStoreDocumentacionId: null })
      .mockResolvedValueOnce({ vectorStoreDocumentacionId: "vs_del_ganador" });
    crearStoreMock.mockResolvedValue({ id: "vs_del_perdedor" });
    updateManyMock.mockResolvedValue({ count: 0 });
    borrarStoreMock.mockRejectedValue(new Error("500"));

    // Un store vacío huérfano cuesta storage; no poder subir el documento
    // cuesta la funcionalidad. Se prioriza seguir.
    expect(await asegurar()).toEqual({ ok: true, vectorStoreId: "vs_del_ganador" });
  });

  it("un fallo al crear el store no lanza: devuelve el motivo", async () => {
    findUniqueMock.mockResolvedValue({ vectorStoreDocumentacionId: null });
    crearStoreMock.mockRejectedValue(new Error("rate limit"));

    const resultado = await asegurar();

    expect(resultado.ok).toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("sin configuración no intenta crear nada", async () => {
    configuracionActual = null;

    expect(await asegurar()).toMatchObject({ ok: false });
    expect(crearStoreMock).not.toHaveBeenCalled();
  });
});
