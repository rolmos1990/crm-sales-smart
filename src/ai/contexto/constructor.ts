import { prisma } from "@/shared/db/prisma";
import { resolverDecisionContexto } from "./router";
import { construirContextoCompuesto } from "./context-builder";
import { formatearHechos, formatearLectura, resolverFichaVigente } from "./capas/estado-conversacion";
import type { FichaConversacion } from "@/ai/ficha-conversacion/tipos";
import type { ContextoIA, MensajeContexto } from "./tipos";

interface OpcionesContexto {
  instanciaId: string;
  conversacionId?: string;
  contactoId?: string;
  oportunidadId?: string;
  agenteIAConfigId?: string;
  /** Tope duro de mensajes del llamador. Acota tanto el presupuesto de tokens
   *  como la cantidad que pidió `memoria` — nunca la amplía. */
  maxMensajes?: number;
  /** 031 — memoria configurada en el nodo Atención IA. Ausente: la cantidad
   *  la decide el presupuesto de tokens, como antes de esa feature. */
  memoria?: { activa: boolean; cantidad: number };
  /** 031 — el nodo Atención IA activó la ficha de la conversación. */
  ficha?: boolean;
  /** 031 — zona de negocio, solo para formatear las fechas de la capa 6. */
  zonaNegocio?: string;
}

// Los mensajes sin texto (solo imagen, audio o evento) se descartan después de
// traerlos, así que hay que pedir de más para que no recorten la ventana real.
// 031 (FR-005): antes el filtro corría después del slice y un mensaje de solo
// imagen quemaba un lugar de la ventana.
//
// El margen es ADITIVO y no un multiplicador a propósito: esta consulta corre
// en cada respuesta del agente, y un factor 2× sobre el caso por defecto (30)
// duplicaría la lectura en todas las conversaciones que ya existen para
// servir, típicamente, 13 mensajes. Si el margen no alcanza porque el tramo
// es casi todo media, se entregan menos mensajes — que es exactamente lo que
// pasaba antes de esta feature, nunca algo peor.
const MARGEN_MENSAJES_VACIOS = 10;
const MAX_MENSAJES_A_TRAER = 100;

