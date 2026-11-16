// Cifrado y descifrado de las credenciales del buzón, y proyección hacia el
// cliente. SOLO servidor: importa `node:crypto` a través de cifrado-tokens.
//
// Los tipos y las constantes que el navegador también necesita viven en
// ./tipos.ts — ver el comentario de ese archivo para el porqué.
import type { Prisma } from "@/generated/prisma/client";
import { cifrarToken, descifrarToken } from "@/shared/lib/cifrado-tokens";
import type { CodigoErrorCorreo } from "./errores";
import type {
  BuzonParaCliente,
  ConexionCorreoAlmacenada,
  ConexionCorreoDescifrada,
  ConexionCorreoEntrada,
  ConfiguracionBuzonAlmacenada,
} from "./tipos";

// Reexportados para que el código de servidor siga importando de un solo lugar.
export * from "./tipos";

// ── Cifrado / descifrado ────────────────────────────────────────────────────

/**
 * Arma la configuración a persistir cifrando las contraseñas.
 *
 * `anterior` permite editar sin reenviar las contraseñas: si el formulario no
 * trae `password`, se conserva la que ya estaba guardada. Si no hay anterior y
 * tampoco password, es un error de programación — el esquema Zod exige la
 * contraseña al crear, así que no debería llegar acá.
 */
export function construirConfiguracionBuzon(input: {
  entrada: ConexionCorreoEntrada;
  salida: ConexionCorreoEntrada;
  recepcion: ConfiguracionBuzonAlmacenada["recepcion"];
  anterior?: ConfiguracionBuzonAlmacenada | null;
}): ConfiguracionBuzonAlmacenada {
  const { entrada, salida, recepcion, anterior } = input;

  const cifrar = (
    conexion: ConexionCorreoEntrada,
    previa: ConexionCorreoAlmacenada | undefined,
    cual: "entrada" | "salida",
  ): string => {
    if (conexion.password) return cifrarToken(conexion.password);
    if (previa?.passwordCifrada) return previa.passwordCifrada;
    throw new Error(`Falta la contraseña de ${cual} del buzón`);
  };

  return {
    entrada: {
      servidor: entrada.servidor,
      puerto: entrada.puerto,
      seguridad: entrada.seguridad,
      usuario: entrada.usuario,
      passwordCifrada: cifrar(entrada, anterior?.entrada, "entrada"),
    },
    salida: {
      servidor: salida.servidor,
      puerto: salida.puerto,
      seguridad: salida.seguridad,
      usuario: salida.usuario,
      passwordCifrada: cifrar(salida, anterior?.salida, "salida"),
      ...(salida.nombreRemitente ? { nombreRemitente: salida.nombreRemitente } : {}),
    },
    recepcion,
  };
}

/** Lee la configuración cruda de Prisma. Devuelve null si no tiene la forma esperada. */
export function leerConfiguracionBuzon(valor: unknown): ConfiguracionBuzonAlmacenada | null {
  if (!valor || typeof valor !== "object") return null;
  const cfg = valor as Partial<ConfiguracionBuzonAlmacenada>;
  if (!cfg.entrada?.servidor || !cfg.salida?.servidor) return null;
  return {
    entrada: cfg.entrada,
    salida: cfg.salida,
    recepcion: {
      agrupacion: cfg.recepcion?.agrupacion ?? "POR_REMITENTE",
      crearContactosAutomaticamente: cfg.recepcion?.crearContactosAutomaticamente ?? true,
    },
  };
}

/** Descifra una conexión para usarla contra el servidor. Solo en el servidor. */
export function descifrarConexion(
  conexion: ConexionCorreoAlmacenada & { nombreRemitente?: string },
): ConexionCorreoDescifrada {
  return {
    servidor: conexion.servidor,
    puerto: conexion.puerto,
    seguridad: conexion.seguridad,
    usuario: conexion.usuario,
    password: descifrarToken(conexion.passwordCifrada),
    ...(conexion.nombreRemitente ? { nombreRemitente: conexion.nombreRemitente } : {}),
  };
}

/**
 * Proyecta un buzón a lo único que puede ver el navegador.
 *
 * Nota de diseño: esta función es la frontera. Toda query que devuelva buzones
 * debe pasar por acá — así no hay forma de filtrar una contraseña por olvido
 * en un `select`.
 */
export function aBuzonParaCliente(cuenta: {
  id: string;
  nombre: string;
  identificador: string;
  activa: boolean;
  configuracion: unknown;
  pipelineId: string | null;
  stageId: string | null;
  stageIdRespuestaAutomatica: string | null;
  buzonCorreoEstado?: {
    ultimaLecturaOkEn: Date | null;
    errorCodigo: string | null;
    errorMensaje: string | null;
  } | null;
}): BuzonParaCliente | null {
  const cfg = leerConfiguracionBuzon(cuenta.configuracion);
  if (!cfg) return null;

  const sinPassword = (c: ConexionCorreoAlmacenada) => ({
    servidor: c.servidor,
    puerto: c.puerto,
    seguridad: c.seguridad,
    usuario: c.usuario,
  });

  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    direccion: cuenta.identificador,
    activa: cuenta.activa,
    entrada: sinPassword(cfg.entrada),
    salida: {
      ...sinPassword(cfg.salida),
      ...(cfg.salida.nombreRemitente ? { nombreRemitente: cfg.salida.nombreRemitente } : {}),
    },
    tieneCredenciales: Boolean(cfg.entrada.passwordCifrada && cfg.salida.passwordCifrada),
    recepcion: cfg.recepcion,
    pipelineId: cuenta.pipelineId,
    stageId: cuenta.stageId,
    stageIdRespuestaAutomatica: cuenta.stageIdRespuestaAutomatica,
    estado: {
      ultimaLecturaOkEn: cuenta.buzonCorreoEstado?.ultimaLecturaOkEn ?? null,
      errorCodigo: (cuenta.buzonCorreoEstado?.errorCodigo as CodigoErrorCorreo | null) ?? null,
      errorMensaje: cuenta.buzonCorreoEstado?.errorMensaje ?? null,
    },
  };
}

/** Normaliza una dirección de correo para comparar y guardar (FR-015). */
export function normalizarDireccion(direccion: string): string {
  return direccion.trim().toLowerCase();
}

/**
 * Adapta la configuración a lo que Prisma acepta en una columna `Json`.
 *
 * Prisma exige un tipo con firma de índice y una interfaz nominal no la tiene.
 * El cast vive acá, en un solo lugar y con nombre, en vez de repetirse en cada
 * `create`/`update` del módulo.
 */
export function configuracionAJson(cfg: ConfiguracionBuzonAlmacenada): Prisma.InputJsonValue {
  return cfg as unknown as Prisma.InputJsonValue;
}
