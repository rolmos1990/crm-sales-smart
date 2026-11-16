import { describe, expect, it } from "vitest";
import { conversacionBloqueada, requiereAprobacion } from "./reglas";

const SIN_CREACION_AUTOMATICA = { crearContactosAutomaticamente: false };
const CON_CREACION_AUTOMATICA = { crearContactosAutomaticamente: true };

describe("requiereAprobacion — solo aplica al canal correo (FR-039)", () => {
  it.each(["whatsapp_lite", "whatsapp_business", "instagram", "facebook_messenger"])(
    "%s nunca requiere aprobación, ni con la creación automática desactivada",
    (canal) => {
      expect(
        requiereAprobacion({ canal, recepcion: SIN_CREACION_AUTOMATICA, aprobadoEn: null }),
      ).toBe(false);
    },
  );
});

describe("requiereAprobacion — canal correo", () => {
  it("con creación automática desactivada y remitente sin aprobar: bloquea", () => {
    expect(
      requiereAprobacion({ canal: "email", recepcion: SIN_CREACION_AUTOMATICA, aprobadoEn: null }),
    ).toBe(true);
  });

  it("con creación automática activada: nunca bloquea", () => {
    expect(
      requiereAprobacion({ canal: "email", recepcion: CON_CREACION_AUTOMATICA, aprobadoEn: null }),
    ).toBe(false);
  });

  it("remitente ya aprobado: no vuelve a pedir aprobación (FR-037)", () => {
    expect(
      requiereAprobacion({
        canal: "email",
        recepcion: SIN_CREACION_AUTOMATICA,
        aprobadoEn: new Date("2026-11-10T10:00:00Z"),
      }),
    ).toBe(false);
  });

  it("sin configuración legible asume el comportamiento de siempre: no bloquea", () => {
    // Un buzón mal configurado no debe dejar conversaciones bloqueadas en
    // silencio: el fallo seguro es seguir atendiendo.
    expect(requiereAprobacion({ canal: "email", recepcion: null, aprobadoEn: null })).toBe(false);
    expect(requiereAprobacion({ canal: "email", aprobadoEn: null })).toBe(false);
  });
});

describe("conversacionBloqueada", () => {
  it("solo bloquea con la bandera explícitamente en true", () => {
    expect(conversacionBloqueada({ bloqueadaPorAprobacion: true })).toBe(true);
    expect(conversacionBloqueada({ bloqueadaPorAprobacion: false })).toBe(false);
    expect(conversacionBloqueada({ bloqueadaPorAprobacion: null })).toBe(false);
    expect(conversacionBloqueada({})).toBe(false);
    expect(conversacionBloqueada(null)).toBe(false);
    expect(conversacionBloqueada(undefined)).toBe(false);
  });
});
