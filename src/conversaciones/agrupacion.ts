import type {
  AvisoOtroCanal,
  ConversacionResumen,
  EstadoConversacion,
  GrupoContacto,
  IdentidadCanalResumen,
  IdentidadConAcceso,
} from "./types";
import { cuentaParaAtencionHumana } from "./atencion-humana";

/**
 * 035-inbox-agrupado-contacto — Lógica derivada del Inbox.
 *
 * Todo lo que el Inbox calcula sobre las conversaciones que ya tiene cargadas
 * vive acá y no dentro del componente, por una razón práctica: el corredor de
 * unitarios del proyecto es Vitest con `environment: "node"` y
 * `include: ["src/**\/*.test.ts"]` — no mira `.tsx` ni tiene DOM. Si esto
 * viviera en `inbox-layout.tsx` no habría forma de probarlo.
 *
 * Reglas del módulo (no son recomendaciones):
 * - No importa React, ni componentes, ni Prisma, ni server actions.
 * - No lee `window`, `localStorage` ni la hora actual: lo que necesite el
 *   "ahora" lo recibe por parámetro.
 * - Todas las funciones son puras y no mutan sus argumentos.
 *
 * Nada de lo que se calcula acá dispara una consulta: el universo es siempre
 * el arreglo de conversaciones que el Inbox ya cargó (FR-015, FR-019).
 */

/**
 * Prioridad de ordenación por estado. Vive acá —y no en inbox-layout.tsx, de
 * donde salió— para que el orden de la lista sea uno solo y se pueda probar.
 */
export const PRIORIDAD: Record<EstadoConversacion, number> = {
  ABIERTA: 0,
  EN_ESPERA: 1,
  CERRADA: 2,
  ARCHIVADA: 3,
};

/**
 * El criterio de "no leído" del Inbox, en un solo lugar: el último mensaje es
 * del contacto y todavía no se marcó como leído. Si la lista y el aviso de
 * otro canal usaran criterios distintos, se contradirían en pantalla.
 */
export function tieneMensajeSinLeer(
  conv: Pick<ConversacionResumen, "ultimoMensaje">,
): boolean {
  const m = conv.ultimoMensaje;
  return !!m && m.remitente === "CONTACTO" && m.estado !== "LEIDO";
}

/** Orden vigente del Inbox: primero lo que requiere acción, después lo más reciente. */
export function compararPorPrioridad(
  a: Pick<ConversacionResumen, "estado" | "actualizadoEn">,
  b: Pick<ConversacionResumen, "estado" | "actualizadoEn">,
): number {
  return (
    PRIORIDAD[a.estado] - PRIORIDAD[b.estado] ||
    new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime()
  );
}

/**
 * Agrupa por contacto las conversaciones **ya filtradas y buscadas**.
 *
 * Que la entrada venga filtrada es deliberado: es lo que hace que los
 * contadores del grupo cuenten conversaciones visibles sin que esta función
 * necesite conocer el filtro activo, y que la suma de los grupos cuadre con el
 * número de la pestaña (research.md, Decisión 3).
 */
export function agruparPorContacto(conversaciones: ConversacionResumen[]): GrupoContacto[] {
  const porContacto = new Map<string, ConversacionResumen[]>();

  for (const conv of conversaciones) {
    const previas = porContacto.get(conv.contactoId);
    if (previas) previas.push(conv);
    else porContacto.set(conv.contactoId, [conv]);
  }

  const grupos: GrupoContacto[] = [];

  for (const [contactoId, convs] of porContacto) {
    const ordenadas = [...convs].sort(compararPorPrioridad);
    const lider = ordenadas[0];

    const canales = new Set<string>();
    let noLeidos = 0;
    let requiereAtencion = false;

    for (const conv of ordenadas) {
      // Una conversación sin cuenta de canal no suma: no se sabe por dónde
      // entró, y contarla inflaría el "N canales" con un canal fantasma.
      if (conv.cuentaCanal?.canal) canales.add(conv.cuentaCanal.canal);
      if (tieneMensajeSinLeer(conv)) noLeidos++;
      if (cuentaParaAtencionHumana(conv)) requiereAtencion = true;
    }

    grupos.push({
      contactoId,
      // El contacto sale del líder: todas las conversaciones del grupo son del
      // mismo contacto, así que cualquiera sirve y el líder siempre existe.
      contacto: lider.contacto,
      conversaciones: ordenadas,
      lider,
      totalConversaciones: ordenadas.length,
      totalCanales: canales.size,
      noLeidos,
      requiereAtencionHumana: requiereAtencion,
      esSimple: ordenadas.length === 1,
    });
  }

  // Mismo criterio que ordena las conversaciones, aplicado al líder de cada
  // grupo: una persona con algo abierto nunca queda debajo de una con todo
  // cerrado. El desempate final por contactoId hace el orden determinista
  // cuando dos grupos empatan en estado y fecha (importa para los tests y
  // para que la lista no "salte" entre refrescos).
  return grupos.sort(
    (a, b) =>
      compararPorPrioridad(a.lider, b.lider) || a.contactoId.localeCompare(b.contactoId),
  );
}

