# Implementation Plan: Memoria conversacional configurable y ficha de conversación

**Branch**: `031-memoria-y-ficha-conversacion` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-memoria-y-ficha-conversacion/spec.md`

## Summary

El nodo **Atención IA** de los Workflows gana dos capacidades configurables
desde su propio panel: cuánta conversación lee el agente antes de responder, y
si lleva registro de lo que ya mostró y dejó preguntado.

El enfoque técnico se apoya en tres cosas que ya existen y no se tocan:

1. **La canalización de contexto ya lee mensajes previos** — solo que la
   cantidad la decide un presupuesto de tokens invisible. Se le agrega una
   perilla explícita que convive con ese cálculo; cuando la perilla está
   ausente, el cálculo manda igual que hoy.
2. **La arquitectura de capas de la spec 013 ya reservó el lugar** — la capa 6
   ("Estado actual de la conversación") nunca tuvo productor y la capa 7
   ("Datos conocidos y faltantes") es un placeholder que devuelve `null`. La
   propuesta del negocio encaja ahí sin mover el orden de precedencia.
3. **La spec 012 ya resolvió el patrón** — hechos objetivos separados de lectura
   interpretada, la interpretada etiquetada como no confirmada y nunca borrada
   ante un fallo. Se replica para una entidad nueva de alcance distinto
   (conversación, no contacto).

Entrega en tres cortes independientes: **P1** sin migración ni costo de IA,
**P2** con una tabla nueva y costo de IA cero, **P3** con una derivación por
turno que corre después del envío.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router), Prisma 7, Zod v4,
React Hook Form, shadcn/ui sobre Base UI, Vitest 4

**Storage**: PostgreSQL vía Prisma. Una tabla nueva (`FichaConversacionIA`) en
P2; P1 no toca la base — su configuración viaja en el JSON de la definición del
Workflow.

**Testing**: Vitest (unitario), Playwright (E2E). Esta feature es toda unitaria;
no agrega journeys E2E nuevos.

**Target Platform**: Servidor Linux — app Next.js y worker de RabbitMQ
(`src/worker/disparadores.ts`). El motor de Workflows corre en el worker, así
que todo el código de esta feature tiene que funcionar fuera del request de
Next.

**Project Type**: Aplicación web con lógica de dominio por capacidad de negocio
(VSA), módulos bajo `src/`.

**Performance Goals**: Latencia percibida por el cliente **sin cambio** (SC-003).
Toda escritura y derivación ocurre después de que el mensaje salió. La
derivación interpretada tiene un timeout de 10 s que la acota en el worker.

**Constraints**:

- `limiteTokensCtx` del agente (4000 por omisión) sigue siendo el techo. La
  reserva de tokens pasa a descontar el tamaño de la ficha para que activarla no
  recorte mensajes en silencio (FR-007).
- Retrocompatibilidad byte a byte del `systemPrompt` cuando no hay configuración
  nueva (SC-001) — es el requisito más restrictivo del plan y condiciona la
  forma de los esquemas (research D4) y el orden de las capas (research D13).
- Un fallo de la ficha nunca puede afectar un mensaje ya enviado (FR-014).

**Scale/Scope**: ~12 archivos tocados, 4 archivos nuevos de dominio + 4 de test,
1 migración aditiva. Una fila de ficha por conversación activa.

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado después de Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Arquitectura modular por capacidad** | Módulo nuevo `src/ai/ficha-conversacion/` con la misma forma que `src/ai/perfil-cliente/` (`tipos` / `servicio` / `queries` / derivación). Las capas viven donde ya viven las demás (`src/ai/contexto/capas/`). Ningún componente React toca Prisma: el formulario del nodo solo edita JSON de configuración. Se **extiende** el punto de extensión que la 013 dejó, en vez de crear una abstracción paralela | ✅ |
| **II. Reglas de negocio en el servidor** | La configuración del nodo se valida con Zod en `ConfigAtencionIASchema` y la publicación la aplica `validador.ts`. El rango 1–30 se impone en el servidor; el formulario es solo UX (FR-008) | ✅ |
| **III. Datos y eventos confiables** | La ficha es un efecto secundario que corre **después** de que la operación primaria (enviar el mensaje) tuvo éxito, envuelto en `try/catch` — exactamente el orden que pide el principio. No se agregan eventos de dominio ni consumidores nuevos: la justificación y la salida futura por RabbitMQ están en research D10. La escritura es un `upsert` por `conversacionId`, idempotente por construcción | ✅ |
| **IV. Integraciones reemplazables** | La derivación interpretada usa `generarRespuesta` del gateway de IA, nunca un SDK. Sale por `TareaIA.EXTRACCION_ENTIDADES`, así que el enrutamiento por objetivo de la spec 010 puede mandarla a un modelo económico sin tocar este código. La salida del modelo **no** evita ninguna regla determinista: se valida contra el enum y ante cualquier fallo degrada a conservar lo anterior | ✅ |
| **V. Seguridad y calidad (NO NEGOCIABLE)** | Toda query de ficha lleva `instanciaId` (FR-033). No hay secretos ni datos personales nuevos en logs — la ficha guarda referencias y montos, y el resumen se trunca. Tests proporcionales al riesgo: unitarios de regla de negocio, test de regresión byte a byte para el riesgo principal, e inyección de fallo para FR-014 (research D16) | ✅ |

**Restricciones técnicas**: la migración es aditiva (una tabla nueva, sin
cambios destructivos ni backfill — la ausencia de fila es un estado válido).
Fechas en UTC, en ISO, formateadas a la zona de negocio recién al armar el texto
de la capa (`CLAUDE.md` regla 7). Sin dependencias nuevas.

**Resultado**: sin violaciones, antes y después del diseño. La sección
Complexity Tracking queda vacía a propósito.

### Riesgo de desviación a vigilar en implementación

El único lugar donde es fácil romper la constitución sin darse cuenta es
**FR-034 / principio III**: `responderConAgente` lo comparten el nodo de
Workflow y el suscriptor de mensajes entrantes. Si la lógica de ficha se
engancha sin mirar el parámetro `ficha`, se activa para todo el mundo. El test
de `responder-con-agente.test.ts` tiene que cubrir explícitamente "llamada sin
`ficha` ⇒ no se escribe nada, no se consulta nada".

## Project Structure

### Documentation (this feature)

```text
specs/031-memoria-y-ficha-conversacion/
├── plan.md              # Este archivo
├── spec.md              # Qué y por qué
├── research.md          # 16 decisiones técnicas con su alternativa descartada
├── data-model.md        # Configuración del nodo, tabla nueva, shapes JSON
├── quickstart.md        # Guía de validación por historia
├── checklists/
│   └── requirements.md  # 16/16 aprobado
├── contracts/
│   ├── config-nodo-atencion-ia.md   # UI + esquema + propagación al motor
│   └── capas-contexto.md            # Texto exacto de las capas 6 y 7
└── tasks.md             # Lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── workflows/                                  # P1 — la perilla
│   ├── definicion/
│   │   ├── schema.ts                           # [M] ConfigAtencionIASchema += memoria, ficha
│   │   └── validador.test.ts                   # [M] rango 1–30 bloquea publicación
│   ├── components/editor/
│   │   ├── formularios-nodo.tsx                # [M] FormAtencionIA: dos switches + cantidad
│   │   └── resumen-nodo.ts                     # [M] chip "recuerda N" / "con ficha"
│   └── motor/
│       ├── tipos.ts                            # [M] ParamsRespuestaIA pasa memoria y ficha
│       └── nodos.ts                            # [M] responderIA() propaga la config
│
├── ai/
│   ├── respuesta/
│   │   ├── responder-con-agente.ts             # [M] propaga config; captura resultados de
│   │   │                                       #     herramientas; escribe la ficha post-envío
│   │   └── responder-con-agente.test.ts        # [M] FR-014 + FR-034
│   ├── contexto/
│   │   ├── constructor.ts                      # [M] honra memoria y maxMensajes; filtra antes
│   │   │                                       #     de cortar; reordena para el presupuesto
│   │   ├── router.ts                           # [M] override explícito + tokensReservadosExtra
│   │   ├── router.test.ts                      # [N]
│   │   ├── context-builder.ts                  # [M] capa 6 + fichaOverride; orden 6→7→8→9
│   │   └── capas/
│   │       ├── estado-conversacion.ts          # [N] capa 6 — hechos
│   │       ├── estado-conversacion.test.ts     # [N]
│   │       └── placeholders.ts                 # [M] capa 7 deja de ser placeholder
│   ├── ficha-conversacion/                     # [N] módulo nuevo (forma de perfil-cliente/)
│   │   ├── tipos.ts                            # HechosConversacion, LecturaConversacion
│   │   ├── hechos.ts                           # derivación determinista (D6, D7, D8)
│   │   ├── hechos.test.ts
│   │   ├── extraccion.ts                       # derivación interpretada (P3)
│   │   ├── extraccion.test.ts
│   │   ├── servicio.ts                         # registrar() / obtener(), upsert idempotente
│   │   └── queries.ts
│   ├── simulador/servicio.ts                   # [M] ficha simulada (FR-032)
│   └── prompt/builder.test.ts                  # [M] fixture byte a byte (SC-001)
│
├── conversaciones/actions-ia.ts                # [M] el maxMensajes: 15 empieza a cumplirse
│                                               #     ⚠ única excepción a FR-034 — research D3
└── shared/db/prisma                            # sin cambios

