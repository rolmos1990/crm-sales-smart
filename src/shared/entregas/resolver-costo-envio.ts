import { generarSlug } from "@/shared/lib/slug";

// 019-cobertura-geografica-envios — motor único de resolución de costo/
// cobertura de envío, compartido entre las tools de IA (calcular_costo_envio,
// validar_cobertura, estimar_fecha_entrega) y la UI humana (cotización/
// pedido). Combina dos fuentes independientes:
//   - Transportista: cobertura por zonas de entrega + tarifas (022-transportistas-zonas-tarifas)
//   - Delivery propio: zonas aproximadas de texto libre + modo de cobertura
//     (Historia 2)
// y decide si hay una única coincidencia clara o si debe escalar a humano
// (research.md Decisión 5 — criterio único, sin duplicar en cada tool).

export interface CandidatoCosto {
  fuente: "transportista" | "delivery";
  costo: number;
  diasMin?: number | null;
  diasMax?: number | null;
  /** MetodoEntrega (o TipoTransportista, mismo enum) del candidato — para exponer "qué método cubre" a validar_cobertura. */
  metodoEntrega?: string;
}

export type ResolucionCosto =
  | { estado: "CLARA"; cubierto: true; costo: number; diasMin: number | null; diasMax: number | null; metodosQueCubren: string[] }
  | { estado: "CLARA"; cubierto: false; motivo: string }
  | { estado: "SIN_COINCIDENCIA_CLARA"; motivo: string };

interface DecidirCoincidenciaParams {
  candidatosCubiertos: CandidatoCosto[];
  /**
   * Zona con una configuración explícita de "no cubierta" — ya sea marcada
   * como excepción (modo TODOS_LADOS_CON_EXCEPCIONES) o listada con
   * `cubierta: false` (modo SOLO_ZONAS_EVALUADAS). Es una respuesta
   * NEGATIVA CLARA, no ambigua: el negocio ya decidió explícitamente que
   * ahí no se entrega — distinto de una zona que simplemente no aparece en
   * ninguna configuración (ver hayZonaPendienteEvaluacion).
   */
  hayNegativaExplicita: boolean;
  /** Zona que NO aparece en ninguna configuración bajo modo SOLO_ZONAS_EVALUADAS — requiere evaluación humana, no es "no cubierto" (FR-006). */
  hayZonaPendienteEvaluacion: boolean;
  /** Si el país/estado (o la zona de texto libre) resolvió contra alguna configuración real. */
  ubicacionReconocida: boolean;
}

/**
 * Función pura — sin I/O. El caller (resolverCostoEnvio) le pasa datos ya
 * cargados, mismo patrón que decidirAutonomia en src/ai/autonomia/gate.ts.
 */
