import { describe, expect, it, vi, beforeEach } from "vitest";

// Línea base de SC-011 (spec 034): fija el comportamiento ACTUAL de
// resolverContactoYConversacion para WhatsApp, Instagram y Messenger ANTES de
// que el canal de correo introduzca su propia regla de agrupación. Si alguno
// de estos tests se rompe al tocar actions.ts, la regresión es real: estos
// canales deben seguir comportándose exactamente igual que antes.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: vi.fn(), obtenerSesionActual: vi.fn() }));
vi.mock("@/shared/auth/permisos-server", () => ({ requirePermisoAction: vi.fn() }));
vi.mock("./providers/registry", () => ({ obtenerProvider: vi.fn() }));
vi.mock("./queries", () => ({ obtenerConversacionPorId: vi.fn(), obtenerConversacionesInbox: vi.fn() }));
vi.mock("@/crm/pipeline/mover-stage", () => ({ registrarEntradaInicialAEtapa: vi.fn() }));
vi.mock("@/configuracion/empresa/queries", () => ({ obtenerMonedaPrincipal: vi.fn().mockResolvedValue("PEN") }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));

const registrarEventoConversacionMock = vi.fn();
vi.mock("./envio", () => ({
  enviarMensajeInterno: vi.fn(),
  procesarPrimeraRespuestaProspecto: vi.fn(),
  registrarEventoConversacion: (...a: unknown[]) => registrarEventoConversacionMock(...a),
}));

const identificadorFindUnique = vi.fn();
const identificadorCreate = vi.fn();
const identificadorUpdate = vi.fn();
const contactoFindFirst = vi.fn();
const contactoCreate = vi.fn();
const contactoUpdate = vi.fn();
const conversacionFindFirst = vi.fn();
const conversacionCreate = vi.fn();
const conversacionUpdate = vi.fn();
const mensajeFindFirst = vi.fn();
const mensajeCreate = vi.fn();
const oportunidadContactoFindFirst = vi.fn();
const oportunidadUpdate = vi.fn();
const oportunidadConversacionUpsert = vi.fn();
const pipelineStageFindUnique = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    contactoIdentificadorCanal: {
      findUnique: (...a: unknown[]) => identificadorFindUnique(...a),
      create: (...a: unknown[]) => identificadorCreate(...a),
      update: (...a: unknown[]) => identificadorUpdate(...a),
    },
    contacto: {
      findFirst: (...a: unknown[]) => contactoFindFirst(...a),
      create: (...a: unknown[]) => contactoCreate(...a),
      update: (...a: unknown[]) => contactoUpdate(...a),
    },
    conversacion: {
      findFirst: (...a: unknown[]) => conversacionFindFirst(...a),
      create: (...a: unknown[]) => conversacionCreate(...a),
      update: (...a: unknown[]) => conversacionUpdate(...a),
    },
    mensajeConversacion: {
      findFirst: (...a: unknown[]) => mensajeFindFirst(...a),
      create: (...a: unknown[]) => mensajeCreate(...a),
    },
    oportunidadContacto: { findFirst: (...a: unknown[]) => oportunidadContactoFindFirst(...a) },
    oportunidad: { update: (...a: unknown[]) => oportunidadUpdate(...a) },
    oportunidadConversacion: { upsert: (...a: unknown[]) => oportunidadConversacionUpsert(...a) },
    pipelineStage: { findUnique: (...a: unknown[]) => pipelineStageFindUnique(...a) },
    mediaArchivo: { update: vi.fn().mockResolvedValue({}) },
  },
}));

const { procesarMensajeEntrante } = await import("./actions");

const CONTACTO = { id: "cont-1", nombre: "Ana", avatarUrl: "http://a/x.png" };
const ESTADOS_CONVERSACION_REUTILIZABLE = ["ABIERTA", "EN_ESPERA", "CERRADA"];

/** Deja todo listo para que el flujo llegue hasta el final con una oportunidad activa. */
function escenarioBase() {
  identificadorFindUnique.mockResolvedValue({ id: "ident-1", handle: "@ana", contacto: CONTACTO });
  conversacionFindFirst.mockResolvedValue({
    id: "conv-1",
    estado: "ABIERTA",
    cuentaCanalId: "cuenta-vieja",
  });
  conversacionUpdate.mockResolvedValue({});
  mensajeFindFirst.mockResolvedValue(null);
  mensajeCreate.mockResolvedValue({ id: "msg-1" });
  oportunidadContactoFindFirst.mockResolvedValue({
    oportunidad: { id: "op-1", stageId: null, instanciaId: "inst-1" },
  });
  oportunidadUpdate.mockResolvedValue({});
  oportunidadConversacionUpsert.mockResolvedValue({});
}

