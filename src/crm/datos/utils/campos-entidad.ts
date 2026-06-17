import type { DefinicionCampo, EntidadImportable } from "../types";

export const CAMPOS_POR_ENTIDAD: Record<EntidadImportable, DefinicionCampo[]> =
  {
    CONTACTO: [
      {
        clave: "nombre",
        etiqueta: "Nombre",
        requerido: true,
        tipo: "texto",
      },
      {
        clave: "apellido",
        etiqueta: "Apellido",
        requerido: true,
        tipo: "texto",
      },
      {
        clave: "email",
        etiqueta: "Email",
        requerido: false,
        tipo: "email",
      },
      {
        clave: "telefonoPrincipal",
        etiqueta: "Teléfono",
        requerido: false,
        tipo: "telefono",
      },
      {
        clave: "cargo",
        etiqueta: "Cargo",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "notas",
        etiqueta: "Notas",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "estado",
        etiqueta: "Estado",
        requerido: false,
        tipo: "enum",
        valoresEnum: ["ACTIVO", "INACTIVO", "LEAD"],
      },
    ],
    EMPRESA: [
      {
        clave: "nombre",
        etiqueta: "Nombre",
        requerido: true,
        tipo: "texto",
      },
      {
        clave: "ruc",
        etiqueta: "RUC",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "industria",
        etiqueta: "Industria",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "tamano",
        etiqueta: "Tamaño",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "sitioWeb",
        etiqueta: "Sitio web",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "telefono",
        etiqueta: "Teléfono",
        requerido: false,
        tipo: "telefono",
      },
      {
        clave: "email",
        etiqueta: "Email",
        requerido: false,
        tipo: "email",
      },
      {
        clave: "notas",
        etiqueta: "Notas",
        requerido: false,
        tipo: "texto",
      },
    ],
    OPORTUNIDAD: [
      {
        clave: "titulo",
        etiqueta: "Título",
        requerido: true,
        tipo: "texto",
      },
      {
        clave: "valor",
        etiqueta: "Valor",
        requerido: true,
        tipo: "numero",
      },
      {
        clave: "probabilidad",
        etiqueta: "Probabilidad (%)",
        requerido: false,
        tipo: "numero",
      },
      {
        clave: "fechaCierre",
        etiqueta: "Fecha de cierre",
        requerido: false,
        tipo: "fecha",
      },
      {
        clave: "notas",
        etiqueta: "Notas",
        requerido: false,
        tipo: "texto",
      },
    ],
    PEDIDO: [
      {
        clave: "nombre",
        etiqueta: "Nombre",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "apellido",
        etiqueta: "Apellido",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "telefono",
        etiqueta: "Teléfono",
        requerido: false,
        tipo: "telefono",
      },
      {
        clave: "email",
        etiqueta: "Email",
        requerido: false,
        tipo: "email",
      },
      {
        clave: "empresaNombre",
        etiqueta: "Empresa",
        requerido: false,
        tipo: "texto",
      },
    ],
    PRODUCTO: [
      {
        clave: "nombre",
        etiqueta: "Nombre",
        requerido: true,
        tipo: "texto",
      },
      {
        clave: "precio",
        etiqueta: "Precio",
        requerido: true,
        tipo: "numero",
      },
      {
        clave: "sku",
        etiqueta: "SKU",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "descripcion",
        etiqueta: "Descripción",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "categoria",
        etiqueta: "Categoría",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "unidad",
        etiqueta: "Unidad",
        requerido: false,
        tipo: "texto",
      },
      {
        clave: "cantidadDisponible",
        etiqueta: "Stock disponible",
        requerido: false,
        tipo: "numero",
      },
    ],
    ACTIVIDAD: [
      {
        clave: "tipo",
        etiqueta: "Tipo",
        requerido: true,
        tipo: "enum",
        valoresEnum: ["LLAMADA", "EMAIL", "REUNION", "TAREA", "NOTA"],
      },
      {
        clave: "titulo",
        etiqueta: "Título",
        requerido: true,
        tipo: "texto",
      },
      {
        clave: "fecha",
        etiqueta: "Fecha",
        requerido: true,
        tipo: "fecha",
      },
      {
        clave: "prioridad",
        etiqueta: "Prioridad",
        requerido: true,
        tipo: "enum",
        valoresEnum: ["ALTA", "MEDIA", "BAJA"],
      },
      {
        clave: "descripcion",
        etiqueta: "Descripción",
        requerido: false,
        tipo: "texto",
      },
    ],
  };

export function obtenerCamposEntidad(
  entidad: EntidadImportable,
): DefinicionCampo[] {
  return CAMPOS_POR_ENTIDAD[entidad] ?? [];
}