prisma/
├── schema.prisma                               # [M] model FichaConversacionIA + relaciones
└── migrations/<ts>_ficha_conversacion_ia/      # [N] aditiva, sin backfill

docs/
└── AGENTE-IA-EVOLUCION-ANALISIS.md             # [M] nota de cierre: capas 6 y 7 ya no son
                                                #     placeholders (estilo de la §12 de la 028)
```

`[N]` nuevo · `[M]` modificado

**Structure Decision**: se respeta la organización por capacidad de negocio que
ya tiene el repo. La perilla del nodo vive entera en `src/workflows/` (schema →
formulario → motor), la inteligencia vive entera en `src/ai/`, y el único punto
de contacto entre las dos es `ParamsRespuestaIA` — que ya era la frontera
establecida entre el motor de Workflows y la canalización de respuesta.

El módulo `src/ai/ficha-conversacion/` copia deliberadamente la forma de
`src/ai/perfil-cliente/`: quien ya leyó uno entiende el otro sin esfuerzo, y la
simetría deja a la vista que son dos cosas distintas con alcances distintos.

## Orden de implementación

| Corte | Qué entrega | Migración | Costo IA | Se puede soltar solo |
|---|---|---|---|---|
| **P1** | La perilla de memoria funciona de punta a punta | No | Cero | Sí — ya resuelve el síntoma reportado |
| **P2** | El agente deja de contradecir precios y de olvidar lo que preguntó | Sí (aditiva) | Cero | Sí |
| **P3** | El agente entiende tema y fase de la conversación | No (usa la columna de P2) | 1 derivación por turno, post-envío | Sí |

P1 no depende de P2. P3 necesita la tabla de P2. Dentro de cada corte, el test
de regresión de SC-001 se corre **primero**: si no está en verde, el corte no
avanza.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