export function decidirCoincidenciaCosto(params: DecidirCoincidenciaParams): ResolucionCosto {
  const { candidatosCubiertos, hayNegativaExplicita, hayZonaPendienteEvaluacion, ubicacionReconocida } = params;

  // Caso 1 (research.md Decisión 5) — nada reconocible, sin ninguna
  // configuración aplicable.
  if (!ubicacionReconocida && candidatosCubiertos.length === 0 && !hayNegativaExplicita) {
    return { estado: "SIN_COINCIDENCIA_CLARA", motivo: "Ubicación no reconocida y sin configuración aplicable" };
  }

  // Caso 2 — modo SOLO_ZONAS_EVALUADAS, zona no listada: nunca es "no
  // cubierto", es "requiere evaluación".
  if (hayZonaPendienteEvaluacion && candidatosCubiertos.length === 0) {
    return { estado: "SIN_COINCIDENCIA_CLARA", motivo: "Zona pendiente de evaluación caso por caso" };
  }

  // Negativa explícita sin ningún otro candidato que sí cubra: respuesta
  // CLARA (no ambigua) — "no se entrega ahí".
  if (hayNegativaExplicita && candidatosCubiertos.length === 0) {
    return { estado: "CLARA", cubierto: false, motivo: "Zona configurada explícitamente como sin cobertura" };
  }

  if (candidatosCubiertos.length === 0) {
    return { estado: "SIN_COINCIDENCIA_CLARA", motivo: "Sin configuración de costo para esta ubicación" };
  }

  // Caso 3 — más de un costo distinto aplicable, sin criterio para elegir.
  // Candidatos con el mismo costo no son ambiguos: el número que
  // recibiría el cliente es el mismo sin importar cuál "gane".
  const costosUnicos = [...new Set(candidatosCubiertos.map((c) => c.costo))];
  if (costosUnicos.length > 1) {
    return { estado: "SIN_COINCIDENCIA_CLARA", motivo: "Más de un costo aplicable sin criterio para elegir" };
  }

  let diasMin: number | null = null;
  let diasMax: number | null = null;
  for (const c of candidatosCubiertos) {
    if (c.diasMin != null && (diasMin === null || c.diasMin < diasMin)) diasMin = c.diasMin;
    if (c.diasMax != null && (diasMax === null || c.diasMax > diasMax)) diasMax = c.diasMax;
  }

  const metodosQueCubren = [...new Set(candidatosCubiertos.map((c) => c.metodoEntrega).filter((m): m is string => !!m))];

  return { estado: "CLARA", cubierto: true, costo: costosUnicos[0], diasMin, diasMax, metodosQueCubren };
}

export interface ResolverCostoEnvioArgs {
  instanciaId: string;
  /** Nombre del estado/provincia (texto — el usado en la conversación o el formulario). */
  estadoProvincia: string;
  /** Nombre del país. Opcional si la instancia opera en modo UN_SOLO_PAIS. */
  pais?: string | null;
  /** Refinamiento opcional; también se usa como texto de match para zonas aproximadas de delivery. */
  ciudad?: string | null;
  metodoEntrega?: string | null;
  transportistaId?: string | null;
}

// 022-transportistas-zonas-tarifas — un candidato de envío resuelto contra
// el catálogo de zonas (transportista + zona + servicio + tarifa), sin
// colapsar a un veredicto único (research.md Decisión 4). Consumido
// directamente por la UI humana (Historia 2) y por la tool de opciones de
// envío para IA (Historia 7) — nunca por las tools de IA de spec 019, que
// siguen pasando por decidirCoincidenciaCosto.
export interface CandidatoEnvioZona {
  tarifaId: string;
  transportistaId: string;
  transportistaNombre: string;
  transportistaTipo: string;
  zonaEntregaId: string;
  zonaEntregaNombre: string;
  servicioTransportistaId: string;
  servicioNombre: string;
  costoInterno: number;
  precioCliente: number;
  tiempoMinimoDias: number | null;
  tiempoMaximoDias: number | null;
}

export interface DestinoEnvioZona {
  instanciaId: string;
  /** Nombre del país (texto). Opcional si la instancia opera en modo UN_SOLO_PAIS. */
  pais?: string | null;
  estadoProvincia?: string | null;
  distritoCiudad?: string | null;
  corregimiento?: string | null;
  sectorOCodigoPostal?: string | null;
  /** Restringe la búsqueda a un transportista puntual. */
  transportistaId?: string | null;
}

/**
 * Resuelve un destino contra el catálogo de ZonaEntrega/ZonaEntregaUbicacion
 * y devuelve TODAS las tarifas candidatas (activas y vigentes), sin
 * colapsar a un único veredicto (research.md Decisión 3/4). Un nivel vacío
 * en la ubicación es comodín; un nivel definido en la ubicación que el
 * destino no aporta NO coincide (no se adivina). Pueden coincidir varias
 * zonas a la vez — se agregan los candidatos de todas.
 */
