import { describe, it, expect } from "vitest";
import {
  agruparPorContacto,
  elegirAvisoOtroCanal,
  resumirIdentidades,
  tieneMensajeSinLeer,
} from "./agrupacion";
import type {
  ConversacionResumen,
  EstadoConversacion,
  IdentidadCanalResumen,
  MensajeConMeta,
} from "./types";

// ── Fixtures ─────────────────────────────────────────────────────────────────
// Constructor mínimo de ConversacionResumen: solo se parametriza lo que la
// agrupación mira. El resto se llena con valores inertes para que un cambio
// en campos que no le importan no rompa estos tests.

function crearMensaje(over: Partial<MensajeConMeta> = {}): MensajeConMeta {
  return {
    id: "msg-1",
    conversacionId: "conv-1",
    contenido: "hola",
    tipo: "TEXTO",
    remitente: "CONTACTO",
    estado: "ENTREGADO",
    esNotaInterna: false,
    idExterno: null,
    usuarioId: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaDuracion: null,
    creadoEn: new Date("2026-11-16T10:00:00Z"),
    enviadoEn: null,
    leidoEn: null,
    mediaArchivoId: null,
    mediaEstado: null,
    mediaUrlOptimizada: null,
    mediaUrlThumbnail: null,
    mediaErrorMensaje: null,
    transcripcion: null,
    transcripcionEstado: null,
    transcripcionIdioma: null,
    ...over,
  };
}

function crearConversacion(over: {
  id: string;
  contactoId?: string;
  estado?: EstadoConversacion;
  actualizadoEn?: string;
  canal?: string | null;
  nombreCanal?: string;
  ultimoMensaje?: MensajeConMeta | null;
  modoAtencion?: ConversacionResumen["modoAtencion"];
  pendientesIA?: number;
  identificadoresCanal?: IdentidadCanalResumen[];
}): ConversacionResumen {
  const canal = over.canal === undefined ? "whatsapp_lite" : over.canal;
  return {
    id: over.id,
    instanciaId: "inst-1",
    contactoId: over.contactoId ?? "contacto-1",
    cuentaCanalId: canal ? `cuenta-${canal}` : null,
    asunto: null,
    estado: over.estado ?? "ABIERTA",
    clasificacion: "NINGUNA",
    modoAtencion: over.modoAtencion ?? "AUTOMATICO",
    pendientesIA: over.pendientesIA ?? 0,
    creadoEn: new Date("2026-11-01T00:00:00Z"),
    actualizadoEn: new Date(over.actualizadoEn ?? "2026-11-16T10:00:00Z"),
    contacto: {
      id: over.contactoId ?? "contacto-1",
      nombre: "Jose",
      apellido: "Perez",
      telefonoPrincipal: null,
      email: null,
      avatarUrl: null,
      identificadoresCanal: over.identificadoresCanal ?? [],
    },
    cuentaCanal: canal
      ? {
          id: `cuenta-${canal}`,
          canal,
          nombre: over.nombreCanal ?? canal,
          identificador: "id-externo",
        }
      : null,
    oportunidades: [],
    ultimoMensaje: over.ultimoMensaje === undefined ? null : over.ultimoMensaje,
  };
}

// ── tieneMensajeSinLeer ──────────────────────────────────────────────────────

describe("tieneMensajeSinLeer", () => {
  it("es true solo si el último mensaje es del contacto y no está leído", () => {
    expect(tieneMensajeSinLeer(crearConversacion({ id: "c", ultimoMensaje: null }))).toBe(false);

    expect(
      tieneMensajeSinLeer(
        crearConversacion({ id: "c", ultimoMensaje: crearMensaje({ remitente: "CONTACTO", estado: "ENTREGADO" }) }),
      ),
    ).toBe(true);

    expect(
      tieneMensajeSinLeer(
        crearConversacion({ id: "c", ultimoMensaje: crearMensaje({ remitente: "CONTACTO", estado: "LEIDO" }) }),
      ),
    ).toBe(false);

    // Un mensaje nuestro no cuenta como pendiente, aunque no esté leído.
    expect(
      tieneMensajeSinLeer(
        crearConversacion({ id: "c", ultimoMensaje: crearMensaje({ remitente: "AGENTE", estado: "ENVIADO" }) }),
      ),
    ).toBe(false);
  });
});

