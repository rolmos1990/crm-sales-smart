import "@/voz/proveedores/inicializar";

import { prisma } from "@/shared/db/prisma";
import { getStorageProvider } from "@/lib/media/providers/factory";
import { configEntornoVoz } from "./config-entorno";
import { seleccionarProveedorVoz } from "./orquestador";
import { registrarUsoVoz } from "./auditoria";
import { nombreConExtension } from "./nombre-archivo";
import { marcarErrorDefinitivo, marcarNoAplica, devolverConBackoff } from "./cola";
import { verificarLimiteDiario, registrarConsumoLocal } from "./limites";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { ErrorProveedorVoz } from "./proveedores/types";
import type { TranscribirResult } from "./proveedores/types";

/**
 * 049 — Punto único de entrada de la transcripción.
 *
 * Acá viven las tres cosas que no pueden delegarse a un adaptador:
 *  1. El SEGUNDO corte de alcance (solo AUDIO/NOTA_VOZ).
 *  2. La decisión LISTO contra INAUDIBLE, igual para todo proveedor.
 *  3. El registro del consumo, pase lo que pase.
 */

/** Por debajo de esta confianza de idioma, lo transcrito no es habla fiable. */
const UMBRAL_CONFIANZA_IDIOMA = 0.5;

export const TEXTO_INAUDIBLE = "Inaudible";

export type ResultadoTranscripcion =
  | { estado: "LISTO"; texto: string }
  | { estado: "INAUDIBLE" }
  | { estado: "NO_APLICA"; motivo: string }
  | { estado: "OMITIDO"; motivo: string }
  | { estado: "ERROR"; codigo: string; reintentable: boolean };

export async function transcribirMediaArchivo(mediaArchivoId: string): Promise<ResultadoTranscripcion> {
  const config = configEntornoVoz();

  const media = await prisma.mediaArchivo.findUnique({
    where: { id: mediaArchivoId },
    select: {
      id: true,
      instanciaId: true,
      keyOriginal: true,
      keyOptimizado: true,
      mimeOriginal: true,
      nombreOriginal: true,
      pesoOriginal: true,
    },
  });
  if (!media) return { estado: "OMITIDO", motivo: "MEDIA_INEXISTENTE" };

  // ── Corte de alcance #2 ─────────────────────────────────────────────────
  // Se revalida contra la base aunque `marcarPendiente` ya lo haya filtrado:
  // una fila pudo quedar PENDIENTE por una versión anterior del código, por un
  // backfill mal invocado o por una escritura manual.
  //
  // Y no alcanza con mirar el mime: en Instagram una nota de voz y un video
  // llegan los dos como video/mp4 (727 contra 203 en datos reales), y el
  // proveedor transcribe video sin devolver error. El único discriminador es
  // el tipo del MENSAJE.
  const esAudio = await prisma.mensajeConversacion.count({
    where: { mediaArchivoId: media.id, tipo: { in: ["AUDIO", "NOTA_VOZ"] } },
  });
  if (esAudio === 0) {
    await marcarNoAplica(media.id);
    return { estado: "NO_APLICA", motivo: "NO_ES_NOTA_DE_VOZ" };
  }

  // Tope de tamaño: que un envío atípico no genere un cargo desproporcionado.
  if (media.pesoOriginal > config.maxBytes) {
    await marcarErrorDefinitivo(media.id);
    return { estado: "ERROR", codigo: "ARCHIVO_DEMASIADO_GRANDE", reintentable: false };
  }

  const seleccion = await seleccionarProveedorVoz(media.instanciaId);
  if (!seleccion) {
    // Sin proveedor no es un fallo del audio: queda PENDIENTE para cuando el
    // comercio configure uno. No se consumen intentos.
    return { estado: "OMITIDO", motivo: "SIN_PROVEEDOR" };
  }

  // Tope diario de la cuenta: alcanzado, el audio queda PENDIENTE (no falla
  // ni consume intentos) y se retoma cuando el contador se reinicie.
  const limite = await verificarLimiteDiario(media.instanciaId, seleccion.limiteMinutosDia);
  if (!limite.permitido) {
    return { estado: "OMITIDO", motivo: "LIMITE_MINUTOS_DIA" };
  }

  const key = media.keyOriginal ?? media.keyOptimizado;
  const archivo = await getStorageProvider()
    .download(key)
    .catch((e) => {
      // El motivo se registra: sin esto, "no se pudo leer el archivo" es
      // indistinguible de "el archivo no existe", y la única pista que queda
      // es un ERROR en la fila sin fila de UsoVoz que lo explique.
      console.error(`[voz] No se pudo leer ${key} del storage:`, e);
      return null;
    });

  if (!archivo) {
    // REINTENTABLE a propósito. Que el archivo no se pueda leer casi nunca es
    // culpa del archivo: es infraestructura nuestra —proveedor de storage mal
    // configurado, credenciales rotadas, un bache del bucket—. Marcarlo
    // definitivo dejaría el audio muerto para siempre justo cuando basta con
    // arreglar el entorno para que funcione, y haría falta una persona para
    // resucitarlo. Con backoff se cura solo; si de verdad el archivo no está,
    // termina en ERROR tras MAX_INTENTOS igual.
    console.error(
      `[voz] Archivo ${key} no disponible (storage: ${getStorageProvider().constructor?.name}). ` +
        `Se reintenta con backoff.`,
    );
    await devolverConBackoff([media.id]);
    return { estado: "ERROR", codigo: "ARCHIVO_NO_DISPONIBLE", reintentable: true };
  }

  const inicio = Date.now();
  let salida: TranscribirResult;
  try {
    salida = await seleccion.proveedor.transcribir({
      buffer: archivo.buffer,
      mimeType: media.mimeOriginal,
      // 051 — Groq y OpenAI validan por la EXTENSIÓN del nombre, y ningún
      // canal la entrega. Ver src/voz/nombre-archivo.ts.
      nombreArchivo: nombreConExtension(media.nombreOriginal, key),
      timeoutMs: Math.min(seleccion.timeoutMs, config.timeoutMs),
    });
  } catch (e) {
    const err = e instanceof ErrorProveedorVoz
      ? e
      : new ErrorProveedorVoz("Fallo inesperado del proveedor", "ERROR_PROVEEDOR", true);

    await registrarUsoVoz({
      instanciaId: media.instanciaId,
      proveedorVozId: seleccion.proveedorVozId,
      modelo: seleccion.modelo,
      segundos: 0,
      costoPorHora: seleccion.costoPorHora,
      tiempoMs: Date.now() - inicio,
      exito: false,
      error: err.codigo,
      mediaArchivoId: media.id,
    });

    if (err.reintentable) await devolverConBackoff([media.id]);
    else await marcarErrorDefinitivo(media.id);

    return { estado: "ERROR", codigo: err.codigo, reintentable: err.reintentable };
  }

  const inaudible = esInaudible(salida);
  const segundos = salida.segundos ?? 0;

  // Suma local: sin esto, un lote entero pasaría el tope porque todos leen el
  // mismo valor cacheado antes de que ninguno haya registrado su consumo.
  registrarConsumoLocal(media.instanciaId, segundos);

  await registrarUsoVoz({
    instanciaId: media.instanciaId,
    proveedorVozId: seleccion.proveedorVozId,
    modelo: salida.modelo,
    segundos,
    costoPorHora: seleccion.costoPorHora,
    tiempoMs: salida.tiempoMs,
    exito: true,
    mediaArchivoId: media.id,
  });

  await prisma.mediaArchivo.update({
    where: { id: media.id },
    data: {
      // INAUDIBLE guarda el literal, no null: el agente tiene que ver que el
      // audio se procesó y no se entendió, no una transcripción ausente.
      transcripcion: inaudible ? TEXTO_INAUDIBLE : salida.texto.trim(),
      // Estado TERMINAL en los dos casos. INAUDIBLE no se reintenta: el audio
      // no tenía habla, y volver a pedirlo cuesta otra llamada para obtener el
      // mismo silencio.
      transcripcionEstado: inaudible ? "INAUDIBLE" : "LISTO",
      transcripcionIdioma: salida.idioma,
      transcripcionSegundos: salida.segundos,
      transcripcionProveedorVozId: seleccion.proveedorVozId,
      transcripcionBloqueadoHasta: null,
      transcripcionEn: new Date(),
    },
  });

  // 049 (R10) — Meta no manda la duración en el webhook, así que los audios de
  // Instagram la tienen en NULL y la burbuja no la muestra. El proveedor ya la
  // devolvió: se aprovecha, sin pisar la que sí llegó por otro canal.
  if (salida.segundos) {
    await prisma.mensajeConversacion.updateMany({
      where: { mediaArchivoId: media.id, mediaDuracion: null },
      data: { mediaDuracion: salida.segundos },
    }).catch(() => { /* dato de presentación: nunca tumba la transcripción */ });
  }

  // La burbuja ya se pintó si el timeout en línea venció y esto lo terminó el
  // barrido: el evento la refresca sin que el agente recargue (FR-025).
  await publicarTranscripcion(media.id, media.instanciaId, {
    estado: inaudible ? "INAUDIBLE" : "LISTO",
    transcripcion: inaudible ? TEXTO_INAUDIBLE : salida.texto.trim(),
    idioma: salida.idioma,
    segundos: salida.segundos,
  });

  return inaudible ? { estado: "INAUDIBLE" } : { estado: "LISTO", texto: salida.texto.trim() };
}

