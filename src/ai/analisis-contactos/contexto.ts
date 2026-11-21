import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import type { ContactoParaIA } from "@/crm/contactos/analisis/types";
import type { LecturaConversacion } from "@/ai/ficha-conversacion/tipos";

/**
 * 042 — Contexto compacto de cada contacto para la IA (FR-014, research D6).
 *
 * Prioriza lo que Karia ya resumió (la lectura de la ficha 031) y solo cae a
 * mensajes recortados cuando una conversación no tiene lectura —las atendidas
 * solo por personas—. Nunca manda una conversación completa: tope de ~1.500
 * tokens por contacto, recortando primero los mensajes y después los
 * resúmenes más viejos.
 */

export const MAX_MENSAJES_POR_CONVERSACION = 12;
export const LARGO_MAXIMO_MENSAJE = 300;
export const TOPE_CARACTERES_CONTACTO = 6000; // ≈ 1.500 tokens (4 caracteres por token)

export interface ResumenConversacionIA {
  canal: string | null;
  tema: string | null;
  intencion: string | null;
  resumen: string;
}

export interface MensajeIA {
  de: "CLIENTE" | "NEGOCIO";
  texto: string;
}

export interface ConversacionesContacto {
  resumenes: ResumenConversacionIA[];
  mensajesRecientes: MensajeIA[];
}

export interface ContextoContactoIA {
  ref: string;
  hechos: {
    relacionComercial: string;
    compras: number;
    ultimaCompraHaceDias: number | null;
    cotizacionesActivas: number;
    oportunidadesAbiertas: number;
    seguimiento: string;
    esperandoRespuesta: boolean;
    puntajeBase: number;
  };
  evaluacionAnterior: { intencion: string | null; senales: string[]; haceDias: number | null } | null;
  noContactarDescartadoEn: string | null;
  conversacion: ConversacionesContacto;
}

function recortar(t: string, max: number): string {
  const limpio = t.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

function diasEntre(desde: Date | null, ahora: Date): number | null {
  return desde ? Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / 86_400_000)) : null;
}

/** Puro: arma el contexto de un contacto y aplica el tope de tamaño. */
export function construirContextoContacto(
  contacto: ContactoParaIA,
  conversaciones: ConversacionesContacto,
  ref: string,
  ahora: Date,
): ContextoContactoIA {
  const { datos, reglas } = contacto;
  const previa = datos.evaluacionPrevia;
  const contexto: ContextoContactoIA = {
    ref,
    hechos: {
      relacionComercial: reglas.relacionComercial,
      compras: datos.compras,
      ultimaCompraHaceDias: diasEntre(datos.ultimaCompraEn, ahora),
      cotizacionesActivas: datos.cotizacionesActivas,
      oportunidadesAbiertas: datos.oportunidadesAbiertas,
      seguimiento: datos.seguimiento,
      esperandoRespuesta: datos.esperandoRespuesta,
      puntajeBase: reglas.puntajeBase,
    },
    evaluacionAnterior: previa?.evaluadoIAEn
      ? { intencion: previa.intencion, senales: previa.senales.slice(0, 5), haceDias: diasEntre(previa.evaluadoIAEn, ahora) }
      : null,
    noContactarDescartadoEn: previa?.noContactarResueltoEn?.toISOString() ?? null,
    conversacion: {
      resumenes: conversaciones.resumenes.map((r) => ({ ...r, resumen: recortar(r.resumen, 600) })),
      mensajesRecientes: conversaciones.mensajesRecientes.map((m) => ({ ...m, texto: recortar(m.texto, LARGO_MAXIMO_MENSAJE) })),
    },
  };

  // Tope de tamaño: primero se van los mensajes más viejos, después los resúmenes más viejos.
  const tamano = () => JSON.stringify(contexto).length;
  while (tamano() > TOPE_CARACTERES_CONTACTO && contexto.conversacion.mensajesRecientes.length > 0) {
    contexto.conversacion.mensajesRecientes.shift();
  }
  while (tamano() > TOPE_CARACTERES_CONTACTO && contexto.conversacion.resumenes.length > 1) {
    contexto.conversacion.resumenes.shift();
  }
  return contexto;
}

/** Textos que vio la IA de un contacto: el filtro de privacidad rechaza citas de estos. */
export function textosFuente(c: ContextoContactoIA): string[] {
  return [...c.conversacion.resumenes.map((r) => r.resumen), ...c.conversacion.mensajesRecientes.map((m) => m.texto)];
}

