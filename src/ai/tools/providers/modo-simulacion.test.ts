import { describe, expect, it, vi, beforeEach } from "vitest";

// 018-simulador-agente (Setup/Foundational) — con ctx.modoSimulacion: true,
// ninguna de las 6 tools que escriben debe invocar prisma.create/update/
// createMany. Un único archivo cubre las 6 (T008), con mocks compartidos.

const cotizacionCountMock = vi.fn();
const cotizacionCreateMock = vi.fn();
const pedidoCountMock = vi.fn();
const pedidoCreateMock = vi.fn();
const oportunidadFindFirstMock = vi.fn();
const productoFindManyMock = vi.fn();
const oportunidadProductoCreateManyMock = vi.fn();
const conversacionUpdateManyMock = vi.fn();
const contactoFindUniqueMock = vi.fn();
const contactoUpdateMock = vi.fn();
const tagFindFirstMock = vi.fn();
const tagCreateMock = vi.fn();
const contactoTagFindUniqueMock = vi.fn();
const contactoTagCreateMock = vi.fn();
const agenteIAConfigFindUniqueMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    cotizacion: { count: (...a: unknown[]) => cotizacionCountMock(...a), create: (...a: unknown[]) => cotizacionCreateMock(...a) },
    pedido: { count: (...a: unknown[]) => pedidoCountMock(...a), create: (...a: unknown[]) => pedidoCreateMock(...a) },
    oportunidad: { findFirst: (...a: unknown[]) => oportunidadFindFirstMock(...a) },
    producto: { findMany: (...a: unknown[]) => productoFindManyMock(...a) },
    oportunidadProducto: { createMany: (...a: unknown[]) => oportunidadProductoCreateManyMock(...a) },
    conversacion: { updateMany: (...a: unknown[]) => conversacionUpdateManyMock(...a) },
    contacto: { findUnique: (...a: unknown[]) => contactoFindUniqueMock(...a), update: (...a: unknown[]) => contactoUpdateMock(...a) },
    tag: { findFirst: (...a: unknown[]) => tagFindFirstMock(...a), create: (...a: unknown[]) => tagCreateMock(...a) },
    contactoTag: { findUnique: (...a: unknown[]) => contactoTagFindUniqueMock(...a), create: (...a: unknown[]) => contactoTagCreateMock(...a) },
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
  },
}));
vi.mock("@/configuracion/empresa/queries", () => ({
  obtenerMonedaPrincipal: vi.fn().mockResolvedValue("PEN"),
}));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));
vi.mock("@/eventos/catalogo", () => ({ EventosSistema: { ConversacionClasificada: "ConversacionClasificada" } }));

await import("./crear-cotizacion.tool");
await import("./crear-pedido.tool");
await import("./agregar-productos-oportunidad.tool");
await import("./transfer.tool");
await import("./actualizar-info-contacto.tool");
await import("./agregar-etiqueta-contacto.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctxSimulado = {
  instanciaId: "instancia-1",
  conversacionId: "conv-1",
  contactoId: "contacto-1",
  agenteId: "agente-1",
  herramientasPermitidas: [],
  modoSimulacion: true,
};

describe("modoSimulacion (018) — ninguna tool que escribe toca Prisma", () => {
  beforeEach(() => {
    cotizacionCountMock.mockReset();
    cotizacionCreateMock.mockReset();
    pedidoCountMock.mockReset();
    pedidoCreateMock.mockReset();
    oportunidadFindFirstMock.mockReset().mockResolvedValue({ id: "op-1" });
    productoFindManyMock.mockReset().mockResolvedValue([{ id: "p1", nombre: "Producto X", precio: 50 }]);
    oportunidadProductoCreateManyMock.mockReset();
    conversacionUpdateManyMock.mockReset();
    contactoFindUniqueMock.mockReset().mockResolvedValue({ id: "contacto-1", instanciaId: "instancia-1" });
    contactoUpdateMock.mockReset();
    tagFindFirstMock.mockReset();
    tagCreateMock.mockReset();
    contactoTagFindUniqueMock.mockReset();
    contactoTagCreateMock.mockReset();
    agenteIAConfigFindUniqueMock.mockReset().mockResolvedValue({ accionesComercialesModoBorrador: false });
  });

  it("crear_cotizacion: no llama a cotizacion.count ni .create, devuelve previsualizado: true", async () => {
    const tool = registroHerramientas.get("crear_cotizacion")!;
    const resultado = await tool.execute({ lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] }, ctxSimulado);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(cotizacionCountMock).not.toHaveBeenCalled();
    expect(cotizacionCreateMock).not.toHaveBeenCalled();
  });

  it("crear_pedido: no llama a pedido.count ni .create, devuelve previsualizado: true", async () => {
    const tool = registroHerramientas.get("crear_pedido")!;
    const resultado = await tool.execute({ lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] }, ctxSimulado);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(pedidoCountMock).not.toHaveBeenCalled();
    expect(pedidoCreateMock).not.toHaveBeenCalled();
  });

  it("agregar_productos_oportunidad: no llama a oportunidadProducto.createMany", async () => {
    const tool = registroHerramientas.get("agregar_productos_oportunidad")!;
    const resultado = await tool.execute({ oportunidadId: "op-1", productos: [{ productoId: "p1", cantidad: 2 }] }, ctxSimulado);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(oportunidadProductoCreateManyMock).not.toHaveBeenCalled();
  });

  it("transferir_a_humano: no llama a conversacion.updateMany", async () => {
    const tool = registroHerramientas.get("transferir_a_humano")!;
    const resultado = await tool.execute({ motivo: "Cliente molesto" }, ctxSimulado);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(conversacionUpdateManyMock).not.toHaveBeenCalled();
  });

  it("actualizar_info_contacto: no llama a contacto.update", async () => {
    const tool = registroHerramientas.get("actualizar_info_contacto")!;
    const resultado = await tool.execute({ nombre: "Juan" }, ctxSimulado);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(contactoUpdateMock).not.toHaveBeenCalled();
  });

  it("agregar_etiqueta_contacto: no llama a tag.create ni contactoTag.create", async () => {
    const tool = registroHerramientas.get("agregar_etiqueta_contacto")!;
    const resultado = await tool.execute({ nombreEtiqueta: "interesado" }, ctxSimulado);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { previsualizado: boolean }).previsualizado).toBe(true);
    expect(tagCreateMock).not.toHaveBeenCalled();
    expect(contactoTagCreateMock).not.toHaveBeenCalled();
  });

  it("sin modoSimulacion (comportamiento real): crear_cotizacion SÍ escribe (retrocompatibilidad)", async () => {
    cotizacionCountMock.mockResolvedValue(0);
    cotizacionCreateMock.mockResolvedValue({ id: "cot-1", numero: "00001" });
    const tool = registroHerramientas.get("crear_cotizacion")!;
    const { modoSimulacion, ...ctxReal } = ctxSimulado;
    void modoSimulacion;
    const resultado = await tool.execute({ lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] }, ctxReal);
    expect(resultado.ok).toBe(true);
    expect(cotizacionCreateMock).toHaveBeenCalled();
  });
});
