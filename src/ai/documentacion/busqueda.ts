// 033 — Búsqueda en la documentación del comercio, con su consumo registrado.
//
// Es la ÚNICA función del repositorio autorizada a invocar el hosted tool
// `file_search` de OpenAI. Esa exclusividad no es estilística: es lo que hace
// que el filtro por tenant sea imposible de omitir. No acepta `filters` ni
// `vector_store_ids` del llamador — los construye ella con el instanciaId y el
// agenteId que vienen del ContextoTool del backend.
//
// Sobre la contabilización: se eligió la Responses API con síntesis, y no el
// endpoint de búsqueda directa, justamente porque es la única que devuelve un
// bloque `usage` con los tokens REALES que facturó OpenAI. Un token estimado
// en una tabla de auditoría es un token que no sirve para facturar.
//
// Esta función nunca lanza. Una búsqueda rota no puede tumbar la respuesta al
// cliente: degrada a "no encontré nada" y queda registrada como fallida.

import { registrarUsoIA, calcularCosto } from "@/ai/auditoria/logger";
import { obtenerVersionPublicadaVigenteId } from "@/ai/queries";
import {
  filtroTenant,
  verificarResultados,
  type FragmentoDocumental,
} from "./aislamiento";
import { obtenerConfiguracionDocumentacion } from "./cliente-openai";
import { vectorStoreDeInstancia } from "./vector-store";
import {
  COSTO_POR_LLAMADA_FILE_SEARCH,
  MAX_RESULTADOS_BUSQUEDA,
  TIMEOUT_BUSQUEDA_MS,
} from "./tipos";

export interface SolicitudBusquedaDocumental {
  /** Del ContextoTool del backend. NUNCA de los argumentos del LLM. */
  instanciaId: string;
  /** Ídem. */
  agenteId: string;
  consulta: string;
  conversacionId?: string;
}

export type MotivoSinResultado =
  | "SIN_COINCIDENCIAS"
  | "NO_CONFIGURADO"
  | "TIEMPO_AGOTADO"
  | "ERROR_PROVEEDOR"
  /** Un fragmento devuelto no era del tenant. La respuesta se descartó entera. */
  | "VERIFICACION_FALLIDA";

export type ResultadoBusquedaDocumental =
  | { encontrado: true; respuesta: string; fuentes: string[] }
  | { encontrado: false; motivo: MotivoSinResultado };

/**
 * Lo que se le pide al modelo que sintetiza. Es deliberadamente restrictivo:
 * este modelo NO conversa con el cliente ni conoce el negocio — su único
 * trabajo es decir qué dicen los documentos sobre la consulta. Si se le
 * permitiera "ayudar", inventaría, y el agente de arriba lo repetiría como si
 * viniera de un documento.
 */
const INSTRUCCION_SINTESIS =
  "Respondé usando EXCLUSIVAMENTE el contenido de los documentos adjuntos. " +
  "No uses conocimiento general ni completes lo que falte. " +
  "Si los documentos no contienen la respuesta, respondé exactamente: SIN_DATOS. " +
  "No agregues saludos ni ofrecimientos: devolvé solo la información encontrada.";

/** El modelo devuelve este centinela cuando no hay nada. Se traduce a
 *  `SIN_COINCIDENCIAS` para que el agente lo diga con sus palabras. */
const CENTINELA_SIN_DATOS = "SIN_DATOS";

/** Error interno para distinguir el timeout de un fallo del proveedor. */
class TiempoAgotado extends Error {}

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, reject) => setTimeout(() => reject(new TiempoAgotado()), ms)),
  ]);
}

/** Extrae los fragmentos que devolvió el tool, para poder verificarlos. Se
 *  mapea a un tipo propio: el verificador no debe conocer al SDK. */
function fragmentosDe(output: unknown): { fragmentos: FragmentoDocumental[]; fuentes: string[] } {
  const fragmentos: FragmentoDocumental[] = [];
  const fuentes = new Set<string>();

  if (!Array.isArray(output)) return { fragmentos, fuentes: [] };

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const bloque = item as { type?: string; results?: unknown };
    if (bloque.type !== "file_search_call" || !Array.isArray(bloque.results)) continue;

    for (const resultado of bloque.results) {
      const r = resultado as { attributes?: FragmentoDocumental["attributes"]; filename?: string };
      fragmentos.push({ attributes: r.attributes, filename: r.filename });
      if (r.filename) fuentes.add(r.filename);
    }
  }

  return { fragmentos, fuentes: [...fuentes] };
}

/** El `filename` en OpenAI lleva el prefijo de identidad; al cliente le
 *  mostramos solo el nombre que subió. */
function nombreLegible(filename: string): string {
  const partes = filename.split("_");
  return partes.length > 3 ? partes.slice(3).join("_") : filename;
}

