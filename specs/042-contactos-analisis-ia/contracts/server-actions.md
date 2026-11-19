# Contrato: Server Actions y consultas

Todas siguen la convención del proyecto:

1. `requirePermisoAction(modulo, nivel)` al inicio.
2. Validación Zod de la entrada antes de tocar Prisma.
3. `instanciaId` tomado **siempre de la sesión**, nunca de la entrada.
4. Respuesta `ResultadoAccion<T>` (`{ ok: true, datos } | { ok: false, error }`)
   sin detalles internos.
5. `revalidatePath` sobre la ruta afectada.

## Contactos: `src/crm/contactos/analisis/actions.ts`

| Acción | Permiso | Entrada (Zod) | Efecto |
|---|---|---|---|
| `analizarContactoAction` | `contactos` / `modificar` | `{ contactoId: cuid }` | `marcarPendiente(P0, inmediato, forzarIA, motivo MANUAL)`. Devuelve `{ encolado: true }`, o `{ ok:false }` si la IA no está disponible para la cuenta |
| `analizarSeleccionadosAction` | `contactos` / `modificar` | `{ contactoIds: cuid[] (1–100) }` | Marca P1 con `forzarIA`, solo los ids de la cuenta (los demás se ignoran en silencio). Devuelve `{ encolados: n }` |
| `analizarSegmentoAction` | `ia` / `modificar` | `{ segmento: Segmento, filtros?: FiltrosVistaContactos }` | Marca P2 con `forzarIA` y `motivo SEGMENTO`, por cursor y en páginas. Devuelve `{ encolados: n }` |
| `resolverSugerenciaInteresAction` | `contactos` / `modificar` | `{ contactoId, decision: "ACEPTAR" \| "DESCARTAR" }` | ACEPTAR → `actualizarInteres({origen: MANUAL, accion: FIJAR, nivel: interesSugerido})`. DESCARTAR → estado DESCARTADA |
| `resolverSugerenciaNoContactarAction` | `contactos` / `modificar` | `{ contactoId, decision }` | ACEPTAR → `actualizarPreferenciaContacto({noContactar: true, origen: MANUAL})` |

Las dos acciones de sugerencias responden `{ ok:false, codigo:"SIN_SUGERENCIA" }`
si la sugerencia ya no está PENDIENTE. Eso cubre el doble clic y dos usuarios
resolviendo a la vez.

## Consultas: `src/crm/contactos/analisis/queries.ts`

| Función | Uso | Devuelve |
|---|---|---|
| `obtenerAnalisisContacto(instanciaId, contactoId)` | Panel lateral (`resumen.ts` lo incluye en `ResumenContacto.analisis`) | `{ evaluacion \| null, estadoCola: "AL_DIA" \| "PENDIENTE" \| "EN_PROCESO" \| "FALLIDO", iaDisponible: boolean, interesFijado: boolean, accionVisible: AccionComercial }` |
| `obtenerAvanceAnalisis(instanciaId)` | Configuración → IA → Análisis de contactos | Ver más abajo |

`accionVisible` sale de la recomendación de la 041 si es `RESPONDER` o
`NO_CONTACTAR`; si no, de `accionSugerida` (FR-021).

```ts
AvanceAnalisis = {
  clasificacionInicial: { elegiblesIA: number, analizadosIA: number, porcentaje: number,
                          resueltosPorReglas: number, pausado: boolean },
  actualizacion: { pendientes: { p0: number, p1: number, p2: number },
                   esperaMediaSeg: number | null, ultimaAtencionEn: string | null },
  fallidos: number,
  hoy: { atenciones: number, lotesFallidos: number, duracionMediaMs: number | null,
         tokens: number, costoEstimado: number | null },
  limites: { presupuestoPropio: number | null, consumoLimiteCuentaPct: number | null,
             iaDisponible: boolean, motivoNoDisponible: string | null },
}
```

`elegiblesIA` cuenta los contactos con conversaciones e interacción dentro de
`mesesAntiguedadInicial` (FR-052, Clarifications Q2).

## Configuración: `src/crm/contactos/analisis/configuracion/actions.ts`

| Acción | Permiso | Entrada |
|---|---|---|
| `guardarConfiguracionAnalisisAction` | `ia` / `modificar` | `{ habilitado, modoInteres, mesesAntiguedadInicial, tamanoLote, maxLotesSimultaneos, presupuestoDiarioCosto?, presupuestoDiarioTokens?, ventanaAgrupacionSeg, esperaMaximaSeg, historicoPausado }`. `peso` **no** se acepta: lo ajusta Karia |
| `reintentarFallidosAction` | `ia` / `modificar` | `{}`. Los FALLIDO de la cuenta pasan a PENDIENTE con `intentos = 0`. Devuelve `{ reintentados: n }` |
| `guardarBorradorCriterioAction` | `ia` / `modificar` | `{ contenido: CriterioContenido }` |
| `crearBorradorDesdePlantillaAction` | `ia` / `modificar` | `{ plantilla: "GENERAL" \| "RETAIL" \| "SERVICIOS" \| "B2B" }` |
| `publicarCriterioAction` | `ia` / `modificar` | `{ versionId, reevaluar: boolean }` |

Cambiar `modoInteres` registra quién y cuándo (FR-050a) y **no** reescribe
intereses existentes.

## Tabla de Contactos (041), cambios aditivos en `vista.ts`

- `FiltrosVistaContactos.orden` acepta `"PUNTAJE"`. Orden
  `[{ puntajeComercial: { sort, nulls: "last" } }, ...ORDEN_RECIENTE]`.
- `SELECT_FILA` incluye `puntajeComercial`.
- Ningún otro filtro, indicador ni el orden por defecto (`PRIORIDAD`) cambia
  (FR-052a).
