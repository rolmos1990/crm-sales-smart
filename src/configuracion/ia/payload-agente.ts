import { Prisma } from "@/generated/prisma/client";
import type { AgenteIAConfigInput } from "./agente-schema";

// Mapeo campo del formulario → columna de AgenteIAConfig. Vive fuera de los
// archivos "use server" porque lo usan tanto la creación del agente
// (usuarios/actions.ts) como el guardado y el versionado (agente-actions.ts):
// antes estaba duplicado y la creación se dejaba campos sin persistir.
//
// No incluye `tipo` a propósito: se elige al crear el agente y ni publicar ni
// restaurar una versión deben cambiarlo.
export function construirPayloadAgenteIA(datos: AgenteIAConfigInput) {
  return {
    instruccionesAgente: datos.instruccionesAgente ?? null,
    sistemaPrompt: datos.sistemaPrompt ?? null,
    personalidad: datos.personalidad ?? null,
    objetivo: datos.objetivo ?? null,
    especialidad: datos.especialidad ?? null,
    temperaturaOverride: datos.temperaturaOverride ?? null,
    modeloPreferido: datos.modeloPreferido ?? null,
    memoriaHabilitada: datos.memoriaHabilitada,
    limiteTokensCtx: datos.limiteTokensCtx,
    canalesPermitidos: datos.canalesPermitidos ?? Prisma.JsonNull,
    herramientas: datos.herramientas ?? Prisma.JsonNull,
    configuracionTono: datos.configuracionTono ?? Prisma.JsonNull,

    nombreAgente: datos.nombreAgente ?? null,
    rol: datos.rol ?? null,
    idiomaPrincipal: datos.idiomaPrincipal ?? null,
    idiomasPermitidos: datos.idiomasPermitidos ?? Prisma.JsonNull,
    longitudRespuesta: datos.longitudRespuesta ?? null,
    proactividad: datos.proactividad ?? null,
    intensidadComercial: datos.intensidadComercial ?? null,
    estiloRecomendacion: datos.estiloRecomendacion ?? null,
    frasesPreferidas: datos.frasesPreferidas ?? Prisma.JsonNull,
    frasesProhibidas: datos.frasesProhibidas ?? Prisma.JsonNull,
    comportamientosProhibidos: datos.comportamientosProhibidos ?? Prisma.JsonNull,
    reglasPersonalizadas: datos.reglasPersonalizadas ?? Prisma.JsonNull,
    condicionesTransferenciaHumano: datos.condicionesTransferenciaHumano ?? Prisma.JsonNull,

    // 028-respuestas-guia-catalogo-ia — una versión anterior a 028 no trae
    // estos campos: se restaura sin respuestas guía y con el catálogo activo.
    respuestasGuia: datos.respuestasGuia ?? Prisma.JsonNull,
    catalogoEnContexto: datos.catalogoEnContexto ?? true,
    esperarAntesDeResponder: datos.esperarAntesDeResponder ?? false,
    segundosEsperaRespuesta: datos.segundosEsperaRespuesta ?? null,
    limiteCatalogoContexto: datos.limiteCatalogoContexto ?? 30,
  };
}