export async function obtenerCandidatosEnvioPorZona(destino: DestinoEnvioZona): Promise<CandidatoEnvioZona[]> {
  const { prisma } = await import("@/shared/db/prisma");

  let paisId: string | null = null;
  if (destino.pais) {
    const paisTexto = generarSlug(destino.pais);
    const paises = await prisma.pais.findMany({ select: { id: true, nombre: true } });
    paisId = paises.find((p) => generarSlug(p.nombre) === paisTexto)?.id ?? null;
  } else {
    const config = await prisma.configuracionEmpresa.findUnique({
      where: { instanciaId: destino.instanciaId },
      select: { modoGeografico: true, paisOperacionId: true },
    });
    if (config?.modoGeografico === "UN_SOLO_PAIS") paisId = config.paisOperacionId;
  }
  if (!paisId) return [];

  const ubicaciones = await prisma.zonaEntregaUbicacion.findMany({
    where: { paisId, zonaEntrega: { instanciaId: destino.instanciaId, activa: true } },
    select: {
      zonaEntregaId: true,
      provinciaEstado: true,
      distritoCiudad: true,
      corregimiento: true,
      sectorOCodigoPostal: true,
    },
  });

  // Comparación por slug (sin tildes/mayúsculas) — mismo criterio que el
  // match de país. Un nivel vacío en la ubicación es comodín; un nivel
  // definido que el destino no aporta NO coincide.
  const coincideNivel = (valorUbicacion: string | null, valorDestino: string | null | undefined): boolean => {
    if (!valorUbicacion) return true;
    if (!valorDestino) return false;
    return generarSlug(valorUbicacion) === generarSlug(valorDestino);
  };

  const zonaIds = new Set<string>();
  for (const u of ubicaciones) {
    if (
      coincideNivel(u.provinciaEstado, destino.estadoProvincia) &&
      coincideNivel(u.distritoCiudad, destino.distritoCiudad) &&
      coincideNivel(u.corregimiento, destino.corregimiento) &&
      coincideNivel(u.sectorOCodigoPostal, destino.sectorOCodigoPostal)
    ) {
      zonaIds.add(u.zonaEntregaId);
    }
  }
  if (zonaIds.size === 0) return [];

  const ahora = new Date();
  const tarifas = await prisma.tarifaTransportistaZona.findMany({
    where: {
      zonaEntregaId: { in: [...zonaIds] },
      activa: true,
      instanciaId: destino.instanciaId,
      transportista: {
        activo: true,
        ...(destino.transportistaId ? { id: destino.transportistaId } : {}),
      },
      OR: [{ vigenteDesde: null }, { vigenteDesde: { lte: ahora } }],
    },
    include: {
      transportista: { select: { id: true, nombre: true, tipo: true } },
      zonaEntrega: { select: { nombre: true } },
      servicioTransportista: { select: { nombre: true } },
    },
  });

  return tarifas
    .filter((t) => !t.vigenteHasta || t.vigenteHasta >= ahora)
    .map((t) => ({
      tarifaId: t.id,
      transportistaId: t.transportistaId,
      transportistaNombre: t.transportista.nombre,
      transportistaTipo: t.transportista.tipo,
      zonaEntregaId: t.zonaEntregaId,
      zonaEntregaNombre: t.zonaEntrega.nombre,
      servicioTransportistaId: t.servicioTransportistaId,
      servicioNombre: t.servicioTransportista.nombre,
      costoInterno: Number(t.costoInterno),
      precioCliente: Number(t.precioCliente),
      tiempoMinimoDias: t.tiempoMinimoDias,
      tiempoMaximoDias: t.tiempoMaximoDias,
    }));
}

/**
 * Orquestación con I/O: resuelve país/zona/delivery y delega la decisión
 * final a decidirCoincidenciaCosto — usada por las tools de IA de spec 019
 * (calcular_costo_envio, validar_cobertura, estimar_fecha_entrega), que
 * nunca deben recibir más de un precio ambiguo (research.md Decisión 4).
 */
