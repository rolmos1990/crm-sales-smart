# Implementation Plan: Análisis inteligente de Contactos

**Branch**: `feature/042-contactos-analisis-ia` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-contactos-analisis-ia/spec.md`

## Summary

Se completa la sección "Análisis de IA" que la 041 dejó reservada, con un motor
que mantiene un perfil comercial por contacto. Todas las cuentas tienen reglas,
que no cuestan nada; la IA entra solo para interpretar conversaciones nuevas.

El enfoque reutiliza lo que ya existe en lugar de crear un sistema paralelo:

| Pieza nueva | Se apoya en |
|---|---|
| Cola durable en PostgreSQL | Patrón de `DisparadorJob`: lease y `SKIP LOCKED` |
| Planificador justo (stride scheduling) | Una columna por cuenta |
| Reglas | Las condiciones de 038/041 |
| Contexto compacto | Fichas de conversación (031) |
| Llamadas a la IA | Gateway y proveedores por cuenta (009/010/021), con la tarea nueva `ANALISIS_CONTACTOS` |
| Escritura del interés | Punto único de escritura de la 041 |
| Auditoría | Una fila por intento, enlazada con `UsoIA` |

El motor corre en un ciclo propio dentro del worker existente. El perfil del
cliente (012) deja de llamar a la IA por evento y recibe la interpretación del
motor con la misma forma.

## Technical Context

**Language/Version**: TypeScript 5 (estricto), Node 20+

**Primary Dependencies**: Next.js 16 App Router, Prisma 7, Zod v4, React Hook
Form, TanStack Query v5, shadcn/ui (`@base-ui` Select), amqplib (RabbitMQ). **Sin
dependencias nuevas**: el filtro de privacidad y el planificador se escriben a
mano.

**Storage**: PostgreSQL. 8 tablas nuevas, 2 columnas nuevas y valores de enum
nuevos, todo aditivo. Índices parciales en SQL de la migración.

**Testing**: Vitest (unitarias puras y servicios con `vi.mock` de Prisma y del
gateway), simulador de carga en `scripts/` contra una base de desarrollo, y
Playwright para los recorridos de interfaz.

**Target Platform**: servidor Linux con la app Next.js y el worker
(`npm run worker`), que pueden ser varias réplicas.

**Project Type**: aplicación web monolítica (Next.js) más un proceso worker.

**Performance Goals**:

| Objetivo | Criterio |
|---|---|
| "Analizar con IA" en menos de 60 s (p95) | SC-006 |
| Cambios incrementales (P1) en menos de 15 min (p95) | SC-009 |
| Ordenar por puntaje en menos de 1 s con 20.000 contactos | SC-017 |
| Ciclo del planificador en menos de 50 ms con 1.000 cuentas | Objetivo interno |

**Constraints**:
- Servidores económicos: concurrencia de 3 lotes por worker por defecto y
  ningún contacto completo en memoria (lotes de 20 y cursores de 1.000).
- Nada de N+1: unas 6 consultas por lote (research D6).
- No alterar 038, 041, 011/012 ni el bloqueo por "No contactar" (FR-055).

**Scale/Scope**: más de 1.000 cuentas, más de 10.000 contactos por cuenta y
millones de filas de cola, una por contacto. Unos 125.000 lotes al mes en
régimen.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| **I. Arquitectura modular** | El dominio va en `src/crm/contactos/analisis/` y la parte de IA en `src/ai/analisis-contactos/`. La UI no toca Prisma ni el SDK del proveedor. Se extienden los módulos existentes (gateway, `interaccion.ts`, `InvalidarPerfilSuscriptor`, `vista.ts`, `tab-ia.tsx`) en lugar de duplicarlos | ✅ |
| **II. Reglas en el servidor** | Cada acción valida con Zod y `requirePermisoAction`. La salida de la IA se valida con Zod y con el filtro de privacidad. El interés y "No contactar" cambian solo por `clasificacion.ts` | ✅ |
| **III. Datos y eventos confiables** | Transacción en la escritura de la evaluación. Efectos posteriores (interés automático, `ContactoAnalizado`) después del commit. Idempotencia por versión monótona. Recuperación por lease. Ver la nota abajo sobre RabbitMQ | ✅ (justificado) |
| **IV. Integraciones reemplazables** | Todo pasa por el gateway e `IProveedorIA`; el motor no conoce SDKs. Hay timeouts, reintentos acotados con backoff y degradación a solo reglas. La IA no salta reglas: Cliente, Responder y No contactar las deciden las reglas | ✅ |
| **V. Seguridad y calidad** | `instanciaId` en toda consulta y en los lotes; referencias del lote en lugar de ids; sin claves, prompts ni conversaciones en los logs; pruebas proporcionales al riesgo (research D17) | ✅ |
| **Restricciones técnicas** | Migración versionada y aditiva; fechas en UTC con el día del negocio de `obtenerZonaNegocio`; sin dependencias nuevas | ✅ |

**Nota sobre el principio III**: la planificación usa la base de datos como
cola en lugar de RabbitMQ. El principio pide RabbitMQ "where appropriate", y
aquí no lo es: no da justicia entre cuentas, no deduplica por contacto y no
tiene backoff (research D1). Hay precedente aprobado en `DisparadorJob`. Los
eventos de dominio de entrada y salida siguen pasando por RabbitMQ.

**Re-check post-diseño**: sin violaciones nuevas. `Complexity Tracking` no
aplica.

## Project Structure

### Documentation (this feature)

```text
specs/042-contactos-analisis-ia/
├── plan.md              # Este archivo
├── research.md          # Decisiones D1–D17
├── data-model.md        # Tablas, enums y estados
├── quickstart.md        # Validación de punta a punta
├── contracts/
│   ├── ia-analisis-lote.md   # Prompt en 3 capas, salida JSON y validación
│   ├── criterio.md           # Contenido del criterio y plantillas por rubro
│   ├── server-actions.md     # Acciones, consultas y cambios en vista.ts
│   └── eventos.md            # ContactoAnalizado y suscripciones
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                              # + modelos y enums de data-model.md
└── migrations/<ts>_042_contactos_analisis_ia/ # aditiva + índices parciales en SQL