export async function construirContexto(opciones: OpcionesContexto): Promise<ContextoIA> {
  const { instanciaId, conversacionId, contactoId, oportunidadId, agenteIAConfigId, memoria } = opciones;

  // Con la memoria apagada el agente solo ve el último mensaje del cliente,
  // así que no tiene sentido traer la ventana completa (research D2).
  const mensajesAPedir = memoria?.activa === false
    ? 0
    : Math.min((memoria?.cantidad ?? 30) + MARGEN_MENSAJES_VACIOS, MAX_MENSAJES_A_TRAER);

  const [conversacionRaw, contacto, oportunidad, agenteConfig] = await Promise.all([
    conversacionId
      ? prisma.conversacion.findUnique({
          where: { id: conversacionId },
          select: {
            id: true,
            cuentaCanal: { select: { canal: true } },
            contacto: { select: { nombre: true } },
            _count: { select: { mensajes: true } },
            // Se pide de más y el recorte fino se hace en memoria, ya sin
            // los mensajes vacíos (ver MARGEN_MENSAJES_VACIOS).
            mensajes: {
              orderBy: { creadoEn: "desc" },
              take: mensajesAPedir,
              select: { contenido: true, remitente: true, creadoEn: true },
            },
          },
        })
      : null,
    contactoId
      ? prisma.contacto.findUnique({
          where: { id: contactoId },
          select: {
            id: true,
            nombre: true,
            email: true,
            empresa: { select: { nombre: true } },
          },
        })
      : null,
    oportunidadId
      ? prisma.oportunidad.findUnique({
          where: { id: oportunidadId },
          select: { id: true, titulo: true, etapa: true, valor: true },
        })
      : null,
    agenteIAConfigId
      ? prisma.agenteIAConfig.findUnique({
          where: { id: agenteIAConfigId },
          select: {
            // Bloque único de instrucciones (Rol · Estilo · Proceso ·
            // Reglas). Es LA fuente del prompt de todo agente migrado: sin
            // él, construirSystemPrompt cae al camino previo a la 009 y el
            // texto que el negocio escribe en el modal no llega nunca al
            // modelo. El simulador sí lo cargaba (lee la fila entera), así
            // que el agente se comportaba distinto ahí que en producción.
            instruccionesAgente: true,

            sistemaPrompt: true,
            personalidad: true,
            objetivo: true,
            especialidad: true,
            instrucciones: true,
            configuracionTono: true,
            limiteTokensCtx: true,

            // 009-perfil-agente-estructurado-versionado — AgenteIAConfig es
            // siempre la versión PUBLICADA vigente (ver research.md de esa
            // spec), así que leer estos campos acá ya cumple FR-008/FR-012
            // sin necesitar resolver nada adicional.
            nombreAgente: true,
            rol: true,
            idiomaPrincipal: true,
            idiomasPermitidos: true,
            longitudRespuesta: true,
            proactividad: true,
            intensidadComercial: true,
            estiloRecomendacion: true,
            frasesPreferidas: true,
            frasesProhibidas: true,
            comportamientosProhibidos: true,
            reglasPersonalizadas: true,
            condicionesTransferenciaHumano: true,

            // 028-respuestas-guia-catalogo-ia
            respuestasGuia: true,
            catalogoEnContexto: true,
            limiteCatalogoContexto: true,
          },
        })
      : null,
  ]);

  // 031 (research D11) — la ficha se resuelve ANTES de decidir cuántos
  // mensajes entran: ocupa tokens del mismo presupuesto, y sin descontarla
  // activarla empujaría al agente por encima de su límite en silencio. Se lee
  // una sola vez y después se le pasa al context builder como override, así
  // no se consulta dos veces por turno. Sin ficha, `tokensReservadosExtra`
  // vale 0 y el cálculo da exactamente lo mismo que antes (SC-001).
  const ficha = opciones.ficha
    ? await resolverFichaVigente({ instanciaId, conversacionId, activa: true, zonaNegocio: opciones.zonaNegocio })
    : null;
  const tokensReservadosExtra = ficha ? estimarTokensFicha(ficha, opciones.zonaNegocio) : 0;

  const totalMensajes = conversacionRaw?._count?.mensajes ?? 0;
  const decision = resolverDecisionContexto({
    totalMensajes,
    tieneResumen: false,
    esPrimerMensajeDeContacto: totalMensajes <= 1,
    limiteTokensCtx: agenteConfig?.limiteTokensCtx ?? 4000,
    override: memoria?.activa ? memoria.cantidad : undefined,
    tokensReservadosExtra,
  });

  if (decision.recortadoPorTokens) {
    console.warn(
      `[ContextoIA] El nodo pidió recordar ${memoria?.cantidad} mensajes pero el límite de contexto del agente ` +
        `(${agenteConfig?.limiteTokensCtx ?? 4000} tokens) solo permite ${decision.mensajesAIncluir}. ` +
        `Se descartaron los más antiguos.`,
    );
  }

  // `maxMensajes` es un tope duro del llamador: acota, nunca amplía.
  const cantidadFinal = Math.min(decision.mensajesAIncluir, opciones.maxMensajes ?? Number.POSITIVE_INFINITY);

  const contexto: ContextoIA = {};

  if (conversacionRaw) {
    const mensajes: MensajeContexto[] =
      memoria?.activa === false
        ? await ultimoMensajeDelCliente(conversacionId!)
        : conversacionRaw.mensajes
            // 031 (FR-005): filtrar ANTES de cortar — si no, un mensaje de
            // solo imagen ocupa un lugar de la ventana y después desaparece.
            .filter((m) => m.contenido && m.contenido.trim().length > 0)
            .slice(0, cantidadFinal)
            .reverse()
            .map((m) => ({
              rol: m.remitente === "CONTACTO" ? "user" : "assistant",
              contenido: m.contenido!,
              creadoEn: m.creadoEn,
            }));

    contexto.conversacion = {
      id: conversacionRaw.id,
      contactoNombre: conversacionRaw.contacto?.nombre,
      canal: conversacionRaw.cuentaCanal?.canal,
      mensajes,
    };
  }

  if (contacto) {
    contexto.contacto = {
      id: contacto.id,
      nombre: contacto.nombre,
      email: contacto.email,
      empresa: contacto.empresa?.nombre,
    };
  }

  if (oportunidad) {
    contexto.oportunidad = {
      id: oportunidad.id,
      titulo: oportunidad.titulo,
      etapa: oportunidad.etapa,
      valor: oportunidad.valor ? Number(oportunidad.valor) : null,
    };
  }

  if (agenteConfig) {
    // 013-context-builder-capas-precedencia — construirContexto delega en
    // construirContextoCompuesto, que resuelve además las capas 4 (estrategia,
    // 011) y 5 (perfil de cliente, 012) antes de armar el systemPrompt final.
    const compuesto = await construirContextoCompuesto(
      {
        instanciaId,
        conversacionId,
        contactoId,
        oportunidadId,
        agenteIAConfigId,
        fichaActiva: opciones.ficha ?? false,
        // Ya resuelta arriba (incluida la comprobación de vigencia): se le
        // pasa como override para no volver a consultarla.
        ...(opciones.ficha ? { fichaOverride: ficha } : {}),
        zonaNegocio: opciones.zonaNegocio,
      },
      {
        configAgente: {
          instruccionesAgente: agenteConfig.instruccionesAgente,
          objetivo: agenteConfig.objetivo,
          personalidad: agenteConfig.personalidad,
          especialidad: agenteConfig.especialidad,
          instrucciones: agenteConfig.instrucciones,
          sistemaPrompt: agenteConfig.sistemaPrompt,
          configuracionTono: agenteConfig.configuracionTono,
          nombreAgente: agenteConfig.nombreAgente,
          rol: agenteConfig.rol,
          idiomaPrincipal: agenteConfig.idiomaPrincipal,
          idiomasPermitidos: agenteConfig.idiomasPermitidos,
          longitudRespuesta: agenteConfig.longitudRespuesta,
          proactividad: agenteConfig.proactividad,
          intensidadComercial: agenteConfig.intensidadComercial,
          estiloRecomendacion: agenteConfig.estiloRecomendacion,
          frasesPreferidas: agenteConfig.frasesPreferidas,
          frasesProhibidas: agenteConfig.frasesProhibidas,
          comportamientosProhibidos: agenteConfig.comportamientosProhibidos,
          reglasPersonalizadas: agenteConfig.reglasPersonalizadas,
          condicionesTransferenciaHumano: agenteConfig.condicionesTransferenciaHumano,
          respuestasGuia: agenteConfig.respuestasGuia,
          catalogoEnContexto: agenteConfig.catalogoEnContexto,
          limiteCatalogoContexto: agenteConfig.limiteCatalogoContexto,
        },
        contextoDinamico: {
          nombreContacto: contacto?.nombre,
          empresaContacto: contacto?.empresa?.nombre ?? undefined,
          tituloOportunidad: oportunidad?.titulo,
          etapaOportunidad: oportunidad?.etapa,
        },
      },
    );

    contexto.sistemaPrompt = compuesto.systemPrompt;
    contexto.estrategiaSeleccionada = compuesto.estrategiaSeleccionada;
    contexto.perfilClienteUsado = compuesto.perfilClienteUsado;
    contexto.ejemplosUtilizadosIds = compuesto.ejemplosUtilizadosIds;
  }

  return contexto;
}