export async function resolverCostoEnvio(args: ResolverCostoEnvioArgs): Promise<ResolucionCosto> {
  const { prisma } = await import("@/shared/db/prisma");

  const candidatos: CandidatoCosto[] = [];
  let ubicacionReconocida = false;
  let hayNegativaExplicita = false;
  let hayZonaPendienteEvaluacion = false;

  // --- Fuente 1: Transportista (zonas de entrega + tarifas, 022) ---
  const candidatosZona = await obtenerCandidatosEnvioPorZona({
    instanciaId: args.instanciaId,
    pais: args.pais,
    estadoProvincia: args.estadoProvincia,
    distritoCiudad: args.ciudad,
    transportistaId: args.transportistaId,
  });
  if (candidatosZona.length > 0) {
    ubicacionReconocida = true;
    // El tipo de transportista usa el mismo enum que MetodoEntrega (ver
    // comentario histórico en form-entrega.tsx) — sirve como "método" para
    // el resultado de validar_cobertura.
    for (const c of candidatosZona) {
      candidatos.push({ fuente: "transportista", costo: c.precioCliente, metodoEntrega: c.transportistaTipo });
    }
  }

  // --- Fuente 2: Delivery propio (zona aproximada de texto libre) ---
  // La ciudad, cuando existe, es el texto más específico para matchear una
  // zona aproximada; si no hay ciudad, se usa el nombre de estado/provincia.
  const textoZona = generarSlug(args.ciudad ?? args.estadoProvincia);
  const metodos = await prisma.metodoEntregaConfig.findMany({
    where: {
      instanciaId: args.instanciaId,
      activo: true,
      ...(args.metodoEntrega
        ? { metodoEntrega: args.metodoEntrega as never }
        : { metodoEntrega: { not: "COURIER_EXTERNO" } }),
    },
    include: { zonas: { include: { zonaCobertura: true } } },
  });

  for (const metodo of metodos) {
    const zonaMatch = metodo.zonas.find((z) => generarSlug(z.zonaCobertura.nombre) === textoZona);

    if (metodo.modoCobertura === "SOLO_ZONAS_EVALUADAS") {
      if (zonaMatch?.cubierta) {
        ubicacionReconocida = true;
        candidatos.push({
          fuente: "delivery",
          costo: Number(metodo.costoBase) + Number(zonaMatch.costoAdicional),
          diasMin: metodo.diasEstimadosMin,
          diasMax: metodo.diasEstimadosMax,
          metodoEntrega: metodo.metodoEntrega,
        });
      } else if (zonaMatch && !zonaMatch.cubierta) {
        // Listada explícitamente como NO cubierta (a diferencia de una zona
        // que simplemente no aparece en la tabla) — negativa clara, no
        // ambigua. Preserva el comportamiento de negocios que ya tenían
        // zonas con `cubierta: false` configuradas antes de esta feature
        // (no deben pasar a escalar por el nuevo default SOLO_ZONAS_EVALUADAS).
        ubicacionReconocida = true;
        hayNegativaExplicita = true;
      } else {
        // No aparece en absoluto en la configuración de este método.
        hayZonaPendienteEvaluacion = true;
      }
      continue;
    }

    // TODOS_LADOS_CON_EXCEPCIONES
    if (zonaMatch?.esExcepcion) {
      ubicacionReconocida = true;
      hayNegativaExplicita = true;
      continue;
    }

    ubicacionReconocida = true;
    candidatos.push({
      fuente: "delivery",
      costo: Number(metodo.costoBase) + Number(zonaMatch?.costoAdicional ?? 0),
      diasMin: metodo.diasEstimadosMin,
      diasMax: metodo.diasEstimadosMax,
      metodoEntrega: metodo.metodoEntrega,
    });
  }

  return decidirCoincidenciaCosto({
    candidatosCubiertos: candidatos,
    hayNegativaExplicita,
    hayZonaPendienteEvaluacion,
    ubicacionReconocida,
  });
}
