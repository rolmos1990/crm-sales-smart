import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };
const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const buscarUbicacionesCoincidentesMock = vi.fn();
vi.mock("@/shared/entregas/resolver-costo-envio", () => ({
  buscarUbicacionesCoincidentes: (...a: unknown[]) => buscarUbicacionesCoincidentesMock(...a),
}));

const transportistaFindFirstMock = vi.fn();
const zonaFindFirstMock = vi.fn();
const zonaCreateMock = vi.fn();
const ubicacionCreateMock = vi.fn();
const servicioFindFirstMock = vi.fn();
const servicioCreateMock = vi.fn();
const tarifaUpsertMock = vi.fn();
const aliasFindFirstMock = vi.fn();
const aliasCreateMock = vi.fn();
const historialCreateMock = vi.fn();
const historialUpdateMock = vi.fn();
const transactionMock = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaTx));

const prismaTx = {
  zonaEntrega: { findFirst: (...a: unknown[]) => zonaFindFirstMock(...a), create: (...a: unknown[]) => zonaCreateMock(...a) },
  zonaEntregaUbicacion: { create: (...a: unknown[]) => ubicacionCreateMock(...a) },
  servicioTransportista: { findFirst: (...a: unknown[]) => servicioFindFirstMock(...a), create: (...a: unknown[]) => servicioCreateMock(...a) },
  tarifaTransportistaZona: { upsert: (...a: unknown[]) => tarifaUpsertMock(...a) },
  aliasUbicacion: { findFirst: (...a: unknown[]) => aliasFindFirstMock(...a), create: (...a: unknown[]) => aliasCreateMock(...a) },
};

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    transportista: { findFirst: (...a: unknown[]) => transportistaFindFirstMock(...a) },
    historialImportacion: { create: (...a: unknown[]) => historialCreateMock(...a), update: (...a: unknown[]) => historialUpdateMock(...a) },
    $transaction: (...a: Parameters<typeof transactionMock>) => transactionMock(...a),
    ...prismaTx,
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revisarImportacionDestinosAction, confirmarImportacionDestinosAction } = await import("./actions");

const FILA_NUEVA = {
  zonaNombre: "David Centro",
  provinciaEstado: "Chiriquí",
  distritoCiudad: "David",
  servicioNombre: "Sucursal",
  costoInterno: "4.50",
  precioCliente: "6.50",
};