function entrante(over: Record<string, unknown> = {}) {
  return {
    canal: "whatsapp_lite",
    identificadorContacto: "51999888777@s.whatsapp.net",
    cuentaCanalId: "cuenta-nueva",
    instanciaId: "inst-1",
    contenido: "hola",
    tipo: "TEXTO" as const,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  escenarioBase();
});

describe("resolverContactoYConversacion — comportamiento vigente de los canales de mensajería", () => {
  it("busca la conversación por contacto + instancia, SIN filtrar por canal ni por cuenta", async () => {
    await procesarMensajeEntrante(entrante());

    expect(conversacionFindFirst).toHaveBeenCalledTimes(1);
    expect(conversacionFindFirst.mock.calls[0][0].where).toEqual({
      contactoId: "cont-1",
      instanciaId: "inst-1",
      estado: { in: ESTADOS_CONVERSACION_REUTILIZABLE },
    });
  });

  it("re-escaneo de QR: reutiliza la conversación existente y le actualiza la cuenta de canal", async () => {
    await procesarMensajeEntrante(entrante());

    expect(conversacionCreate).not.toHaveBeenCalled();
    expect(conversacionUpdate).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { cuentaCanalId: "cuenta-nueva" },
    });
  });

  it("conversación CERRADA: la reabre y registra el evento REABIERTA", async () => {
    conversacionFindFirst.mockResolvedValue({ id: "conv-1", estado: "CERRADA", cuentaCanalId: "cuenta-nueva" });

    await procesarMensajeEntrante(entrante());

    expect(conversacionUpdate).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { estado: "ABIERTA" },
    });
    expect(registrarEventoConversacionMock).toHaveBeenCalledWith("conv-1", "REABIERTA");
  });

  it("conversación EN_ESPERA: la reabre sin registrar REABIERTA", async () => {
    conversacionFindFirst.mockResolvedValue({ id: "conv-1", estado: "EN_ESPERA", cuentaCanalId: "cuenta-nueva" });

    await procesarMensajeEntrante(entrante());

    expect(conversacionUpdate).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { estado: "ABIERTA" },
    });
    expect(registrarEventoConversacionMock).not.toHaveBeenCalled();
  });

  it("un contacto con conversación abierta recibe por otro canal en LA MISMA conversación", async () => {
    await procesarMensajeEntrante(entrante({ canal: "instagram", identificadorContacto: "17841400000000" }));

    expect(conversacionCreate).not.toHaveBeenCalled();
    expect(mensajeCreate.mock.calls[0][0].data.conversacionId).toBe("conv-1");
  });
});

describe("resolverContactoYConversacion — emparejamiento de contacto por identificador", () => {
  beforeEach(() => {
    identificadorFindUnique.mockResolvedValue(null);
    identificadorCreate.mockResolvedValue({ id: "ident-1", handle: null, contacto: CONTACTO });
    contactoCreate.mockResolvedValue(CONTACTO);
  });

  it("WhatsApp: busca un contacto existente por teléfono antes de crear uno nuevo", async () => {
    contactoFindFirst.mockResolvedValue({ id: "cont-9" });

    await procesarMensajeEntrante(entrante());

    expect(contactoFindFirst).toHaveBeenCalledTimes(1);
    expect(contactoCreate).not.toHaveBeenCalled();
    expect(identificadorCreate.mock.calls[0][0].data.contactoId).toBe("cont-9");
  });

  it("WhatsApp sin contacto previo: lo crea guardando el número como teléfono principal", async () => {
    contactoFindFirst.mockResolvedValue(null);

    await procesarMensajeEntrante(entrante({ identificadorContacto: "51999888777" }));

    expect(contactoCreate.mock.calls[0][0].data.telefonoPrincipal).toBe("+51999888777");
  });

  it("WhatsApp con JID @lid: no busca por teléfono ni lo guarda como teléfono", async () => {
    await procesarMensajeEntrante(entrante({ identificadorContacto: "123456789@lid" }));

    expect(contactoFindFirst).not.toHaveBeenCalled();
    expect(contactoCreate.mock.calls[0][0].data.telefonoPrincipal).toBeUndefined();
  });

  it("Instagram: no busca por teléfono ni guarda el IGSID como teléfono", async () => {
    await procesarMensajeEntrante(entrante({ canal: "instagram", identificadorContacto: "17841400000000" }));

    expect(contactoFindFirst).not.toHaveBeenCalled();
    expect(contactoCreate.mock.calls[0][0].data.telefonoPrincipal).toBeUndefined();
  });

  it("Facebook Messenger: no busca por teléfono ni guarda el PSID como teléfono", async () => {
    await procesarMensajeEntrante(entrante({ canal: "facebook_messenger", identificadorContacto: "9876543210" }));

    expect(contactoFindFirst).not.toHaveBeenCalled();
    expect(contactoCreate.mock.calls[0][0].data.telefonoPrincipal).toBeUndefined();
  });
});

