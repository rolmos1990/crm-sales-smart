import { describe, expect, it } from "vitest";
import { resolverProveedorPorObjetivo, type ProveedorActivo } from "./orquestador";

function proveedor(overrides: Partial<ProveedorActivo> & { id: string }): ProveedorActivo {
  return {
    instanciaId: "instancia-1",
    proveedor: "ANTHROPIC",
    apiKeyEncriptada: "clave",
    baseUrl: null,
    modelosDisponibles: ["claude-sonnet-4-6"],
    activo: true,
    prioridad: 1,
    limitePorMinuto: null,
    limitePorDia: null,
    costoInputPorMilToken: null,
    costoOutputPorMilToken: null,
    timeoutMs: 30000,
    reintentosMax: 2,
    casosDeUso: null,
    tipoAgenteIA: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  } as ProveedorActivo;
}

describe("resolverProveedorPorObjetivo (010, FR-004..007)", () => {
  it("devuelve null cuando ningún proveedor tiene asignación para la tarea (retrocompatibilidad, SC-003)", () => {
    const proveedores = [proveedor({ id: "p1" }), proveedor({ id: "p2" })];
    expect(resolverProveedorPorObjetivo(proveedores, "CLASIFICACION")).toBeNull();
  });

  it("devuelve el proveedor con la tarea exacta asignada en casosDeUso", () => {
    const proveedores = [
      proveedor({ id: "economico", casosDeUso: { objetivos: ["CLASIFICACION", "RESUMEN"] } }),
      proveedor({ id: "superior" }),
    ];
    const resultado = resolverProveedorPorObjetivo(proveedores, "CLASIFICACION");
    expect(resultado?.id).toBe("economico");
  });

  it("con tarea=CHAT y requiereRazonamientoSuperior=true, resuelve el proveedor de CHAT_RAZONAMIENTO_SUPERIOR, no el de CHAT estándar", () => {
    const proveedores = [
      proveedor({ id: "chat-estandar", casosDeUso: { objetivos: ["CHAT"] } }),
      proveedor({ id: "chat-superior", casosDeUso: { objetivos: ["CHAT_RAZONAMIENTO_SUPERIOR"] } }),
    ];
    const estandar = resolverProveedorPorObjetivo(proveedores, "CHAT", false);
    const superior = resolverProveedorPorObjetivo(proveedores, "CHAT", true);
    expect(estandar?.id).toBe("chat-estandar");
    expect(superior?.id).toBe("chat-superior");
  });

  it("con tarea=CHAT sin requiereRazonamientoSuperior, no confunde con la asignación de razonamiento superior", () => {
    const proveedores = [proveedor({ id: "chat-superior", casosDeUso: { objetivos: ["CHAT_RAZONAMIENTO_SUPERIOR"] } })];
    expect(resolverProveedorPorObjetivo(proveedores, "CHAT")).toBeNull();
  });

  it("desempata por mayor prioridad cuando más de un proveedor declara el mismo objetivo", () => {
    const proveedores = [
      proveedor({ id: "baja-prioridad", prioridad: 1, casosDeUso: { objetivos: ["RESUMEN"] } }),
      proveedor({ id: "alta-prioridad", prioridad: 5, casosDeUso: { objetivos: ["RESUMEN"] } }),
    ];
    expect(resolverProveedorPorObjetivo(proveedores, "RESUMEN")?.id).toBe("alta-prioridad");
  });

  it("ignora casosDeUso con forma inválida sin lanzar error", () => {
    const proveedores = [
      proveedor({ id: "malformado", casosDeUso: "no-es-un-objeto" as unknown as ProveedorActivo["casosDeUso"] }),
    ];
    expect(resolverProveedorPorObjetivo(proveedores, "RESUMEN")).toBeNull();
  });
});