async function publicarTranscripcion(
  mediaArchivoId: string,
  instanciaId: string,
  datos: {
    estado: "LISTO" | "INAUDIBLE" | "ERROR";
    transcripcion?: string;
    idioma?: string | null;
    segundos?: number | null;
  },
): Promise<void> {
  try {
    const mensajes = await prisma.mensajeConversacion.findMany({
      where: { mediaArchivoId },
      select: { conversacionId: true },
    });
    const conversacionIds = [...new Set(mensajes.map((m) => m.conversacionId))];
    if (conversacionIds.length === 0) return;

    await publicadorEventos.publicar(EventosSistema.AudioTranscrito, instanciaId, {
      version: 1,
      instanciaId,
      mediaArchivoId,
      conversacionIds,
      ...datos,
    });
  } catch (e) {
    // El texto ya está guardado y se paga igual: no publicar solo significa
    // que la burbuja se actualiza en el siguiente refresco.
    console.error("[voz] No se pudo publicar AudioTranscrito:", e);
  }
}

/**
 * Decisión de dominio, idéntica para todos los proveedores. Si cada adaptador
 * la tomara a su manera, cambiar de proveedor cambiaría el producto.
 */
export function esInaudible(salida: Pick<TranscribirResult, "texto" | "palabras" | "confianzaIdioma">): boolean {
  if (salida.texto.trim() === "") return true;
  // Un audio de música o ruido devuelve texto no vacío pero ningún elemento
  // de habla: sin esto, el agente leería una descripción de ruido como si el
  // cliente hubiera dicho algo.
  if (salida.palabras === 0) return true;
  if (salida.confianzaIdioma !== null && salida.confianzaIdioma < UMBRAL_CONFIANZA_IDIOMA) return true;
  return false;
}