// ── agruparPorContacto ───────────────────────────────────────────────────────

describe("agruparPorContacto", () => {
  it("devuelve [] con entrada vacía", () => {
    expect(agruparPorContacto([])).toEqual([]);
  });

  it("cubre todas las conversaciones exactamente una vez y no deja grupos vacíos", () => {
    const convs = [
      crearConversacion({ id: "a", contactoId: "c1" }),
      crearConversacion({ id: "b", contactoId: "c2" }),
      crearConversacion({ id: "c", contactoId: "c1" }),
    ];

    const grupos = agruparPorContacto(convs);
    const ids = grupos.flatMap((g) => g.conversaciones.map((c) => c.id)).sort();

    expect(grupos).toHaveLength(2);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(grupos.every((g) => g.conversaciones.length > 0)).toBe(true);
    expect(grupos.every((g) => g.totalConversaciones === g.conversaciones.length)).toBe(true);
  });

  it("marca esSimple solo cuando el contacto tiene una sola conversación visible", () => {
    const grupos = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1" }),
      crearConversacion({ id: "b", contactoId: "c2" }),
      crearConversacion({ id: "c", contactoId: "c2" }),
    ]);

    expect(grupos.find((g) => g.contactoId === "c1")!.esSimple).toBe(true);
    expect(grupos.find((g) => g.contactoId === "c2")!.esSimple).toBe(false);
  });

  it("cuenta canales distintos e ignora las conversaciones sin cuenta de canal", () => {
    const grupos = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1", canal: "whatsapp_lite" }),
      crearConversacion({ id: "b", contactoId: "c1", canal: "email" }),
      // Dos hilos del MISMO canal (correo agrupado por hilo) suman 1 canal, no 2.
      crearConversacion({ id: "c", contactoId: "c1", canal: "email" }),
      // Sin cuenta de canal: no inventa un canal fantasma.
      crearConversacion({ id: "d", contactoId: "c1", canal: null }),
    ]);

    const grupo = grupos[0];
    expect(grupo.totalConversaciones).toBe(4);
    expect(grupo.totalCanales).toBe(2);
  });

  it("suma los no leídos con el mismo criterio que la lista", () => {
    const grupos = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1", ultimoMensaje: crearMensaje({ estado: "ENTREGADO" }) }),
      crearConversacion({ id: "b", contactoId: "c1", ultimoMensaje: crearMensaje({ estado: "LEIDO" }) }),
      crearConversacion({ id: "c", contactoId: "c1", ultimoMensaje: null }),
    ]);

    expect(grupos[0].noLeidos).toBe(1);
  });

  it("requiereAtencionHumana es un OR sobre los hijos", () => {
    const sinAtencion = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1" }),
      crearConversacion({ id: "b", contactoId: "c1" }),
    ]);
    expect(sinAtencion[0].requiereAtencionHumana).toBe(false);

    const conAtencion = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1" }),
      crearConversacion({ id: "b", contactoId: "c1", modoAtencion: "HUMANO" }),
    ]);
    expect(conAtencion[0].requiereAtencionHumana).toBe(true);

    // Un borrador de la IA esperando aprobación cuenta igual que un humano
    // asignado — es el mismo criterio que alimenta el filtro del Inbox.
    const conPendienteIA = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1", pendientesIA: 1 }),
    ]);
    expect(conPendienteIA[0].requiereAtencionHumana).toBe(true);

    // Una conversación cerrada ya no se atiende, aunque quede el modo HUMANO.
    const cerrada = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1", estado: "CERRADA", modoAtencion: "HUMANO" }),
    ]);
    expect(cerrada[0].requiereAtencionHumana).toBe(false);
  });

  it("elige como líder la conversación más prioritaria, desempatando por fecha", () => {
    const grupos = agruparPorContacto([
      crearConversacion({ id: "cerrada-nueva", contactoId: "c1", estado: "CERRADA", actualizadoEn: "2026-11-16T12:00:00Z" }),
      crearConversacion({ id: "abierta-vieja", contactoId: "c1", estado: "ABIERTA", actualizadoEn: "2026-11-16T08:00:00Z" }),
      crearConversacion({ id: "abierta-nueva", contactoId: "c1", estado: "ABIERTA", actualizadoEn: "2026-11-16T11:00:00Z" }),
    ]);

    // Prioridad primero: una abierta vieja gana a una cerrada nueva.
    expect(grupos[0].lider.id).toBe("abierta-nueva");
    expect(grupos[0].conversaciones.map((c) => c.id)).toEqual([
      "abierta-nueva",
      "abierta-vieja",
      "cerrada-nueva",
    ]);
  });

  it("ordena los grupos por su líder: quien requiere acción primero", () => {
    const grupos = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "todo-cerrado", estado: "CERRADA", actualizadoEn: "2026-11-16T23:00:00Z" }),
      crearConversacion({ id: "b", contactoId: "en-espera", estado: "EN_ESPERA", actualizadoEn: "2026-11-16T09:00:00Z" }),
      crearConversacion({ id: "c", contactoId: "abierto", estado: "ABIERTA", actualizadoEn: "2026-11-16T07:00:00Z" }),
    ]);

    expect(grupos.map((g) => g.contactoId)).toEqual(["abierto", "en-espera", "todo-cerrado"]);
  });

  it("el orden es determinista cuando dos grupos empatan en estado y fecha", () => {
    const base = [
      crearConversacion({ id: "a", contactoId: "zeta", actualizadoEn: "2026-11-16T10:00:00Z" }),
      crearConversacion({ id: "b", contactoId: "alfa", actualizadoEn: "2026-11-16T10:00:00Z" }),
    ];

    const orden1 = agruparPorContacto(base).map((g) => g.contactoId);
    const orden2 = agruparPorContacto([...base].reverse()).map((g) => g.contactoId);

    expect(orden1).toEqual(orden2);
    expect(orden1).toEqual(["alfa", "zeta"]);
  });

  it("toma el contacto del líder, no de una conversación cualquiera", () => {
    const grupos = agruparPorContacto([
      crearConversacion({ id: "a", contactoId: "c1" }),
      crearConversacion({ id: "b", contactoId: "c1" }),
    ]);

    expect(grupos[0].contacto.id).toBe("c1");
    expect(grupos[0].contacto).toBe(grupos[0].lider.contacto);
  });

  it("no muta el arreglo que recibe", () => {
    const convs = [
      crearConversacion({ id: "a", contactoId: "c1", estado: "CERRADA" }),
      crearConversacion({ id: "b", contactoId: "c1", estado: "ABIERTA" }),
    ];
    const ordenOriginal = convs.map((c) => c.id);

    agruparPorContacto(convs);

    expect(convs.map((c) => c.id)).toEqual(ordenOriginal);
  });
});

