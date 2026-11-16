"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import {
  CANAL_EMAIL,
  configuracionAJson,
  construirConfiguracionBuzon,
  descifrarConexion,
  leerConfiguracionBuzon,
  normalizarDireccion,
  type BuzonParaCliente,
  type ConexionCorreoEntrada,
} from "./configuracion";
import { probarConexiones, type ResultadoPrueba } from "./conectar";
import { obtenerPosicionActual } from "./imap/cliente";
import { anclarMarca, crearEstadoBuzon } from "./imap/marca-lectura";
import {
  SchemaCambiarEstadoBuzon,
  SchemaEditarBuzon,
  SchemaEliminarBuzon,
  SchemaProbarConexion,
  SchemaRegistrarBuzon,
} from "./schema";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

const RUTA = "/integraciones/email";

function error(mensaje: string): { ok: false; error: string } {
  return { ok: false, error: mensaje };
}

async function sesionConPermiso() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
    return null;
  }
  return sesion;
}

/**
 * Convierte lo que llega del formulario en credenciales usables.
 *
 * Al editar, el formulario manda la contraseña vacía para decir "dejá la que
 * ya está": en ese caso se toma la guardada, descifrándola solo acá.
 */
function resolverConexion(
  entrada: ConexionCorreoEntrada,
  guardada: { passwordCifrada: string } | undefined,
  nombreRemitente?: string,
) {
  const password = entrada.password
    ? entrada.password
    : guardada
      ? descifrarConexion({ ...entrada, passwordCifrada: guardada.passwordCifrada }).password
      : "";

  return {
    servidor: entrada.servidor,
    puerto: entrada.puerto,
    seguridad: entrada.seguridad,
    usuario: entrada.usuario,
    password,
    ...(nombreRemitente ? { nombreRemitente } : {}),
  };
}

async function configuracionGuardada(cuentaCanalId: string, instanciaId: string) {
  const cuenta = await prisma.cuentaCanal.findFirst({
    where: { id: cuentaCanalId, instanciaId, canal: CANAL_EMAIL },
    select: { configuracion: true },
  });
  return cuenta ? leerConfiguracionBuzon(cuenta.configuracion) : null;
}

// ── Prueba de conexión ──────────────────────────────────────────────────────

/** Prueba entrada y salida contra el servidor real. No persiste nada (FR-003). */
export async function probarConexionBuzon(input: unknown): Promise<Resultado<ResultadoPrueba>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para configurar integraciones");

  const parseado = SchemaProbarConexion.safeParse(input);
  if (!parseado.success) return error(parseado.error.issues[0]?.message ?? "Datos inválidos");

  const { cuentaCanalId, entrada, salida } = parseado.data;
  const previa = cuentaCanalId ? await configuracionGuardada(cuentaCanalId, sesion.instanciaId) : null;

  const conexionEntrada = resolverConexion(entrada, previa?.entrada);
  const conexionSalida = resolverConexion(salida, previa?.salida, salida.nombreRemitente);

  if (!conexionEntrada.password || !conexionSalida.password) {
    return error("Faltan las contraseñas del buzón");
  }

  try {
    return { ok: true, data: await probarConexiones({ entrada: conexionEntrada, salida: conexionSalida }) };
  } catch {
    return error("No se pudo completar la prueba de conexión");
  }
}

// ── Alta ────────────────────────────────────────────────────────────────────

/**
 * Registra el buzón. Solo persiste si las dos conexiones responden (FR-004):
 * un buzón guardado con credenciales que no andan es un canal que el negocio
 * cree tener y no tiene.
 */