/**
 * Decide si el chat abierto debe avisar que esa misma persona escribió algo
 * más nuevo por otro lado, y por cuál.
 *
 * Solo mira conversaciones ya cargadas en el Inbox: no existe ningún camino
 * desde acá al servidor (FR-015).
 */
export function elegirAvisoOtroCanal(args: {
  conversacionAbierta: ConversacionResumen;
  todasLasConversaciones: ConversacionResumen[];
  descartados: ReadonlySet<string>;
}): AvisoOtroCanal | null {
  const { conversacionAbierta, todasLasConversaciones, descartados } = args;

  // Si la conversación abierta no tiene mensajes todavía, cualquier mensaje
  // sin leer del otro canal es más nuevo que nada.
  const referencia = conversacionAbierta.ultimoMensaje
    ? new Date(conversacionAbierta.ultimoMensaje.creadoEn).getTime()
    : -Infinity;

  let ganadora: { conv: ConversacionResumen; fecha: Date } | null = null;

  for (const conv of todasLasConversaciones) {
    if (conv.id === conversacionAbierta.id) continue;
    if (conv.contactoId !== conversacionAbierta.contactoId) continue;
    if (!tieneMensajeSinLeer(conv)) continue;

    const fecha = new Date(conv.ultimoMensaje!.creadoEn);
    if (fecha.getTime() <= referencia) continue;

    if (!ganadora || fecha.getTime() > ganadora.fecha.getTime()) {
      ganadora = { conv, fecha };
    }
  }

  if (!ganadora) return null;

  const mensajeId = ganadora.conv.ultimoMensaje!.id;
  // Descartado el aviso más nuevo, no se cae al siguiente más viejo: el agente
  // ya dijo que no le interesa lo que hay del otro lado, mostrarle algo
  // anterior sería ruido (research.md, Decisión 5).
  if (descartados.has(mensajeId)) return null;

  return {
    conversacionId: ganadora.conv.id,
    canal: ganadora.conv.cuentaCanal?.canal ?? "",
    nombreCanal: ganadora.conv.cuentaCanal?.nombre ?? "otro canal",
    mensajeId,
    fecha: ganadora.fecha,
  };
}

/**
 * Empareja cada identidad del contacto con la conversación que corre por ese
 * canal, **solo entre las que el Inbox ya tiene cargadas**. Una identidad sin
 * conversación cargada se devuelve sin acceso y sin fecha (FR-018): no se pide
 * nada al servidor para completarla.
 */
export function resumirIdentidades(args: {
  identidades: IdentidadCanalResumen[];
  conversacionesDelContacto: ConversacionResumen[];
}): IdentidadConAcceso[] {
  const { identidades, conversacionesDelContacto } = args;

  // Por canal, la conversación más recientemente actualizada. Un contacto
  // puede tener varias del mismo canal (correo agrupado por hilo).
  const porCanal = new Map<string, ConversacionResumen>();
  for (const conv of conversacionesDelContacto) {
    const canal = conv.cuentaCanal?.canal;
    if (!canal) continue;
    const previa = porCanal.get(canal);
    if (!previa || new Date(conv.actualizadoEn) > new Date(previa.actualizadoEn)) {
      porCanal.set(canal, conv);
    }
  }

  const resumidas: IdentidadConAcceso[] = identidades.map((identidad) => {
    const conv = porCanal.get(identidad.canal) ?? null;
    return {
      ...identidad,
      conversacionId: conv?.id ?? null,
      ultimaActividad: conv ? new Date(conv.actualizadoEn) : null,
    };
  });

  // Primero las que se pueden abrir, por actividad descendente; después las
  // demás, en el orden en que vinieron (estable).
  return resumidas
    .map((identidad, orden) => ({ identidad, orden }))
    .sort((a, b) => {
      const fa = a.identidad.ultimaActividad;
      const fb = b.identidad.ultimaActividad;
      if (fa && fb) return fb.getTime() - fa.getTime() || a.orden - b.orden;
      if (fa) return -1;
      if (fb) return 1;
      return a.orden - b.orden;
    })
    .map(({ identidad }) => identidad);
}
