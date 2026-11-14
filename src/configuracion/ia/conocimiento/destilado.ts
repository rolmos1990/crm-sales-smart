// 032 — Texto extraído → bloque compacto que entra en el presupuesto.
//
// Un manual de 10 páginas son ~20.000 caracteres: más que el límite de
// contexto completo del agente. Se destila UNA vez al subir, no en cada
// turno, y el resultado queda editable: si el modelo se comió algo
// importante, el negocio lo corrige a mano y no vuelve a pasar por acá.

import { generarRespuesta } from "@/ai/gateway/gateway";
import { MAX_CARACTERES_DOCUMENTO } from "./tipos";

const INSTRUCCION = `Convertí este documento en una ficha de consulta para un agente de atención al cliente.

Reglas:
- Solo información que esté en el documento. No agregues nada, no supongas, no completes huecos.
- Formato: líneas cortas de "tema: dato". Agrupá por tema. Sin encabezados, sin markdown, sin viñetas.
- Priorizá lo que un cliente preguntaría: horarios, cobertura, costos, plazos, condiciones, requisitos, qué sí y qué no.
- Descartá: portadas, índices, numeración de páginas, textos legales de pie, nombres de archivo, datos internos.
- Si el documento trae precios o plazos, incluilos tal cual están escritos.
- Máximo ${MAX_CARACTERES_DOCUMENTO} caracteres. Si no entra todo, quedate con lo que más le serviría a un cliente.

Devolvé únicamente la ficha, sin introducción ni comentarios.`;

/** Recorta en el último corte limpio para no cortar una frase al medio. */
export function recortarEnLimite(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const duro = texto.slice(0, max);
  const corte = Math.max(duro.lastIndexOf("\n"), duro.lastIndexOf(". "));
  // Si el último corte limpio está demasiado atrás, se recorta duro: perder
  // media línea es mejor que perder un tercio del contenido.
  return (corte > max * 0.6 ? duro.slice(0, corte) : duro).trim();
}

export interface ResultadoDestilado {
  contenido: string;
  /** false = el destilado falló y `contenido` es el texto crudo recortado.
   *  El documento queda en estado REVISAR para que una persona lo arregle:
   *  tirar lo que sí se pudo leer sería peor. */
  destilado: boolean;
}

/**
 * Nunca lanza. Si la IA no está disponible o devuelve algo inservible, el
 * documento igual queda cargado con el texto crudo recortado.
 */
export async function destilarDocumento(texto: string, instanciaId: string): Promise<ResultadoDestilado> {
  const crudoRecortado = recortarEnLimite(texto, MAX_CARACTERES_DOCUMENTO);

  try {
    const respuesta = await generarRespuesta({
      instanciaId,
      // RESUMEN es ruteable a un modelo económico por el enrutamiento por
      // objetivo (spec 010): esto no necesita el modelo que atiende clientes.
      tarea: "RESUMEN",
      mensajes: [
        { rol: "system", contenido: INSTRUCCION },
        { rol: "user", contenido: texto },
      ],
      entidadTipo: "agente_conocimiento",
      entidadId: instanciaId,
    });

    const contenido = respuesta.contenido?.trim();
    // Un destilado más corto que un tuit sobre un documento entero significa
    // que el modelo no entendió la tarea: mejor el texto crudo.
    if (!contenido || contenido.length < 40) {
      console.warn("[ConocimientoFAQ] El destilado devolvió muy poco — se conserva el texto crudo");
      return { contenido: crudoRecortado, destilado: false };
    }

    return { contenido: recortarEnLimite(contenido, MAX_CARACTERES_DOCUMENTO), destilado: true };
  } catch (err) {
    console.error("[ConocimientoFAQ] Falló el destilado — se conserva el texto crudo:", err);
    return { contenido: crudoRecortado, destilado: false };
  }
}