src/crm/contactos/analisis/                    # NUEVO: dominio del motor
├── actions.ts            # analizar contacto, seleccionados y segmento; resolver sugerencias
├── queries.ts            # obtenerAnalisisContacto, obtenerAvanceAnalisis
├── schema.ts · types.ts
├── cola.ts               # marcarPendiente, reclamarLote, completar, reintentar (SQL con SKIP LOCKED)
├── reglas.ts             # puro: relación comercial, señales objetivas, próxima evaluación
├── puntaje.ts            # puro: base 0–60 + ajuste ±40
├── datos-lote.ts         # carga en bloque (groupBy) de un lote
├── criterio/             # plantillas.ts, schema.ts, queries.ts, actions.ts
├── configuracion/        # schema.ts, queries.ts, actions.ts
├── motor/
│   ├── planificador.ts   # puro: elegirTurnos (stride + cupos + préstamo)
│   ├── ciclo.ts          # iniciarCicloAnalisisContactos (worker)
│   ├── ejecutor.ts       # procesa un lote: reglas → IA → validación → escritura
│   ├── recuperacion.ts   # leases vencidos y atenciones abandonadas
│   ├── presupuesto.ts    # presupuesto propio, límite de la cuenta, límites del proveedor, global
│   ├── reconciliacion.ts # barrido de eventos perdidos y vencimientos
│   ├── auditoria.ts      # alta y cierre de atenciones y detalle; sanitización
│   └── retencion.ts      # resumen diario y purga de detalle a 90 días
└── components/
    ├── seccion-analisis-ia.tsx   # dentro de panel-contacto.tsx
    ├── sugerencia-pendiente.tsx
    ├── boton-analizar.tsx
    └── celda-puntaje.tsx

src/ai/analisis-contactos/                     # NUEVO: parte de IA
├── prompt.ts             # 3 capas, PROMPT_SISTEMA_VERSION
├── contexto.ts           # contexto compacto por contacto (fichas o mensajes recortados)
├── salida.ts             # Zod de la salida + filtro de privacidad
└── evaluar-lote.ts       # llama a generarRespuesta(formato json) y mapea refs

# MODIFICADOS (cambios acotados)
src/ai/gateway/{gateway,schema,types}.ts       # formatoRespuesta, tokensCacheados, proveedorIAId/costo en la respuesta
src/ai/proveedores/{openai,deepseek,anthropic,types}.ts  # JSON mode + tokens cacheados
src/ai/auditoria/logger.ts                     # tokensCacheados
src/ai/perfil-cliente/servicio.ts              # fusión de datosInterpretados del motor (la extracción por evento se conserva)
src/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor.ts  # marcarPendiente + bifurcación P0/legado + filtro por instanciaId + CONTACTO_CREADO/ACTUALIZADO
src/ai/ficha-conversacion/servicio.ts          # registrarLectura → P0 ante LISTO_PARA_COMPRAR/COTIZAR
src/crm/contactos/interaccion.ts               # marcarPendiente en línea, sin fallar
src/crm/contactos/clasificacion.ts             # rama manual: sugerencia pendiente → REEMPLAZADA (misma transacción)
src/crm/contactos/vista.ts · resumen.ts · types.ts      # orden PUNTAJE y análisis en el resumen
src/crm/contactos/components/panel-contacto.tsx · lista (columna, casillas, barra de selección)
src/configuracion/components/tab-ia.tsx        # + sección "Análisis de contactos"
src/shared/rabbitmq/conexion.ts                # bindings CONTACTO_CREADO/ACTUALIZADO a la cola del perfil
src/eventos/catalogo.ts · contratos/contacto-analizado.event.ts · mapa.ts
src/worker/disparadores.ts                     # arranca el ciclo del motor