// ── elegirAvisoOtroCanal ─────────────────────────────────────────────────────

describe("elegirAvisoOtroCanal", () => {
  const vacio = new Set<string>();

  const abierta = crearConversacion({
    id: "abierta",
    contactoId: "c1",
    canal: "instagram",
    ultimoMensaje: crearMensaje({ id: "m-abierta", creadoEn: new Date("2026-11-16T10:00:00Z") }),
  });

  it("avisa cuando otra conversación del contacto tiene algo sin leer más nuevo", () => {
    const otra = crearConversacion({
      id: "otra",
      contactoId: "c1",
      canal: "whatsapp_lite",
      nombreCanal: "WhatsApp Ventas",
      ultimoMensaje: crearMensaje({ id: "m-otra", creadoEn: new Date("2026-11-16T12:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: abierta,
      todasLasConversaciones: [abierta, otra],
      descartados: vacio,
    });

    expect(aviso).toEqual({
      conversacionId: "otra",
      canal: "whatsapp_lite",
      nombreCanal: "WhatsApp Ventas",
      mensajeId: "m-otra",
      fecha: new Date("2026-11-16T12:00:00Z"),
    });
  });

  it("no avisa de la conversación abierta ni de otros contactos", () => {
    const deOtroContacto = crearConversacion({
      id: "ajena",
      contactoId: "c2",
      ultimoMensaje: crearMensaje({ id: "m-ajena", creadoEn: new Date("2026-11-16T23:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: abierta,
      todasLasConversaciones: [abierta, deOtroContacto],
      descartados: vacio,
    });

    expect(aviso).toBeNull();
  });

  it("no avisa si lo del otro canal es más viejo o ya está leído", () => {
    const vieja = crearConversacion({
      id: "vieja",
      contactoId: "c1",
      canal: "email",
      ultimoMensaje: crearMensaje({ id: "m-vieja", creadoEn: new Date("2026-11-16T08:00:00Z") }),
    });
    const leida = crearConversacion({
      id: "leida",
      contactoId: "c1",
      canal: "email",
      ultimoMensaje: crearMensaje({ id: "m-leida", estado: "LEIDO", creadoEn: new Date("2026-11-16T23:00:00Z") }),
    });

    expect(
      elegirAvisoOtroCanal({
        conversacionAbierta: abierta,
        todasLasConversaciones: [abierta, vieja, leida],
        descartados: vacio,
      }),
    ).toBeNull();
  });

  it("con varias candidatas gana la más reciente", () => {
    const media = crearConversacion({
      id: "media",
      contactoId: "c1",
      canal: "email",
      ultimoMensaje: crearMensaje({ id: "m-media", creadoEn: new Date("2026-11-16T11:00:00Z") }),
    });
    const nueva = crearConversacion({
      id: "nueva",
      contactoId: "c1",
      canal: "whatsapp_lite",
      ultimoMensaje: crearMensaje({ id: "m-nueva", creadoEn: new Date("2026-11-16T13:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: abierta,
      todasLasConversaciones: [abierta, media, nueva],
      descartados: vacio,
    });

    expect(aviso?.conversacionId).toBe("nueva");
  });

  it("si la ganadora está descartada devuelve null, sin caer a una más vieja", () => {
    const media = crearConversacion({
      id: "media",
      contactoId: "c1",
      canal: "email",
      ultimoMensaje: crearMensaje({ id: "m-media", creadoEn: new Date("2026-11-16T11:00:00Z") }),
    });
    const nueva = crearConversacion({
      id: "nueva",
      contactoId: "c1",
      canal: "whatsapp_lite",
      ultimoMensaje: crearMensaje({ id: "m-nueva", creadoEn: new Date("2026-11-16T13:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: abierta,
      todasLasConversaciones: [abierta, media, nueva],
      descartados: new Set(["m-nueva"]),
    });

    expect(aviso).toBeNull();
  });

  it("un mensaje nuevo del mismo canal vuelve a avisar aunque el anterior se haya descartado", () => {
    const otraConMensajeNuevo = crearConversacion({
      id: "otra",
      contactoId: "c1",
      canal: "whatsapp_lite",
      ultimoMensaje: crearMensaje({ id: "m-otra-2", creadoEn: new Date("2026-11-16T14:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: abierta,
      todasLasConversaciones: [abierta, otraConMensajeNuevo],
      descartados: new Set(["m-otra-1"]),
    });

    expect(aviso?.mensajeId).toBe("m-otra-2");
  });

  it("si la conversación abierta no tiene mensajes, cualquier candidata sin leer califica", () => {
    const sinMensajes = crearConversacion({ id: "abierta", contactoId: "c1", ultimoMensaje: null });
    const otra = crearConversacion({
      id: "otra",
      contactoId: "c1",
      canal: "email",
      ultimoMensaje: crearMensaje({ id: "m-otra", creadoEn: new Date("2020-01-01T00:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: sinMensajes,
      todasLasConversaciones: [sinMensajes, otra],
      descartados: vacio,
    });

    expect(aviso?.conversacionId).toBe("otra");
  });

  it("tolera una conversación sin cuenta de canal sin romperse", () => {
    const sinCanal = crearConversacion({
      id: "sin-canal",
      contactoId: "c1",
      canal: null,
      ultimoMensaje: crearMensaje({ id: "m-sin-canal", creadoEn: new Date("2026-11-16T12:00:00Z") }),
    });

    const aviso = elegirAvisoOtroCanal({
      conversacionAbierta: abierta,
      todasLasConversaciones: [abierta, sinCanal],
      descartados: vacio,
    });

    expect(aviso?.nombreCanal).toBe("otro canal");
  });
});

// ── resumirIdentidades ───────────────────────────────────────────────────────

describe("resumirIdentidades", () => {
  const identidades: IdentidadCanalResumen[] = [
    { canal: "email", identificador: "jose.perez@gmail.com", handle: null },
    { canal: "instagram", identificador: "17841400000", handle: "@jose.perez" },
    { canal: "whatsapp_lite", identificador: "+50760000000", handle: null },
  ];

  it("empareja cada identidad con la conversación cargada de su canal", () => {
    const resumidas = resumirIdentidades({
      identidades,
      conversacionesDelContacto: [
        crearConversacion({ id: "conv-email", canal: "email", actualizadoEn: "2026-11-16T10:00:00Z" }),
      ],
    });

    const email = resumidas.find((i) => i.canal === "email")!;
    expect(email.conversacionId).toBe("conv-email");
    expect(email.ultimaActividad).toEqual(new Date("2026-11-16T10:00:00Z"));
  });

  it("deja sin acceso ni fecha a las identidades sin conversación cargada", () => {
    const resumidas = resumirIdentidades({
      identidades,
      conversacionesDelContacto: [crearConversacion({ id: "conv-email", canal: "email" })],
    });

    const instagram = resumidas.find((i) => i.canal === "instagram")!;
    expect(instagram.conversacionId).toBeNull();
    expect(instagram.ultimaActividad).toBeNull();
    // La identidad igual se muestra: es un canal registrado del contacto.
    expect(instagram.handle).toBe("@jose.perez");
  });

  it("con varias conversaciones del mismo canal gana la más recientemente actualizada", () => {
    const resumidas = resumirIdentidades({
      identidades,
      conversacionesDelContacto: [
        crearConversacion({ id: "hilo-viejo", canal: "email", actualizadoEn: "2026-11-10T10:00:00Z" }),
        crearConversacion({ id: "hilo-nuevo", canal: "email", actualizadoEn: "2026-11-16T10:00:00Z" }),
      ],
    });

    expect(resumidas.find((i) => i.canal === "email")!.conversacionId).toBe("hilo-nuevo");
  });

  it("ordena primero las que se pueden abrir, por actividad descendente", () => {
    const resumidas = resumirIdentidades({
      identidades,
      conversacionesDelContacto: [
        crearConversacion({ id: "conv-email", canal: "email", actualizadoEn: "2026-11-10T10:00:00Z" }),
        crearConversacion({ id: "conv-wa", canal: "whatsapp_lite", actualizadoEn: "2026-11-16T10:00:00Z" }),
      ],
    });

    expect(resumidas.map((i) => i.canal)).toEqual(["whatsapp_lite", "email", "instagram"]);
  });

  it("devuelve [] si el contacto no tiene identidades registradas", () => {
    expect(
      resumirIdentidades({ identidades: [], conversacionesDelContacto: [crearConversacion({ id: "x" })] }),
    ).toEqual([]);
  });

  it("no muta el arreglo de identidades que recibe", () => {
    const original = [...identidades];
    resumirIdentidades({ identidades, conversacionesDelContacto: [] });
    expect(identidades).toEqual(original);
  });
});
