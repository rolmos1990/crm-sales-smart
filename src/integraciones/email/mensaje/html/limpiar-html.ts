// 035 — Limpieza del HTML de un correo entrante (al recibir) y preparación
// para la vista aislada (al servir).
//
// Regla de seguridad del canal (CLAUDE.md §9): el HTML entrante solo se
// muestra limpio, en un iframe sandbox sin scripts ni mismo origen y con CSP
// restrictiva; nunca dentro de la página de Karia. Este módulo es la primera
// de esas capas y la única que decide qué etiquetas y atributos existen.
//
// Nunca se loguea ni se devuelve el HTML original.
// Apto para el worker: nada de `server-only` ni de Next.
import sanitizeHtml, { type IOptions, type Transformer } from "sanitize-html";
import {
  ATRIBUTO_IMAGEN_EXTERNA,
  MAX_BYTES_HTML_ENTRADA,
  MAX_BYTES_HTML_LIMPIO,
  MAX_IMAGENES_EXTERNAS,
  MAX_MS_LIMPIEZA,
  PROFUNDIDAD_MAXIMA_RECHAZO,
  VERSION_POLITICA,
  opcionesBase,
} from "./politica";
import { superaProfundidad } from "./profundidad";

export type MotivoHtmlNoDisponible =
  | "DEMASIADO_GRANDE"
  | "DEMASIADO_ANIDADO"
  | "TIEMPO_EXCEDIDO"
  | "ERROR_LIMPIEZA";

export type ResultadoLimpieza =
  | { estado: "SIN_HTML"; motivo: "VACIO" | null }
  | { estado: "NO_DISPONIBLE"; motivo: MotivoHtmlNoDisponible }
  | {
      estado: "DISPONIBLE";
      html: string;
      imagenesExternas: string[];
      cidsUsados: string[];
      versionPolitica: number;
    };

const REL_ENLACE = "noopener noreferrer nofollow";

/** Content-ID como se compara en todo el sistema: sin "<>" y en minúsculas. */
export function normalizarCid(valor: string): string {
  let cid = valor.trim().replace(/^cid:/i, "").replace(/^</, "").replace(/>$/, "").trim();
  try {
    // RFC 2392: en la URL `cid:` el Content-ID va codificado como URL.
    cid = decodeURIComponent(cid);
  } catch {
    /* se usa tal cual */
  }
  return cid.toLowerCase();
}

function sinAtributos(attribs: Record<string, string>, ...nombres: string[]): Record<string, string> {
  const copia = { ...attribs };
  for (const n of nombres) delete copia[n];
  return copia;
}

const transformarEnlace: Transformer = (tagName, attribs) => ({
  tagName,
  attribs: { ...sinAtributos(attribs, "target", "rel"), target: "_blank", rel: REL_ENLACE },
});

function conImagenesMarcables(opciones: IOptions): IOptions {
  const atributos = opciones.allowedAttributes;
  const img = atributos && Array.isArray(atributos.img) ? atributos.img : [];
  return {
    ...opciones,
    allowedAttributes: { ...(atributos || {}), img: [...img, ATRIBUTO_IMAGEN_EXTERNA] },
  };
}

function textoVisible(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s/g, "");
}

/**
 * Limpia el HTML de un correo entrante. No lanza nunca: ante cualquier falla
 * devuelve NO_DISPONIBLE y el correo entra solo como texto.
 */
