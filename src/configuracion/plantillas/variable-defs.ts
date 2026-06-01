export type VariableCategory = "CONTACTO" | "EMPRESA" | "AGENTE" | "OPORTUNIDAD";

export interface VariableDefinition {
  key: string;
  label: string;
  description: string;
  category: VariableCategory;
  icon: string;
  sampleValue: string;
}

export const CATEGORY_LABELS: Record<VariableCategory, string> = {
  CONTACTO: "Contacto",
  EMPRESA: "Empresa",
  AGENTE: "Agente",
  OPORTUNIDAD: "Oportunidad",
};

export const VARIABLES: VariableDefinition[] = [
  // CONTACTO
  { key: "contacto.nombre", label: "nombre", description: "Nombre del contacto", category: "CONTACTO", icon: "👤", sampleValue: "Juan" },
  { key: "contacto.apellido", label: "apellido", description: "Apellido del contacto", category: "CONTACTO", icon: "👤", sampleValue: "Pérez" },
  { key: "contacto.email", label: "correo", description: "Correo principal", category: "CONTACTO", icon: "✉️", sampleValue: "juan@ejemplo.com" },
  { key: "contacto.telefonoPrincipal", label: "telefono", description: "Teléfono principal", category: "CONTACTO", icon: "📞", sampleValue: "+507 6123-4567" },
  { key: "contacto.cargo", label: "cargo", description: "Cargo del contacto", category: "CONTACTO", icon: "💼", sampleValue: "Gerente" },
  { key: "contacto.telefonoSecundario", label: "telefono2", description: "Teléfono secundario", category: "CONTACTO", icon: "📞", sampleValue: "" },
  { key: "contacto.creadoEn", label: "fecha_registro", description: "Fecha de registro", category: "CONTACTO", icon: "📅", sampleValue: "01/01/2026" },
  { key: "contacto.actualizadoEn", label: "ultima_actualizacion", description: "Última actualización", category: "CONTACTO", icon: "🔄", sampleValue: "01/06/2026" },
  // EMPRESA
  { key: "empresa.nombre", label: "empresa", description: "Empresa asociada", category: "EMPRESA", icon: "🏢", sampleValue: "Response CRM" },
  { key: "empresa.ruc", label: "ruc", description: "RUC de la empresa", category: "EMPRESA", icon: "🆔", sampleValue: "123456-1-789" },
  { key: "empresa.industria", label: "industria", description: "Industria de la empresa", category: "EMPRESA", icon: "🏭", sampleValue: "Tecnología" },
  { key: "empresa.sitioWeb", label: "sitio_web", description: "Sitio web", category: "EMPRESA", icon: "🌐", sampleValue: "www.ejemplo.com" },
  { key: "empresa.telefono", label: "tel_empresa", description: "Teléfono de la empresa", category: "EMPRESA", icon: "📞", sampleValue: "" },
  { key: "empresa.email", label: "email_empresa", description: "Email de la empresa", category: "EMPRESA", icon: "✉️", sampleValue: "" },
  { key: "empresa.pais", label: "pais", description: "País de la empresa", category: "EMPRESA", icon: "🌍", sampleValue: "Panamá" },
  { key: "empresa.creadoEn", label: "fecha_empresa", description: "Fecha de registro empresa", category: "EMPRESA", icon: "📅", sampleValue: "01/01/2025" },
  // AGENTE
  { key: "agente", label: "agente", description: "Nombre del agente asignado", category: "AGENTE", icon: "🧑‍💼", sampleValue: "María López" },
  { key: "correo_agente", label: "correo_agente", description: "Correo del agente", category: "AGENTE", icon: "✉️", sampleValue: "maria@empresa.com" },
  // OPORTUNIDAD
  { key: "etapa", label: "etapa", description: "Etapa del pipeline", category: "OPORTUNIDAD", icon: "📊", sampleValue: "Propuesta" },
  { key: "titulo", label: "titulo", description: "Título de la oportunidad", category: "OPORTUNIDAD", icon: "📌", sampleValue: "Proyecto CRM" },
  { key: "descripcion", label: "descripcion", description: "Descripción de la oportunidad", category: "OPORTUNIDAD", icon: "📝", sampleValue: "Implementación de CRM" },
  { key: "valor", label: "monto", description: "Valor de la oportunidad", category: "OPORTUNIDAD", icon: "💰", sampleValue: "$5,000" },
  { key: "moneda", label: "moneda", description: "Moneda", category: "OPORTUNIDAD", icon: "💱", sampleValue: "USD" },
  { key: "probabilidad", label: "probabilidad", description: "Probabilidad de cierre (%)", category: "OPORTUNIDAD", icon: "📈", sampleValue: "75%" },
  { key: "fechaCierre", label: "fecha_cierre", description: "Fecha de cierre estimada", category: "OPORTUNIDAD", icon: "📅", sampleValue: "15/07/2026" },
  { key: "fechaGanada", label: "fecha_ganada", description: "Fecha en que se ganó", category: "OPORTUNIDAD", icon: "🏆", sampleValue: "" },
  { key: "fechaPerdida", label: "fecha_perdida", description: "Fecha en que se perdió", category: "OPORTUNIDAD", icon: "❌", sampleValue: "" },
  { key: "motivoPerdida", label: "motivo_perdida", description: "Motivo de pérdida", category: "OPORTUNIDAD", icon: "❌", sampleValue: "" },
  { key: "creadoEn", label: "fecha_creacion", description: "Fecha de creación", category: "OPORTUNIDAD", icon: "📅", sampleValue: "01/01/2026" },
  { key: "actualizadoEn", label: "ultima_actualizacion", description: "Última actualización", category: "OPORTUNIDAD", icon: "🔄", sampleValue: "01/06/2026" },
];

export function findVariableByKey(key: string): VariableDefinition | undefined {
  return VARIABLES.find((v) => v.key === key);
}

export function filterVariables(query: string): VariableDefinition[] {
  if (!query) return VARIABLES;
  const q = query.toLowerCase();
  return VARIABLES.filter(
    (v) =>
      v.key.toLowerCase().includes(q) ||
      v.label.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q)
  );
}

export function getVariablesByCategory(): [VariableCategory, VariableDefinition[]][] {
  const order: VariableCategory[] = ["CONTACTO", "EMPRESA", "AGENTE", "OPORTUNIDAD"];
  return order.map((cat) => [cat, VARIABLES.filter((v) => v.category === cat)]);
}