export async function registrarBuzon(input: unknown): Promise<Resultado<{ id: string }>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para configurar integraciones");

  const parseado = SchemaRegistrarBuzon.safeParse(input);
  if (!parseado.success) return error(parseado.error.issues[0]?.message ?? "Datos inválidos");

  const datos = parseado.data;
  const direccion = normalizarDireccion(datos.direccion);

  const yaExiste = await prisma.cuentaCanal.findFirst({
    where: { instanciaId: sesion.instanciaId, canal: CANAL_EMAIL, identificador: direccion },
    select: { id: true },
  });
  if (yaExiste) return error("Ese buzón ya está registrado en esta cuenta");

  const conexionEntrada = resolverConexion(datos.entrada, undefined);
  const conexionSalida = resolverConexion(datos.salida, undefined, datos.salida.nombreRemitente);

  const prueba = await probarConexiones({ entrada: conexionEntrada, salida: conexionSalida });
  if (!prueba.entrada.ok || !prueba.salida.ok) {
    const fallo = !prueba.entrada.ok ? prueba.entrada : prueba.salida;
    return error(fallo.mensaje ?? "No se pudo conectar con el servidor de correo");
  }

  const pipelineValido = await validarPipelineYEtapa(datos, sesion.instanciaId);
  if (!pipelineValido.ok) return pipelineValido;

  const configuracion = construirConfiguracionBuzon({
    entrada: datos.entrada,
    salida: datos.salida,
    recepcion: datos.recepcion,
  });

  const cuenta = await prisma.cuentaCanal.create({
    data: {
      canal: CANAL_EMAIL,
      nombre: datos.nombre,
      identificador: direccion,
      configuracion: configuracionAJson(configuracion),
      activa: true,
      instanciaId: sesion.instanciaId,
      pipelineId: datos.pipelineId ?? null,
      stageId: datos.stageId ?? null,
      stageIdRespuestaAutomatica: datos.stageIdRespuestaAutomatica ?? null,
    },
    select: { id: true },
  });

  await crearEstadoBuzon(cuenta.id, sesion.instanciaId);

  // Anclar la marca al UID más alto que ya existe: el historial previo de la
  // casilla no entra al CRM (FR-023). Si falla, el primer ciclo de lectura lo
  // resuelve igual — no vale la pena tirar abajo el alta por esto.
  try {
    const posicion = await obtenerPosicionActual(conexionEntrada);
    await anclarMarca(cuenta.id, sesion.instanciaId, posicion);
  } catch {
    console.warn(`[correo] no se pudo anclar la marca del buzón ${cuenta.id}; se anclará en el primer ciclo`);
  }

  revalidatePath(RUTA);
  return { ok: true, data: { id: cuenta.id } };
}

// ── Edición ─────────────────────────────────────────────────────────────────

export async function actualizarBuzon(input: unknown): Promise<Resultado<{ id: string }>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para configurar integraciones");

  const parseado = SchemaEditarBuzon.safeParse(input);
  if (!parseado.success) return error(parseado.error.issues[0]?.message ?? "Datos inválidos");

  const datos = parseado.data;
  const anterior = await configuracionGuardada(datos.id, sesion.instanciaId);
  if (!anterior) return error("Buzón no encontrado");

  const direccion = normalizarDireccion(datos.direccion);
  const duplicado = await prisma.cuentaCanal.findFirst({
    where: {
      instanciaId: sesion.instanciaId,
      canal: CANAL_EMAIL,
      identificador: direccion,
      NOT: { id: datos.id },
    },
    select: { id: true },
  });
  if (duplicado) return error("Ya hay otro buzón registrado con esa dirección");

  const conexionEntrada = resolverConexion(datos.entrada, anterior.entrada);
  const conexionSalida = resolverConexion(datos.salida, anterior.salida, datos.salida.nombreRemitente);

  const prueba = await probarConexiones({ entrada: conexionEntrada, salida: conexionSalida });
  if (!prueba.entrada.ok || !prueba.salida.ok) {
    const fallo = !prueba.entrada.ok ? prueba.entrada : prueba.salida;
    return error(fallo.mensaje ?? "No se pudo conectar con el servidor de correo");
  }

  const pipelineValido = await validarPipelineYEtapa(datos, sesion.instanciaId);
  if (!pipelineValido.ok) return pipelineValido;

  const configuracion = construirConfiguracionBuzon({
    entrada: datos.entrada,
    salida: datos.salida,
    recepcion: datos.recepcion,
    anterior,
  });

  await prisma.cuentaCanal.updateMany({
    where: { id: datos.id, instanciaId: sesion.instanciaId, canal: CANAL_EMAIL },
    data: {
      nombre: datos.nombre,
      identificador: direccion,
      configuracion: configuracionAJson(configuracion),
      pipelineId: datos.pipelineId ?? null,
      stageId: datos.stageId ?? null,
      stageIdRespuestaAutomatica: datos.stageIdRespuestaAutomatica ?? null,
    },
  });

  revalidatePath(RUTA);
  return { ok: true, data: { id: datos.id } };
}

