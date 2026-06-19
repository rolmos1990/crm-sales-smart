import type { Rol } from "@/generated/prisma/enums";
import type { SesionActual } from "./sesion";

// ─── Labels y metadata de roles ───────────────────────────────────────────────

export const ROL_LABELS: Record<Rol, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  GERENTE_VENTAS: "Gerente Ventas",
  SUPERVISOR: "Supervisor",
  AGENTE_VENTAS: "Agente Ventas",
  EJECUTIVO_VENTAS: "Ejecutivo Ventas",
  AGENTE_SOPORTE: "Agente Soporte",
  INVITADO: "Invitado",
  AGENTE: "Agente",
};

export const ROL_DESCRIPCION: Partial<Record<Rol, string>> = {
  ADMIN: "Acceso total a todos los módulos",
  GERENTE_VENTAS: "Control comercial completo: pipeline, productos y equipo de ventas",
  SUPERVISOR: "Ve todo, no puede modificar configuración ni pipelines",
  AGENTE_VENTAS: "Gestión comercial: contactos, oportunidades, cotizaciones y pedidos",
  EJECUTIVO_VENTAS: "Ventas operativas: cotizaciones, pedidos y actividades",
  AGENTE_SOPORTE: "Atención: conversaciones, contactos y actividades",
  INVITADO: "Solo lectura en módulos operativos",
};

// Roles asignables a humanos (excluye OWNER que se asigna solo en registro y AGENTE para bots)
export const ROLES_HUMANOS: Rol[] = [
  "ADMIN",
  "GERENTE_VENTAS",
  "SUPERVISOR",
  "AGENTE_VENTAS",
  "EJECUTIVO_VENTAS",
  "AGENTE_SOPORTE",
  "INVITADO",
];

// ─── Mapa de módulos a permisos ────────────────────────────────────────────────

export type NivelAcceso = "rw" | "r" | "none";

// dashboard, pipeline, inbox, contactos, empresas, oportunidades, actividades
// cotizaciones, pedidos, flujo-venta, etiquetas, productos, integraciones, configuracion, datos
export type Modulo =
  | "dashboard"
  | "pipeline"
  | "inbox"
  | "contactos"
  | "empresas"
  | "oportunidades"
  | "actividades"
  | "cotizaciones"
  | "pedidos"
  | "flujo-venta"
  | "etiquetas"
  | "productos"
  | "integraciones"
  | "configuracion"
  | "datos"
  | "transportistas";

const PERMISOS: Record<Rol, Record<Modulo, NivelAcceso>> = {
  OWNER: {
    dashboard: "rw", pipeline: "rw", inbox: "rw", contactos: "rw", empresas: "rw",
    oportunidades: "rw", actividades: "rw", cotizaciones: "rw", pedidos: "rw",
    "flujo-venta": "rw", etiquetas: "rw", productos: "rw", integraciones: "rw",
    configuracion: "rw", datos: "rw", transportistas: "rw",
  },
  ADMIN: {
    dashboard: "rw", pipeline: "rw", inbox: "rw", contactos: "rw", empresas: "rw",
    oportunidades: "rw", actividades: "rw", cotizaciones: "rw", pedidos: "rw",
    "flujo-venta": "rw", etiquetas: "rw", productos: "rw", integraciones: "rw",
    configuracion: "rw", datos: "rw", transportistas: "rw",
  },
  GERENTE_VENTAS: {
    dashboard: "rw", pipeline: "rw", inbox: "rw", contactos: "rw", empresas: "rw",
    oportunidades: "rw", actividades: "rw", cotizaciones: "rw", pedidos: "rw",
    "flujo-venta": "rw", etiquetas: "rw", productos: "rw", integraciones: "none",
    configuracion: "none", datos: "r", transportistas: "none",
  },
  SUPERVISOR: {
    dashboard: "r", pipeline: "r", inbox: "r", contactos: "r", empresas: "r",
    oportunidades: "r", actividades: "r", cotizaciones: "r", pedidos: "r",
    "flujo-venta": "r", etiquetas: "r", productos: "r", integraciones: "r",
    configuracion: "r", datos: "r", transportistas: "none",
  },
  AGENTE_VENTAS: {
    dashboard: "rw", pipeline: "rw", inbox: "rw", contactos: "rw", empresas: "rw",
    oportunidades: "rw", actividades: "rw", cotizaciones: "rw", pedidos: "rw",
    "flujo-venta": "none", etiquetas: "none", productos: "r", integraciones: "none",
    configuracion: "none", datos: "none", transportistas: "none",
  },
  EJECUTIVO_VENTAS: {
    dashboard: "rw", pipeline: "none", inbox: "none", contactos: "r", empresas: "none",
    oportunidades: "none", actividades: "rw", cotizaciones: "rw", pedidos: "rw",
    "flujo-venta": "none", etiquetas: "none", productos: "r", integraciones: "none",
    configuracion: "none", datos: "none", transportistas: "none",
  },
  AGENTE_SOPORTE: {
    dashboard: "rw", pipeline: "r", inbox: "rw", contactos: "rw", empresas: "r",
    oportunidades: "r", actividades: "rw", cotizaciones: "none", pedidos: "r",
    "flujo-venta": "none", etiquetas: "none", productos: "none", integraciones: "none",
    configuracion: "none", datos: "none", transportistas: "none",
  },
  INVITADO: {
    dashboard: "r", pipeline: "r", inbox: "r", contactos: "r", empresas: "r",
    oportunidades: "r", actividades: "r", cotizaciones: "r", pedidos: "r",
    "flujo-venta": "none", etiquetas: "none", productos: "none", integraciones: "none",
    configuracion: "none", datos: "none", transportistas: "none",
  },
  // AGENTE es para bots/sistema — no navegan, pero les damos acceso mínimo por si acaso
  AGENTE: {
    dashboard: "none", pipeline: "none", inbox: "none", contactos: "none", empresas: "none",
    oportunidades: "none", actividades: "none", cotizaciones: "none", pedidos: "none",
    "flujo-venta": "none", etiquetas: "none", productos: "none", integraciones: "none",
    configuracion: "none", datos: "none", transportistas: "none",
  },
};

export const ROL_PERMISOS = PERMISOS;

function nivel(rol: Rol, modulo: string): NivelAcceso {
  const mapa = PERMISOS[rol];
  if (!mapa) return "none";
  return (mapa as Record<string, NivelAcceso>)[modulo] ?? "none";
}

// ─── Funciones públicas ────────────────────────────────────────────────────────

export function puedeVerModulo(rol: Rol, modulo: string): boolean {
  return nivel(rol, modulo) !== "none";
}

export function puedeModificar(rol: Rol, modulo: string): boolean {
  return nivel(rol, modulo) === "rw";
}

export function verificarAcceso(
  sesion: SesionActual,
  modulo: string,
  tipo: "ver" | "modificar",
): { permitido: boolean; error?: string } {
  const ok = tipo === "ver"
    ? puedeVerModulo(sesion.rol, modulo)
    : puedeModificar(sesion.rol, modulo);

  if (!ok) {
    return {
      permitido: false,
      error:
        tipo === "ver"
          ? "No tienes acceso a este módulo"
          : "No tienes permisos para realizar esta acción",
    };
  }
  return { permitido: true };
}
