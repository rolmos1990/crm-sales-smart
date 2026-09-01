// Catálogo cerrado compartido entre las specs del plan de evolución del
// agente de IA — definido acá (dominio "estrategia", spec
// 011-playbook-estrategia-comercial) porque es donde el pedido original lo
// ubica conceptualmente (condiciones de aplicación de un playbook), pero
// creado como parte de 012-perfil-dinamico-cliente (que lo necesita primero
// para clasificar el tipo de relación de un contacto) — 011 lo reutiliza sin
// redefinirlo cuando se implemente. Ver docs/AGENTE-IA-EVOLUCION-ANALISIS.md.

export type TipoRelacionCliente =
  | "NUEVO_CONTACTO"
  | "PROSPECTO_RECURRENTE"
  | "CLIENTE_NUEVO"
  | "CLIENTE_REGULAR"
  | "CLIENTE_INACTIVO"
  | "CLIENTE_CON_INCIDENCIA";

export type IntencionComercial =
  | "EXPLORANDO"
  | "COMPARANDO"
  | "SOLICITANDO_RECOMENDACION"
  | "CONSULTANDO_PRECIO"
  | "CONSULTANDO_DISPONIBILIDAD"
  | "LISTO_PARA_COTIZAR"
  | "LISTO_PARA_COMPRAR"
  | "ESPERANDO_INFORMACION"
  | "REQUIERE_SEGUIMIENTO"
  | "REQUIERE_ATENCION_HUMANA";
