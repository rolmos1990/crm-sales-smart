import { describe, expect, it } from "vitest";
import {
  aBuzonParaCliente,
  construirConfiguracionBuzon,
  descifrarConexion,
  leerConfiguracionBuzon,
  normalizarDireccion,
  type ConfiguracionBuzonAlmacenada,
} from "./configuracion";

// La clave de cifrado de prueba la fija vitest.config.ts (TOKENS_CIFRADO_KEY).

const ENTRADA = {
  servidor: "imap.proveedor.com",
  puerto: 993,
  seguridad: "SSL_TLS" as const,
  usuario: "ventas@negocio.com",
  password: "secreto-entrada",
};

const SALIDA = {
  servidor: "smtp.proveedor.com",
  puerto: 465,
  seguridad: "SSL_TLS" as const,
  usuario: "ventas@negocio.com",
  password: "secreto-salida",
  nombreRemitente: "Ventas Mi Negocio",
};

const RECEPCION = { agrupacion: "POR_REMITENTE" as const, crearContactosAutomaticamente: true };

function configuracionDePrueba(): ConfiguracionBuzonAlmacenada {
  return construirConfiguracionBuzon({ entrada: ENTRADA, salida: SALIDA, recepcion: RECEPCION });
}

describe("configuración del buzón — cifrado de credenciales", () => {
  it("cifra ambas contraseñas y no deja ningún rastro en claro", () => {
    const cfg = configuracionDePrueba();

    expect(cfg.entrada.passwordCifrada.startsWith("enc:v1:")).toBe(true);
    expect(cfg.salida.passwordCifrada.startsWith("enc:v1:")).toBe(true);

    const serializado = JSON.stringify(cfg);
    expect(serializado).not.toContain("secreto-entrada");
    expect(serializado).not.toContain("secreto-salida");
  });

  it("descifra de vuelta el valor original", () => {
    const cfg = configuracionDePrueba();

    expect(descifrarConexion(cfg.entrada).password).toBe("secreto-entrada");
    expect(descifrarConexion(cfg.salida).password).toBe("secreto-salida");
    expect(descifrarConexion(cfg.salida).nombreRemitente).toBe("Ventas Mi Negocio");
  });

  it("al editar sin contraseña nueva, conserva la que ya estaba guardada", () => {
    const anterior = configuracionDePrueba();

    const editada = construirConfiguracionBuzon({
      entrada: { ...ENTRADA, password: undefined, puerto: 143, seguridad: "STARTTLS" },
      salida: { ...SALIDA, password: undefined },
      recepcion: RECEPCION,
      anterior,
    });

    expect(editada.entrada.passwordCifrada).toBe(anterior.entrada.passwordCifrada);
    expect(editada.entrada.puerto).toBe(143);
    expect(descifrarConexion(editada.entrada).password).toBe("secreto-entrada");
  });

  it("sin contraseña y sin configuración anterior: falla en vez de guardar un buzón inservible", () => {
    expect(() =>
      construirConfiguracionBuzon({
        entrada: { ...ENTRADA, password: undefined },
        salida: SALIDA,
        recepcion: RECEPCION,
      }),
    ).toThrow(/contraseña de entrada/i);
  });
});

describe("configuración del buzón — frontera hacia el cliente", () => {
  const cuenta = {
    id: "cc-1",
    nombre: "Ventas",
    identificador: "ventas@negocio.com",
    activa: true,
    configuracion: configuracionDePrueba() as unknown,
    pipelineId: "pipe-1",
    stageId: "stage-1",
    stageIdRespuestaAutomatica: null,
    buzonCorreoEstado: {
      ultimaLecturaOkEn: new Date("2026-11-15T10:00:00Z"),
      errorCodigo: null,
      errorMensaje: null,
    },
  };

  it("no filtra ninguna contraseña, ni cifrada ni en claro", () => {
    const buzon = aBuzonParaCliente(cuenta);

    const serializado = JSON.stringify(buzon);
    expect(serializado).not.toContain("enc:v1:");
    expect(serializado).not.toContain("secreto-entrada");
    expect(serializado).not.toContain("passwordCifrada");
    expect(serializado).not.toContain("password");
  });

  it("informa que hay credenciales cargadas sin revelarlas", () => {
    const buzon = aBuzonParaCliente(cuenta);

    expect(buzon?.tieneCredenciales).toBe(true);
    expect(buzon?.entrada.servidor).toBe("imap.proveedor.com");
    expect(buzon?.direccion).toBe("ventas@negocio.com");
    expect(buzon?.estado.errorCodigo).toBeNull();
  });

  it("una cuenta de canal sin configuración de buzón no se proyecta", () => {
    expect(aBuzonParaCliente({ ...cuenta, configuracion: { accessToken: "x" } })).toBeNull();
  });
});

describe("lectura y normalización", () => {
  it("completa las opciones de recepción ausentes con los valores por defecto", () => {
    const cfg = leerConfiguracionBuzon({
      entrada: { servidor: "a", puerto: 993, seguridad: "SSL_TLS", usuario: "u", passwordCifrada: "x" },
      salida: { servidor: "b", puerto: 465, seguridad: "SSL_TLS", usuario: "u", passwordCifrada: "x" },
    });

    expect(cfg?.recepcion).toEqual({ agrupacion: "POR_REMITENTE", crearContactosAutomaticamente: true });
  });

  it("normaliza la dirección a minúsculas y sin espacios", () => {
    expect(normalizarDireccion("  Juan@Ejemplo.COM ")).toBe("juan@ejemplo.com");
  });
});