/**
 * Carga en bloque las conversaciones de los contactos que van a la IA: la
 * lectura de la ficha de cada conversación con actividad posterior a
 * `iaHasta`, y para las que no tienen lectura, sus últimos mensajes (una sola
 * consulta con ventana por conversación). Se incluyen los últimos 12 aunque
 * alguno sea anterior a `iaHasta`: dan el contexto de lo nuevo.
 */
export async function cargarConversacionesParaIA(
  instanciaId: string,
  contactos: Array<{ contactoId: string; iaHasta: Date | null }>,
): Promise<Map<string, ConversacionesContacto>> {
  const resultado = new Map<string, ConversacionesContacto>(
    contactos.map((c) => [c.contactoId, { resumenes: [], mensajesRecientes: [] }]),
  );
  if (contactos.length === 0) return resultado;
  const iaHastaPor = new Map(contactos.map((c) => [c.contactoId, c.iaHasta]));

  const conversaciones = await prisma.conversacion.findMany({
    where: { instanciaId, contactoId: { in: contactos.map((c) => c.contactoId) } },
    orderBy: { actualizadoEn: "asc" },
    select: {
      id: true,
      contactoId: true,
      actualizadoEn: true,
      cuentaCanal: { select: { canal: true } },
      fichaIA: { select: { interpretado: true } },
    },
  });

  const sinLectura: Array<{ id: string; contactoId: string }> = [];
  for (const conv of conversaciones) {
    const iaHasta = iaHastaPor.get(conv.contactoId) ?? null;
    if (iaHasta && conv.actualizadoEn.getTime() <= iaHasta.getTime()) continue;
    const lectura = conv.fichaIA?.interpretado as LecturaConversacion | null | undefined;
    if (lectura?.resumen) {
      resultado.get(conv.contactoId)!.resumenes.push({
        canal: conv.cuentaCanal?.canal ?? null,
        tema: lectura.tema ?? null,
        intencion: lectura.intencion ?? null,
        resumen: lectura.resumen,
      });
    } else {
      sinLectura.push({ id: conv.id, contactoId: conv.contactoId });
    }
  }

  if (sinLectura.length > 0) {
    const filas = await prisma.$queryRaw<Array<{ conversacionId: string; remitente: string; contenido: string }>>`
      -- 049 — COALESCE con la transcripción: sin esto el análisis comercial no
      -- lee nada de lo que el cliente dijo hablando, que en algunas cuentas es
      -- el 15% de las conversaciones.
      --
      -- Solo LISTO, a diferencia del inbox: "Inaudible" le dice algo al agente
      -- humano, pero al análisis solo le mete ruido en el prompt.
      SELECT "conversacionId", "remitente", "contenido" FROM (
        SELECT m."conversacionId", m."remitente",
               COALESCE(NULLIF(TRIM(m."contenido"), ''), ma."transcripcion") AS "contenido",
               m."creadoEn",
               ROW_NUMBER() OVER (PARTITION BY m."conversacionId" ORDER BY m."creadoEn" DESC) AS n
        FROM "MensajeConversacion" m
        LEFT JOIN "MediaArchivo" ma
          ON ma."id" = m."mediaArchivoId"
          AND m."tipo" IN ('AUDIO', 'NOTA_VOZ')
          AND ma."transcripcionEstado" = 'LISTO'
        WHERE m."conversacionId" IN (${Prisma.join(sinLectura.map((c) => c.id))})
          AND m."esNotaInterna" = false
          AND m."remitente" <> 'SISTEMA'
          AND COALESCE(NULLIF(TRIM(m."contenido"), ''), ma."transcripcion") IS NOT NULL
      ) x
      WHERE x.n <= ${MAX_MENSAJES_POR_CONVERSACION}
      ORDER BY x."conversacionId", x."creadoEn" ASC`;
    const contactoDe = new Map(sinLectura.map((c) => [c.id, c.contactoId]));
    for (const f of filas) {
      const contactoId = contactoDe.get(f.conversacionId);
      if (!contactoId) continue;
      resultado.get(contactoId)!.mensajesRecientes.push({
        de: f.remitente === "CONTACTO" ? "CLIENTE" : "NEGOCIO",
        texto: f.contenido,
      });
    }
  }
  return resultado;
}