scripts/
├── 042-encolar-clasificacion-inicial.ts (+ .test.ts)   # npm run db:backfill:analisis-contactos
└── 042-simular-carga-analisis.ts

docs/analisis-contactos.md   # arquitectura, configuración, escalado, auditoría, recuperación
docs/eventos.md              # + ContactoAnalizado
CLAUDE.md                    # + regla 13 (resumen y puntero al doc)
```

**Structure Decision**: Monolito existente. El dominio vive junto a Contactos
(`src/crm/contactos/analisis/`), igual que `segmentacion/` de la 041, y lo
específico de IA va en `src/ai/`, como `perfil-cliente/` y
`ficha-conversacion/`. No hay servicio aparte: el motor es un ciclo más del
worker.

## Fases de implementación (orden sugerido para `/speckit-tasks`)

| Fase | Historias | Contenido | Se puede probar sin |
|---|---|---|---|
| **1. Base y reglas** | US1 | Migración; `cola.ts`; `reglas.ts`/`puntaje.ts`; `datos-lote.ts`; ejecutor solo con reglas; marcado en línea y por suscriptor; recuperación; columna `puntajeComercial`; sección del panel por reglas; script de clasificación inicial | IA |
| **2. Planificador y auditoría** | US4, US5 | `planificador.ts` + `ciclo.ts`; cupos P0/P1/P2; pausa del histórico; tablas de atención, detalle y resumen diario; reconciliación; retención; simulador de carga | IA real (se usa el ejecutor simulado) |
| **3. IA** | US2 | Extensiones del gateway y los proveedores; `TareaIA.ANALISIS_CONTACTOS`; prompt, contexto, salida y filtro de privacidad; división de lotes; presupuestos y límites; sugerencias y modo de interés; compatibilidad con 012 (bifurcación P0/legado); P0 por ficha; **interruptores mínimos (activar análisis, pausar histórico) en Configuración → IA** | — |
| **4. Criterio y configuración** | US3, US6 | Criterio con versiones y plantillas; sección en Configuración → IA; avance; reintentar fallidos | — |
| **5. Selección múltiple** | US7 | Casillas y barra en la tabla; analizar seleccionados o segmento | — |
| **6. Documentación** | — | `docs/analisis-contactos.md`, `docs/eventos.md`, regla 13 en CLAUDE.md | — |

## Riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Quitar la IA por evento de 012 deja datos viejos al agente (`gate.ts`, `estrategia-activa.ts`, `ejemplos-piloto.ts`), o lo deja sin ellos si se apaga el análisis | El motor escribe `datosInterpretados` con el mismo shape y la misma lista `INTENCIONES_COMERCIALES`, sin mapeo con pérdida. La extracción por evento **no se borra**: el suscriptor la usa cuando el análisis con IA está apagado o no disponible. Cuando está activo, `CONVERSACION_CLASIFICADA` marca P0 inmediato para no sumar retraso (research D3). Todo sale en la **misma** fase 3. Hay pruebas de esos lectores sin modificar |
| R2 | La clasificación inicial se activa sola y sin presupuesto propio, y puede consumir el límite diario que comparte con el agente | Desde el 80 % de `limiteTokensDiarios`, el histórico se pausa para esa cuenta; al 100 % se detiene el análisis. El avance muestra el consumo. La primera tanda solo manda a la IA contactos con actividad de los últimos 12 meses |
| R3 | Bucle de eventos: el motor escribe en `Contacto` → `CONTACTO_ACTUALIZADO` → lo vuelve a marcar | El motor nunca publica `CONTACTO_ACTUALIZADO`; `actualizarInteres` publica `CONTACTO_INTERES_ACTUALIZADO`, que no está suscripto. Hay una prueba del suscriptor que lo verifica |
| R4 | Contención en la cola durante la clasificación inicial | Índices parciales, lotes chicos y `SKIP LOCKED`. Cargar la cola desde el script en páginas de 1.000 |
| R5 | Fuga de datos personales en señales o motivos | Instrucción fija, filtro de privacidad que rechaza (no enmascara) y SC-018 con un set de prueba |
| R6 | Inyección de instrucciones desde conversaciones o desde el criterio | Delimitadores, referencias del lote, validación estricta y una prueba con textos hostiles en el lote |
| R7 | `limitePorMinuto`, `limitePorDia` y `limiteTokensDiarios` existen pero no se aplicaban: el agente conversacional sigue sin aplicarlos | Fuera de alcance por FR-055. Se documenta como deuda en `docs/analisis-contactos.md` |
| R8 | Circuit breaker en memoria por proceso | Aceptable con pocos workers; documentado |

## Complexity Tracking

No hay violaciones de la constitución que justificar.
