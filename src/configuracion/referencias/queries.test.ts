import { describe, expect, it, vi, beforeEach } from "vitest";

const plantillaFindManyMock = vi.fn();
const usuarioInstanciaFindManyMock = vi.fn();
const productoFindManyMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    plantillaCRM: { findMany: (...a: unknown[]) => plantillaFindManyMock(...a) },
    usuarioInstancia: { findMany: (...a: unknown[]) => usuarioInstanciaFindManyMock(...a) },
    producto: { findMany: (...a: unknown[]) => productoFindManyMock(...a) },
  },
}));

const { resolverReferencias, buscarOpcionesReferencia } = await import("./queries");
const { extraerReferencias } = await import("./parser");

const PLANTILLA = {
  nombre: "Métodos de envío",
  alias: "metodos_envios",
  descripcion: "Cómo y cuánto cobramos el envío",
  contenidoTexto: "Hacemos envíos a todo el país con Uno Express.",
  imagenUrl: null,
};

const USUARIO = {
  rol: "AGENTE_VENTAS",
  usuario: { nombre: "María López", email: "maria@empresa.com", cargo: "Encargada de envíos" },
};

const PRODUCTO = {
  nombre: "Teclado K380",
  sku: "K380",
  descripcion: "Bluetooth, multidispositivo",
  precio: 45,
  moneda: "PAB",
  unidad: "unidad",
  categoria: "Periféricos",
};

beforeEach(() => {
  plantillaFindManyMock.mockReset().mockResolvedValue([PLANTILLA]);
  usuarioInstanciaFindManyMock.mockReset().mockResolvedValue([USUARIO]);
  productoFindManyMock.mockReset().mockResolvedValue([PRODUCTO]);
});

describe("resolverReferencias", () => {
  it("resuelve una plantilla por su alias", async () => {
    const r = await resolverReferencias("inst-1", extraerReferencias("@plantilla:metodos_envios"));

    const resuelta = r.get("plantilla:metodos_envios")!;
    expect(resuelta.etiqueta).toBe("Plantilla · Métodos de envío");
    expect(resuelta.contenido).toContain("Uno Express");
  });

  it("resuelve usuario y producto por el slug de su nombre", async () => {
    const r = await resolverReferencias(
      "inst-1",
      extraerReferencias("@usuario:maria-lopez y @producto:teclado-k380"),
    );

    expect(r.get("usuario:maria-lopez")?.etiqueta).toBe("Usuario · María López");
    expect(r.get("producto:teclado-k380")?.contenido).toContain("PAB 45.00");
  });

  it("no expone email ni teléfono del equipo — el agente le habla al cliente", async () => {
    const r = await resolverReferencias("inst-1", extraerReferencias("@usuario:maria-lopez"));

    expect(r.get("usuario:maria-lopez")!.contenido).not.toContain("maria@empresa.com");
  });

  it("clave inexistente queda sin resolver", async () => {
    const r = await resolverReferencias("inst-1", extraerReferencias("@plantilla:no_existe"));
    expect(r.size).toBe(0);
  });

  it("dos productos con el mismo nombre quedan sin resolver — nunca adivina cuál", async () => {
    productoFindManyMock.mockResolvedValue([PRODUCTO, { ...PRODUCTO, sku: "K380-B", precio: 50 }]);

    const r = await resolverReferencias("inst-1", extraerReferencias("@producto:teclado-k380"));
    expect(r.size).toBe(0);
  });

  it("consulta una vez por tipo, no una vez por referencia", async () => {
    plantillaFindManyMock.mockResolvedValue([
      PLANTILLA,
      { ...PLANTILLA, nombre: "Pagos", alias: "pagos" },
      { ...PLANTILLA, nombre: "Horarios", alias: "horarios" },
    ]);

    await resolverReferencias(
      "inst-1",
      extraerReferencias("@plantilla:metodos_envios @plantilla:pagos @plantilla:horarios"),
    );

    expect(plantillaFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("no consulta los tipos que no aparecen en el texto", async () => {
    await resolverReferencias("inst-1", extraerReferencias("@plantilla:metodos_envios"));

    expect(plantillaFindManyMock).toHaveBeenCalledTimes(1);
    expect(usuarioInstanciaFindManyMock).not.toHaveBeenCalled();
    expect(productoFindManyMock).not.toHaveBeenCalled();
  });

  it("filtra por instanciaId y solo registros activos", async () => {
    await resolverReferencias("inst-1", extraerReferencias("@plantilla:metodos_envios"));

    expect(plantillaFindManyMock.mock.calls[0][0].where).toMatchObject({
      instanciaId: "inst-1",
      activo: true,
    });
  });

  it("sin referencias no toca la base", async () => {
    const r = await resolverReferencias("inst-1", []);

    expect(r.size).toBe(0);
    expect(plantillaFindManyMock).not.toHaveBeenCalled();
  });
});

describe("buscarOpcionesReferencia", () => {
  it("sin consulta devuelve los tres tipos", async () => {
    const opciones = await buscarOpcionesReferencia("inst-1", "");
    expect(opciones.map((o) => o.tipo).sort()).toEqual(["plantilla", "producto", "usuario"]);
  });

  it("busca en los tres tipos a la vez, con las plantillas primero", async () => {
    // "envío" aparece en el nombre de la plantilla y en el cargo de María.
    const opciones = await buscarOpcionesReferencia("inst-1", "envío");

    expect(opciones.map((o) => o.token)).toEqual(["@plantilla:metodos_envios", "@usuario:maria-lopez"]);
  });

  it("descarta lo que no coincide", async () => {
    const opciones = await buscarOpcionesReferencia("inst-1", "teclado");
    expect(opciones.map((o) => o.token)).toEqual(["@producto:teclado-k380"]);
  });

  it("encuentra al usuario por su cargo", async () => {
    const opciones = await buscarOpcionesReferencia("inst-1", "encargada");
    expect(opciones[0].token).toBe("@usuario:maria-lopez");
  });

  it("no ofrece una clave ambigua: llevaría a un token que después no resuelve", async () => {
    productoFindManyMock.mockResolvedValue([PRODUCTO, { ...PRODUCTO, sku: "K380-B" }]);

    const opciones = await buscarOpcionesReferencia("inst-1", "teclado");
    expect(opciones).toHaveLength(0);
  });
});