// Aproximación por caracteres, igual de gruesa que los 150 tokens/mensaje
// que ya usa el router: sirve para no pasarse del límite, no para predecir.
const CARACTERES_POR_TOKEN = 4;

function estimarTokensFicha(ficha: FichaConversacion, zonaNegocio?: string): number {
  const texto = [
    formatearHechos(ficha.hechos, ficha.turnos, zonaNegocio),
    ficha.interpretado ? formatearLectura(ficha.interpretado) : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return Math.ceil(texto.length / CARACTERES_POR_TOKEN);
}

/**
 * 031 (FR-004, research D2) — con la memoria apagada el agente responde a lo
 * último que dijo el cliente. Se busca por remitente y no "el último mensaje"
 * a secas: si el último fuera nuestro, el agente se respondería a sí mismo.
 */
async function ultimoMensajeDelCliente(conversacionId: string): Promise<MensajeContexto[]> {
  const mensaje = await prisma.mensajeConversacion.findFirst({
    where: { conversacionId, remitente: "CONTACTO" },
    orderBy: { creadoEn: "desc" },
    select: { contenido: true, creadoEn: true },
  });

  if (!mensaje?.contenido?.trim()) return [];
  return [{ rol: "user", contenido: mensaje.contenido, creadoEn: mensaje.creadoEn }];
}

export function serializarContextoComoMensajes(
  contexto: ContextoIA,
): Array<{ rol: "system" | "user" | "assistant"; contenido: string }> {
  const mensajes: Array<{ rol: "system" | "user" | "assistant"; contenido: string }> = [];

  if (contexto.sistemaPrompt) {
    mensajes.push({ rol: "system", contenido: contexto.sistemaPrompt });
  }

  if (contexto.conversacion?.mensajes) {
    for (const m of contexto.conversacion.mensajes) {
      mensajes.push({ rol: m.rol, contenido: m.contenido });
    }
  }

  return mensajes;
}
