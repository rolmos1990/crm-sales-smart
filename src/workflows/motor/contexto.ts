import { prisma } from "@/shared/db/prisma";
import { interpolarPlantilla, type ContextoInterpolacion } from "@/conversaciones/interpolacion";
import type { EjecucionEnCurso, MetaEjecucion } from "./tipos";

// Datos del CRM que ven los nodos: se leen frescos en cada avance de la
// ejecución (nunca se copian al contexto guardado), así un Workflow que
// espera 3 días ve la oportunidad tal como está al despertar.

export interface ContextoDatos {
  interpolacion: ContextoInterpolacion;
  oportunidad: {
    id: string;
    titulo: string;
    valor: number;
    probabilidad: number;
    stageId: string | null;
    fechaCierre: Date | null;
    usuarioInstanciaId: string | null;
  } | null;
  contacto: { id: string; email: string | null; telefonoPrincipal: string | null } | null;
  conversacion: { id: string; canal: string | null } | null;
}

export async function cargarContextoDatos(ej: EjecucionEnCurso): Promise<ContextoDatos> {
  const [oportunidad, conversacion] = await Promise.all([
    ej.oportunidadId
      ? prisma.oportunidad.findFirst({
          where: { id: ej.oportunidadId, instanciaId: ej.instanciaId },
          select: {
            id: true,
            titulo: true,
            descripcion: true,
            valor: true,
            moneda: true,
            probabilidad: true,
            fechaCierre: true,
            fechaGanada: true,
            fechaPerdida: true,
            motivoPerdida: true,
            metadata: true,
            stageId: true,
            creadoEn: true,
            actualizadoEn: true,
            usuarioInstanciaId: true,
            stage: { select: { nombre: true } },
            usuarioInstancia: { select: { usuario: { select: { nombre: true, email: true } } } },
            contactos: { where: { principal: true }, select: { contactoId: true }, take: 1 },
          },
        })
      : null,
    ej.conversacionId
      ? prisma.conversacion.findFirst({
          where: { id: ej.conversacionId, instanciaId: ej.instanciaId },
          select: { id: true, contactoId: true, cuentaCanal: { select: { canal: true } } },
        })
      : null,
  ]);

  const contactoId = ej.contactoId ?? conversacion?.contactoId ?? oportunidad?.contactos[0]?.contactoId ?? null;
  const contacto = contactoId
    ? await prisma.contacto.findFirst({
        where: { id: contactoId, instanciaId: ej.instanciaId },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          telefonoPrincipal: true,
          telefonoSecundario: true,
          cargo: true,
          creadoEn: true,
          actualizadoEn: true,
          empresa: { select: { nombre: true, ruc: true, industria: true, sitioWeb: true, telefono: true, email: true, metadata: true } },
        },
      })
    : null;

  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  const agente = oportunidad?.usuarioInstancia?.usuario;

  return {
    interpolacion: {
      contacto: contacto
        ? { ...contacto, creadoEn: iso(contacto.creadoEn), actualizadoEn: iso(contacto.actualizadoEn) }
        : null,
      empresa: contacto?.empresa
        ? { ...contacto.empresa, metadata: (contacto.empresa.metadata as Record<string, unknown> | null) ?? null }
        : null,
      oportunidad: oportunidad
        ? {
            titulo: oportunidad.titulo,
            descripcion: oportunidad.descripcion,
            etapa: oportunidad.stage?.nombre ?? null,
            valor: oportunidad.valor.toString(),
            moneda: oportunidad.moneda,
            probabilidad: oportunidad.probabilidad,
            fechaCierre: iso(oportunidad.fechaCierre),
            fechaGanada: iso(oportunidad.fechaGanada),
            fechaPerdida: iso(oportunidad.fechaPerdida),
            motivoPerdida: oportunidad.motivoPerdida,
            creadoEn: iso(oportunidad.creadoEn),
            actualizadoEn: iso(oportunidad.actualizadoEn),
            metadata: (oportunidad.metadata as Record<string, unknown> | null) ?? null,
          }
        : null,
      agente: agente?.nombre ?? null,
      correo_agente: agente?.email ?? null,
    },
    oportunidad: oportunidad
      ? {
          id: oportunidad.id,
          titulo: oportunidad.titulo,
          valor: Number(oportunidad.valor),
          probabilidad: oportunidad.probabilidad,
          stageId: oportunidad.stageId,
          fechaCierre: oportunidad.fechaCierre,
          usuarioInstanciaId: oportunidad.usuarioInstanciaId,
        }
      : null,
    contacto: contacto ? { id: contacto.id, email: contacto.email, telefonoPrincipal: contacto.telefonoPrincipal } : null,
    conversacion: conversacion ? { id: conversacion.id, canal: conversacion.cuentaCanal?.canal ?? null } : null,
  };
}

