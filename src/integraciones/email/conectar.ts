// Validación de las credenciales del buzón contra el servidor real, antes de
// activar el canal (FR-003, FR-004).
//
// Las dos conexiones se prueban por separado y se informan por separado: lo
// más común es que una ande y la otra no (puertos de entrada y salida
// distintos, o un proveedor que exige contraseña de aplicación solo para SMTP).
import nodemailer from "nodemailer";
import type { ConexionCorreoDescifrada } from "./configuracion";
import { conexionFallida, conexionOk, traducirErrorCorreo, type ResultadoConexion } from "./errores";
import { ErrorCorreo, TIMEOUT_MS, verificarAcceso } from "./imap/cliente";

export interface ResultadoPrueba {
  entrada: ResultadoConexion;
  salida: ResultadoConexion;
}

/** Transporte SMTP. Lo comparten la prueba de conexión y el envío real. */
export function construirTransporteSmtp(conexion: ConexionCorreoDescifrada) {
  return nodemailer.createTransport({
    host: conexion.servidor,
    port: conexion.puerto,
    secure: conexion.seguridad === "SSL_TLS",
    ...(conexion.seguridad === "STARTTLS" ? { requireTLS: true } : {}),
    ...(conexion.seguridad === "NINGUNA" ? { ignoreTLS: true } : {}),
    auth: { user: conexion.usuario, pass: conexion.password },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

export async function probarConexionEntrada(
  conexion: ConexionCorreoDescifrada,
): Promise<ResultadoConexion> {
  try {
    await verificarAcceso(conexion);
    return conexionOk();
  } catch (err) {
    // El detalle técnico queda solo en el log del servidor: al navegador va el
    // código funcional y su mensaje en español.
    console.error("[correo] prueba de conexión de entrada fallida", {
      servidor: conexion.servidor,
      puerto: conexion.puerto,
      error: err instanceof Error ? err.message : String(err),
    });
    return conexionFallida(err instanceof ErrorCorreo ? err.codigo : traducirErrorCorreo(err));
  }
}

export async function probarConexionSalida(
  conexion: ConexionCorreoDescifrada,
): Promise<ResultadoConexion> {
  const transporte = construirTransporteSmtp(conexion);
  try {
    await transporte.verify();
    return conexionOk();
  } catch (err) {
    console.error("[correo] prueba de conexión de salida fallida", {
      servidor: conexion.servidor,
      puerto: conexion.puerto,
      error: err instanceof Error ? err.message : String(err),
    });
    return conexionFallida(traducirErrorCorreo(err));
  } finally {
    transporte.close();
  }
}

/** Prueba las dos conexiones en paralelo: son independientes entre sí. */
export async function probarConexiones(input: {
  entrada: ConexionCorreoDescifrada;
  salida: ConexionCorreoDescifrada;
}): Promise<ResultadoPrueba> {
  const [entrada, salida] = await Promise.all([
    probarConexionEntrada(input.entrada),
    probarConexionSalida(input.salida),
  ]);
  return { entrada, salida };
}
