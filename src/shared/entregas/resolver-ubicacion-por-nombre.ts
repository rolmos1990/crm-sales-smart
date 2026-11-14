// Resolver un destino cuando solo se sabe su nombre, sin saber a qué nivel
// geográfico pertenece.
//
// El caso real: el cliente escribe "¿tienen delivery en Calidonia?". Calidonia
// es un corregimiento, y está cargada como `distritoCiudad` de una zona cuya
// provincia es "Panamá Province". Todas las rutas de resolución exigen la
// provincia, y el agente —que solo tiene la palabra "Calidonia"— la ponía en
// el campo de provincia. Ahí no coincidía con nada, y un destino
// perfectamente configurado se reportaba como sin cobertura.
//
// Esto no reemplaza el matching nivel por nivel: lo alimenta. Busca el nombre
// contra todos los niveles de las ubicaciones configuradas y devuelve el
// destino COMPLETO, para que el resolvedor de siempre haga su trabajo con los
// datos que le faltaban.

import { prisma } from "@/shared/db/prisma";
import { generarSlug } from "@/shared/lib/slug";

export type NivelUbicacion = "PROVINCIA" | "CIUDAD" | "CORREGIMIENTO" | "SECTOR";

export interface UbicacionResuelta {
  estadoProvincia: string | null;
  distritoCiudad: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
  /** En qué nivel coincidió el nombre buscado. Sirve para explicarle al
   *  agente por qué se expandió el destino. */
  nivel: NivelUbicacion;
}

export type ResultadoUbicacionPorNombre =
  | { estado: "UNICA"; ubicacion: UbicacionResuelta }
  /** El mismo nombre existe en más de un lugar: hay que preguntar, no adivinar. */
  | { estado: "AMBIGUA"; candidatas: UbicacionResuelta[] }
  | { estado: "SIN_COINCIDENCIA" };

/** Clave de deduplicación: dos filas del mismo destino son el mismo destino. */
const claveDestino = (u: UbicacionResuelta) =>
  [u.estadoProvincia, u.distritoCiudad, u.corregimiento, u.sectorOCodigoPostal].map((v) => generarSlug(v ?? "")).join("|");

/**
 * Busca `nombre` contra todos los niveles de las ubicaciones configuradas y
 * sus alias. Solo considera zonas activas de transportistas activos: ofrecer
 * un destino que después no se puede cotizar sería peor que no encontrarlo.
 *
 * El nivel más específico gana. Si "Panamá" es a la vez una provincia y el
 * nombre de un distrito, la provincia es la lectura correcta: es lo que
 * abarca más, y el matching posterior refina con lo que el cliente agregue.
 */
export async function resolverUbicacionPorNombre(params: {
  instanciaId: string;
  nombre: string;
  transportistaId?: string | null;
}): Promise<ResultadoUbicacionPorNombre> {
  const buscado = generarSlug(params.nombre);
  if (!buscado) return { estado: "SIN_COINCIDENCIA" };

  const ubicaciones = await prisma.zonaEntregaUbicacion.findMany({
    where: {
      zonaEntrega: {
        instanciaId: params.instanciaId,
        activa: true,
        transportista: { activo: true, ...(params.transportistaId ? { id: params.transportistaId } : {}) },
      },
    },
    select: {
      provinciaEstado: true,
      distritoCiudad: true,
      corregimiento: true,
      sectorOCodigoPostal: true,
      aliases: { select: { campo: true, valorNormalizado: true } },
    },
  });

  // De lo más específico a lo más general: si el nombre coincide con un
  // sector, ese es el destino, aunque la misma palabra aparezca como ciudad.
  const NIVELES: Array<{ nivel: NivelUbicacion; campo: keyof typeof ubicaciones[number]; campoAlias: string }> = [
    { nivel: "SECTOR", campo: "sectorOCodigoPostal", campoAlias: "sectorOCodigoPostal" },
    { nivel: "CORREGIMIENTO", campo: "corregimiento", campoAlias: "corregimiento" },
    { nivel: "CIUDAD", campo: "distritoCiudad", campoAlias: "distritoCiudad" },
    { nivel: "PROVINCIA", campo: "provinciaEstado", campoAlias: "provinciaEstado" },
  ];

  for (const { nivel, campo, campoAlias } of NIVELES) {
    const encontradas = new Map<string, UbicacionResuelta>();

    for (const u of ubicaciones) {
      const valor = u[campo] as string | null;
      const coincidePorNombre = !!valor && generarSlug(valor) === buscado;
      // `?? []` y no `u.aliases.some`: la fila puede venir de otro `select`
      // que no los pida. Un alias ausente es "sin alias", no un crash.
      const coincidePorAlias = (u.aliases ?? []).some((a) => a.campo === campoAlias && a.valorNormalizado === buscado);
      if (!coincidePorNombre && !coincidePorAlias) continue;

      const resuelta: UbicacionResuelta = {
        estadoProvincia: u.provinciaEstado,
        distritoCiudad: u.distritoCiudad,
        corregimiento: u.corregimiento,
        sectorOCodigoPostal: u.sectorOCodigoPostal,
        nivel,
      };
      encontradas.set(claveDestino(resuelta), resuelta);
    }

    if (encontradas.size === 1) return { estado: "UNICA", ubicacion: [...encontradas.values()][0] };
    if (encontradas.size > 1) return { estado: "AMBIGUA", candidatas: [...encontradas.values()] };
  }

  return { estado: "SIN_COINCIDENCIA" };
}

/** Texto legible del destino, para que el agente pueda nombrarlo al cliente. */
export function describirUbicacion(u: UbicacionResuelta): string {
  return [u.estadoProvincia, u.distritoCiudad, u.corregimiento, u.sectorOCodigoPostal]
    .filter((v): v is string => !!v?.trim())
    .join(" > ");
}
