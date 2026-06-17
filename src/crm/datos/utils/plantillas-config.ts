import type { EntidadImportable } from "../types";

// Para migrar a un storage externo (S3, R2, Supabase Storage, etc.)
// simplemente define NEXT_PUBLIC_TEMPLATES_URL en tu .env:
//   NEXT_PUBLIC_TEMPLATES_URL=https://cdn.vento.io/templates
const BASE_URL =
  process.env.NEXT_PUBLIC_TEMPLATES_URL?.replace(/\/$/, "") ?? "/templates";

export interface PlantillaInfo {
  url: string;
  nombreDescarga: string;
}

export const PLANTILLAS_POR_ENTIDAD: Record<EntidadImportable, PlantillaInfo> =
  {
    CONTACTO: {
      url: `${BASE_URL}/contactos.csv`,
      nombreDescarga: "modelo-contactos.csv",
    },
    EMPRESA: {
      url: `${BASE_URL}/empresas.csv`,
      nombreDescarga: "modelo-empresas.csv",
    },
    OPORTUNIDAD: {
      url: `${BASE_URL}/oportunidades.csv`,
      nombreDescarga: "modelo-oportunidades.csv",
    },
    PEDIDO: {
      url: `${BASE_URL}/pedidos.csv`,
      nombreDescarga: "modelo-pedidos.csv",
    },
    PRODUCTO: {
      url: `${BASE_URL}/productos.csv`,
      nombreDescarga: "modelo-productos.csv",
    },
    ACTIVIDAD: {
      url: `${BASE_URL}/actividades.csv`,
      nombreDescarga: "modelo-actividades.csv",
    },
  };

export function obtenerPlantilla(entidad: EntidadImportable): PlantillaInfo {
  return PLANTILLAS_POR_ENTIDAD[entidad];
}