// ── Estado y baja ───────────────────────────────────────────────────────────

export async function cambiarEstadoBuzon(input: unknown): Promise<Resultado<{ activa: boolean }>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para configurar integraciones");

  const parseado = SchemaCambiarEstadoBuzon.safeParse(input);
  if (!parseado.success) return error("Datos inválidos");

  const { count } = await prisma.cuentaCanal.updateMany({
    where: { id: parseado.data.id, instanciaId: sesion.instanciaId, canal: CANAL_EMAIL },
    data: { activa: parseado.data.activa },
  });
  if (count === 0) return error("Buzón no encontrado");

  revalidatePath(RUTA);
  return { ok: true, data: { activa: parseado.data.activa } };
}

/** Elimina el buzón. Las conversaciones ya recibidas se conservan. */
export async function eliminarBuzon(input: unknown): Promise<Resultado<null>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para configurar integraciones");

  const parseado = SchemaEliminarBuzon.safeParse(input);
  if (!parseado.success) return error("Datos inválidos");

  const { count } = await prisma.cuentaCanal.deleteMany({
    where: { id: parseado.data.id, instanciaId: sesion.instanciaId, canal: CANAL_EMAIL },
  });
  if (count === 0) return error("Buzón no encontrado");

  revalidatePath(RUTA);
  return { ok: true, data: null };
}

/** Lectura para el cliente, sin credenciales. */
export async function obtenerBuzonesAction(): Promise<BuzonParaCliente[]> {
  const sesion = await requireSesion();
  const { obtenerBuzones } = await import("./queries");
  return obtenerBuzones(sesion.instanciaId);
}

// ── Validaciones compartidas ────────────────────────────────────────────────

async function validarPipelineYEtapa(
  datos: {
    pipelineId?: string | null;
    stageId?: string | null;
    stageIdRespuestaAutomatica?: string | null;
  },
  instanciaId: string,
): Promise<{ ok: true; data: null } | { ok: false; error: string }> {
  if (!datos.pipelineId && !datos.stageId && !datos.stageIdRespuestaAutomatica) {
    return { ok: true, data: null };
  }

  if (datos.pipelineId) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: datos.pipelineId, instanciaId },
      select: { id: true },
    });
    if (!pipeline) return error("El pipeline elegido no existe en esta cuenta");
  }

  if (datos.stageId) {
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id: datos.stageId,
        pipeline: { instanciaId, ...(datos.pipelineId ? { id: datos.pipelineId } : {}) },
      },
      select: { id: true },
    });
    if (!stage) return error("La etapa elegida no pertenece al pipeline seleccionado");
  }

  // La etapa de respuesta puede vivir en otro pipeline (igual que en los
  // canales de mensajería, donde el pipeline destino se deriva del stage):
  // solo se exige que pertenezca a la instancia.
  if (datos.stageIdRespuestaAutomatica) {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: datos.stageIdRespuestaAutomatica, pipeline: { instanciaId } },
      select: { id: true },
    });
    if (!stage) return error("La etapa de respuesta elegida no existe en esta cuenta");
  }

  return { ok: true, data: null };
}