describe("importacion-destinos/actions (024, Historia 4)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    buscarUbicacionesCoincidentesMock.mockReset().mockResolvedValue([]);
    transportistaFindFirstMock.mockReset().mockResolvedValue({ id: "transportista-1" });
    zonaFindFirstMock.mockReset().mockResolvedValue(null);
    zonaCreateMock.mockReset().mockResolvedValue({ id: "zona-1" });
    ubicacionCreateMock.mockReset().mockResolvedValue({ id: "ubicacion-1" });
    servicioFindFirstMock.mockReset().mockResolvedValue(null);
    servicioCreateMock.mockReset().mockResolvedValue({ id: "servicio-1" });
    tarifaUpsertMock.mockReset().mockResolvedValue({ id: "tarifa-1" });
    aliasFindFirstMock.mockReset().mockResolvedValue(null);
    aliasCreateMock.mockReset().mockResolvedValue({ id: "alias-1" });
    historialCreateMock.mockReset().mockResolvedValue({ id: "historial-1" });
    historialUpdateMock.mockReset();
    transactionMock.mockClear();
  });

  describe("revisarImportacionDestinosAction", () => {
    it("clasifica NUEVO cuando no hay ningún candidato", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([]);
      const resultado = await revisarImportacionDestinosAction({ transportistaId: "t1", paisId: "pais-1", filas: [FILA_NUEVA] });
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        expect(resultado.data!.filas[0].estado).toBe("NUEVO");
        expect(resultado.data!.resumen).toEqual({ nuevos: 1, coincidenciaExacta: 0, posiblesDuplicados: 0, aliasAmbiguos: 0, incompletas: 0 });
      }
    });

    it("clasifica COINCIDENCIA_EXACTA con un único candidato EXACTA", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([{ zonaEntregaUbicacionId: "u1", zonaEntregaId: "z1", nombreVisible: "David", confianza: "EXACTA" }]);
      const resultado = await revisarImportacionDestinosAction({ transportistaId: "t1", paisId: "pais-1", filas: [FILA_NUEVA] });
      if (resultado.exito) expect(resultado.data!.filas[0].estado).toBe("COINCIDENCIA_EXACTA");
    });

    it("clasifica POSIBLE_DUPLICADO con un único candidato PROBABLE", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([{ zonaEntregaUbicacionId: "u1", zonaEntregaId: "z1", nombreVisible: "Davids", confianza: "PROBABLE" }]);
      const resultado = await revisarImportacionDestinosAction({ transportistaId: "t1", paisId: "pais-1", filas: [FILA_NUEVA] });
      if (resultado.exito) expect(resultado.data!.filas[0].estado).toBe("POSIBLE_DUPLICADO");
    });

    it("clasifica ALIAS_AMBIGUO cuando hay 2+ candidatos sin un EXACTA único", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([
        { zonaEntregaUbicacionId: "u1", zonaEntregaId: "z1", nombreVisible: "David", confianza: "ALIAS" },
        { zonaEntregaUbicacionId: "u2", zonaEntregaId: "z2", nombreVisible: "Divala", confianza: "PROBABLE" },
      ]);
      const resultado = await revisarImportacionDestinosAction({ transportistaId: "t1", paisId: "pais-1", filas: [FILA_NUEVA] });
      if (resultado.exito) expect(resultado.data!.filas[0].estado).toBe("ALIAS_AMBIGUO");
    });

    it("clasifica INCOMPLETA cuando falta un campo requerido", async () => {
      const resultado = await revisarImportacionDestinosAction({ transportistaId: "t1", paisId: "pais-1", filas: [{ zonaNombre: "X" }] });
      if (resultado.exito) expect(resultado.data!.filas[0].estado).toBe("INCOMPLETA");
    });

    it("rechaza si el transportista no pertenece a la instancia actual", async () => {
      transportistaFindFirstMock.mockResolvedValue(null);
      const resultado = await revisarImportacionDestinosAction({ transportistaId: "ajeno", paisId: "pais-1", filas: [FILA_NUEVA] });
      expect(resultado.exito).toBe(false);
    });
  });

  describe("confirmarImportacionDestinosAction", () => {
    const BASE = { transportistaId: "t1", paisId: "pais-1", archivoNombre: "destinos.csv", archivoTipo: "csv", archivoPeso: 100 };

    it("rechaza confirmar una fila ALIAS_AMBIGUO marcada para incluir (FR-013)", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([
        { zonaEntregaUbicacionId: "u1", zonaEntregaId: "z1", nombreVisible: "David", confianza: "ALIAS" },
        { zonaEntregaUbicacionId: "u2", zonaEntregaId: "z2", nombreVisible: "Divala", confianza: "PROBABLE" },
      ]);
      const resultado = await confirmarImportacionDestinosAction({ ...BASE, filas: [FILA_NUEVA], decisiones: [{ incluir: true }] });
      expect(resultado.exito).toBe(false);
      expect(tarifaUpsertMock).not.toHaveBeenCalled();
    });

    it("crea una zona/ubicación/tarifa nueva para una fila NUEVO incluida", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([]);
      const resultado = await confirmarImportacionDestinosAction({ ...BASE, filas: [FILA_NUEVA], decisiones: [{ incluir: true }] });
      expect(resultado.exito).toBe(true);
      expect(zonaCreateMock).toHaveBeenCalled();
      expect(ubicacionCreateMock).toHaveBeenCalled();
      expect(tarifaUpsertMock).toHaveBeenCalled();
      if (resultado.exito) expect(resultado.data).toEqual({ creados: 1, actualizados: 0 });
    });

    it("no crea nada para una fila con incluir: false", async () => {
      const resultado = await confirmarImportacionDestinosAction({ ...BASE, filas: [FILA_NUEVA], decisiones: [{ incluir: false }] });
      expect(resultado.exito).toBe(true);
      expect(zonaCreateMock).not.toHaveBeenCalled();
      expect(tarifaUpsertMock).not.toHaveBeenCalled();
      if (resultado.exito) expect(resultado.data).toEqual({ creados: 0, actualizados: 0 });
    });

    it("reutiliza el destino existente para una fila POSIBLE_DUPLICADO resuelta con usarExistenteId", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([{ zonaEntregaUbicacionId: "u1", zonaEntregaId: "z1", nombreVisible: "David", confianza: "PROBABLE" }]);
      const resultado = await confirmarImportacionDestinosAction({
        ...BASE,
        filas: [FILA_NUEVA],
        decisiones: [{ incluir: true, usarExistenteId: "u1" }],
      });
      expect(resultado.exito).toBe(true);
      expect(zonaCreateMock).not.toHaveBeenCalled();
      expect(ubicacionCreateMock).not.toHaveBeenCalled();
      expect(tarifaUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ transportistaId_zonaEntregaId_servicioTransportistaId: expect.objectContaining({ zonaEntregaId: "z1" }) }) }),
      );
      if (resultado.exito) expect(resultado.data).toEqual({ creados: 0, actualizados: 1 });
    });

    it("registra el resultado en HistorialImportacion con entidad DESTINO_TRANSPORTISTA", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([]);
      await confirmarImportacionDestinosAction({ ...BASE, filas: [FILA_NUEVA], decisiones: [{ incluir: true }] });
      expect(historialCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidad: "DESTINO_TRANSPORTISTA" }) }));
      expect(historialUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ registrosExitosos: 1 }) }));
    });

    // 026-fix-importacion-destinos — reproduce el bug real: la plantilla
    // espera una fila por servicio para el mismo destino, y ambas filas
    // clasifican NUEVO (no hay nada previo en la base). Sin el mapa de
    // dedup dentro del propio archivo, la 2ª fila creaba una
    // ZonaEntregaUbicacion duplicada.
    it("reutiliza la misma ubicación para dos filas del mismo destino con distinto servicio (una fila por servicio)", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([]);
      const filaServicioA = { ...FILA_NUEVA, servicioNombre: "Estándar" };
      const filaServicioB = { ...FILA_NUEVA, servicioNombre: "Express" };
      const resultado = await confirmarImportacionDestinosAction({
        ...BASE,
        filas: [filaServicioA, filaServicioB],
        decisiones: [{ incluir: true }, { incluir: true }],
      });
      expect(resultado.exito).toBe(true);
      expect(ubicacionCreateMock).toHaveBeenCalledTimes(1);
      expect(zonaCreateMock).toHaveBeenCalledTimes(1);
      expect(tarifaUpsertMock).toHaveBeenCalledTimes(2);
      if (resultado.exito) expect(resultado.data).toEqual({ creados: 1, actualizados: 1 });
    });

    // 026-fix-importacion-destinos — un `create` de alias que choca contra
    // el índice único dejaba la transacción de Postgres "abortada" para el
    // resto del lote (un catch de JS no alcanza a recuperarla sin
    // SAVEPOINT); ahora se verifica existencia antes de crear.
    it("no intenta crear un alias que ya existe (evita abortar la transacción del lote)", async () => {
      buscarUbicacionesCoincidentesMock.mockResolvedValue([]);
      aliasFindFirstMock.mockResolvedValue({ id: "alias-existente" });
      const filaConAlias = { ...FILA_NUEVA, alias: "David Centro" };
      const resultado = await confirmarImportacionDestinosAction({
        ...BASE,
        filas: [filaConAlias],
        decisiones: [{ incluir: true }],
      });
      expect(resultado.exito).toBe(true);
      expect(aliasFindFirstMock).toHaveBeenCalled();
      expect(aliasCreateMock).not.toHaveBeenCalled();
    });
  });
});