export async function buscarEnDocumentacion(
  solicitud: SolicitudBusquedaDocumental,
): Promise<ResultadoBusquedaDocumental> {
  const config = obtenerConfiguracionDocumentacion();

  // Sin configuración no se registra nada en UsoIA: no hubo llamada ni
  // consumo. Registrar una fila de cero tokens ensuciaría los agregados.
  if (!config) return { encontrado: false, motivo: "NO_CONFIGURADO" };

  // Cada cuenta tiene su propio índice. Sin store, la cuenta todavía no subió
  // ningún documento: no hay nada que buscar y tampoco hay llamada que cobrar.
  const vectorStoreId = await vectorStoreDeInstancia(solicitud.instanciaId);
  if (!vectorStoreId) return { encontrado: false, motivo: "SIN_COINCIDENCIAS" };

  const inicio = Date.now();

  // Trazabilidad a la versión publicada que originó la búsqueda, igual que
  // hace el gateway. Un fallo acá no puede impedir la búsqueda.
  const agenteIAConfigVersionId = await obtenerVersionPublicadaVigenteId(solicitud.agenteId).catch(
    () => null,
  );

  const registrar = (params: {
    tokensInput: number;
    tokensOutput: number;
    exito: boolean;
    error?: string;
  }) =>
    registrarUsoIA({
      instanciaId: solicitud.instanciaId,
      // Sin proveedorIAId a propósito: la credencial es de Karia, no un
      // ProveedorIA del tenant. Apuntar a uno que no se usó sería mentir en
      // la auditoría.
      proveedorIAId: undefined,
      agenteIAConfigId: solicitud.agenteId,
      agenteIAConfigVersionId: agenteIAConfigVersionId ?? undefined,
      tarea: "BUSQUEDA_DOCUMENTAL",
      resultado: {
        contenido: "",
        tokensInput: params.tokensInput,
        tokensOutput: params.tokensOutput,
        modelo: config.modelo,
        proveedor: "OPENAI",
        tiempoMs: Date.now() - inicio,
      },
      exito: params.exito,
      error: params.error,
      entidadTipo: solicitud.conversacionId ? "conversacion" : undefined,
      entidadId: solicitud.conversacionId,
      costoEstimado: params.exito
        ? costoTotal(params.tokensInput, params.tokensOutput)
        : undefined,
    }).catch((err) => {
      // Que falle la auditoría no puede impedir que el agente responda, pero
      // sí tiene que quedar visible: es consumo que se pagó y no se registró.
      console.error("[Documentacion] No se pudo registrar el uso en UsoIA:", err);
    });

  function costoTotal(tokensInput: number, tokensOutput: number): number | undefined {
    const deTokens = calcularCosto(
      tokensInput,
      tokensOutput,
      config!.costoInputPorMil,
      config!.costoOutputPorMil,
    );
    // Sin tarifas configuradas no se inventa un costo: queda null, que es lo
    // que ya hace el resto del sistema cuando no sabe.
    if (deTokens === undefined) return undefined;
    // La tarifa por llamada de file_search va aparte de los tokens: omitirla
    // haría que el costo registrado fuera sistemáticamente menor que el real.
    return deTokens + COSTO_POR_LLAMADA_FILE_SEARCH;
  }

  try {
    const respuesta = await conTimeout(
      config.client.responses.create({
        model: config.modelo,
        instructions: INSTRUCCION_SINTESIS,
        input: solicitud.consulta,
        tools: [
          {
            type: "file_search",
            // Solo el de esta cuenta. El aislamiento entre comercios es
            // físico antes que lógico: acá no hay ningún índice ajeno al que
            // la búsqueda pueda llegar aunque el filtro fallara.
            vector_store_ids: [vectorStoreId],
            max_num_results: MAX_RESULTADOS_BUSQUEDA,
            // Obligatorio y construido acá: el llamador no puede ampliarlo.
            filters: filtroTenant(solicitud.instanciaId, solicitud.agenteId),
          },
        ],
        // Sin esto no llegan los fragmentos y la verificación de tenant no
        // tendría qué verificar.
        include: ["file_search_call.results"],
      }),
      TIMEOUT_BUSQUEDA_MS,
    );

    const tokensInput = respuesta.usage?.input_tokens ?? 0;
    const tokensOutput = respuesta.usage?.output_tokens ?? 0;

    const { fragmentos, fuentes } = fragmentosDe(respuesta.output);

    // Cuarta capa de aislamiento. Corre ANTES de mirar el texto: si algo no es
    // de este tenant, la respuesta entera se descarta y nunca llega al modelo
    // que conversa con el cliente.
    const verificacion = verificarResultados(
      fragmentos,
      solicitud.instanciaId,
      solicitud.agenteId,
    );

    if (!verificacion.ok) {
      console.error(
        `[Documentacion][SEGURIDAD] Respuesta descartada para instancia ${solicitud.instanciaId}, ` +
          `agente ${solicitud.agenteId}: ${verificacion.motivo}`,
      );
      await registrar({
        tokensInput,
        tokensOutput,
        exito: false,
        error: `Verificación de aislamiento fallida: ${verificacion.motivo}`,
      });
      return { encontrado: false, motivo: "VERIFICACION_FALLIDA" };
    }

    await registrar({ tokensInput, tokensOutput, exito: true });

    const texto = (respuesta.output_text ?? "").trim();

    if (!texto || texto.includes(CENTINELA_SIN_DATOS) || fragmentos.length === 0) {
      return { encontrado: false, motivo: "SIN_COINCIDENCIAS" };
    }

    return { encontrado: true, respuesta: texto, fuentes: fuentes.map(nombreLegible) };
  } catch (err) {
    const esTimeout = err instanceof TiempoAgotado;
    const mensaje = esTimeout
      ? `La búsqueda superó ${TIMEOUT_BUSQUEDA_MS} ms`
      : err instanceof Error
        ? err.message
        : String(err);

    console.error("[Documentacion] Falló la búsqueda:", mensaje);
    await registrar({ tokensInput: 0, tokensOutput: 0, exito: false, error: mensaje });

    return { encontrado: false, motivo: esTimeout ? "TIEMPO_AGOTADO" : "ERROR_PROVEEDOR" };
  }
}
