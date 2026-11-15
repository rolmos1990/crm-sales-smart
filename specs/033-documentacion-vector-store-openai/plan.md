# Implementation Plan: Documentación del comercio consultable bajo demanda

**Branch**: `033-documentacion-vector-store-openai` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-documentacion-vector-store-openai/spec.md`

---

## Summary

Los documentos que el negocio sube para su agente dejan de resumirse con IA e inyectarse en cada prompt, y
pasan a **indexarse íntegros en un vector store de OpenAI**, consultables bajo demanda con el hosted tool
`file_search`. El agente decide cuándo consultarlos mediante una herramienta nueva (`buscar_en_documentacion`)
guiada por una política explícita en el contexto, y cada búsqueda se registra en `UsoIA` con los tokens reales
que devuelve el proveedor.

Hay **un vector store por instancia**, creado solo la primera vez que la cuenta sube un documento: el índice
de un comercio no contiene bytes de otro, así que el aislamiento entre cuentas es físico antes que lógico.
Dentro de la cuenta, cada documento pertenece a un agente, y esa separación sí es lógica: identidad
`instanciaId_agenteId_documentoId` en el nombre y los atributos, filtro obligatorio en cada búsqueda, y
verificación a posteriori de cada fragmento devuelto que descarta la respuesta entera ante cualquier
discrepancia. Esas cuatro capas se mantienen también como defensa en profundidad entre comercios, y es donde
se concentra el esfuerzo de diseño y de tests.

---

## Technical Context

**Language/Version**: TypeScript 5 · Node.js 20+

**Primary Dependencies**: Next.js 16 (App Router), Prisma 7, Zod v4, `openai@6.45.0` (ya instalado),
`unpdf` (ya instalado), TanStack Query v5, shadcn/ui. **Cero dependencias nuevas.**

**Storage**: PostgreSQL vía Prisma + storage de objetos de Karia (R2/S3/local vía
`src/lib/media/providers/factory.ts`) + vector store de OpenAI

**Testing**: Vitest (unitarios e integración) · Playwright (flujos críticos)

**Target Platform**: Servidor Linux (app Next.js + worker), desplegado en Coolify

**Project Type**: Aplicación web multi-tenant organizada por capacidad de negocio (VSA)

**Performance Goals**: Una búsqueda documental no debe agregar más de ~3 s al turno del agente. Degrada a
"no encontré" a los 15 s en vez de fallar.

**Constraints**:
- Tokens de `UsoIA` **reales del proveedor**, nunca estimados (FR-023)
- Cero cruce entre tenants, y separación correcta entre agentes de una cuenta (FR-011 a FR-015) — no negociable
- Ningún identificador de OpenAI puede llegar al navegador (FR-015)
- Cero regresión para agentes sin documentación (FR-032)

**Scale/Scope**: 20 documentos por agente, 25 MB por archivo. El techo de 10.000 archivos por vector store de
OpenAI aplica por cuenta, no a toda la plataforma: inalcanzable en la práctica.

---

## Constitution Check

*GATE: debe pasar antes de Phase 0 y re-evaluarse tras Phase 1.*

| Principio | Cómo lo cumple este diseño | Veredicto |
|---|---|---|
| **I — Arquitectura modular de negocio** | Módulo nuevo `src/ai/documentacion/`, dentro del bounded context de IA ya existente. Extiende `src/ai/tools/` y `src/ai/contexto/capas/` en vez de crear abstracciones paralelas. Los componentes React llaman Server Actions; nunca tocan Prisma ni el SDK de OpenAI | ✅ PASS |
| **II — Reglas de negocio en el servidor** | Formato, tamaño y límite de cantidad se validan en el server action, aunque el navegador ya haya filtrado (FR-003). El `instanciaId` sale siempre de `requireSesion()`, nunca de un parámetro. Validación con Zod en el boundary | ✅ PASS |
| **III — Datos y eventos confiables** | El borrado sigue un orden que nunca deja un documento listado pero inexistente. Cada paso del borrado en OpenAI tolera 404 (idempotente ante reintentos). No se introducen eventos de dominio nuevos: no hay efecto secundario asíncrono que lo justifique | ✅ PASS |
| **IV — Integraciones reemplazables** | `busqueda.ts` y `vector-store.ts` son los adaptadores: ningún tipo, payload ni código de error de `openai` cruza sus firmas (ver `contracts/interfaces.md`). Timeout acotado, degradación segura a "no encontré", y la salida de la IA no puede saltarse reglas deterministas — la documentación es material de consulta, no instrucciones | ✅ PASS |
| **V — Seguridad y calidad (NO NEGOCIABLE)** | Ver análisis dedicado abajo | ✅ PASS |

### Principio V en detalle — el punto crítico

> *"Every business query and mutation MUST be scoped to the authenticated tenant."*

En el resto de Karia esto se cumple con una cláusula `where` de Prisma, trivial de auditar. Acá una parte de
la consulta se ejecuta **del lado de OpenAI**, fuera de nuestro control.

La primera línea es estructural: **cada cuenta tiene su propio vector store**, así que una búsqueda no tiene
ningún índice ajeno al que llegar. Encima de eso, el diseño reconstruye la garantía con medios propios, en
cuatro capas que ningún llamador puede saltearse — defensa en profundidad entre comercios, y la única
separación entre agentes de una misma cuenta:

1. **Identidad en el archivo** — `instanciaId_agenteId_documentoId` en el `filename` y en los `attributes`.
2. **Filtro obligatorio** — `filtroTenant()` no tiene parámetros opcionales; `buscarEnDocumentacion()` no
   acepta `filters` del llamador. No existe la forma de llamarla sin filtrar.
3. **Verificación a posteriori** — todo fragmento devuelto se coteja contra el tenant esperado. Si uno solo no
   coincide, se descarta la respuesta **completa**, se registra alerta y se devuelve vacío. El texto ajeno
   nunca llega al cliente aunque el filtro del proveedor fallara.
4. **Fail-closed** — un fragmento sin atributos se trata como ajeno. La omisión no es una vía de acceso.

La creación del store es perezosa y **a prueba de carreras**: dos subidas simultáneas de la misma cuenta no
pueden dejar dos índices con la mitad de los documentos cada uno (UPDATE condicional; ver research.md D4).

Además, sobre los otros dos frentes del principio:

- **Secretos y datos personales**: `OPENAI_DOCUMENTACION_API_KEY` solo por entorno, nunca en el repositorio.
  Los logs de la alerta de verificación registran los ids de tenant, nunca el texto del fragmento ajeno.
- **Tests proporcionales al riesgo**: unitarios para `aislamiento.ts` (reglas de negocio), de integración con
  el cliente mockeado para `busqueda.ts` (adaptador y persistencia de `UsoIA`), y los escenarios 5 y 10 del
  quickstart como validación manual obligatoria.

### Technical Constraints

| Restricción | Cumplimiento |
|---|---|
| Stack aprobado | Sin tecnología fuera de la lista. **Cero dependencias nuevas** |
| Migraciones versionadas y seguras | Migración 100 % aditiva: `CREATE TYPE`, `ALTER TYPE ADD VALUE`, `CREATE TABLE`, `ADD COLUMN` nullable. No se borra la columna `documentosFaq` ni ninguna fila. Rollback = `DROP TABLE` + `DROP TYPE` + `DROP COLUMN` |
| UI responsiva y accesible | La lista es más simple que la actual (se quitan textarea y contadores). El input de archivo conserva su `<label>` y el botón eliminar su `aria-label`, como hoy |
| Representaciones explícitas | `creadoEn` en UTC, serializado ISO y renderizado con los helpers de `src/shared/fechas/` — nunca `toLocaleDateString()` (`docs/fechas-y-zonas-horarias.md`) |
| Dependencias nuevas justificadas | No aplica: ninguna |

### Re-evaluación post-Phase 1

Revisados `data-model.md`, `contracts/interfaces.md` y `quickstart.md` contra los cinco principios:
**sin violaciones nuevas**. La sección **Complexity Tracking** queda vacía a propósito.

Dos puntos que el diseño endureció respecto del borrador inicial:

- Los contratos del Principio IV se escribieron con **tipos propios** (`FragmentoDocumental`,
  `ResultadoBusquedaDocumental`) y no con los del SDK, lo que además hace testeable la verificación sin
  mockear OpenAI.
- El DTO `DocumentoAgenteVista` quedó como frontera explícita del Principio V: los campos sensibles no se
  "filtran al serializar", directamente no se seleccionan de la base.

---

## Project Structure

### Documentation (this feature)

```text
specs/033-documentacion-vector-store-openai/
├── spec.md                      # Qué y por qué (/speckit-specify)
├── plan.md                      # Este archivo (/speckit-plan)
├── research.md                  # 11 decisiones técnicas con alternativas
├── data-model.md                # DocumentoAgenteIA, TareaIA, migración
├── quickstart.md                # 10 escenarios de validación end-to-end
├── contracts/
│   └── interfaces.md            # Contratos internos (Principio IV)
├── checklists/
│   └── requirements.md          # Gate de calidad del spec
└── tasks.md                     # (/speckit-tasks — todavía no creado)
```

### Source Code (repository root)

```text
src/
├── ai/
│   ├── documentacion/                      # ── MÓDULO NUEVO ──
│   │   ├── tipos.ts                        # formatos, límites, mensajes, constantes de costo
│   │   ├── aislamiento.ts                  # ★ identidad, filtro y verificación de tenant
│   │   ├── cliente-openai.ts               # cliente y tarifas desde entorno (credencial de Karia)
│   │   ├── vector-store.ts                 # store por instancia (perezoso) + indexar / eliminar real
│   │   ├── busqueda.ts                     # ★ Responses API + file_search + registrarUsoIA
│   │   ├── queries.ts                      # listarDocumentosAgente (DTO) / contarDocumentosListos
│   │   └── extraccion.ts                   # movido desde conocimiento/ — solo validación de PDF
│   ├── tools/
│   │   ├── providers/buscar-en-documentacion.tool.ts   # NUEVO
│   │   ├── inicializar.ts                  # + import del tool nuevo
│   │   └── herramientas-agente.ts          # + tieneDocumentacion
│   ├── contexto/
│   │   ├── capas/conocimiento.ts           # REESCRITO: contenido → política de consulta
│   │   ├── capas/placeholders.ts           # nueva firma de la capa 8
│   │   ├── constructor.ts                  # deja de leer documentosFaq
│   │   └── context-builder.ts              # ídem
│   ├── respuesta/responder-con-agente.ts   # pasa tieneDocumentacion
│   ├── simulador/servicio.ts               # ídem (mismo camino que la respuesta real)
│   └── auditoria/logger.ts                 # proveedorIAId pasa a opcional
├── configuracion/
│   ├── ia/
│   │   ├── documentacion/actions.ts        # NUEVO — reemplaza conocimiento/actions.ts
│   │   ├── conocimiento/                   # ── SE ELIMINA (destilado, tipos, actions) ──
│   │   ├── agente-schema.ts                # − documentosFaq
│   │   ├── payload-agente.ts               # − documentosFaq
│   │   └── agente-actions.ts               # − documentosFaq del select
│   └── components/
│       ├── editor-documentos-agente.tsx    # NUEVO — lista solo-nombre
│       ├── editor-documentos-faq.tsx       # ── SE ELIMINA ──
│       └── sheet-editar-agente.tsx         # sección renombrada, fuera del formulario
├── scripts/
│   └── conciliar-documentos-huerfanos.ts   # NUEVO (P3)
└── prisma/
    ├── schema.prisma                       # DocumentoAgenteIA, EstadoDocumentoAgenteIA, TareaIA
    └── migrations/<ts>_documentacion_vector_store/