export function limpiarHtmlEntrante(html: string | null | undefined): ResultadoLimpieza {
  if (typeof html !== "string" || html.trim() === "") return { estado: "SIN_HTML", motivo: null };

  try {
    if (Buffer.byteLength(html, "utf8") > MAX_BYTES_HTML_ENTRADA) {
      return { estado: "NO_DISPONIBLE", motivo: "DEMASIADO_GRANDE" };
    }
    if (superaProfundidad(html, PROFUNDIDAD_MAXIMA_RECHAZO)) {
      return { estado: "NO_DISPONIBLE", motivo: "DEMASIADO_ANIDADO" };
    }

    const imagenesExternas: string[] = [];
    const cidsUsados = new Set<string>();
    let imagenesConservadas = 0;

    const opciones: IOptions = {
      ...conImagenesMarcables(opcionesBase()),
      transformTags: {
        a: transformarEnlace,
        img: (tagName, attribs) => {
          // El atributo de marca solo lo pone Karia: si el correo lo trae, se descarta.
          const resto = sinAtributos(attribs, "src", "srcset", ATRIBUTO_IMAGEN_EXTERNA);
          const src = (attribs.src ?? "").trim();

          if (/^cid:/i.test(src)) {
            const cid = normalizarCid(src);
            if (cid) {
              cidsUsados.add(cid);
              imagenesConservadas += 1;
              return { tagName, attribs: { ...resto, src: `cid:${encodeURIComponent(cid)}` } };
            }
          } else if (/^https?:\/\//i.test(src) && imagenesExternas.length < MAX_IMAGENES_EXTERNAS) {
            // La imagen remota queda SIN src: el navegador no tiene qué pedir.
            // Solo el índice permite, si el agente lo decide, pedirla por el proxy.
            const indice = imagenesExternas.push(src) - 1;
            imagenesConservadas += 1;
            return { tagName, attribs: { ...resto, [ATRIBUTO_IMAGEN_EXTERNA]: String(indice) } };
          }
          return { tagName, attribs: resto };
        },
      },
    };

    const inicio = Date.now();
    const limpio = sanitizeHtml(html, opciones).trim();
    // sanitize-html es síncrono y no se puede interrumpir: el tope real es el
    // tamaño de entrada. Esto descarta resultados anómalos (research.md R3).
    if (Date.now() - inicio > MAX_MS_LIMPIEZA) {
      return { estado: "NO_DISPONIBLE", motivo: "TIEMPO_EXCEDIDO" };
    }
    if (Buffer.byteLength(limpio, "utf8") > MAX_BYTES_HTML_LIMPIO) {
      return { estado: "NO_DISPONIBLE", motivo: "DEMASIADO_GRANDE" };
    }
    if (imagenesConservadas === 0 && textoVisible(limpio) === "") {
      return { estado: "SIN_HTML", motivo: "VACIO" };
    }

    return {
      estado: "DISPONIBLE",
      html: limpio,
      imagenesExternas,
      cidsUsados: [...cidsUsados],
      versionPolitica: VERSION_POLITICA,
    };
  } catch {
    return { estado: "NO_DISPONIBLE", motivo: "ERROR_LIMPIEZA" };
  }
}

export interface OpcionesVista {
  /** Si el agente pidió cargar las imágenes externas de este correo. */
  imagenes: boolean;
  /** URL firmada para una imagen cid, o null si el cid no es de este correo. */
  urlCid: (cid: string) => string | null;
  /** URL firmada del proxy para la imagen externa N, o null. */
  urlImagenExterna: (indice: number) => string | null;
}

/**
 * Prepara el HTML guardado para servirlo a la vista aislada.
 *
 * Lo vuelve a pasar por la MISMA política (defensa en profundidad: un HTML
 * guardado con una política vieja, o alterado en la base, sale igual de
 * limpio) y resuelve las imágenes a rutas firmadas de Karia. La reescritura la
 * hace el parser, no una sustitución de texto.
 */
export function prepararHtmlParaVista(htmlLimpio: string, opciones: OpcionesVista): string {
  const base = conImagenesMarcables(opcionesBase());
  return sanitizeHtml(htmlLimpio, {
    ...base,
    transformTags: {
      a: transformarEnlace,
      img: (tagName, attribs) => {
        const resto = sinAtributos(attribs, "src", "srcset", ATRIBUTO_IMAGEN_EXTERNA);
        const src = (attribs.src ?? "").trim();
        const marca = attribs[ATRIBUTO_IMAGEN_EXTERNA];

        if (/^cid:/i.test(src)) {
          const url = opciones.urlCid(normalizarCid(src));
          return { tagName, attribs: url ? { ...resto, src: url } : resto };
        }
        if (marca !== undefined && /^\d{1,3}$/.test(marca)) {
          const indice = Number(marca);
          const url = opciones.imagenes ? opciones.urlImagenExterna(indice) : null;
          return {
            tagName,
            attribs: url ? { ...resto, src: url } : { ...resto, [ATRIBUTO_IMAGEN_EXTERNA]: marca },
          };
        }
        // Cualquier otra fuente (una URL remota que no debería estar guardada)
        // se descarta: la vista nunca pide nada que no sea de Karia.
        return { tagName, attribs: resto };
      },
    },
  });
}