/**
 * {{ruta}} → valor. workflow.variables.* sale del contexto de la ejecución;
 * oportunidad.<x> se traduce a la clave sin prefijo que usa
 * interpolarPlantilla ({{titulo}}, {{valor}}, campos personalizados); el
 * resto (contacto.*, empresa.*, agente) va tal cual.
 */
export function interpolar(texto: string, datos: ContextoDatos, variables: Record<string, string>): string {
  return texto.replace(/\{\{([\w.]+)\}\}/g, (_, ruta: string) => {
    if (ruta.startsWith("workflow.variables.")) return variables[ruta.slice("workflow.variables.".length)] ?? "";
    const clave = ruta.startsWith("oportunidad.") ? ruta.slice("oportunidad.".length) : ruta;
    return interpolarPlantilla(`{{${clave}}}`, datos.interpolacion);
  });
}

/**
 * Hechos que evalúa el nodo Condición, indexados por la misma clave que
 * src/workflows/definicion/campos-condicion.ts.
 */
export async function resolverHechos(
  ej: EjecucionEnCurso,
  datos: ContextoDatos,
  variables: Record<string, string>,
  meta: MetaEjecucion,
): Promise<Record<string, unknown>> {
  const desde = meta.ultimaEsperaDesde ? new Date(meta.ultimaEsperaDesde) : ej.iniciadaEn;
  const [ultimoCliente, cantidadPedidos] = await Promise.all([
    ej.conversacionId
      ? prisma.mensajeConversacion.findFirst({
          where: { conversacionId: ej.conversacionId, remitente: "CONTACTO" },
          orderBy: { creadoEn: "desc" },
          select: { contenido: true, creadoEn: true },
        })
      : null,
    datos.contacto ? prisma.pedido.count({ where: { contactoId: datos.contacto.id, instanciaId: ej.instanciaId } }) : 0,
  ]);

  const hechos: Record<string, unknown> = {
    "conversacion.clienteRespondio": !!ultimoCliente && ultimoCliente.creadoEn > desde,
    "conversacion.ultimoMensajeCliente": ultimoCliente?.contenido ?? "",
    "conversacion.canal": datos.conversacion?.canal ?? null,
    "oportunidad.valor": datos.oportunidad?.valor ?? null,
    "oportunidad.probabilidad": datos.oportunidad?.probabilidad ?? null,
    "oportunidad.titulo": datos.oportunidad?.titulo ?? null,
    "oportunidad.etapa": datos.oportunidad?.stageId ?? null,
    "oportunidad.fechaCierre": datos.oportunidad?.fechaCierre ?? null,
    "contacto.email": datos.contacto?.email ?? null,
    "contacto.telefonoPrincipal": datos.contacto?.telefonoPrincipal ?? null,
    "contacto.tienePedidos": cantidadPedidos > 0,
    "contacto.cantidadPedidos": cantidadPedidos,
  };
  for (const [nombre, valor] of Object.entries(variables)) hechos[`workflow.variables.${nombre}`] = valor;
  return hechos;
}
