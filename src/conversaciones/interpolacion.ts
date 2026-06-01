import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Tipos del contexto ───────────────────────────────────────────────────────

export interface ContextoInterpolacion {
  contacto?: {
    nombre?: string | null;
    apellido?: string | null;
    email?: string | null;
    telefonoPrincipal?: string | null;
    telefonoSecundario?: string | null;
    cargo?: string | null;
    creadoEn?: string | null;
    actualizadoEn?: string | null;
  } | null;
  empresa?: {
    nombre?: string | null;
    ruc?: string | null;
    industria?: string | null;
    sitioWeb?: string | null;
    telefono?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown> | null;
    creadoEn?: string | null;
    actualizadoEn?: string | null;
  } | null;
  oportunidad?: {
    titulo?: string | null;
    descripcion?: string | null;
    etapa?: string | null;
    valor?: string | null;
    moneda?: string | null;
    probabilidad?: number | null;
    fechaCierre?: string | null;
    fechaGanada?: string | null;
    fechaPerdida?: string | null;
    motivoPerdida?: string | null;
    creadoEn?: string | null;
    actualizadoEn?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  agente?: string | null;
  correo_agente?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(fecha: string | null | undefined): string {
  if (!fecha) return "";
  try {
    return format(new Date(fecha), "dd/MM/yyyy", { locale: es });
  } catch {
    return "";
  }
}

function resolverVariable(key: string, ctx: ContextoInterpolacion): string {
  // contacto.*
  if (key.startsWith("contacto.")) {
    const f = key.slice("contacto.".length);
    const c = ctx.contacto;
    if (!c) return "";
    switch (f) {
      case "nombre": return c.nombre ?? "";
      case "apellido": return c.apellido ?? "";
      case "email": return c.email ?? "";
      case "telefonoPrincipal": return c.telefonoPrincipal ?? "";
      case "telefonoSecundario": return c.telefonoSecundario ?? "";
      case "cargo": return c.cargo ?? "";
      case "creadoEn": return fmt(c.creadoEn);
      case "actualizadoEn": return fmt(c.actualizadoEn);
      default: return "";
    }
  }

  // empresa.*
  if (key.startsWith("empresa.")) {
    const f = key.slice("empresa.".length);
    const e = ctx.empresa;
    if (!e) return "";
    switch (f) {
      case "nombre": return e.nombre ?? "";
      case "ruc": return e.ruc ?? "";
      case "industria": return e.industria ?? "";
      case "sitioWeb": return e.sitioWeb ?? "";
      case "telefono": return e.telefono ?? "";
      case "email": return e.email ?? "";
      case "pais": return (e.metadata?.pais as string | undefined) ?? "";
      case "creadoEn": return fmt(e.creadoEn);
      case "actualizadoEn": return fmt(e.actualizadoEn);
      default: return (e.metadata?.[f] as string | undefined) ?? "";
    }
  }

  // _metadata.* — acceso a metadata de la oportunidad
  if (key.startsWith("_metadata.")) {
    const f = key.slice("_metadata.".length);
    return (ctx.oportunidad?.metadata?.[f] as string | undefined) ?? "";
  }

  // agente
  if (key === "agente") return ctx.agente ?? "";
  if (key === "correo_agente") return ctx.correo_agente ?? "";

  // oportunidad (campos directos)
  const op = ctx.oportunidad;
  if (!op) return "";
  switch (key) {
    case "titulo": return op.titulo ?? "";
    case "descripcion": return op.descripcion ?? "";
    case "etapa": return op.etapa ?? "";
    case "valor": {
      if (!op.valor) return "";
      const n = parseFloat(op.valor);
      return isNaN(n) ? "" : n.toLocaleString("es-PA");
    }
    case "moneda": return op.moneda ?? "";
    case "probabilidad": return op.probabilidad != null ? `${op.probabilidad}%` : "";
    case "fechaCierre": return fmt(op.fechaCierre);
    case "fechaGanada": return fmt(op.fechaGanada);
    case "fechaPerdida": return fmt(op.fechaPerdida);
    case "motivoPerdida": return op.motivoPerdida ?? "";
    case "creadoEn": return fmt(op.creadoEn);
    case "actualizadoEn": return fmt(op.actualizadoEn);
    default: return (op.metadata?.[key] as string | undefined) ?? "";
  }
}

// ─── Función principal de interpolación ──────────────────────────────────────

export function interpolarPlantilla(
  contenido: string,
  ctx: ContextoInterpolacion
): string {
  // Reemplaza {{variable}} con el valor real del contexto
  // Si la variable no existe o está vacía, deja el campo vacío (no deja los {{}})
  return contenido.replace(/\{\{([\w._]+)\}\}/g, (_, key) =>
    resolverVariable(key, ctx)
  );
}

// ─── Fetch del contexto desde el cliente ──────────────────────────────────────

export async function fetchContextoInterpolacion(
  conversacionId: string
): Promise<ContextoInterpolacion> {
  try {
    const res = await fetch(`/api/conversaciones/${conversacionId}/contexto`);
    if (!res.ok) return {};
    return res.json() as Promise<ContextoInterpolacion>;
  } catch {
    return {};
  }
}