describe("canal correo — conversación propia, sin tocar los demás canales (034)", () => {
  it("filtra la búsqueda por canal: el correo no cae en la conversación de WhatsApp", async () => {
    conversacionFindFirst.mockResolvedValue(null);
    conversacionCreate.mockResolvedValue({ id: "conv-mail", estado: "ABIERTA", cuentaCanalId: "cuenta-mail" });

    await procesarMensajeEntrante(
      entrante({ canal: "email", identificadorContacto: "juan@cliente.com", cuentaCanalId: "cuenta-mail" }),
    );

    expect(conversacionFindFirst.mock.calls[0][0].where).toEqual({
      contactoId: "cont-1",
      instanciaId: "inst-1",
      estado: { in: ESTADOS_CONVERSACION_REUTILIZABLE },
      cuentaCanal: { canal: "email" },
    });
    expect(conversacionCreate).toHaveBeenCalled();
  });

  it("dos correos del mismo remitente van a la misma conversación y a una sola oportunidad", async () => {
    await procesarMensajeEntrante(entrante({ canal: "email", identificadorContacto: "juan@cliente.com" }));
    await procesarMensajeEntrante(
      entrante({ canal: "email", identificadorContacto: "juan@cliente.com", idExterno: "m2@x.com" }),
    );

    expect(conversacionCreate).not.toHaveBeenCalled();
    expect(oportunidadConversacionUpsert).toHaveBeenCalledTimes(2);
    expect(oportunidadConversacionUpsert.mock.calls[0][0].create.oportunidadId).toBe("op-1");
  });
});

describe("canal correo — emparejamiento del remitente (034)", () => {
  beforeEach(() => {
    identificadorFindUnique.mockResolvedValue(null);
    identificadorCreate.mockResolvedValue({ id: "ident-1", handle: null, contacto: CONTACTO });
    contactoCreate.mockResolvedValue(CONTACTO);
  });

  it("asocia el correo a un contacto que ya tiene esa dirección en su ficha", async () => {
    contactoFindFirst.mockResolvedValue({ id: "cont-9" });

    await procesarMensajeEntrante(entrante({ canal: "email", identificadorContacto: "juan@cliente.com" }));

    expect(contactoFindFirst.mock.calls[0][0].where).toEqual({
      instanciaId: "inst-1",
      email: { equals: "juan@cliente.com", mode: "insensitive" },
    });
    expect(contactoCreate).not.toHaveBeenCalled();
    expect(identificadorCreate.mock.calls[0][0].data.contactoId).toBe("cont-9");
  });

  it("si no existe, crea el contacto guardando la dirección en su ficha", async () => {
    contactoFindFirst.mockResolvedValue(null);

    await procesarMensajeEntrante(entrante({ canal: "email", identificadorContacto: "JUAN@Cliente.com" }));

    expect(contactoCreate.mock.calls[0][0].data.email).toBe("juan@cliente.com");
    expect(contactoCreate.mock.calls[0][0].data.telefonoPrincipal).toBeUndefined();
  });

  it("no busca por teléfono para el canal correo", async () => {
    contactoFindFirst.mockResolvedValue(null);

    await procesarMensajeEntrante(entrante({ canal: "email", identificadorContacto: "juan@cliente.com" }));

    expect(contactoFindFirst).toHaveBeenCalledTimes(1);
  });
});