```

**Structure Decision**: Se sigue la organización por capacidad de negocio que ya usa el repositorio (VSA).
El módulo nuevo va en `src/ai/documentacion/` y no en `src/configuracion/` porque lo consumen **los dos
lados**: la configuración lo usa para cargar y borrar, y el runtime del agente para buscar — exactamente la
misma razón por la que `src/ai/tools/` vive donde vive. La capa de presentación de configuración se queda en
`src/configuracion/`, llamando a Server Actions que a su vez usan el módulo. Ningún componente React importa
Prisma ni el SDK de OpenAI (Principio I).

---

## Fases de implementación

Corresponden a las tres historias del spec. Cada una es desplegable por sí sola.

### Fase 1 (US1, P1) — Cargar y borrar documentación, con aislamiento garantizado

Prisma (`DocumentoAgenteIA`, `EstadoDocumentoAgenteIA`, `TareaIA.BUSQUEDA_DOCUMENTAL`, `Instancia.vectorStoreDocumentacionId`) + migración ·
`src/ai/documentacion/{tipos,aislamiento,cliente-openai,vector-store,queries,extraccion}.ts` ·
`src/configuracion/ia/documentacion/actions.ts` · `editor-documentos-agente.tsx` · salida de `documentosFaq`
del formulario del agente · tests de `aislamiento.ts` y de las actions.

**Checkpoint**: escenarios 1, 2, 3, 5 y 7 del quickstart pasan. El agente todavía no consulta nada.

### Fase 2 (US2, P2) — Búsqueda del agente y contabilización

`busqueda.ts` · `buscar-en-documentacion.tool.ts` + registro en `inicializar.ts` · `tieneDocumentacion` en
`resolverHerramientasAgente` y sus dos llamadores · reescritura de `capas/conocimiento.ts` ·
`proveedorIAId` opcional en `logger.ts` · tests de `busqueda.ts`, del tool y de la capa.

**Checkpoint**: escenarios 4, 6, 9 y 10 del quickstart pasan.

### Fase 3 (US3, P3) — Salvaguardas y limpieza

Reintento de indexación · listado legacy "Requiere resubir" · banner de feature no habilitada · script de
conciliación de huérfanos · eliminación de `conocimiento/{destilado,tipos,actions}.ts` y
`editor-documentos-faq.tsx` · variables de entorno en `README.md` y `env.test.example`.

**Checkpoint**: escenario 8 del quickstart pasa; no queda código muerto del mecanismo anterior.

---

## Complexity Tracking

*No aplica — el Constitution Check pasa sin violaciones ni excepciones que justificar.*
