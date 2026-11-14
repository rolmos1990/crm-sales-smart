import { generarRespuesta } from "@/ai/gateway/gateway";
import { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";
import type { ClasificacionIntencion } from "./tipos";

const CATEGORIAS_VALIDAS = new Set<string>(Object.values(CategoriaIntencionAutonomia));

// Las categorías van CON definición, no como una lista de nombres pelados.
//
// Antes esto era solo los 16 identificadores separados por comas, y el modelo
// tenía que adivinar qué significaba cada uno por su nombre. El resultado era
// predecible y caro: "prefiero que me la envíen" caía en EXCEPCION_ENTREGA
// —menciona una entrega y pide algo— y, como esa categoría está en
// HUMAN_ONLY, el agente se callaba justo cuando el cliente quería comprar.
// "Si por favor" caía en COMPROMISO_NO_DEFINIDO, que leído literalmente es
// "se compromete pero nada está definido".
//
// La regla de desempate del final es la que sostiene el resto: el gate toma
// la categoría MÁS restrictiva de las detectadas, sin mirar confianza, así
// que una categoría peligrosa sugerida a la ligera veta a una segura con el
// doble de confianza.
const INSTRUCCION_CLASIFICACION = `Clasifica el último mensaje de un cliente en una o más de estas categorías (normalmente 1, hasta 2 si mezcla intenciones claramente distintas).

Categorías seguras (el agente puede responder solo):
- SALUDO: saluda, se despide o agradece.
- CONSULTA_HORARIO: pregunta horarios de atención o de despacho.
- PREGUNTA_FRECUENTE: duda general sobre cómo opera el negocio.
- INFORMACION_GENERAL: da o pide un dato sin pedir una acción (su ciudad, un nombre, una aclaración).
- RECOMENDACION: pide que le sugieran un producto.
- CONSULTA_PRECIO: pregunta cuánto cuesta algo.
- CONSULTA_DISPONIBILIDAD: pregunta si hay stock o si se puede conseguir.
- COSTO_ENVIO: pregunta por envío, cobertura, costo o plazo de entrega. INCLUYE pedir que se lo envíen a un lugar normal: "prefiero que me la envíen", "me la mandan a mi casa", "hacen envíos a X".
- SOLICITUD_COTIZACION: quiere avanzar con la compra, confirma o acepta lo ofrecido, pide que le preparen el pedido. INCLUYE respuestas afirmativas cortas a una propuesta del agente: "sí", "me interesa", "dale", "listo", "confirmo", "por favor".

Categorías que exigen una persona (usalas SOLO si el mensaje ENCAJA CLARAMENTE):
- RECLAMO: se queja de algo que ya compró o recibió.
- SOLICITUD_REEMBOLSO: pide que le devuelvan el dinero.
- DESCUENTO_ESPECIAL: pide un precio distinto al de lista, un descuento o una excepción comercial.
- PROBLEMA_PAGO: reporta que un pago falló, no se acreditó o fue cobrado mal.
- EXCEPCION_ENTREGA: pide una condición de entrega que se SALE de lo que el negocio ofrece — un horario o día puntual garantizado, un lugar sin cobertura, que el repartidor espere o haga algo especial. Pedir un envío normal NO es una excepción: eso es COSTO_ENVIO.
- CLIENTE_MOLESTO: expresa enojo, frustración o amenaza.
- COMPROMISO_NO_DEFINIDO: pide que la empresa se comprometa a algo que NO está definido en el catálogo ni en las políticas, y que requiere que alguien lo apruebe. NO uses esta categoría para un "sí" o un "me interesa" sobre algo que el agente ya ofreció con precio y condiciones: eso es SOLICITUD_COTIZACION.

Ante la duda entre una categoría segura y una que exige persona, elige la segura.

Devuelve ÚNICAMENTE un JSON (sin texto adicional, sin markdown) con este shape exacto:
{
  "categorias": [{ "categoria": "UNA_DE_LAS_CATEGORIAS", "confianza": número entre 0 y 1 }]
}`;

function parsearJSONRespuesta(texto: string): Record<string, unknown> | null {
  const limpio = texto.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const parseado = JSON.parse(limpio);
    return typeof parseado === "object" && parseado !== null ? (parseado as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Clasifica un mensaje en una o más categorías de intención, tolerante a
 * fallo (FR-010): nunca lanza, devuelve `null` si la IA no está habilitada,
 * el proveedor falla, o el resultado no es parseable — en cuyo caso el
 * llamador (decidirAutonomia) debe tratarlo igual que "sin configuración".
 */
export async function clasificarCategoriaIntencion(
  mensaje: string,
  instanciaId: string,
): Promise<ClasificacionIntencion | null> {
  if (!mensaje.trim()) return null;

  try {
    const respuesta = await generarRespuesta({
      instanciaId,
      tarea: "CLASIFICACION",
      mensajes: [
        { rol: "system", contenido: INSTRUCCION_CLASIFICACION },
        { rol: "user", contenido: mensaje },
      ],
      entidadTipo: "mensaje",
    });

    const parseado = parsearJSONRespuesta(respuesta.contenido);
    if (!parseado || !Array.isArray(parseado.categorias)) return null;

    const categorias = parseado.categorias
      .filter(
        (c): c is { categoria: string; confianza: number } =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as Record<string, unknown>).categoria === "string" &&
          CATEGORIAS_VALIDAS.has((c as Record<string, unknown>).categoria as string),
      )
      .map((c) => ({
        categoria: c.categoria as ClasificacionIntencion["categorias"][number]["categoria"],
        confianza: typeof c.confianza === "number" ? c.confianza : 0.5,
      }));

    if (categorias.length === 0) return null;
    return { categorias };
  } catch (err) {
    console.error("[Autonomia] Error al clasificar intención:", err);
    return null;
  }
}
