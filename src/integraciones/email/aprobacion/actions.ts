"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { CANAL_EMAIL } from "../tipos";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function error(mensaje: string): { ok: false; error: string } {
  return { ok: false, error: mensaje };
}

interface ConversacionPendiente {
  id: string;
  contactoId: string;
  instanciaId: string;
  identificadorId: string;
  identificador: string;
}

/**
 * Carga una conversación pendiente validando que de verdad lo esté y que
 * pertenezca a la instancia de la sesión.
 */
async function cargarPendiente(
  conversacionId: string,
  instanciaId: string,
): Promise<ConversacionPendiente | null> {
  const conversacion = await prisma.conversacion.findFirst({
    where: { id: conversacionId, instanciaId, bloqueadaPorAprobacion: true },
    select: { id: true, contactoId: true, instanciaId: true },
  });
  if (!conversacion?.instanciaId) return null;

  const identificador = await prisma.contactoIdentificadorCanal.findFirst({
    where: { contactoId: conversacion.contactoId, instanciaId, canal: CANAL_EMAIL },
    select: { id: true, identificador: true },
  });
  if (!identificador) return null;

  return {
    id: conversacion.id,
    contactoId: conversacion.contactoId,
    instanciaId: conversacion.instanciaId,
    identificadorId: identificador.id,
    identificador: identificador.identificador,
  };
}

/**
 * Único lugar del código que puede levantar el bloqueo por aprobación.
 *
 * Escribe las tres piezas en UNA transacción:
 *   1. `ContactoIdentificadorCanal.aprobadoEn` — la fuente de verdad, por
 *      dirección: es lo que hace que los correos siguientes de ese remitente
 *      entren solos (FR-037).
 *   2. `Conversacion.bloqueadaPorAprobacion = false` — lo que leen los tres
 *      cortes de envío.
 *   3. `Oportunidad.aprobacionPendiente = false` — lo que distingue la tarjeta
 *      en el Kanban.
 *
 * Las dos últimas son banderas derivadas de la primera; escribirlas juntas es
 * lo que impide que se desincronicen.
 */
async function aprobarRemitenteCorreo(input: {
  pendiente: ConversacionPendiente;
  usuarioId: string;
  /** Contacto definitivo. Si difiere del actual, la conversación se reasigna. */
  contactoDestinoId: string;
  /** Datos con los que activar el contacto provisional, si se conserva. */
  datosContacto?: { nombre: string; apellido?: string };
}): Promise<void> {
  const { pendiente, usuarioId, contactoDestinoId, datosContacto } = input;
  const reasigna = contactoDestinoId !== pendiente.contactoId;

  await prisma.$transaction(async (tx) => {
    await tx.contactoIdentificadorCanal.update({
      where: { id: pendiente.identificadorId },
      data: {
        aprobadoEn: new Date(),
        aprobadoPorId: usuarioId,
        ...(reasigna ? { contactoId: contactoDestinoId } : {}),
      },
    });

    if (reasigna) {
      await tx.conversacion.update({
        where: { id: pendiente.id },
        data: { contactoId: contactoDestinoId, bloqueadaPorAprobacion: false },
      });
      // Las oportunidades que nacieron del pendiente pasan al contacto real.
      await tx.oportunidadContacto.updateMany({
        where: { contactoId: pendiente.contactoId, oportunidad: { instanciaId: pendiente.instanciaId } },
        data: { contactoId: contactoDestinoId },
      });
    } else {
      await tx.conversacion.update({
        where: { id: pendiente.id },
        data: { bloqueadaPorAprobacion: false },
      });
      await tx.contacto.update({
        where: { id: pendiente.contactoId },
        data: {
          activo: true,
          ...(datosContacto?.nombre ? { nombre: datosContacto.nombre } : {}),
          ...(datosContacto?.apellido ? { apellido: datosContacto.apellido } : {}),
        },
      });
    }

    await tx.oportunidad.updateMany({
      where: {
        instanciaId: pendiente.instanciaId,
        aprobacionPendiente: true,
        conversaciones: { some: { conversacionId: pendiente.id } },
      },
      data: { aprobacionPendiente: false },
    });

    if (reasigna) {
      // El contacto provisional ya no sostiene nada: se elimina para no dejar
      // un duplicado inactivo en el CRM.
      await tx.contacto.delete({ where: { id: pendiente.contactoId } }).catch(() => undefined);
    }
  });
}

// Mismo módulo de permisos que el resto de las acciones del Inbox
// (ver src/conversaciones/actions.ts): aprobar un remitente es atender una
// conversación, no configurar una integración.
async function sesionConPermiso() {
  const auth = await requirePermisoAction("inbox", "modificar");
  return auth.ok ? auth.sesion : null;
}

function revalidar() {
  try {
    revalidatePath("/conversaciones");
    revalidatePath("/crm/pipeline");
  } catch {
    /* fuera de request context */
  }
}

/** Aprueba el remitente creando un contacto nuevo con sus datos (FR-035). */
export async function aprobarRemitenteConContactoNuevo(input: {
  conversacionId: string;
  nombre: string;
  apellido?: string;
}): Promise<Resultado<{ contactoId: string }>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para aprobar remitentes");

  const nombre = input.nombre?.trim();
  if (!nombre) return error("Indicá un nombre para el contacto");

  const pendiente = await cargarPendiente(input.conversacionId, sesion.instanciaId);
  if (!pendiente) return error("Esta conversación no está pendiente de aprobación");

  await aprobarRemitenteCorreo({
    pendiente,
    usuarioId: sesion.usuarioId,
    contactoDestinoId: pendiente.contactoId,
    datosContacto: { nombre, apellido: input.apellido?.trim() },
  });

  revalidar();
  return { ok: true, data: { contactoId: pendiente.contactoId } };
}

/** Aprueba el remitente asociándolo a un contacto que ya existe (FR-035). */
export async function aprobarRemitenteConContactoExistente(input: {
  conversacionId: string;
  contactoId: string;
}): Promise<Resultado<{ contactoId: string }>> {
  const sesion = await sesionConPermiso();
  if (!sesion) return error("No tenés permisos para aprobar remitentes");

  const pendiente = await cargarPendiente(input.conversacionId, sesion.instanciaId);
  if (!pendiente) return error("Esta conversación no está pendiente de aprobación");

  const destino = await prisma.contacto.findFirst({
    where: { id: input.contactoId, instanciaId: sesion.instanciaId },
    select: { id: true, email: true },
  });
  if (!destino) return error("El contacto elegido no existe en esta cuenta");

  await aprobarRemitenteCorreo({
    pendiente,
    usuarioId: sesion.usuarioId,
    contactoDestinoId: destino.id,
  });

  // Completar el correo en la ficha si no lo tenía: es el dato por el que el
  // cliente escribió, y sin él el contacto queda sin forma de contactarlo.
  if (!destino.email) {
    await prisma.contacto
      .update({ where: { id: destino.id }, data: { email: pendiente.identificador } })
      .catch(() => undefined);
  }

  revalidar();
  return { ok: true, data: { contactoId: destino.id } };
}
